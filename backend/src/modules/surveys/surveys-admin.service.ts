import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EventKind,
  EventRegistrationStatus,
  EventStatus,
  Prisma,
  Role,
  SurveyStatus,
} from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { randomCode } from '../advisor/share-code';
import { phoneLookupVariants } from '../mobile/member-phone';
import { StaffService, type Actor } from '../staff/staff.service';
import { cleanToken, DIRECT_SOURCE, LINK_PRESETS } from './attribution';
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_TIMES,
  normalizeSettings,
  OTHER,
  parseQuestions,
  tagged,
  validateQuestions,
  type Answers,
  type SurveyQuestion,
} from './survey-schema';
import { findTemplate, SURVEY_TEMPLATES } from './templates';
import type {
  CreateLearningSessionDto,
  CreateSurveyDto,
  CreateSurveyLinkDto,
  SurveyFiltersDto,
  UpdateSurveyDto,
} from './dtos/survey.dto';

export type RespondentType = 'MEMBER' | 'NEW_MEMBER' | 'KNOWN' | 'ANONYMOUS';

const TYPE_LABEL: Record<RespondentType, string> = {
  MEMBER: 'Client',
  NEW_MEMBER: 'Nouveau client',
  KNOWN: 'Connu',
  ANONYMOUS: 'Anonyme',
};
const ROLE_LABEL: Record<string, string> = {
  LEARN: 'Apprendre',
  SHARE: 'Partager',
  BOTH: 'Les deux',
};

const PLATFORM_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

type ResponseRow = Prisma.SurveyResponseGetPayload<{
  include: {
    member: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        phone: true;
        createdAt: true;
      };
    };
    link: { select: { id: true; label: true; code: true } };
  };
}>;

/**
 * Who answered, judged only from reliable facts:
 * linked client who existed before answering / became a client after / left a number / nothing.
 */
export function respondentType(r: {
  memberId: string | null;
  contactPhone: string | null;
  createdAt: Date;
  member?: { createdAt: Date } | null;
}): RespondentType {
  if (r.memberId && r.member)
    return r.member.createdAt < r.createdAt ? 'MEMBER' : 'NEW_MEMBER';
  if (r.contactPhone) return 'KNOWN';
  return 'ANONYMOUS';
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'sondage'
  );
}

/** Completion = responses ÷ people who started (capped: "keep all" lets one browser answer twice). */
export function completionRate(responses: number, started: number) {
  return started
    ? Math.min(100, Math.round((responses / started) * 100))
    : null;
}

export const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formulas typed by respondents
  // Signed numbers (+216…) stay as they are; anything else starting like a formula is neutralised
  const safe = /^(?:[=@\t\r]|[+-](?![\d\s]))/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

@Injectable()
export class SurveysAdminService {
  private readonly logger = new Logger(SurveysAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffService,
  ) {}

  /* ───────────── access ───────────── */

