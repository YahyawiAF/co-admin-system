import { BadRequestException, Injectable } from '@nestjs/common';
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import {
  type AnswerRecord,
  computeMoneyPlan,
  dayLabel,
  dt,
  editableQuestions,
  featureIdeas,
  ideaFit,
  isMoneyKey,
  knowledge,
  LEGAL_PREVIEW,
  type MoneyFacts,
  pendingQuestions,
  QUESTION_SHORT,
  ticketMarkdown,
} from '../../business-manager-core';
import { AnalyticsService } from '../analytics/analytics.service';
import { PerformanceService } from '../analytics/performance.service';
import { CaisseService } from '../caisse/caisse.service';
import { MemberService } from '../member/member.service';
import { SnapshotService } from './snapshot.service';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const STAGES = ['APPROVED', 'TICKET_READY', 'DEFERRED', 'REJECTED'] as const;
const DEFER_DAYS = 30;
const r1 = (n: number) => Math.round(n * 10) / 10;
/** « de mars », « d'octobre » */
const deMonth = (m: string) => (/^[aeiouyéè]/i.test(m) ? `d'${m}` : `de ${m}`);

/**
 * co-admin adapter for the business-manager core: turns this app's tables
 * (caisse, coffre, charges, journal…) into MoneyFacts, and stores the owner's answers.
 */
