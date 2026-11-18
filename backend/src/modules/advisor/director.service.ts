import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { dbDay, fromDbDay, localDayKey } from '../../../common/parse-local-day';
import { computeMonthForecast, loadCalendar, loadDayFacts } from '../analytics/month-data';
import { PerformanceService } from '../analytics/performance.service';
import { ExpensesService } from '../expense/expense.service';
import { AdvisorService } from './advisor.service';
import { ContextService } from './context.service';
import { HealthService } from './health.service';
import {
  addDayKey,
  checkParams,
  eyeLabel,
  EXPORT_FORMAT,
  ANY_DOMAIN,
  lessonFlag,
  LESSONS_FILE_FORMAT,
  measureWatch,
  pickLessons,
  sameRule,
  START_CONFIDENCE,
  updateInstructions,
  VERDICT_STATUS,
  type LessonResult,
  type LessonStatus,
  type EyeParams,
  type PlanLeg,
  type WatchResult,
} from '../../director-core';
import {
  BASE_CORNERS,
  cornerId,
  corners,
  dropAlert,
  ENTRY_KINDS,
  type EntryKind,
  KIND_LABEL,
  parseImport,
  parseUpdate,
} from './director';
import { checkLeg, eyeById, eyeSpecs, LEGS } from './director-eyes';
import { InitiativeMeasure } from './initiative-measure';
import { sumSales } from './sales';

type EntryBody = { date?: string; kind?: string; corner?: string; text?: string; detail?: string | null };
type OwnCorner = { id: string; name: string };
type Brief = { date: string; basedOn: string | null; summary: string | null; priorities: Array<{ title: string; corner: string; why: string }> };
type StoredLeg = PlanLeg & { status: 'DRAFT' | 'DONE' | 'SKIPPED'; targetId: string | null; doneAt: string | null };
type StoredStep = { text: string; done: boolean };
type Look = { eye: string; params: EyeParams; from: string; to: string; why: string };

