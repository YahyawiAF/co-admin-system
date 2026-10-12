import Anthropic from '@anthropic-ai/sdk';
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
import { PerformanceService } from '../analytics/performance.service';
import {
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
import { SnapshotService } from './snapshot.service';

/** A PENDING report older than this is considered lost (server restarted mid-run). */
const STALE_MINUTES = 15;

type InitiativeBody = {
  title?: string;
  description?: string | null;
  category?: string;
  startDate?: string;
  endDate?: string | null;
  sourceReportId?: string | null;
};

@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
    private readonly snapshots: SnapshotService,
  ) {}

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
    } catch (err) {
      this.logger.error(`Advisor report ${reportId} failed`, err as Error);
      await this.prisma.advisorReport.update({
        where: { id: reportId },
        data: { status: 'FAILED', error: this.errorMessage(err) },
      });
    }
  }

  private errorMessage(err: unknown) {
    if (err instanceof AdvisorRefusalError) return err.message;
    if (err instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic invalide.';
    if (err instanceof Anthropic.RateLimitError) {
      return 'Limite de requêtes atteinte, réessayez dans quelques minutes.';
    }
    if (err instanceof Anthropic.APIConnectionError) return "Impossible de joindre l'API Anthropic.";
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
    const data = this.initiativeData({ startDate: new Date().toISOString(), ...body });
    const created = await this.prisma.businessInitiative.create({
      data: { ...(data as Prisma.BusinessInitiativeUncheckedCreateInput), facilityId: id },
    });
    return this.withImpact(created.id);
  }

  async updateInitiative(id: string, body: InitiativeBody) {
    await this.prisma.businessInitiative
      .update({ where: { id }, data: this.initiativeData(body) })
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

  private withImpact(id: string) {
    return this.snapshots.initiativeWithImpact(id);
  }
}