@Injectable()
export class ManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
    private readonly analytics: AnalyticsService,
    private readonly caisse: CaisseService,
    private readonly members: MemberService,
    private readonly snapshot: SnapshotService,
  ) {}

  private async resolve(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  private async answers(facilityId: string) {
    const rows = await this.prisma.businessAnswer.findMany({ where: { facilityId } });
    return new Map<string, AnswerRecord>(rows.map((r) => [r.key, r]));
  }

  /** Last 3 months of money taken in (current month so far included). */
  private async months(now: Date) {
    const keys = [2, 1, 0].map((i) => subMonths(startOfMonth(now), i));
    const years = [...new Set(keys.map((d) => d.getFullYear()))];
    const all = (await Promise.all(years.map((y) => this.analytics.financeMonthly(y)))).flatMap((r) => r.months);
    return keys.map((d) => {
      const m = all.find((x) => x.year === d.getFullYear() && x.month === d.getMonth() + 1);
      const income = m ? r1(m.revenueJournal + m.revenueAbonnements + m.revenueProducts) : 0;
      const current = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return {
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTHS[d.getMonth()],
        longLabel: MONTHS_LONG[d.getMonth()],
        income,
        visits: m ? r1(m.revenueJournal) : 0,
        subscriptions: m ? r1(m.revenueAbonnements) : 0,
        cafe: m ? r1(m.revenueProducts) : 0,
        current,
        asOfDay: current ? now.getDate() : null,
      };
    });
  }

  private async facts(facilityId: string, now = new Date()) {
    const today = localDayKey(now);
    const [day, coffre, charges, months, debtors, target, visits, membersCount] = await Promise.all([
      this.caisse.daySummary(today),
      this.caisse.coffreList(),
      this.prisma.expense.findMany({ where: { type: 'MENSUEL' }, select: { amount: true } }),
      this.months(now),
      this.members.listDebtors(),
      this.prisma.monthlyTarget.findUnique({
        where: { facilityId_year_month: { facilityId, year: now.getFullYear(), month: now.getMonth() + 1 } },
      }),
      this.prisma.journal.count({ where: { registredTime: { gte: startOfMonth(now), lte: endOfMonth(now) }, hiddenAt: null } }),
      this.prisma.member.count(),
    ]);

    const closed = !!day.session?.closedAt;
    // After closing, only the kept float stays in the drawer (the rest went to the safe)
    const drawer = closed ? (day.session?.keptFloat ?? day.session?.countedClose ?? day.expectedClose) : day.expectedClose;
    const owed = debtors.members.reduce((a, m) => a + m.net, 0);
    const lastFull = months[1];
    const currentMonth = months[2];
    const chargesMonthly = charges.reduce((a, c) => a + c.amount, 0);

    const money: MoneyFacts = {
      asOf: now,
      cashDrawer: {
        amount: r1(drawer),
        detail: `caisse du ${dayLabel(now)} ${closed ? 'clôturée' : 'pas encore clôturée'}`,
      },
      safe: { amount: coffre.balance, hasMovements: coffre.entries.length > 0 },
      fixedCharges: { monthly: r1(chargesMonthly), count: charges.length },
      lastFullMonth: { label: lastFull.longLabel, income: lastFull.income },
      links: { fixedCharges: '/finance' },
    };

    // What the manager read in the app (shown so the owner sees it never asks for these)
    const read = [
      { title: 'Caisse', detail: money.cashDrawer.detail, value: dt(drawer), source: 'Caisse' },
      {
        title: 'Coffre',
        detail: coffre.entries.length ? `${coffre.entries.length} mouvements enregistrés` : 'Aucun mouvement enregistré',
        value: coffre.entries.length ? dt(coffre.balance) : undefined,
        source: 'Coffre',
      },
      {
        title: 'Charges fixes',
        detail: charges.length ? `${charges.length} charges mensuelles` : 'Aucune saisie dans Finance',
        value: charges.length ? `${dt(chargesMonthly)} / mois` : undefined,
        source: 'Finance',
        warn: !charges.length,
      },
      {
        title: `Encaissé en ${currentMonth.longLabel}`,
        detail: `${dt(currentMonth.visits)} passages · ${dt(currentMonth.subscriptions)} abonnements · ${dt(currentMonth.cafe)} café`,
        value: dt(currentMonth.income),
        source: 'Journal',
      },
      {
        title: 'Impayés',
        detail: `${debtors.members.length} client${debtors.members.length > 1 ? 's doivent' : ' doit'} de l'argent`,
        value: dt(owed),
        source: 'Impayés',
        warn: owed > 0,
      },
      ...(target
        ? [{ title: `Objectif ${deMonth(currentMonth.longLabel)}`, detail: 'Fixé dans Objectifs', value: dt(target.revenue), source: 'Objectifs' }]
        : []),
      { title: `Passages en ${currentMonth.longLabel}`, detail: `${membersCount} membres au total`, value: String(visits), source: 'Journal' },
    ];

    return { money, months, read, unpaid: { total: r1(owed), clients: debtors.members.length } };
  }

  // ---------- questions ----------

  async questions(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const [{ money, read }, answers] = await Promise.all([this.facts(id), this.answers(id)]);
    const pending = pendingQuestions(money, answers);
    const k = knowledge(money, answers);
    return {
      pending,
      editable: editableQuestions(money, answers),
      toAsk: pending.length,
      known: k.known,
      total: k.total,
      answers: [...answers.values()]
        .filter((a) => isMoneyKey(a.key))
        .sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime())
        .map((a) => ({
          key: a.key,
          short: QUESTION_SHORT[a.key as keyof typeof QUESTION_SHORT],
          label: a.label,
          note: a.note,
          unknown: a.unknown,
          answeredAt: a.answeredAt.toISOString(),
        })),
      read,
      later: LEGAL_PREVIEW,
    };
  }

  async answer(
    facilityId: string | undefined,
    key: string,
    body: { value?: number | null; label?: string; note?: string | null; unknown?: boolean },
    userId?: string,
  ) {
    if (!isMoneyKey(key)) throw new BadRequestException('Question inconnue');
    const unknown = !!body.unknown;
    const value = unknown ? null : Number(body.value);
    if (!unknown && (!Number.isFinite(value) || value! < 0 || value! > 100_000_000)) {
      throw new BadRequestException('Entrez un montant en DT, par ex. 4300');
    }
    if (key === 'reserve' && !unknown && (value! < 0 || value! > 12)) {
      throw new BadRequestException('Réserve : entre 0 et 12 mois');
    }
    const label = (body.label ?? '').trim().slice(0, 120) || (key === 'reserve' ? `${value} mois` : dt(value ?? 0));
    const note = body.note?.trim().slice(0, 160) || null;
    const id = await this.resolve(facilityId);
    const data = { value, label, note, unknown, answeredAt: new Date(), answeredBy: userId ?? null };
    await this.prisma.businessAnswer.upsert({
      where: { facilityId_key: { facilityId: id, key } },
      create: { facilityId: id, key, ...data },
      update: data,
    });
    return this.questions(id);
  }

  // ---------- money ----------

  async money(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const now = new Date();
    const [{ money, months, unpaid }, answers, seats] = await Promise.all([
      this.facts(id, now),
      this.answers(id),
      this.snapshot.facilitySeats(id),
    ]);
    const plan = computeMoneyPlan(money, answers);
    const metrics = await this.snapshot.periodMetrics(subDays(now, 30), now, seats);

    return {
      asOf: now.toISOString(),
      plan,
      months,
      unpaid,
      ideas: this.ideas(metrics).map((i) => ({ ...i, fit: ideaFit(i.cost, plan, i.notNow) })),
      features: await this.features(id, money, answers),
    };
  }

  /** Coworking ideas from the last 30 days (host-specific rules; costs are estimates). */
  private ideas(m: Awaited<ReturnType<SnapshotService['periodMetrics']>>) {
    const out: Array<{
      key: string;
      title: string;
      why: string;
      cost: number;
      test: string;
      goal: string;
      stop: string;
      notNow: boolean;
      draft?: { category: string; metric: string; targetPct: number; fromHour: number; toHour: number };
    }> = [];
    const peak = [...m.arrivalsByHour].filter((h) => h.hour >= 18).sort((a, b) => b.arrivals - a.arrivals)[0];
    if (m.visits >= 10 && (m.onSiteAfter18hPct ?? 0) >= 40) {
      out.push({
        key: 'evenings',
        title: 'Soirées révision (après 18 h)',
        why: `${m.onSiteAfter18hPct} % des passages sont encore là après 18 h${peak ? `, pic d'arrivées à ${peak.hour % 24} h` : ''}.`,
        cost: 120,
        test: 'Instagram 1 semaine + affiches à la fac',
        goal: '+15 passages le soir en 14 jours',
        stop: 'moins de 5 passages en plus en 14 jours',
        notNow: false,
        draft: { category: 'PROMO', metric: 'visitsPerDay', targetPct: 20, fromHour: 18, toHour: 1 },
      });
    }
    if (m.avgOccupancyPct != null) {
      const full = m.avgOccupancyPct >= 70;
      out.push({
        key: 'more-seats',
        title: 'Plus de places (chaises, bureaux)',
        why: full
          ? `Occupation moyenne ${m.avgOccupancyPct} % : la place commence à manquer.`
          : `Occupation moyenne ${m.avgOccupancyPct} % : la place ne manque pas.`,
        cost: 900,
        test: full ? "Louer 3 chaises 1 mois avant d'acheter" : "Aucun : attendre que l'occupation dépasse 70 %",
        goal: full ? "Occupation aux heures pleines sous 90 %" : '—',
        stop: full ? "si l'occupation baisse sous 60 %" : '—',
        notNow: !full,
      });
    }
    return out;
  }

  private async features(facilityId: string, money: MoneyFacts, answers: Map<string, AnswerRecord>) {
    const ideas = featureIdeas(money, answers);
    if (!ideas.length) return [];
    const rows = await Promise.all(
      ideas.map((i) =>
        this.prisma.featureProposal.upsert({
          where: { facilityId_key: { facilityId, key: i.key } },
          create: { facilityId, key: i.key, title: i.title },
          update: {},
        }),
      ),
    );
    const now = Date.now();
    return ideas
      .map((i) => {
        const row = rows.find((r) => r.key === i.key)!;
        const deferred = row.stage === 'DEFERRED' && row.deferredUntil && row.deferredUntil.getTime() > now;
        const stage = row.stage === 'DEFERRED' && !deferred ? 'SUGGESTED' : row.stage;
        return { ...i, stage, ticket: row.approvedAt ? ticketMarkdown(i, row.approvedAt) : null };
      })
      .filter((f) => f.stage !== 'REJECTED' && f.stage !== 'DEFERRED');
  }

  async setFeatureStage(facilityId: string | undefined, key: string, stage: string) {
    if (!(STAGES as readonly string[]).includes(stage)) throw new BadRequestException('Étape inconnue');
    const id = await this.resolve(facilityId);
    const row = await this.prisma.featureProposal.findUnique({ where: { facilityId_key: { facilityId: id, key } } });
    if (!row) throw new BadRequestException('Demande introuvable');
    await this.prisma.featureProposal.update({
      where: { id: row.id },
      data: {
        stage,
        approvedAt: stage === 'APPROVED' || stage === 'TICKET_READY' ? (row.approvedAt ?? new Date()) : row.approvedAt,
        deferredUntil: stage === 'DEFERRED' ? new Date(Date.now() + DEFER_DAYS * 86_400_000) : null,
      },
    });
    return this.money(id);
  }
}
