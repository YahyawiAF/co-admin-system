import Anthropic from '@anthropic-ai/sdk';
import { randomCode } from './share-code';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { subMinutes } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { parseLocalDay } from '../../../common/parse-local-day';
import { CampaignService, type CampaignSegment } from '../analytics/campaign.service';
import { PerformanceService } from '../analytics/performance.service';
import {
  ADVICE_METRICS,
  ADVISOR_MODEL,
  AdvisorRefusalError,
  RECOMMENDATION_CATEGORIES,
  RESULT_SCHEMA,
  SYSTEM_PROMPT,
  chatPrompt,
  parseAdvisorResult,
  runAdvisor,
  userMessage,
} from './advisor-claude';
import { ContextService } from './context.service';
import { parseManualFunnel, parseSteps } from './funnel';
import { SnapshotService } from './snapshot.service';

const CREDIT_MESSAGE =
  "Crédit Anthropic épuisé : rechargez le compte (Plans & Billing), ou utilisez le copier-coller dans « Mon contexte ».";

/** A PENDING report older than this is considered lost (server restarted mid-run). */
const STALE_MINUTES = 15;

type InitiativeBody = {
  title?: string;
  description?: string | null;
  category?: string;
  startDate?: string;
  endDate?: string | null;
  sourceReportId?: string | null;
  recommendationTitle?: string | null;
  metric?: string | null;
  targetPct?: number | null;
  cost?: number | null;
  ownerVerdict?: string | null;
  notes?: Array<{ date?: string; text?: string }>;
  targetKind?: string;
  targetDays?: number[];
  targetFromHour?: number | null;
  targetToHour?: number | null;
  targetSegment?: string | null;
  linkedKind?: string | null;
  linkedId?: string | null;
  objective?: string | null;
  hypothesis?: string | null;
  channels?: string[];
  steps?: Array<{ text?: string; done?: boolean; doneAt?: string | null }>;
  manualFunnel?: Array<{ date?: string; channel?: string | null; reach?: number }>;
};

const TARGET_KINDS = ['ALL', 'SLOT', 'LIST'];
const LINKED_KINDS = ['PRICE', 'PRODUCT', 'PROMOTION', 'EVENT'];
const OBJECTIVES = ['TICKETS', 'SUBSCRIBERS', 'CAFE', 'QUIET_HOURS', 'OTHER'];
export const CHANNELS = ['INSTAGRAM_POST', 'INSTAGRAM_STORY', 'WHATSAPP', 'APP', 'PARTNER', 'WALK_IN'];

const VERDICTS = ['WORKING', 'MIXED', 'NOT_WORKING'];

