/**
 * Export of the month forecast and every number behind it (JSON + CSV), to
 * study the method outside the app. Read only.
 */
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import type { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { calendarKeys, usualDays } from '../../business-manager-core';
import {
  aboPrice,
  byMember,
  computeMonthForecast,
  loadAbonnements,
  loadCalendar,
  loadDayFacts,
  renewalOf,
} from './month-data';

const WEEKDAY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const r1 = (n: number) => Math.round(n * 10) / 10;

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export const HOW_IT_WORKS = {
  curve: 'Chaque jour : passes et café = moyenne du même jour de semaine sur les jours habituels de la base × l’effet du calendrier. Abonnements le jour où ceux en cours finissent, événements le jour de l’événement.',
  base: 'Jusqu’à 4 jours habituels de chaque jour de semaine dans les 8 semaines avant le mois. Jours fériés, périodes du calendrier et leur veille/lendemain exclus.',
  calendarFactor: 'Passes + café des fois précédentes du même type de date ÷ les mêmes jours de semaine habituels les plus proches. Jamais mesuré = 1, fourchette plus large.',
  projectionCurrent: 'Passes + café réels des jours finis + prévu des jours restants + le plus grand entre abonnements déjà payés et prévus + événements (payés + places réservées).',
  projectionPace: 'Pareil, mais les jours restants bougent avec l’écart déjà vu : × (1 + écart % × jours vécus ÷ (jours vécus + 7)), entre 50 % et 150 %.',
  abonnements: 'Valeur des abonnements qui finissent ce mois × taux de renouvellement + nouveaux abonnés au rythme des 28 jours avant le mois.',
  previous: 'Mois dernier : passes et café rejoués sur les jours de semaine de ce mois, abonnements et événements à la même date.',
  objectif: 'Objectif CA = tout ce qui est encaissé. Objectif net = CA − dépenses.',
};

export async function buildForecastExport(prisma: PrismaService, facilityId: string, year: number, month: number, now = new Date()) {
  const f = await computeMonthForecast(prisma, facilityId, year, month, now);
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const histFrom = startOfMonth(subMonths(start, 2));
  const monthKey = localDayKey(start);
  const [facts, calendar, abos] = await Promise.all([
    loadDayFacts(prisma, histFrom, end < now ? end : now),
    loadCalendar(prisma, facilityId),
    loadAbonnements(prisma),
  ]);
  const { all: special } = calendarKeys(calendar);
  const before = facts.filter((d) => d.key < monthKey);
  const base = usualDays(before.slice(-56), special, 4);
  const baseKeys = new Set(base.map((d) => d.key));
  const factByKey = new Map(facts.map((d) => [d.key, d]));
  const labelOf = new Map(f.sources.list.map((s) => [s.key, s.label]));
  const tarifKeys = f.sources.list.filter((s) => s.kind === 'tarif').map((s) => s.key);
  const pace = f.toDate?.pace.multiplier ?? 1;

  const days = f.days.map((d, i) => {
    const src = f.sources.days[i];
    const fact = factByKey.get(d.key);
    const lived = d.actual != null;
    const row: Record<string, unknown> = {
      date: d.key,
      jour: WEEKDAY[d.weekday],
      calendrier: d.period?.label ?? '',
      facteur_calendrier: d.period?.factor ?? 1,
      effet_connu: d.period ? (d.period.known ? 'oui' : 'non') : '',
      jour_complet: d.complete ? 'oui' : 'non',
      prevu_passes_cafe: d.expected,
      prevu_cumul: d.expectedCum,
      fourchette_basse_cumul: d.lowCum,
      fourchette_haute_cumul: d.highCum,
      prevu_rythme_passes_cafe: d.complete ? '' : r1(d.expected * pace),
      reel_passes_cafe: d.actual ?? '',
      reel_cumul: d.actualCum ?? '',
      reel_visites: lived ? fact?.visits ?? 0 : '',
      reel_nouveaux: lived ? fact?.newVisitors ?? 0 : '',
    };
    for (const k of [...tarifKeys, 'cafe', 'abos', 'events']) {
      const name = labelOf.get(k) ?? k;
      row[`prevu:${name}`] = src.expected[k] ?? 0;
      row[`reel:${name}`] = src.actual ? src.actual[k] ?? 0 : '';
      row[`mois_dernier:${name}`] = src.previous[k] ?? 0;
    }
    return row;
  });

  const history = before.map((d) => ({
    date: d.key,
    jour: WEEKDAY[d.weekday],
    dans_la_base: baseKeys.has(d.key) ? 'oui' : 'non',
    jour_special: special.has(d.key) ? 'oui' : 'non',
    passes: d.revenueVisits,
    cafe: d.products,
    passes_cafe: r1(d.revenueVisits + d.products),
    abonnements_encaisses: d.subscriptions,
    evenements: d.events ?? 0,
    visites: d.visits,
    nouveaux: d.newVisitors,
  }));

  const baseRows = base.map((d) => ({
    date: d.key,
    jour: WEEKDAY[d.weekday],
    passes: d.revenueVisits,
    cafe: d.products,
    passes_cafe: r1(d.revenueVisits + d.products),
    visites: d.visits,
    nouveaux: d.newVisitors,
  }));

  const members = byMember(abos);
  const abonnements = abos
    .filter((a) => a.leaveDate && a.leaveDate >= start && a.leaveDate <= end)
    .map((a) => {
      const next = renewalOf(a, members);
      return {
        membre: a.memberName,
        offre: a.priceName,
        debut: localDayKey(a.registredDate),
        fin: localDayKey(a.leaveDate!),
        prix: aboPrice(a),
        arrete_par_vous: a.terminatedAt ? 'oui' : 'non',
        deja_renouvele: next ? `oui (${next.priceName}, ${localDayKey(next.registredDate)})` : 'non',
      };
    });

  const tag = `${year}-${String(month).padStart(2, '0')}`;
  return {
    tag,
    json: {
      exportedAt: now.toISOString(),
      month: tag,
      howItWorks: HOW_IT_WORKS,
      forecast: f,
      baseDays: baseRows,
      calendarEntries: calendar,
    },
    csv: {
      days: toCsv(days),
      base: toCsv(baseRows),
      history: toCsv(history),
      abonnements: toCsv(abonnements),
    },
  };
}
