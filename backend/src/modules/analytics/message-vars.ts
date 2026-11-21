/**
 * Variables a message can use: {prenom} {derniere_visite} {visites} {abonnement}
 * {fin_abonnement} {offre} {espace}. Missing values become empty, never invented.
 */
import { format, startOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';

export const MESSAGE_VARS = ['prenom', 'derniere_visite', 'visites', 'abonnement', 'fin_abonnement', 'offre', 'espace'] as const;
export type MessageVars = Partial<Record<(typeof MESSAGE_VARS)[number], string>>;

/** "Bonjour {prenom}, …" → "Bonjour Sarra, …"; an unknown {word} is left as typed. */
export function fillMessage(template: string, vars: MessageVars) {
  return template
    .replace(/\{\s*pr[ée]nom\s*\}/gi, vars.prenom ?? '')
    .replace(/\{\s*([a-z_]+)\s*\}/gi, (all, key: string) => {
      const k = key.toLowerCase() as keyof MessageVars;
      return (MESSAGE_VARS as readonly string[]).includes(k) ? vars[k] ?? '' : all;
    })
    .replace(/ +([,.])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

const day = (d: Date) => format(d, 'd MMMM', { locale: fr });

/** Each member's values for the variables (one query per table, not per member). */
export async function memberMessageVars(prisma: PrismaService, ids: string[], place: string) {
  const out = new Map<string, MessageVars>();
  if (!ids.length) return out;
  const since = subDays(startOfDay(new Date()), 29);
  const [people, lastVisits, recent, abos] = await Promise.all([
    prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true } }),
    prisma.journal.groupBy({
      by: ['memberID'],
      where: { memberID: { in: ids }, isReservation: false, hiddenAt: null },
      _max: { registredTime: true },
    }),
    prisma.journal.findMany({
      where: { memberID: { in: ids }, isReservation: false, hiddenAt: null, registredTime: { gte: since } },
      select: { memberID: true, registredTime: true },
    }),
    prisma.abonnement.findMany({
      where: { memberID: { in: ids }, isReservation: false, hiddenAt: null },
      orderBy: { registredDate: 'desc' },
      select: { memberID: true, leaveDate: true, terminatedAt: true, serviceName: true, price: { select: { name: true } } },
    }),
  ]);
  const last = new Map(lastVisits.map((v) => [v.memberID!, v._max.registredTime]));
  const days = new Map<string, Set<string>>();
  for (const v of recent) {
    const s = days.get(v.memberID!) ?? new Set<string>();
    s.add(localDayKey(v.registredTime));
    days.set(v.memberID!, s);
  }
  const abo = new Map<string, (typeof abos)[number]>();
  for (const a of abos) if (!abo.has(a.memberID)) abo.set(a.memberID, a);
  for (const p of people) {
    const lv = last.get(p.id);
    const a = abo.get(p.id);
    const end = a?.terminatedAt ?? a?.leaveDate;
    out.set(p.id, {
      prenom: p.firstName?.trim() || '',
      derniere_visite: lv ? day(lv) : '',
      visites: String(days.get(p.id)?.size ?? 0),
      abonnement: a ? a.serviceName || a.price?.name || 'abonnement' : '',
      fin_abonnement: end ? day(end) : '',
      espace: place,
    });
  }
  return out;
}