/** Optional number from the form: empty → null, otherwise a finite number. */
function optionalNumber(v: unknown, label: string) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${label} invalide`);
  return Math.round(n * 10) / 10;
}

@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
    private readonly snapshots: SnapshotService,
    private readonly context: ContextService,
    private readonly campaigns: CampaignService,
  ) {}

  async dataCheck(facilityId?: string) {
    return this.snapshots.dataCheck(await this.facilityId(facilityId));
  }

  /** Target and linked sale; a client list is frozen at start so the measure doesn't drift. */
  private async targetData(facilityId: string, body: InitiativeBody) {
    const data: Prisma.BusinessInitiativeUncheckedUpdateInput = {};
    if (body.targetKind !== undefined) {
      if (!TARGET_KINDS.includes(body.targetKind)) throw new BadRequestException('Cible invalide');
      data.targetKind = body.targetKind;
      const hour = (h: unknown, max: number) => {
        if (h === null || h === undefined || h === '') return null;
        const n = Number(h);
        if (!Number.isInteger(n) || n < 0 || n > max) throw new BadRequestException('Heure invalide');
        return n;
      };
      if (body.targetKind === 'SLOT') {
        const days = [...new Set((body.targetDays ?? []).map(Number))];
        if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
          throw new BadRequestException('Jours invalides');
        }
        const from = hour(body.targetFromHour, 23);
        const to = hour(body.targetToHour, 24);
        if ((from == null) !== (to == null) || (from != null && from === to)) {
          throw new BadRequestException('Créneau invalide');
        }
        if (!days.length && from == null) throw new BadRequestException('Choisissez des jours ou des heures');
        Object.assign(data, { targetDays: days.length === 7 ? [] : days, targetFromHour: from, targetToHour: to });
      } else {
        Object.assign(data, { targetDays: [], targetFromHour: null, targetToHour: null });
      }
      if (body.targetKind === 'LIST') {
        const segment = body.targetSegment as CampaignSegment;
        const ids = [...new Set(await this.campaigns.segmentMembers(segment, facilityId).catch(() => []))];
        if (!ids.length) throw new BadRequestException('Personne dans cette liste pour le moment');
        Object.assign(data, { targetSegment: segment, targetMemberIds: ids });
      } else {
        Object.assign(data, { targetSegment: null, targetMemberIds: [] });
      }
    }
    if (body.linkedKind !== undefined || body.linkedId !== undefined) {
      if (body.linkedKind && !LINKED_KINDS.includes(body.linkedKind)) {
        throw new BadRequestException('Vente liée invalide');
      }
      const linked = !!(body.linkedKind && body.linkedId);
      data.linkedKind = linked ? body.linkedKind : null;
      data.linkedId = linked ? body.linkedId : null;
    }
    return data;
  }

  private get enabled() {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  private anthropic() {
    if (!this.enabled) {
      throw new BadRequestException(
        "Conseiller IA non configuré : ajoutez ANTHROPIC_API_KEY dans le fichier .env du backend.",
      );
    }
    // Org-level keys (not scoped to a workspace) must name the workspace on every request
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    this.client ??= new Anthropic(
      workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {},
    );
    return this.client;
  }

  private async facilityId(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  async settings(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const f = await this.prisma.facility.findUniqueOrThrow({
      where: { id },
      select: { businessContext: true },
    });
    return {
      facilityId: id,
      businessContext: f.businessContext || '',
      enabled: this.enabled,
      model: ADVISOR_MODEL,
    };
  }

  async updateSettings(facilityId: string | undefined, body: { businessContext?: string }) {
    const id = await this.facilityId(facilityId);
    const text = (body.businessContext || '').trim();
    if (text.length > 4000) {
      throw new BadRequestException('Contexte trop long (4000 caractères max)');
    }
    await this.prisma.facility.update({
      where: { id },
      data: { businessContext: text || null },
    });
    return this.settings(id);
  }

  async snapshot(facilityId?: string, days?: number) {
    return this.snapshots.build(await this.facilityId(facilityId), this.days(days));
  }

  /** Exactly what the API call would send, plus a single paste-ready text for a chat. */
  async prompt(facilityId?: string, days?: number) {
    const snapshot = await this.snapshot(facilityId, days);
    return {
      model: ADVISOR_MODEL,
      system: SYSTEM_PROMPT,
      user: userMessage(snapshot),
      schema: RESULT_SCHEMA,
      chat: chatPrompt(snapshot),
      snapshot,
    };
  }

  /** Saves a result produced outside the app (answer pasted from claude.ai). */
  async importReport(facilityId: string | undefined, body: { days?: number; result?: unknown }) {
    let result;
    try {
      result = parseAdvisorResult(body?.result);
    } catch {
      throw new BadRequestException(
        "Réponse illisible : collez uniquement le JSON renvoyé par Claude (de { à }).",
      );
    }
    const id = await this.facilityId(facilityId);
    const snapshot = await this.snapshots.build(id, this.days(body?.days));
    const report = await this.prisma.advisorReport.create({
      data: {
        facilityId: id,
        status: 'DONE',
        trigger: 'IMPORT',
        periodFrom: parseLocalDay(snapshot.period.from),
        periodTo: parseLocalDay(snapshot.period.to),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
        model: 'claude.ai (copier-coller)',
      },
    });
    await this.keepQuestions(report.id, result.questions);
    return this.summary(report);
  }

  private days(days?: number) {
    const n = Math.round(Number(days) || 30);
    if (n < 7 || n > 90) throw new BadRequestException('Période : 7 à 90 jours');
    return n;
  }

  /** Creates the report and runs Claude in the background; the page polls it. */
  async generate(
    facilityId: string | undefined,
    opts: { days?: number; trigger?: 'MANUAL' | 'WEEKLY' } = {},
  ) {
    const client = this.anthropic();
    const id = await this.facilityId(facilityId);
    const running = await this.prisma.advisorReport.findFirst({
      where: {
        facilityId: id,
        status: 'PENDING',
        createdAt: { gte: subMinutes(new Date(), STALE_MINUTES) },
      },
    });
    if (running) return this.summary(running);

    const snapshot = await this.snapshots.build(id, this.days(opts.days));
    const report = await this.prisma.advisorReport.create({
      data: {
        facilityId: id,
        trigger: opts.trigger || 'MANUAL',
        periodFrom: parseLocalDay(snapshot.period.from),
        periodTo: parseLocalDay(snapshot.period.to),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        model: ADVISOR_MODEL,
      },
    });
    void this.complete(client, report.id, snapshot);
    return this.summary(report);
  }

  private async complete(client: Anthropic, reportId: string, snapshot: unknown) {
    try {
      const out = await runAdvisor(client, snapshot);
      await this.prisma.advisorReport.update({
        where: { id: reportId },
        data: {
          status: 'DONE',
          result: out.result as unknown as Prisma.InputJsonValue,
          model: out.model,
          inputTokens: out.inputTokens,
          outputTokens: out.outputTokens,
        },
      });
      await this.keepQuestions(reportId, out.result.questions);
    } catch (err) {
      this.logger.error(`Advisor report ${reportId} failed`, err as Error);
      await this.prisma.advisorReport.update({
        where: { id: reportId },
        data: { status: 'FAILED', error: this.errorMessage(err) },
      });
    }
  }

  /** Questions become checklist items the owner answers before the next analysis. */
  private async keepQuestions(reportId: string, questions: string[]) {
    const r = await this.prisma.advisorReport.findUnique({
      where: { id: reportId },
      select: { facilityId: true },
    });
    if (!r) return;
    await this.context
      .storeQuestions(r.facilityId, reportId, questions)
      .catch((err) => this.logger.warn(`Could not store advisor questions: ${err}`));
  }

  private errorMessage(err: unknown) {
    if (err instanceof AdvisorRefusalError) return err.message;
    if (err instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic invalide.';
    if (err instanceof Anthropic.RateLimitError) {
      return 'Limite de requêtes atteinte, réessayez dans quelques minutes.';
    }
    if (err instanceof Anthropic.APIConnectionError) return "Impossible de joindre l'API Anthropic.";
    if (err instanceof Anthropic.APIError && /credit balance/i.test(err.message)) {
      return CREDIT_MESSAGE;
    }
    if (err instanceof Anthropic.APIError) return `Erreur API (${err.status}) : ${err.message}`;
    if (err instanceof SyntaxError) return "Réponse de l'IA illisible, réessayez.";
    return (err as Error)?.message || 'Erreur inconnue';
  }

  private summary(r: {
    id: string;
    status: string;
    trigger: string;
    periodFrom: Date;
    periodTo: Date;
    createdAt: Date;
    error: string | null;
  }) {
    return {
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      periodFrom: r.periodFrom,
      periodTo: r.periodTo,
      createdAt: r.createdAt,
      error: r.error,
    };
  }

  private async expireStale(facilityId: string) {
    await this.prisma.advisorReport.updateMany({
      where: {
        facilityId,
        status: 'PENDING',
        createdAt: { lt: subMinutes(new Date(), STALE_MINUTES) },
      },
      data: { status: 'FAILED', error: 'Analyse interrompue, relancez-la.' },
    });
  }

  async reports(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    await this.expireStale(id);
    const rows = await this.prisma.advisorReport.findMany({
      where: { facilityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        trigger: true,
        periodFrom: true,
        periodTo: true,
        createdAt: true,
        error: true,
        result: true,
      },
    });
    return rows.map(({ result, ...r }) => ({
      ...this.summary(r),
      headline: (result as { summary?: string } | null)?.summary?.slice(0, 160) || null,
    }));
  }

  async report(id: string) {
    const r = await this.prisma.advisorReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rapport introuvable');
    if (r.status === 'PENDING' && r.createdAt < subMinutes(new Date(), STALE_MINUTES)) {
      await this.expireStale(r.facilityId);
      return this.report(id);
    }
    return r;
  }

  /** Monday 7:00 — weekly report for every facility, when the API key is set. */
  @Cron('0 7 * * 1')
  async weekly() {
    if (!this.enabled || process.env.ADVISOR_WEEKLY === 'off') return;
    const facilities = await this.prisma.facility.findMany({ select: { id: true } });
    for (const f of facilities) {
      try {
        await this.generate(f.id, { days: 30, trigger: 'WEEKLY' });
      } catch (err) {
        this.logger.error(`Weekly advisor report failed for ${f.id}`, err as Error);
      }
    }
  }

  async initiatives(facilityId?: string) {
    return this.snapshots.initiativesWithImpact(await this.facilityId(facilityId));
  }

  private initiativeData(body: InitiativeBody) {
    const data: Prisma.BusinessInitiativeUncheckedUpdateInput = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title || title.length > 200) throw new BadRequestException('Titre requis (200 max)');
      data.title = title;
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.category !== undefined) {
      if (!(RECOMMENDATION_CATEGORIES as readonly string[]).includes(body.category)) {
        throw new BadRequestException('Catégorie invalide');
      }
      data.category = body.category;
    }
    if (body.startDate !== undefined) data.startDate = parseLocalDay(body.startDate);
    if (body.endDate !== undefined) {
      data.endDate = body.endDate ? parseLocalDay(body.endDate) : null;
    }
    if (body.sourceReportId !== undefined) data.sourceReportId = body.sourceReportId || null;
    if (body.recommendationTitle !== undefined) {
      data.recommendationTitle = body.recommendationTitle?.trim().slice(0, 300) || null;
    }
    if (body.metric !== undefined) {
      if (body.metric && !(ADVICE_METRICS as readonly string[]).includes(body.metric)) {
        throw new BadRequestException('Chiffre à suivre invalide');
      }
      data.metric = body.metric || null;
    }
    if (body.targetPct !== undefined) data.targetPct = optionalNumber(body.targetPct, 'Objectif');
    if (body.cost !== undefined) {
      const cost = optionalNumber(body.cost, 'Coût');
      if (cost !== null && cost < 0) throw new BadRequestException('Le coût ne peut pas être négatif');
      data.cost = cost;
    }
    if (body.ownerVerdict !== undefined) {
      if (body.ownerVerdict && !VERDICTS.includes(body.ownerVerdict)) {
        throw new BadRequestException('Verdict invalide');
      }
      data.ownerVerdict = body.ownerVerdict || null;
    }
    if (body.notes !== undefined) {
      if (!Array.isArray(body.notes) || body.notes.length > 50) {
        throw new BadRequestException('Notes invalides');
      }
      data.notes = body.notes
        .map((n) => ({
          date: typeof n?.date === 'string' ? n.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          text: typeof n?.text === 'string' ? n.text.trim().slice(0, 500) : '',
        }))
        .filter((n) => n.text);
    }
    if (body.objective !== undefined) {
      if (body.objective && !OBJECTIVES.includes(body.objective)) throw new BadRequestException('But invalide');
      data.objective = body.objective || null;
    }
    if (body.hypothesis !== undefined) data.hypothesis = body.hypothesis?.trim().slice(0, 300) || null;
    if (body.channels !== undefined) {
      if (!Array.isArray(body.channels) || body.channels.some((c) => !CHANNELS.includes(c))) {
        throw new BadRequestException('Canal invalide');
      }
      data.channels = [...new Set(body.channels)];
    }
    if (body.steps !== undefined) {
      if (!Array.isArray(body.steps) || body.steps.length > 20) throw new BadRequestException('Étapes invalides');
      const today = new Date().toISOString().slice(0, 10);
      // A step ticked now gets today's date; one already done keeps its date
      data.steps = parseSteps(body.steps).map((s) => ({ ...s, doneAt: s.done ? s.doneAt || today : null }));
    }
    if (body.manualFunnel !== undefined) {
      if (!Array.isArray(body.manualFunnel) || body.manualFunnel.length > 50) {
        throw new BadRequestException('Chiffres invalides');
      }
      data.manualFunnel = parseManualFunnel(body.manualFunnel);
    }
    for (const k of ['startDate', 'endDate'] as const) {
      const d = data[k];
      if (d instanceof Date && Number.isNaN(d.getTime())) {
        throw new BadRequestException('Date invalide');
      }
    }
    return data;
  }

  async createInitiative(facilityId: string | undefined, body: InitiativeBody) {
    if (!body.title) throw new BadRequestException('Titre requis');
    const id = await this.facilityId(facilityId);
    const data = {
      ...this.initiativeData({ startDate: new Date().toISOString(), ...body }),
      ...(await this.targetData(id, body)),
    };
    const created = await this.prisma.businessInitiative.create({
      data: { ...(data as Prisma.BusinessInitiativeUncheckedCreateInput), facilityId: id },
    });
    return this.withImpact(created.id);
  }

  async updateInitiative(id: string, body: InitiativeBody) {
    const row = await this.prisma.businessInitiative.findUnique({ where: { id }, select: { facilityId: true } });
    if (!row) throw new NotFoundException('Initiative introuvable');
    const data = { ...this.initiativeData(body), ...(await this.targetData(row.facilityId, body)) };
    await this.prisma.businessInitiative
      .update({ where: { id }, data })
      .catch(() => {
        throw new NotFoundException('Initiative introuvable');
      });
    return this.withImpact(id);
  }

  async deleteInitiative(id: string) {
    await this.prisma.businessInitiative.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Initiative introuvable');
    });
    return { ok: true };
  }

  /** A tracked link for one channel; the action must be tied to an event. */
  async createLink(initiativeId: string, channel: string) {
    if (!CHANNELS.includes(channel)) throw new BadRequestException('Canal invalide');
    const i = await this.prisma.businessInitiative.findUnique({
      where: { id: initiativeId },
      select: { facilityId: true, linkedKind: true, linkedId: true },
    });
    if (!i) throw new NotFoundException('Initiative introuvable');
    if (i.linkedKind !== 'EVENT' || !i.linkedId) {
      throw new BadRequestException("Liez d'abord l'action à un événement");
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const created = await this.prisma.shareLink
        .create({
          data: { code, facilityId: i.facilityId, initiativeId, kind: 'EVENT', targetId: i.linkedId, channel },
        })
        .catch(() => null);
      if (created) return this.withImpact(initiativeId);
    }
    throw new BadRequestException('Réessayez');
  }

  async deleteLink(initiativeId: string, linkId: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { id: linkId }, select: { initiativeId: true } });
    if (!link || link.initiativeId !== initiativeId) throw new NotFoundException('Lien introuvable');
    await this.prisma.shareLink.delete({ where: { id: linkId } });
    return this.withImpact(initiativeId);
  }

  private withImpact(id: string) {
    return this.snapshots.initiativeWithImpact(id);
  }
}
