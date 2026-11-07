import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { orderUnitPrice } from '../product/order-price';
import {
  cafeRate,
  calendarEffects,
  calendarKeys,
  dayFactorsFor,
  lastingChanges,
  unusualDays,
  type DayFact,
} from '../../business-manager-core';
import { expenseAmount, guessCategory } from '../expense/expense-amount';
import { computeMonthForecast, loadCalendar, loadDayFacts } from './month-data';
import { PerformanceService } from './performance.service';

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const variable = (d: DayFact) => d.revenueVisits + d.products;

/** One-tap answers to « pourquoi ce jour ? ». `calendar` answers become calendar facts, so the forecast learns them. */
export const UNUSUAL_REASONS = [
  { code: 'EXAMS', label: 'Examens / révisions', calendar: { kind: 'PERIOD', tag: 'exams' } },
  { code: 'HOLIDAY', label: 'Vacances / jour férié', calendar: { kind: 'PERIOD', tag: 'vacation' } },
  { code: 'EVENT', label: 'Un événement', calendar: { kind: 'LOCAL_EVENT', tag: null } },
  { code: 'PROMO', label: 'Promotion / publication', calendar: null },
  { code: 'PRODUCT', label: 'Nouveau produit / règle', calendar: null },
  { code: 'WEATHER', label: 'Météo', calendar: null },
  { code: 'CLOSED', label: 'Ouvert moins / fermé', calendar: null },
  { code: 'UNKNOWN', label: 'Je ne sais pas', calendar: null },
] as const;

/** First day of the school year containing `d` (1 September). */
export function schoolYearStart(d: Date) {
  return new Date(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1, 8, 1);
}

/**
 * Finance › Année, unusual days and café: the school year as one curve
 * (exams, holidays and summer move the business, months only pay the rent),
 * days that peaked or dropped with no reason known, and café per visit.
 */
