import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, SurveyStatus } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { parseTunisiaPhoneOrNull } from '../mobile/member-phone';
import {
  attributionFromVisit,
  resolveAttribution,
  type Attribution,
  type AttributionMethod,
  type TrackedLink,
  type UtmParams,
} from './attribution';
import { SlidingWindowLimiter } from './rate-limit';
import {
  deriveRole,
  deriveSubjects,
  normalizeSettings,
  parseQuestions,
  validateAnswers,
} from './survey-schema';
import type { SubmitSurveyDto, SurveyVisitDto } from './dtos/survey.dto';

/** Faster than this, a person cannot have read the questions: kept but flagged. */
export const MIN_FILL_MS = 3000;

type LoadedSurvey = Prisma.SurveyGetPayload<{
  include: { facility: { select: { organizationId: true } } };
}>;

@Injectable()
export class SurveysPublicService {
  private readonly logger = new Logger(SurveysPublicService.name);
  private readonly submitLimiter = new SlidingWindowLimiter(40, 10 * 60_000);
  private readonly visitLimiter = new SlidingWindowLimiter(200, 10 * 60_000);

  constructor(private readonly prisma: PrismaService) {}

  /** Published (or paused/closed) survey of an organization; drafts do not exist publicly. */
  private async load(
    orgSlug: string,
    slug: string,
  ): Promise<LoadedSurvey & { open: boolean }> {
    const survey = await this.prisma.survey.findFirst({
      where: {
        slug,
        status: { not: SurveyStatus.DRAFT },
        facility: { organization: { slug: orgSlug, isActive: true } },
      },
      include: { facility: { select: { organizationId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!survey) throw new NotFoundException('Sondage introuvable');
    const open =
      survey.status === SurveyStatus.PUBLISHED &&
      (!survey.closesAt || survey.closesAt.getTime() > Date.now());
    return { ...survey, open };
  }

  /** What the public page needs: questions and wording only, never any answer. */
  async get(orgSlug: string, slug: string) {
    const s = await this.load(orgSlug, slug);
    const settings = normalizeSettings(s.settings);
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      intro: s.intro,
      description: s.description,
      open: s.open,
      closesAt: s.closesAt,
      questions: s.open ? parseQuestions(s.questions) : [],
      settings: {
        sections: settings.sections,
        contactMode: settings.contactMode,
        contactText: settings.contactText,
        successMessage: settings.successMessage,
        requireLogin: settings.requireLogin,
      },
    };
  }

  /** A tracked code only counts if it is a survey link of this very survey. */
  private async trackedLink(
    surveyId: string,
    code?: string,
  ): Promise<TrackedLink | null> {
    const c = (code || '').trim().toLowerCase();
    if (!c || !/^[a-z0-9]{4,32}$/.test(c)) return null;
    const link = await this.prisma.shareLink.findUnique({
      where: { code: c },
      select: {
        id: true,
        kind: true,
        targetId: true,
        channel: true,
        source: true,
        medium: true,
        campaign: true,
        content: true,
        term: true,
      },
    });
    if (!link || link.kind !== 'SURVEY' || link.targetId !== surveyId)
      return null;
    return link;
  }

  private visitAttribution(v: {
    linkId: string | null;
    source: string;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
    method: string;
    firstSeenAt: Date;
  }) {
    return { ...v, method: v.method as AttributionMethod };
  }

  /**
   * Resolve and store this browser's attribution (first touch within the window).
   * Runs on page open and again on submit, so a lost /visit call still attributes the answer.
   */
  private async touchVisit(
    survey: LoadedSurvey,
    visitorKey: string,
    params: SurveyVisitDto,
    extra: { startedAt?: Date; submittedAt?: Date } = {},
  ): Promise<{
    visitId: string;
    attribution: Attribution;
    link: TrackedLink | null;
  }> {
    const settings = normalizeSettings(survey.settings);
    const link = await this.trackedLink(survey.id, params.c);
    const incoming = attributionFromVisit(link, params as UtmParams);
    const now = new Date();
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await this.prisma.surveyVisit.findUnique({
        where: { surveyId_visitorKey: { surveyId: survey.id, visitorKey } },
      });
      const { attribution, replaced } = resolveAttribution(
        incoming,
        existing ? this.visitAttribution(existing) : null,
        settings.attributionDays,
        now,
      );
      const fields = {
        linkId: attribution.linkId,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content,
        term: attribution.term,
        method: attribution.method,
      };
      try {
        const visit = existing
          ? await this.prisma.surveyVisit.update({
              where: { id: existing.id },
              data: {
                lastSeenAt: now,
                ...(replaced && { ...fields, firstSeenAt: now }),
                ...(extra.startedAt &&
                  !existing.startedAt && { startedAt: extra.startedAt }),
                ...(extra.submittedAt && { submittedAt: extra.submittedAt }),
              },
            })
          : await this.prisma.surveyVisit.create({
              data: { surveyId: survey.id, visitorKey, ...fields, ...extra },
            });
        return { visitId: visit.id, attribution, link };
      } catch (e) {
        // Two tabs created the row at the same time: read it back once
        if (
          attempt === 0 &&
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
          continue;
        throw e;
      }
    }
    throw new ConflictException('Réessayez');
  }

  async visit(orgSlug: string, slug: string, dto: SurveyVisitDto, ip: string) {
    const survey = await this.load(orgSlug, slug);
    if (!survey.open) return { open: false };
    if (!this.visitLimiter.take(ip)) return { open: true, counted: false };
    const { attribution, link } = await this.touchVisit(
      survey,
      dto.visitorKey,
      dto,
    );
    if (link && dto.firstOpen) {
      await this.prisma.shareLink.update({
        where: { id: link.id },
        data: { opens: { increment: 1 } },
      });
    }
    return {
      open: true,
      counted: true,
      source: attribution.source,
      medium: attribution.medium,
      method: attribution.method,
    };
  }

  async start(orgSlug: string, slug: string, visitorKey: string) {
    const survey = await this.load(orgSlug, slug);
    if (!survey.open) return { ok: false };
    const updated = await this.prisma.surveyVisit.updateMany({
      where: { surveyId: survey.id, visitorKey, startedAt: null },
      data: { startedAt: new Date() },
    });
    if (!updated.count) {
      // /visit never reached us (blocked request, old tab): record a direct visit now
      await this.touchVisit(
        survey,
        visitorKey,
        { visitorKey },
        { startedAt: new Date() },
      );
    }
    return { ok: true };
  }

  private async existingResponse(idempotencyKey: string, surveyId: string) {
    const prev = await this.prisma.surveyResponse.findUnique({
      where: { idempotencyKey },
      select: { id: true, surveyId: true },
    });
    if (prev && prev.surveyId !== surveyId)
      throw new ConflictException('Clé de réponse déjà utilisée');
    return prev;
  }

  async submit(
    orgSlug: string,
    slug: string,
    dto: SubmitSurveyDto,
    ip: string,
  ) {
    const survey = await this.load(orgSlug, slug);
    const settings = normalizeSettings(survey.settings);
    const done = (id: string, deduplicated: boolean) => ({
      id,
      deduplicated,
      successMessage: settings.successMessage,
    });

    // A retry (double tap, network drop) gets the answer it already created
    const prev = await this.existingResponse(dto.idempotencyKey, survey.id);
    if (prev) return done(prev.id, true);

    if (!survey.open) throw new BadRequestException('Ce sondage est fermé');
    if (!this.submitLimiter.take(ip)) {
      throw new HttpException(
        'Trop d’envois depuis ce réseau, réessayez dans quelques minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let memberId: string | null = null;
    if (dto.memberId) {
      const m = await this.prisma.member.findFirst({
        where: {
          id: dto.memberId,
          organizationId: survey.facility.organizationId ?? undefined,
          deletedAt: null,
        },
        select: { id: true },
      });
      memberId = m?.id ?? null;
    }
    if (settings.requireLogin && !memberId)
      throw new UnauthorizedException('Connectez-vous pour répondre');

    const questions = parseQuestions(survey.questions);
    const checked = validateAnswers(questions, dto.answers);
    if (checked.ok === false) {
      throw new BadRequestException({
        message: 'Certaines réponses manquent ou sont invalides',
        errors: checked.errors,
      });
    }

    // Contact: optional unless the survey requires it; a phone needs consent
    let contactName: string | null = null;
    let contactPhone: string | null = null;
    let contactConsentAt: Date | null = null;
    if (settings.contactMode !== 'NONE' && !memberId) {
      contactName = (dto.contact?.name || '').trim().slice(0, 80) || null;
      const rawPhone = (dto.contact?.phone || '').trim();
      if (rawPhone) {
        contactPhone = parseTunisiaPhoneOrNull(rawPhone);
        if (!contactPhone) {
          throw new BadRequestException({
            message: 'Numéro WhatsApp invalide',
            errors: [
              {
                questionId: 'contact.phone',
                message: 'Numéro tunisien attendu (8 chiffres)',
              },
            ],
          });
        }
        if (!dto.contact?.consent) {
          throw new BadRequestException({
            message: 'Cochez la case pour qu’on puisse vous écrire',
            errors: [
              {
                questionId: 'contact.consent',
                message: 'Accord requis pour garder votre numéro',
              },
            ],
          });
        }
        contactConsentAt = new Date();
      } else if (settings.contactMode === 'REQUIRED') {
        throw new BadRequestException({
          message: 'Indiquez votre WhatsApp',
          errors: [{ questionId: 'contact.phone', message: 'Réponse requise' }],
        });
      }
    }

    const flagged =
      !!(dto.hp && dto.hp.trim()) ||
      (dto.elapsedMs != null && dto.elapsedMs < MIN_FILL_MS);
    const now = new Date();
    // A finished survey was started too, even if the "start" call never arrived
    const { attribution } = await this.touchVisit(survey, dto.visitorKey, dto, {
      startedAt: now,
      submittedAt: now,
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const response = await tx.surveyResponse.create({
          data: {
            surveyId: survey.id,
            visitorKey: dto.visitorKey,
            idempotencyKey: dto.idempotencyKey,
            linkId: attribution.linkId,
            source: attribution.source,
            medium: attribution.medium,
            campaign: attribution.campaign,
            content: attribution.content,
            term: attribution.term,
            method: attribution.method,
            answers: checked.answers as Prisma.InputJsonValue,
            role: deriveRole(questions, checked.answers),
            subjects: deriveSubjects(questions, checked.answers),
            contactName,
            contactPhone,
            contactConsentAt,
            memberId,
            ...(memberId && {
              memberLinkMethod: 'SESSION',
              memberLinkedAt: now,
            }),
            flagged,
          },
          select: { id: true },
        });
        // Same browser answered again: keep the old answer, out of the results
        if (settings.duplicatePolicy === 'LATEST_PER_BROWSER' && !flagged) {
          await tx.surveyResponse.updateMany({
            where: {
              surveyId: survey.id,
              visitorKey: dto.visitorKey,
              supersededAt: null,
              flagged: false,
              id: { not: response.id },
            },
            data: { supersededAt: now },
          });
        }
        return response;
      });
      if (flagged)
        this.logger.warn(
          `Survey ${survey.id}: answer ${created.id} flagged (honeypot or too fast)`,
        );
      return done(created.id, false);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const again = await this.existingResponse(
          dto.idempotencyKey,
          survey.id,
        );
        if (again) return done(again.id, true);
      }
      this.logger.error(
        `Survey ${survey.id}: submit failed`,
        e instanceof Error ? e.stack : String(e),
      );
      throw e;
    }
  }
}
