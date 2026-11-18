/**
 * Co-admin's eyes and legs for the Directeur: what the app can measure by itself, day by
 * day, and what it can do. Adding an eye = one entry here; the brain sees it in the next export.
 */
import { addDays, endOfDay, startOfDay } from 'date-fns';
import type { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import type { EyeDay, EyeParams, EyeSpec, LegSpec, PlanLeg } from '../../director-core';
import { loadDayFacts } from '../analytics/month-data';
import { orderUnitPrice } from '../product/order-price';
import { sanitizeTool, TOOL_KINDS } from './tools';

type Compute = (prisma: PrismaService, params: EyeParams, from: Date, to: Date) => Promise<EyeDay[]>;
export type Eye = EyeSpec & { compute: Compute };

const HOURS = [
  { name: 'fromHour', label: 'de', type: 'hour' as const },
  { name: 'toHour', label: 'à', type: 'hour' as const },
];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Every day from `from` to `to`, at 0. */
function emptyDays(from: Date, to: Date) {
  const rows = new Map<string, EyeDay>();
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) rows.set(localDayKey(d), { day: localDayKey(d), value: 0 });
  return rows;
}
const inHours = (d: Date, p: EyeParams) => {
  const h = d.getHours();
  const from = typeof p.fromHour === 'number' ? p.fromHour : 0;
  const to = typeof p.toHour === 'number' && p.toHour > 0 ? p.toHour : 24;
  return h >= from && h < to;
};
const matches = (name: string | null | undefined, wanted: unknown) =>
  typeof wanted !== 'string' || !wanted || (name ?? '').toLowerCase().includes(wanted.toLowerCase());
function addTo(rows: Map<string, EyeDay>, at: Date | null, value: number, split?: string, base?: number) {
  if (!at) return;
  const r = rows.get(localDayKey(at));
  if (!r) return;
  r.value += value;
  if (base !== undefined) r.base = (r.base ?? 0) + base;
  if (split) {
    r.split = r.split ?? {};
    r.split[split] = (r.split[split] ?? 0) + value;
  }
}
const done = (rows: Map<string, EyeDay>) =>
  [...rows.values()].map((r) => ({ ...r, value: r1(r.value), ...(r.split ? { split: Object.fromEntries(Object.entries(r.split).map(([k, v]) => [k, r1(v)])) } : {}) }));