  /** Organization the admin works in (header / query), checked as org admin, and its main facility. */
  async scope(actor: Actor, orgHint?: string | null) {
    let organizationId = orgHint || null;
    if (!organizationId) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          role: true,
          organizationMemberships: {
            select: { organizationId: true },
            take: 1,
          },
        },
      });
      organizationId = user?.organizationMemberships[0]?.organizationId ?? null;
      if (!organizationId && user && PLATFORM_ROLES.includes(user.role)) {
        const first = await this.prisma.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        organizationId = first?.id ?? null;
      }
    }
    await this.staff.assertOrgAdmin(actor, organizationId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId! },
      select: {
        id: true,
        slug: true,
        facilities: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    const facilityId = org?.facilities[0]?.id;
    if (!org || !facilityId)
      throw new NotFoundException('Aucun espace pour cette organisation');
    return { organizationId: org.id, orgSlug: org.slug, facilityId };
  }

  /** A survey the admin may manage. */
  private async own(actor: Actor, id: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            organizationId: true,
            organization: { select: { slug: true } },
          },
        },
      },
    });
    if (!survey) throw new NotFoundException('Sondage introuvable');
    await this.staff.assertOrgAdmin(actor, survey.facility.organizationId);
    return survey;
  }

  /* ───────────── surveys ───────────── */

  templates() {
    return SURVEY_TEMPLATES.map((t) => ({
      code: t.code,
      name: t.name,
      title: t.title,
      questions: t.questions.length,
    }));
  }

  async list(actor: Actor, orgHint?: string | null) {
    const { facilityId, orgSlug } = await this.scope(actor, orgHint);
    const surveys = await this.prisma.survey.findMany({
      where: { facilityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        closesAt: true,
        publishedAt: true,
        createdAt: true,
        _count: { select: { visits: true } },
      },
    });
    const counts = await this.prisma.surveyResponse.groupBy({
      by: ['surveyId'],
      where: {
        surveyId: { in: surveys.map((s) => s.id) },
        flagged: false,
        supersededAt: null,
      },
      _count: { _all: true },
    });
    const byId = new Map(counts.map((c) => [c.surveyId, c._count._all]));
    const startedCounts = await this.prisma.surveyVisit.groupBy({
      by: ['surveyId'],
      where: {
        surveyId: { in: surveys.map((s) => s.id) },
        startedAt: { not: null },
      },
      _count: { _all: true },
    });
    const startedById = new Map(
      startedCounts.map((c) => [c.surveyId, c._count._all]),
    );
    return {
      orgSlug,
      surveys: surveys.map(({ _count, ...s }) => {
        const responses = byId.get(s.id) ?? 0;
        const started = startedById.get(s.id) ?? 0;
        return {
          ...s,
          visitors: _count.visits,
          started,
          responses,
          completionRate: completionRate(responses, started),
        };
      }),
    };
  }

  private async freeSlug(
    facilityId: string,
    wanted: string,
    exceptId?: string,
  ) {
    const base = slugify(wanted);
    for (let n = 1; n < 50; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const taken = await this.prisma.survey.findUnique({
        where: { facilityId_slug: { facilityId, slug } },
        select: { id: true },
      });
      if (!taken || taken.id === exceptId) return slug;
    }
    throw new ConflictException('Adresse déjà utilisée');
  }

  async create(
    actor: Actor,
    orgHint: string | null | undefined,
    dto: CreateSurveyDto,
  ) {
    const { facilityId } = await this.scope(actor, orgHint);
    if (dto.duplicateOf) {
      const src = await this.own(actor, dto.duplicateOf);
      if (src.facilityId !== facilityId)
        throw new BadRequestException('Sondage d’une autre organisation');
      const title = dto.title?.trim() || `${src.title} (copie)`;
      return this.prisma.survey.create({
        data: {
          facilityId,
          slug: await this.freeSlug(facilityId, `${src.slug}-copie`),
          title,
          intro: src.intro,
          description: src.description,
          purpose: src.purpose,
          audience: src.audience,
          questions: src.questions as Prisma.InputJsonValue,
          settings: src.settings as Prisma.InputJsonValue,
          templateCode: src.templateCode,
        },
      });
    }
    const t = findTemplate(dto.templateCode);
    if (dto.templateCode && !t) throw new BadRequestException('Modèle inconnu');
    const title = dto.title?.trim() || t?.title || 'Nouveau sondage';
    return this.prisma.survey.create({
      data: {
        facilityId,
        slug: await this.freeSlug(facilityId, t?.slug || title),
        title,
        intro: t?.intro ?? null,
        description: t?.description ?? null,
        purpose: t?.purpose ?? null,
        audience: t?.audience ?? null,
        questions: (t?.questions ?? []) as unknown as Prisma.InputJsonValue,
        settings: (t?.settings ??
          normalizeSettings({})) as unknown as Prisma.InputJsonValue,
        templateCode: t?.code ?? null,
      },
    });
  }

  async get(actor: Actor, id: string) {
    const s = await this.own(actor, id);
    const links = await this.surveyLinks(id);
    const { facility, ...rest } = s;
    return {
      ...rest,
      orgSlug: facility.organization?.slug ?? null,
      questions: parseQuestions(s.questions),
      settings: normalizeSettings(s.settings),
      links,
    };
  }

  async update(actor: Actor, id: string, dto: UpdateSurveyDto) {
    const s = await this.own(actor, id);
    const data: Prisma.SurveyUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    for (const k of ['intro', 'description', 'purpose', 'audience'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k]?.trim() || null;
    }
    if (dto.closesAt !== undefined)
      data.closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    if (dto.slug !== undefined && dto.slug !== s.slug) {
      const taken = await this.prisma.survey.findUnique({
        where: {
          facilityId_slug: { facilityId: s.facilityId, slug: dto.slug },
        },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Cette adresse est déjà utilisée');
      data.slug = dto.slug;
    }
    const settings = normalizeSettings(
      dto.settings
        ? { ...normalizeSettings(s.settings), ...dto.settings }
        : s.settings,
    );
    if (dto.settings)
      data.settings = settings as unknown as Prisma.InputJsonValue;
    if (dto.questions !== undefined || dto.settings) {
      const checked = validateQuestions(
        dto.questions ?? parseQuestions(s.questions),
        settings.sections.map((x) => x.id),
      );
      if (checked.ok === false) throw new BadRequestException(checked.error);
      data.questions = checked.questions as unknown as Prisma.InputJsonValue;
    }
    await this.prisma.survey.update({ where: { id }, data });
    return this.get(actor, id);
  }

  async setStatus(actor: Actor, id: string, status: SurveyStatus) {
    const s = await this.own(actor, id);
    if (
      status === SurveyStatus.PUBLISHED &&
      !parseQuestions(s.questions).length
    ) {
      throw new BadRequestException(
        'Ajoutez au moins une question avant de publier',
      );
    }
    await this.prisma.survey.update({
      where: { id },
      data: {
        status,
        ...(status === SurveyStatus.PUBLISHED &&
          !s.publishedAt && { publishedAt: new Date() }),
      },
    });
    return this.get(actor, id);
  }

  /** Only an untouched draft can be deleted; anything with answers is closed instead. */
  async remove(actor: Actor, id: string) {
    const s = await this.own(actor, id);
    const answers = await this.prisma.surveyResponse.count({
      where: { surveyId: id },
    });
    if (s.status !== SurveyStatus.DRAFT || answers) {
      throw new BadRequestException(
        'Ce sondage a déjà été publié : fermez-le plutôt que de le supprimer',
      );
    }
    await this.prisma.$transaction([
      this.prisma.shareLink.deleteMany({
        where: { kind: 'SURVEY', targetId: id },
      }),
      this.prisma.survey.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /* ───────────── links ───────────── */

  private async surveyLinks(surveyId: string) {
    const links = await this.prisma.shareLink.findMany({
      where: { kind: 'SURVEY', targetId: surveyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        channel: true,
        label: true,
        source: true,
        medium: true,
        campaign: true,
        content: true,
        opens: true,
        createdAt: true,
        _count: { select: { surveyVisits: true } },
      },
    });
    const answered = await this.prisma.surveyResponse.groupBy({
      by: ['linkId'],
      where: {
        surveyId,
        linkId: { in: links.map((l) => l.id) },
        flagged: false,
        supersededAt: null,
      },
      _count: { _all: true },
    });
    const byLink = new Map(answered.map((a) => [a.linkId, a._count._all]));
    return links.map(({ _count, ...l }) => ({
      ...l,
      visitors: _count.surveyVisits,
      responses: byLink.get(l.id) ?? 0,
    }));
  }

  async createLink(actor: Actor, id: string, dto: CreateSurveyLinkDto) {
    const s = await this.own(actor, id);
    const preset = LINK_PRESETS[dto.preset];
    const year = new Date().getFullYear();
    const campaign =
      cleanToken(dto.campaign, 80) || `${s.slug.replace(/-/g, '_')}_${year}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const created = await this.prisma.shareLink
        .create({
          data: {
            code: randomCode(),
            facilityId: s.facilityId,
            kind: 'SURVEY',
            targetId: s.id,
            channel: preset.channel,
            label: dto.label?.trim() || preset.label,
            source: preset.source,
            medium: preset.medium,
            campaign,
            content: cleanToken(dto.content, 80),
          },
        })
        .catch((e) => {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          )
            return null;
          throw e;
        });
      if (created) return this.surveyLinks(id);
    }
    throw new ConflictException('Réessayez');
  }

  /** Answers keep their own copy of the source, so deleting a link loses no attribution. */
  async deleteLink(actor: Actor, id: string, linkId: string) {
    await this.own(actor, id);
    const link = await this.prisma.shareLink.findUnique({
      where: { id: linkId },
      select: { kind: true, targetId: true },
    });
    if (!link || link.kind !== 'SURVEY' || link.targetId !== id)
      throw new NotFoundException('Lien introuvable');
    await this.prisma.shareLink.delete({ where: { id: linkId } });
    return this.surveyLinks(id);
  }

  /* ───────────── responses ───────────── */

  private responseWhere(
    surveyId: string,
    f: SurveyFiltersDto,
  ): Prisma.SurveyResponseWhereInput {
    const to = f.to ? new Date(f.to) : null;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(f.to!)) to.setHours(23, 59, 59, 999);
    return {
      surveyId,
      ...(f.all !== '1' && { flagged: false, supersededAt: null }),
      ...(f.linkId && { linkId: f.linkId }),
      ...(f.source && { source: f.source }),
      ...(f.role && { role: f.role }),
      ...((f.from || to) && {
        createdAt: {
          ...(f.from && { gte: new Date(f.from) }),
          ...(to && { lte: to }),
        },
      }),
    };
  }

  private async loadResponses(
    surveyId: string,
    f: SurveyFiltersDto,
  ): Promise<ResponseRow[]> {
    const rows = await this.prisma.surveyResponse.findMany({
      where: this.responseWhere(surveyId, f),
      orderBy: { createdAt: 'desc' },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
          },
        },
        link: { select: { id: true, label: true, code: true } },
      },
    });
    return f.type ? rows.filter((r) => respondentType(r) === f.type) : rows;
  }

  async responses(actor: Actor, id: string, f: SurveyFiltersDto) {
    await this.own(actor, id);
    const rows = await this.loadResponses(id, f);
    const pageSize = f.pageSize ?? 50;
    const page = f.page ?? 1;
    return {
      total: rows.length,
      page,
      pageSize,
      rows: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        type: respondentType(r),
        role: r.role,
        subjects: r.subjects,
        answers: r.answers,
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        content: r.content,
        method: r.method,
        link: r.link,
        contactName: r.contactName,
        contactPhone: r.contactPhone,
        contactConsentAt: r.contactConsentAt,
        member: r.member
          ? {
              id: r.member.id,
              firstName: r.member.firstName,
              lastName: r.member.lastName,
              phone: r.member.phone,
            }
          : null,
        memberLinkMethod: r.memberLinkMethod,
        flagged: r.flagged,
        supersededAt: r.supersededAt,
      })),
    };
  }

  async exportCsv(actor: Actor, id: string, f: SurveyFiltersDto) {
    const s = await this.own(actor, id);
    const questions = parseQuestions(s.questions);
    const rows = await this.loadResponses(id, { ...f, all: f.all ?? '1' });
    const label = (q: SurveyQuestion, v: string) =>
      q.options?.find((o) => o.value === v)?.label ?? v;
    const slot = (v: string) => {
      const [d, t] = v.split(':');
      return `${AVAILABILITY_DAYS.find((x) => x.value === d)?.label ?? d} ${
        AVAILABILITY_TIMES.find((x) => x.value === t)?.label ?? t
      }`;
    };
    const header = [
      'Date',
      'Statut',
      'Type',
      'Rôle',
      'Source',
      'Medium',
      'Campagne',
      'Contenu',
      'Lien',
      'Méthode',
      'Prénom',
      'WhatsApp',
      'Accord contact',
      'Client lié',
      ...questions.map((q) => q.label),
    ];
    const lines = rows.map((r) => {
      const a = (r.answers || {}) as Answers;
      return [
        r.createdAt.toISOString(),
        r.flagged ? 'suspect' : r.supersededAt ? 'remplacée' : 'valide',
        TYPE_LABEL[respondentType(r)],
        r.role ? ROLE_LABEL[r.role] ?? r.role : '',
        r.source,
        r.medium ?? '',
        r.campaign ?? '',
        r.content ?? '',
        r.link?.label ?? '',
        r.method,
        r.contactName ?? '',
        r.contactPhone ?? '',
        r.contactConsentAt ? 'oui' : '',
        r.member
          ? `${r.member.firstName ?? ''} ${r.member.lastName ?? ''}`.trim() ||
            r.member.id
          : '',
        ...questions.map((q) => {
          const v = a[q.id];
          const list = Array.isArray(v) ? v : v ? [v] : [];
          const shown = list.map((x) =>
            q.type === 'availability' ? slot(x) : label(q, x),
          );
          const other = a[`${q.id}__other`];
          if (other) shown.push(`Autre : ${other}`);
          return shown.join(' | ');
        }),
      ]
        .map(csvCell)
        .join(';');
    });
    // BOM + ";" so Excel (French locale) opens it directly
    return {
      filename: `${s.slug}-reponses.csv`,
      body: '﻿' + [header.map(csvCell).join(';'), ...lines].join('\r\n'),
    };
  }

  /* ───────────── people ───────────── */

  /** Clients with exactly the same phone number. Never matched on IP, name or browser. */
  async memberSuggestions(actor: Actor, id: string, responseId: string) {
    const s = await this.own(actor, id);
    const r = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, surveyId: id },
    });
    if (!r) throw new NotFoundException('Réponse introuvable');
    if (!r.contactPhone || !s.facility.organizationId) return [];
    return this.prisma.member.findMany({
      where: {
        organizationId: s.facility.organizationId,
        deletedAt: null,
        phone: { in: phoneLookupVariants(r.contactPhone) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        visitorNumber: true,
        createdAt: true,
      },
      take: 5,
    });
  }

  async linkMember(
    actor: Actor,
    id: string,
    responseId: string,
    memberId: string,
  ) {
    const s = await this.own(actor, id);
    const [r, m] = await Promise.all([
      this.prisma.surveyResponse.findFirst({
        where: { id: responseId, surveyId: id },
        select: { id: true },
      }),
      this.prisma.member.findFirst({
        where: {
          id: memberId,
          organizationId: s.facility.organizationId ?? undefined,
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!r) throw new NotFoundException('Réponse introuvable');
    if (!m) throw new NotFoundException('Client introuvable');
    // Attribution columns are left untouched: the original source stays
    await this.prisma.surveyResponse.update({
      where: { id: responseId },
      data: {
        memberId,
        memberLinkMethod: 'STAFF',
        memberLinkedAt: new Date(),
        memberLinkedBy: actor.userId,
      },
    });
    return { ok: true };
  }

  async unlinkMember(actor: Actor, id: string, responseId: string) {
    await this.own(actor, id);
    const r = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, surveyId: id },
      select: { id: true },
    });
    if (!r) throw new NotFoundException('Réponse introuvable');
    await this.prisma.surveyResponse.update({
      where: { id: responseId },
      data: {
        memberId: null,
        memberLinkMethod: null,
        memberLinkedAt: null,
        memberLinkedBy: null,
      },
    });
    return { ok: true };
  }

  /* ───────────── dashboard ───────────── */

  async dashboard(actor: Actor, id: string, f: SurveyFiltersDto) {
    const s = await this.own(actor, id);
    const questions = parseQuestions(s.questions);
    const rows = await this.loadResponses(id, { ...f, all: '0' });
    const links = await this.surveyLinks(id);

    const to = f.to ? new Date(f.to) : null;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(f.to!)) to.setHours(23, 59, 59, 999);
    const visitWhere: Prisma.SurveyVisitWhereInput = {
      surveyId: id,
      ...(f.linkId && { linkId: f.linkId }),
      ...(f.source && { source: f.source }),
      ...((f.from || to) && {
        firstSeenAt: {
          ...(f.from && { gte: new Date(f.from) }),
          ...(to && { lte: to }),
        },
      }),
    };
    const [visitors, started, visitGroups, startedGroups] = await Promise.all([
      this.prisma.surveyVisit.count({ where: visitWhere }),
      this.prisma.surveyVisit.count({
        where: { ...visitWhere, startedAt: { not: null } },
      }),
      this.prisma.surveyVisit.groupBy({
        by: ['source', 'medium'],
        where: visitWhere,
        _count: { _all: true },
      }),
      this.prisma.surveyVisit.groupBy({
        by: ['source', 'medium'],
        where: { ...visitWhere, startedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const clicks = links
      .filter((l) => !f.linkId || l.id === f.linkId)
      .filter((l) => !f.source || l.source === f.source)
      .reduce((a, l) => a + l.opens, 0);

    // Count answers per option of a tagged question
    const countTag = (tag: Parameters<typeof tagged>[2]) => {
      const q = questions.find((x) => x.tag === tag);
      const counts = new Map<string, number>();
      for (const r of rows)
        for (const v of tagged(questions, (r.answers || {}) as Answers, tag))
          counts.set(v, (counts.get(v) ?? 0) + 1);
      return (q?.options ?? []).map((o) => ({
        value: o.value,
        label: o.label,
        count: counts.get(o.value) ?? 0,
      }));
    };

    const learnQ = questions.find((q) => q.tag === 'learnSubjects');
    const teachQ = questions.find((q) => q.tag === 'teachSubjects');
    const subjectOptions = new Map<string, string>();
    for (const o of [...(learnQ?.options ?? []), ...(teachQ?.options ?? [])])
      if (!subjectOptions.has(o.value)) subjectOptions.set(o.value, o.label);
    const subjects = [...subjectOptions].map(([value, label]) => {
      const learners = rows.filter((r) =>
        tagged(
          questions,
          (r.answers || {}) as Answers,
          'learnSubjects',
        ).includes(value),
      );
      const volunteers = rows.filter((r) =>
        tagged(
          questions,
          (r.answers || {}) as Answers,
          'teachSubjects',
        ).includes(value),
      );
      return {
        value,
        label,
        learners: learners.length,
        committed: learners.filter((r) =>
          tagged(questions, (r.answers || {}) as Answers, 'attend').includes(
            'yes',
          ),
        ).length,
        volunteers: volunteers.length,
        others:
          value === OTHER
            ? [
                ...new Set(
                  rows
                    .flatMap((r) => [
                      (r.answers as Answers)?.[`${learnQ?.id}__other`],
                      (r.answers as Answers)?.[`${teachQ?.id}__other`],
                    ])
                    .filter((x): x is string => typeof x === 'string' && !!x),
                ),
              ].slice(0, 30)
            : undefined,
      };
    });
    subjects.sort(
      (a, b) => b.learners - a.learners || b.volunteers - a.volunteers,
    );

    const roles = { LEARN: 0, SHARE: 0, BOTH: 0 };
    for (const r of rows)
      if (r.role && r.role in roles) roles[r.role as keyof typeof roles]++;

    const types: Record<RespondentType, number> = {
      MEMBER: 0,
      NEW_MEMBER: 0,
      KNOWN: 0,
      ANONYMOUS: 0,
    };
    for (const r of rows) types[respondentType(r)]++;

    // Volunteer availability grid (day × time)
    const slots = new Map<string, number>();
    for (const r of rows)
      for (const v of tagged(
        questions,
        (r.answers || {}) as Answers,
        'teachSlots',
      ))
        slots.set(v, (slots.get(v) ?? 0) + 1);

    const conversions = await this.conversions(id, rows);

    // Campaign table: one row per source + medium
    const campaigns = new Map<
      string,
      {
        source: string;
        medium: string | null;
        visitors: number;
        started: number;
        responses: number;
        completionRate: number | null;
        linked: number;
        registered: number;
        attended: number;
        paidVisits: number;
      }
    >();
    const row = (source: string, medium: string | null) => {
      const k = `${source}|${medium ?? ''}`;
      if (!campaigns.has(k))
        campaigns.set(k, {
          source,
          medium,
          visitors: 0,
          started: 0,
          responses: 0,
          completionRate: null,
          linked: 0,
          registered: 0,
          attended: 0,
          paidVisits: 0,
        });
      return campaigns.get(k)!;
    };
    for (const g of visitGroups)
      row(g.source, g.medium).visitors += g._count._all;
    for (const g of startedGroups)
      row(g.source, g.medium).started += g._count._all;
    for (const r of rows) {
      const c = row(r.source, r.medium);
      c.responses++;
      if (r.memberId) {
        c.linked++;
        const m = conversions.byMember.get(r.memberId);
        if (m) {
          c.registered += m.registered ? 1 : 0;
          c.attended += m.attended ? 1 : 0;
          c.paidVisits += m.paidVisits;
        }
      }
    }

    return {
      kpis: {
        clicks,
        visitors,
        started,
        responses: rows.length,
        completionRate: completionRate(rows.length, started),
        flagged: await this.prisma.surveyResponse.count({
          where: { surveyId: id, flagged: true },
        }),
      },
      roles,
      types,
      subjects,
      days: countTag('days'),
      times: countTag('times'),
      attend: countTag('attend'),
      levels: countTag('level'),
      formats: countTag('format'),
      host: countTag('host'),
      volunteerSlots: AVAILABILITY_DAYS.map((d) => ({
        day: d.value,
        label: d.label,
        times: AVAILABILITY_TIMES.map((t) => ({
          time: t.value,
          label: t.label,
          count: slots.get(`${d.value}:${t.value}`) ?? 0,
        })),
      })),
      campaigns: [...campaigns.values()]
        .map((c) => ({
          ...c,
          completionRate: completionRate(c.responses, c.started),
        }))
        .sort(
        (a, b) => b.responses - a.responses || b.visitors - a.visitors,
      ),
      funnel: conversions.funnel,
      directSource: DIRECT_SOURCE,
    };
  }

  /**
   * What linked respondents did afterwards. Only responses tied to a client count;
   * nothing is inferred for anonymous people.
   */
  private async conversions(surveyId: string, rows: ResponseRow[]) {
    const firstAnswer = new Map<string, Date>();
    for (const r of rows) {
      if (!r.memberId) continue;
      const prev = firstAnswer.get(r.memberId);
      if (!prev || r.createdAt < prev) firstAnswer.set(r.memberId, r.createdAt);
    }
    const memberIds = [...firstAnswer.keys()];
    const byMember = new Map<
      string,
      {
        registered: boolean;
        attended: boolean;
        visits: number;
        paidVisits: number;
        subscriptions: number;
      }
    >();
    if (memberIds.length) {
      const earliest = new Date(
        Math.min(...[...firstAnswer.values()].map((d) => d.getTime())),
      );
      const [regs, visits, subs] = await Promise.all([
        this.prisma.eventRegistration.findMany({
          where: {
            memberId: { in: memberIds },
            event: { surveyId },
            status: { not: EventRegistrationStatus.CANCELLED },
          },
          select: { memberId: true, status: true, checkedInAt: true },
        }),
        this.prisma.journal.findMany({
          where: {
            memberID: { in: memberIds },
            registredTime: { gte: earliest },
            hiddenAt: null,
          },
          select: { memberID: true, registredTime: true, isPayed: true },
        }),
        this.prisma.abonnement.findMany({
          where: {
            memberID: { in: memberIds },
            registredDate: { gte: earliest },
          },
          select: { memberID: true, registredDate: true },
        }),
      ]);
      for (const id of memberIds)
        byMember.set(id, {
          registered: false,
          attended: false,
          visits: 0,
          paidVisits: 0,
          subscriptions: 0,
        });
      for (const r of regs) {
        const m = byMember.get(r.memberId)!;
        m.registered = true;
        if (r.checkedInAt || r.status === EventRegistrationStatus.ATTENDED)
          m.attended = true;
      }
      for (const v of visits) {
        if (!v.memberID || v.registredTime < firstAnswer.get(v.memberID)!)
          continue;
        const m = byMember.get(v.memberID)!;
        m.visits++;
        if (v.isPayed) m.paidVisits++;
      }
      for (const a of subs) {
        if (a.registredDate < firstAnswer.get(a.memberID)!) continue;
        byMember.get(a.memberID)!.subscriptions++;
      }
    }
    const all = [...byMember.values()];
    return {
      byMember,
      funnel: {
        responses: rows.length,
        linked: memberIds.length,
        registered: all.filter((m) => m.registered).length,
        attended: all.filter((m) => m.attended).length,
        visited: all.filter((m) => m.visits > 0).length,
        paid: all.filter((m) => m.paidVisits > 0).length,
        subscribed: all.filter((m) => m.subscriptions > 0).length,
      },
    };
  }

  /** Volunteers for a subject, with what they can give and when. */
  async volunteers(actor: Actor, id: string, subject?: string) {
    const s = await this.own(actor, id);
    const questions = parseQuestions(s.questions);
    const rows = await this.loadResponses(id, { role: undefined });
    return rows
      .filter((r) => r.role === 'SHARE' || r.role === 'BOTH')
      .map((r) => {
        const a = (r.answers || {}) as Answers;
        const teachQ = questions.find((q) => q.tag === 'teachSubjects');
        return {
          responseId: r.id,
          createdAt: r.createdAt,
          name: r.member
            ? `${r.member.firstName ?? ''} ${r.member.lastName ?? ''}`.trim()
            : r.contactName,
          phone: r.member?.phone ?? r.contactPhone,
          memberId: r.memberId,
          subjects: tagged(questions, a, 'teachSubjects'),
          otherSubject: teachQ
            ? (a[`${teachQ.id}__other`] as string | undefined) ?? null
            : null,
          experience: (a['teach_experience'] as string | undefined) ?? null,
          time: tagged(questions, a, 'teachTime')[0] ?? null,
          slots: tagged(questions, a, 'teachSlots'),
          host: tagged(questions, a, 'host')[0] ?? null,
        };
      })
      .filter((v) => !subject || v.subjects.includes(subject));
  }

  /* ───────────── learning sessions (Events) ───────────── */

  async sessions(actor: Actor, id: string) {
    await this.own(actor, id);
    const events = await this.prisma.event.findMany({
      where: { surveyId: id },
      orderBy: { startAt: 'desc' },
      include: {
        registrations: { select: { status: true, checkedInAt: true } },
      },
    });
    const hostIds = events
      .map((e) => e.hostMemberId)
      .filter((x): x is string => !!x);
    const hosts = hostIds.length
      ? await this.prisma.member.findMany({
          where: { id: { in: hostIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const hostResponses = events
      .map((e) => e.hostResponseId)
      .filter((x): x is string => !!x);
    const hostContacts = hostResponses.length
      ? await this.prisma.surveyResponse.findMany({
          where: { id: { in: hostResponses } },
          select: { id: true, contactName: true },
        })
      : [];
    return events.map(({ registrations, ...e }) => {
      const h = hosts.find((m) => m.id === e.hostMemberId);
      return {
        ...e,
        hostName: h
          ? `${h.firstName ?? ''} ${h.lastName ?? ''}`.trim()
          : hostContacts.find((c) => c.id === e.hostResponseId)?.contactName ??
            null,
        registered: registrations.filter(
          (r) => r.status !== EventRegistrationStatus.CANCELLED,
        ).length,
        attended: registrations.filter(
          (r) => r.checkedInAt || r.status === EventRegistrationStatus.ATTENDED,
        ).length,
      };
    });
  }

  async createSession(actor: Actor, id: string, dto: CreateLearningSessionDto) {
    const s = await this.own(actor, id);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt)
      throw new BadRequestException('La fin doit être après le début');
    let hostMemberId: string | null = null;
    if (dto.hostResponseId) {
      const host = await this.prisma.surveyResponse.findFirst({
        where: { id: dto.hostResponseId, surveyId: id },
        select: { memberId: true },
      });
      if (!host) throw new NotFoundException('Volontaire introuvable');
      hostMemberId = host.memberId;
    }
    const event = await this.prisma.event.create({
      data: {
        facilityId: s.facilityId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind: EventKind.LEARNING,
        location: dto.location?.trim() || null,
        startAt,
        endAt,
        capacity: dto.capacity ?? null,
        price: null,
        status:
          dto.status === 'DRAFT' ? EventStatus.DRAFT : EventStatus.PUBLISHED,
        surveyId: id,
        subject: dto.subject?.trim() || null,
        hostMemberId,
        hostResponseId: dto.hostResponseId ?? null,
      },
    });
    this.logger.log(`Survey ${id}: learning session ${event.id} created`);
    return event;
  }

  async setReward(
    actor: Actor,
    id: string,
    eventId: string,
    given: boolean,
    note?: string,
  ) {
    await this.own(actor, id);
    const ev = await this.prisma.event.findFirst({
      where: { id: eventId, surveyId: id },
      select: { id: true },
    });
    if (!ev) throw new NotFoundException('Séance introuvable');
    return this.prisma.event.update({
      where: { id: eventId },
      data: given
        ? { rewardGivenAt: new Date(), rewardNote: note?.trim() || null }
        : { rewardGivenAt: null, rewardNote: note?.trim() || null },
      select: { id: true, rewardGivenAt: true, rewardNote: true },
    });
  }
}
