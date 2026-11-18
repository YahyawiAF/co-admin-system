import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { dbDay, fromDbDay, localDayKey } from '../../../common/parse-local-day';
import { computeMonthForecast, loadDayFacts } from '../analytics/month-data';
import { PerformanceService } from '../analytics/performance.service';
import { ExpensesService } from '../expense/expense.service';
import { HealthService } from './health.service';
import { BASE_CORNERS, cornerId, corners, dropAlert, ENTRY_KINDS, type EntryKind, KIND_LABEL, parseImport } from './director';

type EntryBody = { date?: string; kind?: string; corner?: string; text?: string; detail?: string | null };
type OwnCorner = { id: string; name: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayKey = (d: Date) => localDayKey(fromDbDay(d));

const ownCorners = (raw: unknown): OwnCorner[] =>
  Array.isArray(raw) ? raw.filter((c): c is OwnCorner => !!c && typeof c.id === 'string' && typeof c.name === 'string') : [];

/** The Directeur page: goal, money of the month, drop alert, corners of the business and its memory. */
@Injectable()
export class DirectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
    private readonly expenses: ExpensesService,
    private readonly health: HealthService,
  ) {}

  private async facilityId(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  async overview(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const [facility, entries, bilan, facts, forecast, month, questions] = await Promise.all([
      this.prisma.facility.findUniqueOrThrow({
        where: { id },
        select: { directorGoalProfit: true, directorGoalDate: true, directorCorners: true },
      }),
      this.prisma.directorEntry.findMany({ where: { facilityId: id }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 300 }),
      this.health.health(id),
      loadDayFacts(this.prisma, subDays(startOfDay(now), 36), subDays(startOfDay(now), 1)),
      computeMonthForecast(this.prisma, id, y, m, now),
      this.expenses.monthOverview(y, m),
      this.prisma.advisorQuestion.findMany({
        where: { facilityId: id, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, question: true },
      }),
    ]);

    const custom = ownCorners(facility.directorCorners);
    const t = month.totals;
    const charges = Math.round((t.daily + t.chargesPaid + t.chargesRemaining) * 10) / 10;
    const income = Math.round(forecast.projectedAll?.pace ?? forecast.expected.total);
    const alert = dropAlert(facts, now);
    const memory = entries.map((e) => ({
      id: e.id,
      date: dayKey(e.date),
      kind: e.kind as EntryKind,
      kindLabel: KIND_LABEL[e.kind as EntryKind] ?? e.kind,
      corner: e.corner,
      text: e.text,
      detail: e.detail,
      source: e.source,
    }));
    const cornerList = corners({ areas: bilan.areas, entries: memory, custom, charges, alert });

    // Rule priorities: what is missing to judge, then the first solution of each point in trouble
    const RANK = { red: 0, orange: 1, grey: 2, green: 3 } as const;
    const suggestions: Array<{ title: string; corner: string; why: string; gain: number | null; href: string | null }> = [];
    if (charges <= 0)
      suggestions.push({ title: 'Mettre les dépenses du mois', corner: 'couts', why: 'Sans elles, pas de bénéfice ni de chemin vers l’objectif', gain: null, href: '/finance' });
    for (const a of [...bilan.areas].sort((p, q) => RANK[p.status] - RANK[q.status])) {
      const s = a.solutions[0];
      if (!s || (a.status !== 'red' && a.status !== 'orange')) continue;
      const corner = BASE_CORNERS.find((c) => c.areas?.includes(a.id))?.id ?? a.id;
      suggestions.push({ title: s.title, corner, why: a.headline, gain: s.gain || null, href: `/directeur?tab=conseils&area=${a.id}` });
    }

    return {
      goal: { profit: facility.directorGoalProfit, date: facility.directorGoalDate ? dayKey(facility.directorGoalDate) : null },
      month: { year: y, month: m, income, charges, profit: charges > 0 ? Math.round(income - charges) : null },
      alert,
      corners: cornerList,
      memory,
      questions,
      suggestions: suggestions.slice(0, 3),
      maxRunning: bilan.max,
    };
  }

  private async cornerIds(facilityId: string) {
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id: facilityId }, select: { directorCorners: true } });
    return [...BASE_CORNERS, ...ownCorners(f.directorCorners)];
  }

  private async clean(facilityId: string, body: EntryBody) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('Écris ce qui s’est passé');
    if (text.length > 300) throw new BadRequestException('300 caractères au plus');
    const kind = (ENTRY_KINDS as readonly string[]).includes(body.kind ?? '') ? (body.kind as EntryKind) : 'FACT';
    const list = await this.cornerIds(facilityId);
    const corner = list.find((c) => c.id === body.corner)?.id;
    if (!corner) throw new BadRequestException('Coin inconnu');
    if (body.date && !DAY_RE.test(body.date)) throw new BadRequestException('Date invalide');
    const date = dbDay(body.date || new Date());
    const detail = body.detail?.trim().slice(0, 500) || null;
    return { text, kind, corner, date, detail };
  }

  async createEntry(facilityId: string | undefined, body: EntryBody) {
    const id = await this.facilityId(facilityId);
    return this.prisma.directorEntry.create({ data: { facilityId: id, source: 'OWNER', ...(await this.clean(id, body)) } });
  }

  async updateEntry(entryId: string, body: EntryBody) {
    const e = await this.prisma.directorEntry.findUnique({ where: { id: entryId } });
    if (!e) throw new NotFoundException('Note introuvable');
    const merged = { date: dayKey(e.date), kind: e.kind, corner: e.corner, text: e.text, detail: e.detail, ...body };
    return this.prisma.directorEntry.update({ where: { id: entryId }, data: await this.clean(e.facilityId, merged) });
  }

  async deleteEntry(entryId: string) {
    await this.prisma.directorEntry.delete({ where: { id: entryId } }).catch(() => {
      throw new NotFoundException('Note introuvable');
    });
    return { ok: true };
  }

  /** Pasted lines « date | type | coin | texte | détail » (e.g. from the analysis doc). */
  async importEntries(facilityId: string | undefined, body: { text?: string }) {
    const id = await this.facilityId(facilityId);
    if (!body.text?.trim()) throw new BadRequestException('Colle au moins une ligne');
    if (body.text.length > 50_000) throw new BadRequestException('Texte trop long');
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorCorners: true } });
    const own = ownCorners(f.directorCorners);
    const { entries, skipped, newCorners } = parseImport(body.text, [...BASE_CORNERS, ...own]);
    await this.prisma.$transaction([
      ...(newCorners.length
        ? [this.prisma.facility.update({ where: { id }, data: { directorCorners: [...own, ...newCorners] } })]
        : []),
      this.prisma.directorEntry.createMany({
        data: entries.map((e) => ({ facilityId: id, source: 'OWNER', date: dbDay(e.date), kind: e.kind, corner: e.corner, text: e.text, detail: e.detail })),
      }),
    ]);
    return { added: entries.length, skipped, newCorners };
  }

  async setGoal(facilityId: string | undefined, body: { profit?: number; date?: string | null }) {
    const id = await this.facilityId(facilityId);
    const data: { directorGoalProfit?: number; directorGoalDate?: Date | null } = {};
    if (body.profit !== undefined) {
      const p = Math.round(Number(body.profit));
      if (!Number.isFinite(p) || p <= 0 || p > 10_000_000) throw new BadRequestException('Objectif invalide');
      data.directorGoalProfit = p;
    }
    if (body.date !== undefined) {
      if (body.date && !DAY_RE.test(body.date)) throw new BadRequestException('Date invalide');
      data.directorGoalDate = body.date ? dbDay(body.date) : null;
    }
    await this.prisma.facility.update({ where: { id }, data });
    return this.overview(id);
  }

  async addCorner(facilityId: string | undefined, body: { name?: string }) {
    const id = await this.facilityId(facilityId);
    const name = body.name?.trim();
    if (!name || name.length > 40) throw new BadRequestException('Nom du coin : 1 à 40 caractères');
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorCorners: true } });
    const own = ownCorners(f.directorCorners);
    const cid = cornerId(name);
    if ([...BASE_CORNERS, ...own].some((c) => c.id === cid)) throw new BadRequestException('Ce coin existe déjà');
    await this.prisma.facility.update({ where: { id }, data: { directorCorners: [...own, { id: cid, name }] } });
    return { id: cid, name };
  }

  async removeCorner(facilityId: string | undefined, cornerKey: string) {
    const id = await this.facilityId(facilityId);
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorCorners: true } });
    const own = ownCorners(f.directorCorners);
    if (!own.some((c) => c.id === cornerKey)) throw new BadRequestException('Seuls tes coins peuvent être retirés');
    if (await this.prisma.directorEntry.count({ where: { facilityId: id, corner: cornerKey } }))
      throw new BadRequestException('Ce coin a des notes : déplace-les d’abord');
    await this.prisma.facility.update({ where: { id }, data: { directorCorners: own.filter((c) => c.id !== cornerKey) } });
    return { ok: true };
  }
}