export const EYES: Eye[] = [
  {
    id: 'money.day',
    label: 'Argent encaissé',
    unit: 'DT',
    aggregate: 'sum',
    splitBy: 'partie',
    help: 'Argent du jour : passes, café, abonnements, événements.',
    params: [{ name: 'part', label: 'partie', values: ['total', 'passes', 'cafe', 'abos', 'events'] }],
    async compute(prisma, p, from, to) {
      const facts = await loadDayFacts(prisma, from, to);
      return facts.map((f) => {
        const parts = { passes: f.revenueVisits, cafe: f.products, abos: f.subscriptions, events: f.events ?? 0 };
        const part = (p.part as keyof typeof parts | 'total' | undefined) ?? 'total';
        const value = part === 'total' ? parts.passes + parts.cafe + parts.abos + parts.events : parts[part];
        return { day: f.key, value: r1(value), ...(part === 'total' ? { split: parts } : {}) };
      });
    },
  },
  {
    id: 'visits',
    label: 'Visites',
    unit: 'visites',
    aggregate: 'sum',
    splitBy: 'nouveaux / habitués',
    help: 'Check-ins (hors réservations), à l’heure d’arrivée.',
    params: [{ name: 'who', label: 'qui', values: ['all', 'new', 'regulars'] }, ...HOURS],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const [visits, firsts] = await Promise.all([
        prisma.journal.findMany({
          where: { registredTime: { gte: startOfDay(from), lte: endOfDay(to) }, isReservation: false, hiddenAt: null },
          select: { id: true, memberID: true, registredTime: true },
        }),
        prisma.journal.groupBy({ by: ['memberID'], where: { memberID: { not: null }, isReservation: false, hiddenAt: null }, _min: { registredTime: true } }),
      ]);
      const firstAt = new Map(firsts.map((f) => [f.memberID, f._min.registredTime?.getTime()]));
      for (const v of visits) {
        if (!inHours(v.registredTime, p)) continue;
        const isNew = !!v.memberID && firstAt.get(v.memberID) === v.registredTime.getTime();
        if (p.who === 'new' && !isNew) continue;
        if (p.who === 'regulars' && isNew) continue;
        addTo(rows, v.registredTime, 1, isNew ? 'nouveaux' : 'habitués');
      }
      return done(rows);
    },
  },
  {
    id: 'cafe.sales',
    label: 'Ventes café',
    unit: 'articles',
    aggregate: 'sum',
    splitBy: 'canal',
    help: 'Commandes café / snacks payées ou confirmées. Canal app = commandé depuis l’app membre, comptoir = saisi par l’équipe (avant le 19/11/2026 : inconnu).',
    params: [
      { name: 'product', label: 'produit', type: 'text' },
      { name: 'channel', label: 'canal', values: ['all', 'app', 'comptoir'] },
      { name: 'measure', label: 'en', values: ['qty', 'dt'] },
      ...HOURS,
    ],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const orders = await prisma.dailyProduct.findMany({
        where: { date: { gte: startOfDay(from), lte: endOfDay(to) }, status: { notIn: ['PENDING', 'CANCELLED'] } },
        select: { date: true, quantite: true, unitPrice: true, channel: true, product: { select: { name: true, sellingPrice: true } } },
      });
      for (const o of orders) {
        if (!o.date || !inHours(o.date, p) || !matches(o.product?.name, p.product)) continue;
        const channel = o.channel === 'APP' ? 'app' : o.channel === 'COUNTER' ? 'comptoir' : 'inconnu';
        if (p.channel && p.channel !== 'all' && p.channel !== channel) continue;
        const qty = o.quantite || 0;
        addTo(rows, o.date, p.measure === 'dt' ? orderUnitPrice(o) * qty : qty, channel);
      }
      return done(rows);
    },
  },
  {
    id: 'cafe.attach',
    label: 'Visites avec un café',
    unit: '%',
    aggregate: 'ratio',
    help: 'Part des visites où le client a pris au moins un article (même visite ou même client le même jour).',
    params: [...HOURS],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const range = { gte: startOfDay(from), lte: endOfDay(to) };
      const [visits, orders] = await Promise.all([
        prisma.journal.findMany({ where: { registredTime: range, isReservation: false, hiddenAt: null }, select: { id: true, memberID: true, registredTime: true } }),
        prisma.dailyProduct.findMany({ where: { date: range, status: { notIn: ['PENDING', 'CANCELLED'] } }, select: { journalId: true, memberId: true, date: true } }),
      ]);
      const byJournal = new Set(orders.map((o) => o.journalId).filter(Boolean));
      const byMemberDay = new Set(orders.filter((o) => o.memberId && o.date).map((o) => `${o.memberId}|${localDayKey(o.date!)}`));
      for (const v of visits) {
        if (!inHours(v.registredTime, p)) continue;
        const took = byJournal.has(v.id) || (!!v.memberID && byMemberDay.has(`${v.memberID}|${localDayKey(v.registredTime)}`));
        addTo(rows, v.registredTime, took ? 1 : 0, undefined, 1);
      }
      return done(rows);
    },
  },
  {
    id: 'offers.sold',
    label: 'Visites par offre',
    unit: 'passes',
    aggregate: 'sum',
    splitBy: 'offre',
    help: 'Visites par offre du catalogue (2h, 4h, journée…), à l’heure d’arrivée.',
    params: [{ name: 'offer', label: 'offre', type: 'text' }, ...HOURS],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const visits = await prisma.journal.findMany({
        where: { registredTime: { gte: startOfDay(from), lte: endOfDay(to) }, isReservation: false, hiddenAt: null, priceId: { not: null } },
        select: { registredTime: true, prices: { select: { name: true } } },
      });
      for (const v of visits) {
        if (!inHours(v.registredTime, p) || !matches(v.prices?.name, p.offer)) continue;
        addTo(rows, v.registredTime, 1, v.prices?.name ?? 'Autre');
      }
      return done(rows);
    },
  },
  {
    id: 'abos',
    label: 'Abonnements',
    unit: 'abonnements',
    aggregate: 'sum',
    splitBy: 'formule',
    help: 'new = premier abonnement du client, renewed = un client qui en avait déjà un, ended = abonnements qui se terminent.',
    params: [{ name: 'what', label: 'quoi', values: ['new', 'renewed', 'ended'] }],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const range = { gte: startOfDay(from), lte: endOfDay(to) };
      if (p.what === 'ended') {
        const ended = await prisma.abonnement.findMany({ where: { leaveDate: range, isReservation: false }, select: { leaveDate: true, serviceName: true } });
        for (const a of ended) addTo(rows, a.leaveDate, 1, a.serviceName ?? 'Abonnement');
        return done(rows);
      }
      const created = await prisma.abonnement.findMany({ where: { createdAt: range, isReservation: false }, select: { memberID: true, createdAt: true, serviceName: true } });
      const firsts = await prisma.abonnement.groupBy({
        by: ['memberID'],
        where: { memberID: { in: [...new Set(created.map((a) => a.memberID))] }, isReservation: false },
        _min: { createdAt: true },
      });
      const firstAt = new Map(firsts.map((f) => [f.memberID, f._min.createdAt?.getTime()]));
      for (const a of created) {
        const isNew = firstAt.get(a.memberID) === a.createdAt?.getTime();
        if ((p.what ?? 'new') === 'new' ? isNew : !isNew) addTo(rows, a.createdAt ?? null, 1, a.serviceName ?? 'Abonnement');
      }
      return done(rows);
    },
  },
  {
    id: 'unpaid',
    label: 'Impayés',
    unit: 'DT',
    aggregate: 'sum',
    help: 'Argent dû par les visites parties sans payer, au jour de la visite (encore dû aujourd’hui).',
    params: [],
    async compute(prisma, _p, from, to) {
      const rows = emptyDays(from, to);
      const left = await prisma.journal.findMany({
        where: { registredTime: { gte: startOfDay(from), lte: endOfDay(to) }, isPayed: false, leaveTime: { not: null }, isReservation: false, hiddenAt: null },
        select: { registredTime: true, amountAtCheckout: true, payedAmount: true },
      });
      for (const v of left) addTo(rows, v.registredTime, v.amountAtCheckout ?? v.payedAmount ?? 0);
      return done(rows);
    },
  },
  {
    id: 'promo.uses',
    label: 'Promos utilisées',
    unit: 'utilisations',
    aggregate: 'sum',
    splitBy: 'promo',
    help: 'Chaque fois qu’une promo a servi (pass ou café).',
    params: [{ name: 'promotion', label: 'promo', type: 'text' }],
    async compute(prisma, p, from, to) {
      const rows = emptyDays(from, to);
      const uses = await prisma.promotionUse.findMany({
        where: { createdAt: { gte: startOfDay(from), lte: endOfDay(to) } },
        select: { createdAt: true, promotion: { select: { title: true } } },
      });
      for (const u of uses) if (matches(u.promotion?.title, p.promotion)) addTo(rows, u.createdAt, 1, u.promotion?.title ?? 'Promo');
      return done(rows);
    },
  },
];