@Injectable()
export class FinanceYearService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
  ) {}

  // ---------- unusual days ----------

  /** Unusual days of the last 60 days, with the owner's answer when there is one. */
  async unusual(facilityId?: string, now = new Date()) {
    const s = await this.performance.settings(facilityId);
    const yesterday = subDays(startOfDay(now), 1);
    const from = subDays(yesterday, 60 + 28);
    const [days, calendar, answers] = await Promise.all([
      loadDayFacts(this.prisma, from, yesterday),
      loadCalendar(this.prisma, s.facilityId),
      this.prisma.businessAnswer.findMany({
        where: { facilityId: s.facilityId, key: { startsWith: 'unusual:' } },
        select: { key: true, label: true, note: true },
      }),
    ]);
    const { inside } = calendarKeys(calendar);
    const found = unusualDays(days, inside, { from: localDayKey(subDays(yesterday, 59)) });
    const answered = new Map(answers.map((a) => [a.key.slice('unusual:'.length), a]));
    const list = found
      .map((d) => {
        const a = answered.get(d.key);
        return {
          ...d,
          label: format(new Date(`${d.key}T12:00:00`), 'EEEE d MMMM', { locale: fr }),
          answer: a ? { label: a.label, note: a.note } : null,
        };
      })
      .reverse();
    return {
      rules: { up: 50, down: -40, minAbs: 40, window: 60 },
      days: list,
      toAnswer: list.filter((d) => !d.answer).length,
      lasting: lastingChanges(found).reverse(),
      reasons: UNUSUAL_REASONS.map(({ code, label, calendar: c }) => ({ code, label, learns: !!c })),
    };
  }

  /** The owner says why a day was unusual. Calendar reasons become a dated fact the forecast learns from. */
  async answerUnusual(facilityId: string | undefined, body: { day?: string; reason?: string; note?: string }) {
    const s = await this.performance.settings(facilityId);
    if (!body.day || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) throw new BadRequestException('Jour invalide');
    const reason = UNUSUAL_REASONS.find((r) => r.code === body.reason);
    if (!reason) throw new BadRequestException('Réponse invalide');
    const note = body.note?.trim().slice(0, 300) || null;
    const key = `unusual:${body.day}`;
    await this.prisma.businessAnswer.upsert({
      where: { facilityId_key: { facilityId: s.facilityId, key } },
      create: { facilityId: s.facilityId, key, label: reason.label, note, unknown: reason.code === 'UNKNOWN' },
      update: { label: reason.label, note, unknown: reason.code === 'UNKNOWN', answeredAt: new Date() },
    });
    const externalId = `unusual:${body.day}`;
    if (reason.calendar) {
      const day = new Date(`${body.day}T00:00:00`);
      const data = {
        kind: reason.calendar.kind,
        tag: reason.calendar.tag,
        title: note || reason.label,
        startDate: day,
        endDate: day,
        source: 'MANUAL',
        confirmed: true,
      };
      await this.prisma.advisorFact.upsert({
        where: { facilityId_externalId: { facilityId: s.facilityId, externalId } },
        create: { facilityId: s.facilityId, externalId, ...data },
        update: data,
      });
    } else {
      await this.prisma.advisorFact.deleteMany({ where: { facilityId: s.facilityId, externalId } });
    }
    return { ok: true };
  }

  // ---------- school year ----------

  async schoolYear(facilityId?: string, now = new Date()) {
    const s = await this.performance.settings(facilityId);
    const start = schoolYearStart(now);
    const end = new Date(start.getFullYear() + 1, 7, 31);
    const today = startOfDay(now);
    const yesterday = subDays(today, 1);
    const [history, calendar, f, charges, payments, visitors] = await Promise.all([
      loadDayFacts(this.prisma, subDays(start, 365), now),
      loadCalendar(this.prisma, s.facilityId),
      computeMonthForecast(this.prisma, s.facilityId, now.getFullYear(), now.getMonth() + 1, now),
      this.prisma.expense.findMany({ where: { type: 'MENSUEL' }, select: { id: true, name: true, amount: true } }),
      this.prisma.dailyExpense.findMany({
        where: { OR: [{ date: { gte: start, lte: end } }, { forMonth: { gte: format(start, 'yyyy-MM') } }] },
        select: { amount: true, label: true, category: true, date: true, createdAt: true, forMonth: true, spreadMonths: true, expenseId: true, expense: { select: { amount: true, name: true } } },
      }),
      this.prisma.journal.findMany({
        where: { registredTime: { gte: subDays(today, 30), lte: now }, isReservation: false, memberID: { not: null } },
        select: { memberID: true, members: { select: { profileType: true } } },
      }),
    ]);

    // A normal day by weekday = the month forecast's base (previous month, recent days weigh more)
    const normal = f.perWeekday.map((w) => w.revenueVisits + w.products);
    const effects = calendarEffects(history, calendar);
    const yearDays = Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 }, (_, i) => {
      const d = addDays(start, i);
      return { key: localDayKey(d), weekday: d.getDay() };
    });
    const factors = dayFactorsFor(yearDays, calendar, effects);
    const byKey = new Map(history.map((d) => [d.key, d]));
    const todayKey = localDayKey(today);

    // Weeks (Monday) covering the school year
    const weeks: Array<{
      from: string;
      to: string;
      label: string;
      actual: number | null;
      expected: number;
      normal: number;
      period: string | null;
      periodType: string | null;
      known: boolean;
      current: boolean;
    }> = [];
    for (let w = startOfWeek(start, { weekStartsOn: 1 }); w <= end; w = addDays(w, 7)) {
      const keys = Array.from({ length: 7 }, (_, i) => addDays(w, i)).filter((d) => d >= start && d <= end);
      let actual = 0;
      let expected = 0;
      let usual = 0;
      let lived = 0;
      let period: string | null = null;
      let periodType: string | null = null;
      let known = true;
      for (const d of keys) {
        const k = localDayKey(d);
        const n = normal[d.getDay()] ?? 0;
        const fac = factors[k];
        usual += n;
        if (k < todayKey) {
          lived += 1;
          const fact = byKey.get(k);
          actual += fact ? variable(fact) + fact.subscriptions + (fact.events ?? 0) : 0;
        } else {
          expected += n * (fac?.factor ?? 1);
        }
        if (fac && !period) {
          period = fac.label;
          periodType = fac.type;
          known = fac.known;
        }
      }
      const first = keys[0];
      weeks.push({
        from: localDayKey(first),
        to: localDayKey(keys[keys.length - 1]),
        label: format(first, 'd MMM', { locale: fr }),
        actual: lived ? r1(actual) : null,
        expected: r1(expected),
        normal: r1(usual),
        period,
        periodType,
        known,
        current: lived > 0 && lived < keys.length,
      });
    }

    // Rent: monthly charges recognised as rent, paid (counted for the month) or not
    const rentTemplates = charges.filter((c) => guessCategory(c.name) === 'LOYER');
    const rentPerMonth = rentTemplates.reduce((a, c) => a + c.amount, 0) || null;
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = format(m, 'yyyy-MM');
      const rentPaid = payments
        .filter((p) => {
          const forKey = p.forMonth ?? format(p.date ?? p.createdAt, 'yyyy-MM');
          const isRent = (p.category ?? guessCategory(p.label ?? p.expense?.name)) === 'LOYER' || rentTemplates.some((t) => t.id === p.expenseId);
          return isRent && forKey === key;
        })
        .reduce((a, p) => a + expenseAmount(p), 0);
      const mEnd = endOfMonth(m);
      const inMonth = weeks.filter((w) => w.from >= key + '-01' && w.from <= localDayKey(mEnd));
      return {
        key,
        label: format(m, 'MMMM', { locale: fr }),
        rent: rentPerMonth,
        rentPaid: r1(rentPaid),
        revenue: r1(inMonth.reduce((a, w) => a + (w.actual ?? 0) + w.expected, 0)),
        past: mEnd < today,
      };
    });

    // Summer reserve: July + August rent, to put aside each week until 1 July
    const july = new Date(start.getFullYear() + 1, 6, 1);
    const weeksToJuly = Math.max(1, Math.ceil((july.getTime() - today.getTime()) / (7 * 86_400_000)));
    const summerGoal = rentPerMonth ? rentPerMonth * 2 : null;

    // Normal weeks: the usual week of the base vs the first normal week of the year
    const normalWeek = r1(normal.reduce((a, n) => a + n, 0));
    const firstWeeks = weeks.filter((w) => w.actual != null && !w.period && !w.current).slice(0, 1);

    // Who comes (last 30 days, members with a profile)
    const seen = new Map<string, string | null>();
    for (const v of visitors) if (v.memberID && !seen.has(v.memberID)) seen.set(v.memberID, v.members?.profileType ?? null);
    const who = { PUPIL: 0, STUDENT: 0, PRO: 0, UNKNOWN: 0 };
    for (const t of seen.values()) who[(t as keyof typeof who) ?? 'UNKNOWN'] = (who[(t as keyof typeof who) ?? 'UNKNOWN'] ?? 0) + 1;

    const done = weeks.reduce((a, w) => a + (w.actual ?? 0), 0);
    const toCome = weeks.reduce((a, w) => a + w.expected, 0);
    return {
      from: localDayKey(start),
      to: localDayKey(end),
      label: `${start.getFullYear()}–${start.getFullYear() + 1}`,
      weeks,
      months,
      calendar: calendar
        .filter((c) => c.end >= localDayKey(start) && c.start <= localDayKey(end))
        .map((c) => ({ ...c, effect: effects[c.type]?.factor ?? null })),
      effects: Object.values(effects)
        .filter((e) => !e.type.includes(':'))
        .map((e) => ({ ...e, label: calendar.find((c) => c.type === e.type)?.label ?? e.type })),
      year: { done: r1(done), toCome: r1(toCome), total: r1(done + toCome) },
      normalWeek: { now: normalWeek, first: firstWeeks[0]?.actual ?? null, firstFrom: firstWeeks[0]?.from ?? null },
      summer: { goal: summerGoal, weeksLeft: weeksToJuly, perWeek: summerGoal ? r1(summerGoal / weeksToJuly) : null, rentPerMonth },
      who: { ...who, total: seen.size },
      todayKey,
      yesterdayKey: localDayKey(yesterday),
    };
  }

  // ---------- café ----------

  /** Café and products of a month: DT per visit (and the change of habit), each day, each product. */
  async cafe(facilityId?: string, year?: number, month?: number, now = new Date()) {
    const s = await this.performance.settings(facilityId);
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);
    const isCurrent = now >= start && now <= end;
    const to = isCurrent ? now : end;
    const [f, days, orders] = await Promise.all([
      computeMonthForecast(this.prisma, s.facilityId, y, m, now),
      loadDayFacts(this.prisma, subDays(start, 28), to),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: start, lte: to }, status: { notIn: ['PENDING', 'CANCELLED'] } },
        select: { quantite: true, unitPrice: true, isPayed: true, date: true, product: { select: { id: true, name: true, sellingPrice: true } } },
      }),
    ]);
    const todayKey = localDayKey(now);
    const complete = days.filter((d) => d.key < todayKey);
    const rate = cafeRate(complete.slice(-28));
    const monthDays = days.filter((d) => d.key >= localDayKey(start));
    const actual = r1(monthDays.reduce((a, d) => a + d.products, 0));
    const visits = monthDays.reduce((a, d) => a + d.visits, 0);
    const withOrder = new Set(orders.filter((o) => o.date).map((o) => localDayKey(o.date!))).size;

    const byProduct = new Map<string, { id: string; name: string; qty: number; revenue: number; offered: number; unpaid: number; unpaidQty: number }>();
    for (const o of orders) {
      const p = byProduct.get(o.product.id) ?? { id: o.product.id, name: o.product.name, qty: 0, revenue: 0, offered: 0, unpaid: 0, unpaidQty: 0 };
      const unit = orderUnitPrice(o);
      p.qty += o.quantite;
      p.revenue += unit * o.quantite;
      if (unit === 0) p.offered += o.quantite;
      if (!o.isPayed && unit > 0) {
        p.unpaid += unit * o.quantite;
        p.unpaidQty += o.quantite;
      }
      byProduct.set(o.product.id, p);
    }
    const products = [...byProduct.values()]
      .map((p) => ({ ...p, revenue: r2(p.revenue), unpaid: r2(p.unpaid), offeredValue: r2(p.offered * (orders.find((o) => o.product.id === p.id)?.product.sellingPrice ?? 0)) }))
      .sort((a, b) => b.revenue - a.revenue);
    // Café still to come = expected visits of the days left × DT per visit
    const left = f.days.filter((d) => d.actual == null);
    const visitsLeft = left.reduce((a, d) => a + (f.perWeekday[d.weekday]?.visits ?? 0) * (d.period?.factor ?? 1), 0);
    const toCome = rate ? r1(visitsLeft * rate.perVisit) : r1(Math.max(0, f.expected.products - actual));
    return {
      period: { year: y, month: m, label: format(start, 'MMMM yyyy', { locale: fr }), isCurrent },
      rate,
      actual,
      /** Café expected for the whole month: sold so far + still to come */
      expected: r1(actual + toCome),
      toCome,
      visitsLeft: r1(visitsLeft),
      visits,
      perVisitMonth: visits ? r2(actual / visits) : null,
      daysWithOrders: withOrder,
      daily: days.map((d) => ({ key: d.key, products: d.products, visits: d.visits, perVisit: d.visits ? r2(d.products / d.visits) : null })),
      products,
      offered: { qty: products.reduce((a, p) => a + p.offered, 0), value: r2(products.reduce((a, p) => a + p.offeredValue, 0)) },
      unpaid: { qty: products.reduce((a, p) => a + p.unpaidQty, 0), value: r2(products.reduce((a, p) => a + p.unpaid, 0)) },
    };
  }
}