const BUSINESS = 'cet espace de coworking en Tunisie (prix en DT)';
/** This app's trade, for lessons that are not principles */
const DOMAIN = 'coworking';
const MAX_LEARN = 5;
type Learn = { id: string; text: string; at: string };
type Debate = Array<{ by: 'OWNER' | 'DIRECTOR'; text: string; date: string }>;
type History = Array<{ date: string; change: string; why: string }>;
/** Days of history sent with every export, so the brain can compute most things itself */
const PACK_DAYS = 56;
const MAX_ACTIVE = 3;

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
    private readonly advisor: AdvisorService,
    private readonly context: ContextService,
    private readonly measure: InitiativeMeasure,
  ) {}

  private async facilityId(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  /** Yesterday, the last complete day. */
  private yesterday() {
    return localDayKey(subDays(new Date(), 1));
  }

  /** What one watch shows today: the eye's days against the same weekdays before, plus the legs' sales. */
  private async measureOne(
    w: { eye: string; params: unknown; startDate: Date; days: number; goal: number | null; stoppedAt: Date | null },
    legs: StoredLeg[],
    periods: Array<{ label: string; from: string; to: string }>,
  ): Promise<WatchResult | null> {
    const eye = eyeById(w.eye);
    if (!eye) return null;
    const start = dayKey(w.startDate);
    const today = w.stoppedAt ? [localDayKey(subDays(w.stoppedAt, 1)), this.yesterday()].sort()[0] : this.yesterday();
    const end = [addDayKey(start, w.days - 1), today].sort()[0];
    const from = addDayKey(start, -28);
    const days = await eye.compute(this.prisma, (w.params ?? {}) as EyeParams, new Date(`${from}T12:00:00`), new Date(`${(end < start ? start : end)}T12:00:00`));
    const done = legs.filter((l) => l.status === 'DONE' && l.targetId);
    const sales = done.length && end >= start
      ? sumSales(await Promise.all(done.map((l) => this.measure.linkedSale(l.kind, l.targetId!, startOfDay(new Date(`${start}T12:00:00`)), new Date(`${end}T23:59:59`)))))
      : null;
    return measureWatch({
      aggregate: eye.aggregate,
      days,
      start,
      length: w.days,
      today,
      periods,
      sales: sales ? { count: sales.count, revenue: sales.total } : null,
      goal: w.goal,
    });
  }

  private async periods(facilityId: string) {
    const cal = await loadCalendar(this.prisma, facilityId).catch(() => []);
    return cal.map((c) => ({ label: c.label, from: c.start, to: c.end }));
  }

  /** For each lesson, the results of the watches of the priorities (last 180 days) that applied or tested it. */
  private async lessonResults(facilityId: string) {
    const rows = await this.prisma.directorPriority.findMany({
      where: { facilityId, createdAt: { gte: subDays(new Date(), 180) }, NOT: { lessonIds: { equals: [] } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { watches: true },
    });
    const out = new Map<string, LessonResult[]>();
    if (!rows.length) return out;
    const periods = await this.periods(facilityId);
    for (const p of rows) {
      const legs = (p.legs as StoredLeg[]) ?? [];
      for (const w of p.watches) {
        const r = await this.measureOne(w, legs, periods);
        if (!r || r.status === 'waiting') continue;
        const res: LessonResult = { priority: p.title, watch: w.label, change: r.change, unit: r.changeUnit, sales: r.sales?.revenue ?? null, date: dayKey(w.startDate) };
        for (const l of (p.lessonIds as string[]) ?? []) out.set(l, [...(out.get(l) ?? []), res]);
      }
    }
    return out;
  }

  /** Active priorities and the ones closed in the last 30 days, each with its legs and measured watches. */
  async priorities(facilityId: string) {
    const [rows, loose, periods] = await Promise.all([
      this.prisma.directorPriority.findMany({
        where: { facilityId, OR: [{ status: 'ACTIVE' }, { closedAt: { gte: subDays(new Date(), 30) } }] },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        include: { watches: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.directorWatch.findMany({
        where: { facilityId, priorityId: null, startDate: { gte: subDays(new Date(), 60) } },
        orderBy: { createdAt: 'desc' },
      }),
      this.periods(facilityId),
    ]);
    const watchView = async (w: (typeof loose)[number], legs: StoredLeg[]) => {
      const spec = eyeById(w.eye);
      return {
        id: w.id,
        eye: w.eye,
        params: w.params as EyeParams,
        label: w.label,
        unit: spec?.unit ?? '',
        aggregate: spec?.aggregate ?? 'sum',
        startDate: dayKey(w.startDate),
        days: w.days,
        goal: w.goal,
        stopped: !!w.stoppedAt,
        result: await this.measureOne(w, legs, periods),
      };
    };
    const priorities = await Promise.all(
      rows.map(async (p) => {
        const legs = (p.legs as StoredLeg[]) ?? [];
        return {
          id: p.id,
          title: p.title,
          corner: p.corner,
          why: p.why,
          steps: (p.steps as StoredStep[]) ?? [],
          legs: legs.map((l, index) => ({ index, ...l })),
          status: p.status,
          source: p.source,
          startDate: dayKey(p.startDate),
          closedAt: p.closedAt?.toISOString() ?? null,
          lessonIds: (p.lessonIds as string[]) ?? [],
          watches: await Promise.all(p.watches.map((w) => watchView(w, legs))),
        };
      }),
    );
    return { priorities, watches: await Promise.all(loose.map((w) => watchView(w, []))) };
  }

  /** What the brain asked to be coded (not seen or not doable by the app yet). */
  private async needs(facilityId: string) {
    const rows = await this.prisma.featureProposal.findMany({
      where: { facilityId, source: 'CLAUDE', stage: { not: 'REJECTED' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const now = Date.now();
    return rows
      .filter((r) => !(r.stage === 'DEFERRED' && r.deferredUntil && r.deferredUntil.getTime() > now))
      .map((r) => ({ key: r.key, title: r.title, problem: r.problem, capability: r.capability, stage: r.stage === 'DEFERRED' ? 'SUGGESTED' : r.stage }));
  }

  /** The days the brain reads in every export (8 weeks), from the same eyes the watches use. */
  private async dataPack() {
    const to = subDays(startOfDay(new Date()), 1);
    const from = subDays(to, PACK_DAYS - 1);
    const read = (id: string, params: EyeParams = {}) => eyeById(id)!.compute(this.prisma, params, from, to);
    const [money, visits, cafe, attach] = await Promise.all([read('money.day'), read('visits'), read('cafe.sales'), read('cafe.attach')]);
    const at = new Map(visits.map((v) => [v.day, v]));
    const ca = new Map(cafe.map((v) => [v.day, v]));
    const att = new Map(attach.map((v) => [v.day, v]));
    return {
      note: 'Un jour par ligne. money en DT (passes, cafe, abos, events) ; visits (nouveaux, habitués) ; cafe = articles par canal ; withCafe = visites avec au moins un article.',
      days: money.map((m) => ({
        day: m.day,
        money: m.split,
        visits: at.get(m.day)?.split ?? {},
        cafe: ca.get(m.day)?.split ?? {},
        withCafe: att.get(m.day)?.value ?? 0,
      })),
    };
  }

  /** Answers to what the brain asked to look at last time (each look ≤ 92 days). */
  private async answerLooks(raw: unknown) {
    const looks = (Array.isArray(raw) ? raw : []) as Look[];
    return Promise.all(
      looks.map(async (l) => {
        const eye = eyeById(l.eye);
        if (!eye) return { ...l, answer: null, error: 'œil inconnu' };
        const to = l.to;
        const from = l.from < addDayKey(to, -91) ? addDayKey(to, -91) : l.from;
        const days = await eye.compute(this.prisma, l.params, new Date(`${from}T12:00:00`), new Date(`${to}T12:00:00`));
        return { ...l, from, label: eyeLabel(eye, l.params), unit: eye.unit, answer: days };
      }),
    );
  }

  async overview(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const [facility, entries, bilan, facts, forecast, month, questions, plan, needs] = await Promise.all([
      this.prisma.facility.findUniqueOrThrow({
        where: { id },
        select: { directorGoalProfit: true, directorGoalDate: true, directorCorners: true, directorBrief: true, directorLearn: true },
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
      this.priorities(id),
      this.needs(id),
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
    const results = await this.lessonResults(id);
    const lessons = entries
      .filter((e) => e.kind === 'LESSON')
      .map((e) => {
        const debate = (e.debate as Debate | null) ?? [];
        const view = {
          id: e.id,
          rule: e.text,
          why: e.detail,
          corner: e.corner,
          date: dayKey(e.date),
          source: e.source,
          status: (e.status ?? 'ADOPTED') as LessonStatus,
          confidence: e.confidence ?? 50,
          domain: e.domain ?? DOMAIN,
          origin: e.origin,
          results: results.get(e.id) ?? [],
          evidence: (e.evidence as Array<{ date: string; text: string }> | null) ?? [],
          debate,
          history: (e.history as History | null) ?? [],
          canContest: e.source === 'CLAUDE' && !debate.some((d) => d.by === 'OWNER'),
          contested: debate.length > 0 && debate[debate.length - 1].by === 'OWNER',
        };
        return { ...view, flag: lessonFlag(view) };
      });
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
      suggestions.push({ title: s.title, corner, why: a.headline, gain: s.gain || null, href: null });
    }

    return {
      goal: { profit: facility.directorGoalProfit, date: facility.directorGoalDate ? dayKey(facility.directorGoalDate) : null },
      month: { year: y, month: m, income, charges, profit: charges > 0 ? Math.round(income - charges) : null },
      alert,
      corners: cornerList,
      memory,
      questions,
      suggestions: suggestions.slice(0, 3),
      brief: (facility.directorBrief as Brief | null) ?? null,
      maxRunning: bilan.max,
      priorities: plan.priorities,
      watches: plan.watches,
      needs,
      lessons,
      learn: (facility.directorLearn as Learn[] | null) ?? [],
    };
  }

  /** Everything Claude needs in one file: memory, numbers, what the app can see and do, the answer format. */
  async exportForClaude(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const [overview, prompt, answered, facility, data] = await Promise.all([
      this.overview(id),
      this.advisor.prompt(id, 30),
      this.prisma.advisorQuestion.findMany({
        where: { facilityId: id, status: 'ANSWERED' },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { question: true, answer: true },
      }),
      this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorLooks: true } }),
      this.dataPack(),
    ]);
    const exportedAt = new Date().toISOString();
    const watchOut = (w: (typeof overview.watches)[number]) => ({
      label: w.label,
      eye: w.eye,
      params: w.params,
      startDate: w.startDate,
      days: w.days,
      goal: w.goal,
      stopped: w.stopped,
      result: w.result,
    });
    return {
      format: EXPORT_FORMAT,
      exportedAt,
      today: localDayKey(new Date()),
      instructions: updateInstructions(BUSINESS, DOMAIN),
      catalogue: { eyes: eyeSpecs(), legs: LEGS },
      goal: overview.goal,
      month: overview.month,
      alert: overview.alert,
      corners: overview.corners.map((c) => ({ id: c.id, name: c.name, status: c.status, fact: c.fact, own: c.custom })),
      priorities: overview.priorities.map((p) => ({
        title: p.title,
        corner: p.corner,
        why: p.why,
        status: p.status,
        startDate: p.startDate,
        closedAt: p.closedAt,
        steps: p.steps,
        legs: p.legs.map((l) => ({ kind: l.kind, label: l.label, status: l.status, doneAt: l.doneAt })),
        watches: p.watches.map(watchOut),
      })),
      otherWatches: overview.watches.map(watchOut),
      looks: await this.answerLooks(facility.directorLooks),
      needs: overview.needs,
      memory: overview.memory.filter((m) => m.kind !== 'LESSON').map(({ kindLabel: _k, ...m }) => m),
      learn: overview.learn.map((l) => ({ id: l.id, text: l.text })),
      lessons: pickLessons(overview.lessons, {
        domain: DOMAIN,
        hotCorners: overview.corners.filter((c) => c.status === 'red' || c.status === 'orange').map((c) => c.id),
      }).map((l) => ({ id: l.id, rule: l.rule, why: l.why, corner: l.corner, status: l.status, confidence: l.confidence, domain: l.domain, results: l.results, evidence: l.evidence, flag: l.flag })),
      rejected: overview.lessons.filter((l) => l.status === 'REJECTED').slice(0, 30).map((l) => ({ id: l.id, rule: l.rule })),
      contested: overview.lessons
        .filter((l) => l.contested)
        .map((l) => ({ id: l.id, rule: l.rule, status: l.status, objection: l.debate[l.debate.length - 1].text })),
      questions: { open: overview.questions.map((q) => q.question), answered },
      data,
      numbers: prompt.snapshot,
    };
  }

  private async plan(id: string, json: unknown) {
    const [f, ids, products] = await Promise.all([
      this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorCorners: true, directorLearn: true } }),
      this.prisma.directorEntry.findMany({ where: { facilityId: id }, select: { id: true, kind: true, debate: true } }),
      this.prisma.product.findMany({ select: { id: true, name: true } }),
    ]);
    const own = ownCorners(f.directorCorners);
    try {
      const now = new Date();
      return {
        own,
        plan: parseUpdate(
          json,
          {
            corners: [...BASE_CORNERS, ...own],
            entryIds: ids.map((e) => e.id),
            eyes: eyeSpecs(),
            legs: LEGS,
            checkLeg: (kind, raw) => checkLeg(kind, raw, { now, products }),
            lessonIds: ids.filter((e) => e.kind === 'LESSON').map((e) => e.id),
            learnIds: ((f.directorLearn as Learn[] | null) ?? []).map((l) => l.id),
            contestedIds: ids
              .filter((e) => {
                const d = (e.debate as Debate | null) ?? [];
                return d.length > 0 && d[d.length - 1].by === 'OWNER';
              })
              .map((e) => e.id),
            domain: DOMAIN,
          },
          localDayKey(now),
        ),
      };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** What Claude's answer would change, without saving anything. */
  async previewUpdate(facilityId: string | undefined, body: { json?: unknown }) {
    const id = await this.facilityId(facilityId);
    return (await this.plan(id, body.json)).plan;
  }

  /** Saves Claude's answer: new corners, notes added / changed / removed, questions, and the week's brief. */
  async applyUpdate(facilityId: string | undefined, body: { json?: unknown }) {
    const id = await this.facilityId(facilityId);
    const { own, plan } = await this.plan(id, body.json);
    const brief: Brief | undefined =
      plan.summary || plan.priorities.length
        ? { date: localDayKey(new Date()), basedOn: plan.basedOn, summary: plan.summary, priorities: plan.priorities }
        : undefined;
    await this.prisma.$transaction([
      ...(plan.corners.length || brief
        ? [
            this.prisma.facility.update({
              where: { id },
              data: {
                ...(plan.corners.length ? { directorCorners: [...own, ...plan.corners] } : {}),
                ...(brief ? { directorBrief: brief } : {}),
              },
            }),
          ]
        : []),
      ...(plan.add.length
        ? [
            this.prisma.directorEntry.createMany({
              data: plan.add.map((e) => ({ facilityId: id, source: 'CLAUDE', date: dbDay(e.date), kind: e.kind, corner: e.corner, text: e.text, detail: e.detail })),
            }),
          ]
        : []),
      ...plan.update.map(({ id: entryId, date, ...rest }) =>
        this.prisma.directorEntry.update({ where: { id: entryId }, data: { ...rest, ...(date ? { date: dbDay(date) } : {}) } }),
      ),
      ...(plan.remove.length ? [this.prisma.directorEntry.deleteMany({ where: { facilityId: id, id: { in: plan.remove } } })] : []),
    ]);
    if (plan.questions.length) await this.context.storeQuestions(id, null, plan.questions);
    const v2 = plan.format !== 'directeur-update/v1';
    const created = v2 ? await this.saveLessons(id, plan) : new Map<string, string>();
    if (v2) await this.saveActions(id, plan, created);
    return {
      priorities: v2 ? plan.priorities.length : 0,
      watches: v2 ? plan.priorities.reduce((a, p) => a + p.watch.length, 0) : 0,
      drafts: v2 ? plan.priorities.reduce((a, p) => a + p.legs.length, 0) : 0,
      looks: v2 ? plan.look.length : 0,
      needs: v2 ? plan.needs.length : 0,
      lessons: v2 ? plan.lessons.length : 0,
      confidence: v2 ? plan.confidence.length : 0,
      replies: v2 ? plan.replies.length : 0,
      added: plan.add.length,
      updated: plan.update.length,
      removed: plan.remove.length,
      corners: plan.corners.length,
      questions: plan.questions.length,
      brief: !!brief,
      warnings: plan.warnings,
    };
  }

  /**
   * v2: the new priorities replace the active ones (their watches keep measuring), each with its
   * steps, drafts and watches from today; looks replace the last ones; needs become feature requests.
   */
  private async saveActions(id: string, plan: Awaited<ReturnType<DirectorService['plan']>>['plan'], created: Map<string, string>) {
    const today = dbDay(new Date());
    await this.prisma.$transaction(async (tx) => {
      if (plan.priorities.length) {
        await tx.directorPriority.updateMany({ where: { facilityId: id, status: 'ACTIVE' }, data: { status: 'DONE', closedAt: new Date() } });
        for (const p of plan.priorities) {
          await tx.directorPriority.create({
            data: {
              facilityId: id,
              title: p.title,
              corner: p.corner,
              why: p.why,
              steps: p.steps.map((text) => ({ text, done: false })),
              legs: p.legs.map((l) => ({ ...l, status: 'DRAFT', targetId: null, doneAt: null })) as object[],
              basedOn: plan.basedOn,
              lessonIds: p.lessonIds.map((l) => created.get(l) ?? l).filter((l) => !l.startsWith('new:')),
              startDate: today,
              watches: {
                create: p.watch.map((w) => ({
                  facilityId: id,
                  eye: w.eye,
                  params: w.params,
                  label: w.label ?? eyeLabel(eyeById(w.eye)!, w.params),
                  startDate: today,
                  days: w.days,
                  goal: w.goal,
                })),
              },
            },
          });
        }
      }
      await tx.facility.update({ where: { id }, data: { directorLooks: plan.look as object[] } });
      for (const n of plan.needs) {
        const key = `claude-${cornerId(n.title)}`;
        await tx.featureProposal.upsert({
          where: { facilityId_key: { facilityId: id, key } },
          create: { facilityId: id, key, title: n.title, problem: n.problem, capability: n.capability, source: 'CLAUDE' },
          update: { title: n.title, problem: n.problem, capability: n.capability },
        });
      }
    });
  }

  /**
   * The brain's verdicts on what the owner wanted it to learn, its confidence changes and its
   * answers to contests. Returns "new:<ref>" → id of each lesson created, for the priorities that test them.
   */
  private async saveLessons(id: string, plan: Awaited<ReturnType<DirectorService['plan']>>['plan']) {
    const today = localDayKey(new Date());
    const created = new Map<string, string>();
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorLearn: true } });
    const learn = (f.directorLearn as Learn[] | null) ?? [];
    const sourceOf = (learnId: string | null) => learn.find((l) => l.id === learnId)?.text.slice(0, 200) ?? null;
    const touched = new Set(plan.lessons.map((l) => l.learnId).filter(Boolean));
    const load = async (lessonId: string) => this.prisma.directorEntry.findUniqueOrThrow({ where: { id: lessonId } });

    for (const v of plan.lessons) {
      if (v.verdict === 'SAME') {
        const e = await load(v.sameAs!);
        await this.prisma.directorEntry.update({
          where: { id: e.id },
          data: { history: [...((e.history as History | null) ?? []), { date: today, change: 'Même idée reçue', why: v.claim }] },
        });
        continue;
      }
      const why = [v.why, v.changed && `Changé : ${v.changed}`, v.changeMind && `Me ferait changer d’avis : ${v.changeMind}`].filter(Boolean).join(' · ');
      const row = await this.prisma.directorEntry.create({
        data: {
          facilityId: id,
          date: dbDay(today),
          kind: 'LESSON',
          corner: v.corner,
          text: v.rule,
          detail: why.slice(0, 500) || null,
          source: 'CLAUDE',
          status: VERDICT_STATUS[v.verdict],
          confidence: START_CONFIDENCE[v.verdict],
          domain: v.domain,
          origin: [sourceOf(v.learnId), v.claim !== v.rule ? `« ${v.claim} »` : null].filter(Boolean).join(' · ').slice(0, 500) || null,
          history: [{ date: today, change: { ADOPT: 'Adoptée', ADAPT: 'Adaptée', TEST: 'À tester', REJECT: 'Refusée' }[v.verdict], why: why || v.claim }],
        },
      });
      created.set(`new:${v.ref}`, row.id);
    }
    for (const c of plan.confidence) {
      const e = await load(c.id);
      await this.prisma.directorEntry.update({
        where: { id: e.id },
        data: {
          confidence: c.confidence,
          ...(c.status ? { status: c.status } : {}),
          evidence: [...((e.evidence as Array<{ date: string; text: string }> | null) ?? []), { date: today, text: c.why }],
          history: [...((e.history as History | null) ?? []), { date: today, change: `Confiance ${e.confidence ?? 50} → ${c.confidence}${c.status ? `, ${c.status}` : ''}`, why: c.why }],
        },
      });
    }
    for (const r of plan.replies) {
      const e = await load(r.id);
      await this.prisma.directorEntry.update({
        where: { id: e.id },
        data: {
          ...(r.rule ? { text: r.rule } : {}),
          ...(r.status ? { status: r.status } : {}),
          debate: [...((e.debate as Debate | null) ?? []), { by: 'DIRECTOR', text: r.reply, date: today }],
          history: [...((e.history as History | null) ?? []), { date: today, change: r.rule ? 'Réécrite après contestation' : 'Gardée après contestation', why: r.reply }],
        },
      });
    }
    if (touched.size) await this.prisma.facility.update({ where: { id }, data: { directorLearn: learn.filter((l) => !touched.has(l.id)) } });
    return created;
  }

  /** A text the owner wants the brain to learn (book note, video summary…), sent with the next export. */
  async addLearn(facilityId: string | undefined, body: { text?: string }) {
    const id = await this.facilityId(facilityId);
    const text = body.text?.trim();
    if (!text || text.length < 20) throw new BadRequestException('Colle au moins quelques phrases');
    if (text.length > 8000) throw new BadRequestException('8 000 caractères au plus');
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorLearn: true } });
    const learn = (f.directorLearn as Learn[] | null) ?? [];
    if (learn.length >= MAX_LEARN) throw new BadRequestException(`${MAX_LEARN} textes en attente au plus : exporte d’abord pour Claude`);
    const item = { id: `learn-${Date.now().toString(36)}`, text, at: new Date().toISOString() };
    await this.prisma.facility.update({ where: { id }, data: { directorLearn: [...learn, item] } });
    return item;
  }

  async removeLearn(facilityId: string | undefined, learnId: string) {
    const id = await this.facilityId(facilityId);
    const f = await this.prisma.facility.findUniqueOrThrow({ where: { id }, select: { directorLearn: true } });
    const learn = (f.directorLearn as Learn[] | null) ?? [];
    await this.prisma.facility.update({ where: { id }, data: { directorLearn: learn.filter((l) => l.id !== learnId) } });
    return { ok: true };
  }

  /** The owner disagrees with a lesson the brain wrote: once, with an argument; the brain answers in the next update. */
  async contestLesson(facilityId: string | undefined, entryId: string, body: { text?: string }) {
    const id = await this.facilityId(facilityId);
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('Écris ton argument ou un fait');
    const e = await this.prisma.directorEntry.findFirst({ where: { id: entryId, facilityId: id, kind: 'LESSON' } });
    if (!e) throw new NotFoundException('Leçon introuvable');
    const debate = (e.debate as Debate | null) ?? [];
    if (debate.some((d) => d.by === 'OWNER')) throw new BadRequestException('Déjà contestée une fois : ce sont les résultats qui décident maintenant');
    await this.prisma.directorEntry.update({
      where: { id: e.id },
      data: { debate: [...debate, { by: 'OWNER', text: text.slice(0, 500), date: localDayKey(new Date()) }] },
    });
    return { ok: true };
  }

  /** Principles (domain *) to take to another project, e.g. the ERP. */
  async lessonsFile(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const rows = await this.prisma.directorEntry.findMany({
      where: { facilityId: id, kind: 'LESSON', domain: ANY_DOMAIN, status: { in: ['ADOPTED', 'ADAPTED', 'TESTING', 'REJECTED'] } },
      orderBy: { confidence: 'desc' },
    });
    return {
      format: LESSONS_FILE_FORMAT,
      exportedAt: new Date().toISOString(),
      from: DOMAIN,
      lessons: rows.map((r) => ({ rule: r.text, why: r.detail, status: r.status, confidence: r.confidence, corner: r.corner, history: r.history })),
    };
  }

  /** Lessons from another project: new ideas only, kept with their status and a lower confidence (not proven here yet). */
  async importLessonsFile(facilityId: string | undefined, body: { json?: unknown }) {
    const id = await this.facilityId(facilityId);
    let x: { format?: string; from?: string; lessons?: unknown };
    try {
      x = (typeof body.json === 'string' ? JSON.parse(body.json) : body.json) as typeof x;
    } catch {
      throw new BadRequestException('Ce n’est pas du JSON valide');
    }
    if (x?.format !== LESSONS_FILE_FORMAT || !Array.isArray(x.lessons)) throw new BadRequestException(`Format attendu : « ${LESSONS_FILE_FORMAT} »`);
    const known = await this.prisma.directorEntry.findMany({ where: { facilityId: id, kind: 'LESSON' }, select: { text: true } });
    const corners = await this.cornerIds(id);
    const today = localDayKey(new Date());
    let added = 0;
    let skipped = 0;
    for (const raw of x.lessons.slice(0, 200)) {
      const l = (raw ?? {}) as { rule?: unknown; why?: unknown; status?: unknown; confidence?: unknown; corner?: unknown };
      const rule = typeof l.rule === 'string' ? l.rule.trim().slice(0, 300) : '';
      if (!rule || known.some((k) => sameRule(k.text, rule))) {
        skipped += 1;
        continue;
      }
      const status = ['ADOPTED', 'ADAPTED', 'TESTING', 'REJECTED'].includes(l.status as string) ? (l.status as LessonStatus) : 'TESTING';
      await this.prisma.directorEntry.create({
        data: {
          facilityId: id,
          date: dbDay(today),
          kind: 'LESSON',
          corner: corners.find((c) => c.id === l.corner)?.id ?? 'marketing',
          text: rule,
          detail: typeof l.why === 'string' ? l.why.slice(0, 500) : null,
          source: 'APP',
          status,
          // Not proven here yet: at most 50
          confidence: Math.min(50, Math.max(0, Math.round(Number(l.confidence) || 30))),
          domain: ANY_DOMAIN,
          origin: `import:${typeof x.from === 'string' ? x.from.slice(0, 40) : 'autre projet'}`,
          history: [{ date: today, change: 'Importée d’un autre projet', why: `Venue de ${x.from ?? 'un autre projet'}` }],
        },
      });
      known.push({ text: rule });
      added += 1;
    }
    return { added, skipped };
  }

  /**
   * A priority the owner starts himself (from Finance: a money idea to test, a missing lever):
   * his steps, and a watch when he picks the number to follow. Counts in the 3 at most.
   */
  async createPriority(
    facilityId: string | undefined,
    body: { title?: string; corner?: string; why?: string; steps?: string[]; watch?: { eye?: string; params?: Record<string, unknown>; days?: number; goal?: number | null } | null },
  ) {
    const id = await this.facilityId(facilityId);
    const title = body.title?.trim().slice(0, 200);
    if (!title) throw new BadRequestException('Donne un titre');
    const active = await this.prisma.directorPriority.count({ where: { facilityId: id, status: 'ACTIVE' } });
    if (active >= MAX_ACTIVE) throw new BadRequestException(`${MAX_ACTIVE} priorités en cours au plus : termine-en une dans le Directeur`);
    const corners = await this.cornerIds(id);
    const eye = body.watch?.eye ? eyeById(body.watch.eye) : null;
    const params = eye ? checkParams(eye, body.watch?.params ?? {}) : null;
    const today = dbDay(new Date());
    return this.prisma.directorPriority.create({
      data: {
        facilityId: id,
        title,
        corner: corners.find((c) => c.id === body.corner)?.id ?? 'revenus',
        why: body.why?.trim().slice(0, 300) ?? '',
        steps: (body.steps ?? []).map((t) => String(t).trim().slice(0, 160)).filter(Boolean).slice(0, 4).map((text) => ({ text, done: false })),
        source: 'OWNER',
        startDate: today,
        ...(eye && params
          ? {
              watches: {
                create: {
                  facilityId: id,
                  eye: eye.id,
                  params,
                  label: eyeLabel(eye, params),
                  startDate: today,
                  days: Math.min(42, Math.max(7, Math.round(Number(body.watch?.days) || 28))),
                  goal: body.watch?.goal ?? null,
                },
              },
            }
          : {}),
      },
    });
  }

  private async ownPriority(facilityId: string | undefined, priorityId: string) {
    const id = await this.facilityId(facilityId);
    const p = await this.prisma.directorPriority.findFirst({ where: { id: priorityId, facilityId: id } });
    if (!p) throw new NotFoundException('Priorité introuvable');
    return p;
  }

  /** The owner created what a draft prepared (promo, relance…): its sales count for the priority from now on. */
  async setLeg(facilityId: string | undefined, priorityId: string, index: number, body: { targetId?: string | null; status?: string }) {
    const p = await this.ownPriority(facilityId, priorityId);
    const legs = [...((p.legs as StoredLeg[]) ?? [])];
    if (!legs[index]) throw new NotFoundException('Brouillon introuvable');
    const status = body.status === 'SKIPPED' ? 'SKIPPED' : body.status === 'DRAFT' ? 'DRAFT' : 'DONE';
    legs[index] = {
      ...legs[index],
      status,
      targetId: status === 'DONE' ? (body.targetId ?? legs[index].targetId ?? null) : null,
      doneAt: status === 'DONE' ? new Date().toISOString() : null,
    };
    await this.prisma.directorPriority.update({ where: { id: p.id }, data: { legs: legs as object[] } });
    return { ok: true };
  }

  async setStep(facilityId: string | undefined, priorityId: string, index: number, body: { done?: boolean }) {
    const p = await this.ownPriority(facilityId, priorityId);
    const steps = [...((p.steps as StoredStep[]) ?? [])];
    if (!steps[index]) throw new NotFoundException('Étape introuvable');
    steps[index] = { ...steps[index], done: !!body.done };
    await this.prisma.directorPriority.update({ where: { id: p.id }, data: { steps } });
    return { ok: true };
  }

  /** Done or dropped by the owner; its watches keep measuring until their end. */
  async closePriority(facilityId: string | undefined, priorityId: string, body: { status?: string }) {
    const p = await this.ownPriority(facilityId, priorityId);
    const status = body.status === 'DROPPED' ? 'DROPPED' : body.status === 'ACTIVE' ? 'ACTIVE' : 'DONE';
    if (status === 'ACTIVE') {
      const active = await this.prisma.directorPriority.count({ where: { facilityId: p.facilityId, status: 'ACTIVE' } });
      if (active >= MAX_ACTIVE) throw new BadRequestException(`${MAX_ACTIVE} priorités au plus en même temps`);
    }
    await this.prisma.directorPriority.update({ where: { id: p.id }, data: { status, closedAt: status === 'ACTIVE' ? null : new Date() } });
    return { ok: true };
  }

  async stopWatch(facilityId: string | undefined, watchId: string) {
    const id = await this.facilityId(facilityId);
    const w = await this.prisma.directorWatch.findFirst({ where: { id: watchId, facilityId: id } });
    if (!w) throw new NotFoundException('Suivi introuvable');
    await this.prisma.directorWatch.update({ where: { id: w.id }, data: { stoppedAt: w.stoppedAt ? null : new Date() } });
    return { ok: true };
  }

  /** The owner's answer to a need: APPROVED (to code), DEFERRED (later) or REJECTED. */
  async setNeed(facilityId: string | undefined, key: string, body: { stage?: string }) {
    const id = await this.facilityId(facilityId);
    const stage = ['APPROVED', 'DEFERRED', 'REJECTED', 'SUGGESTED'].includes(body.stage ?? '') ? body.stage! : null;
    if (!stage) throw new BadRequestException('Réponse inconnue');
    const row = await this.prisma.featureProposal.findUnique({ where: { facilityId_key: { facilityId: id, key } } });
    if (!row || row.source !== 'CLAUDE') throw new NotFoundException('Demande introuvable');
    await this.prisma.featureProposal.update({
      where: { id: row.id },
      data: {
        stage,
        approvedAt: stage === 'APPROVED' ? (row.approvedAt ?? new Date()) : row.approvedAt,
        deferredUntil: stage === 'DEFERRED' ? new Date(Date.now() + 30 * 86_400_000) : null,
      },
    });
    return { ok: true };
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