export const eyeSpecs = (): EyeSpec[] => EYES.map(({ compute: _c, ...spec }) => spec);
export const eyeById = (id: string) => EYES.find((e) => e.id === id) ?? null;

const FIELDS = 'title, text, price, discountPct, date, days, fromHour, toHour, capacity, segment, items';
export const LEGS: LegSpec[] = [
  { kind: 'NOTE', label: 'Écrire une note (add)', needsOk: false, fields: 'voir add' },
  { kind: 'WATCH', label: 'Suivre un chiffre (watch)', needsOk: false, fields: 'voir watch' },
  { kind: 'LOOK', label: 'Demander des données (look)', needsOk: false, fields: 'voir look' },
  { kind: 'PROMOTION', label: 'Promo : title, discountPct ou price (formule), items = produits exacts, days, fromHour/toHour, date de début', needsOk: true, fields: FIELDS },
  { kind: 'CAMPAIGN', label: 'Relance WhatsApp : segment (ABO_EXPIRING, ABO_ENDED, INACTIVE, TOP_UP, CONVERT, UNPAID, RECENT_30, ALL), text = message', needsOk: true, fields: FIELDS },
  { kind: 'EVENT', label: 'Événement : title, text, date, fromHour, toHour, price, capacity', needsOk: true, fields: FIELDS },
  { kind: 'SURVEY', label: 'Enquête : title, text = intro, items = 3 à 6 questions', needsOk: true, fields: FIELDS },
  { kind: 'PRICE', label: 'Tarif : title, price, fromHour/toHour pour un créneau', needsOk: true, fields: FIELDS },
  { kind: 'PRODUCT', label: 'Produit : title, price', needsOk: true, fields: FIELDS },
];

/** One leg of Claude's answer, checked with the same rules as the Conseil tools. */
export function checkLeg(kind: string, raw: { label?: unknown; draft?: unknown }, ctx: { now: Date; products: Array<{ id: string; name: string }> }): PlanLeg | null {
  if (!(TOOL_KINDS as readonly string[]).includes(kind)) return null;
  const tool = sanitizeTool({ kind, step: 0, label: typeof raw.label === 'string' ? raw.label : '', draft: raw.draft as never }, { steps: 0, now: ctx.now, products: ctx.products });
  return tool ? { kind: tool.kind, label: tool.label, draft: tool.draft } : null;
}
