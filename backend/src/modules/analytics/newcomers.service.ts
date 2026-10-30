import { Injectable } from '@nestjs/common';
import { addDays, differenceInCalendarDays, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';

const DAY_MS = 86_400_000;
const RETURN_DAYS = 14;
/** A second check-in the same half-day is the same visit, not a return. */
const SAME_VISIT_MS = 6 * 3_600_000;

export const PROFILE_LABEL: Record<string, string> = {
  STUDENT: 'Étudiants',
  PUPIL: 'Élèves',
  PRO: 'Pros',
};
export const HEARD_FROM_LABEL: Record<string, string> = {
  INSTAGRAM: 'Instagram / Facebook',
  FRIEND: 'Un ami',
  SCHOOL: 'Fac / école',
  WALK_BY: 'Passé devant',
  OTHER: 'Autre',
};
const WEEKDAY = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export type Newcomer = {
  memberId: string;
  first: Date;
  firstLeave: Date | null;
  visitDays: number;
  last: Date;
  /** Came back within 14 days of the first visit */
  back: boolean;
  /** At least 14 days since the first visit (return can be judged) */
  judged: boolean;
  appDay1: boolean;
  hasApp: boolean;
  profileType: string | null;
  heardFrom: string | null;
};

type Row = { label: string; count: number; back: number; pct: number | null };

function rate(back: number, count: number) {
  return count ? Math.round((back / count) * 100) : null;
}

/** First visits, returns within 14 days, and what goes with coming back. */
@Injectable()
export class NewcomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every member with at least one visit, with their first visit facts. */
  async newcomers(now = new Date()): Promise<Newcomer[]> {
    const [visits, members] = await Promise.all([
      this.prisma.journal.findMany({
        where: { memberID: { not: null }, isReservation: false, hiddenAt: null, registredTime: { lte: now } },
        select: { memberID: true, registredTime: true, leaveTime: true },
        orderBy: { registredTime: 'asc' },
      }),
      this.prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, pwaInstalledAt: true, profileType: true, heardFrom: true },
      }),
    ]);
    const info = new Map(members.map((m) => [m.id, m]));
    const byMember = new Map<string, { registredTime: Date; leaveTime: Date | null }[]>();
    for (const v of visits) {
      const list = byMember.get(v.memberID!) ?? [];
      list.push(v);
      byMember.set(v.memberID!, list);
    }
    const out: Newcomer[] = [];
    for (const [memberId, list] of byMember) {
      const m = info.get(memberId);
      if (!m) continue;
      const first = list[0].registredTime;
      const limit = first.getTime() + RETURN_DAYS * DAY_MS;
      const back = list.some(
        (v) => v.registredTime.getTime() > first.getTime() + SAME_VISIT_MS && v.registredTime.getTime() <= limit,
      );
      out.push({
        memberId,
        first,
        firstLeave: list[0].leaveTime,
        visitDays: new Set(list.map((v) => localDayKey(v.registredTime))).size,
        last: list[list.length - 1].registredTime,
        back,
        judged: now.getTime() - first.getTime() >= RETURN_DAYS * DAY_MS || back,
        appDay1: !!m.pwaInstalledAt && m.pwaInstalledAt.getTime() <= first.getTime() + DAY_MS,
        hasApp: !!m.pwaInstalledAt,
        profileType: m.profileType,
        heardFrom: m.heardFrom,
      });
    }
    return out;
  }

  async overview(opts: { weeks?: number } = {}) {
    const now = new Date();
    const weeks = Math.min(26, Math.max(4, opts.weeks || 12));
    const all = await this.newcomers(now);
    const from = startOfWeek(subDays(now, (weeks - 1) * 7), { weekStartsOn: 1 });
    const recent = all.filter((n) => n.first >= from);

    // Weekly cohorts
    const cohorts = Array.from({ length: weeks }, (_, i) => {
      const start = addDays(from, i * 7);
      const end = addDays(start, 7);
      const rows = recent.filter((n) => n.first >= start && n.first < end);
      const back = rows.filter((n) => n.back).length;
      return {
        weekStart: start,
        count: rows.length,
        back,
        pct: rate(back, rows.length),
        /** Less than 14 days since the end of the week: too early to judge */
        early: differenceInCalendarDays(now, end) < RETURN_DAYS,
        avgVisitDays: rows.length
          ? Math.round((rows.reduce((a, n) => a + n.visitDays, 0) / rows.length) * 10) / 10
          : null,
        appDay1: rows.filter((n) => n.appDay1).length,
      };
    });
    let cumulative = all.filter((n) => n.first < from).length;
    const withTotal = cohorts.map((c) => ({ ...c, total: (cumulative += c.count) }));

    // Daily (last 60 days)
    const dayFrom = startOfDay(subDays(now, 59));
    const perDay = new Map<string, number>();
    for (const n of all) if (n.first >= dayFrom) perDay.set(localDayKey(n.first), (perDay.get(localDayKey(n.first)) ?? 0) + 1);
    const daily = Array.from({ length: 60 }, (_, i) => {
      const key = localDayKey(addDays(dayFrom, i));
      return { day: key, count: perDay.get(key) ?? 0 };
    });

    // KPIs
    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const sameDayPrev = addDays(prevMonthStart, differenceInCalendarDays(now, monthStart));
    const judged = all.filter((n) => n.judged && n.first >= subDays(now, 60));
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const kpis = {
      thisMonth: all.filter((n) => n.first >= monthStart).length,
      prevMonthSamePoint: all.filter((n) => n.first >= prevMonthStart && n.first <= sameDayPrev).length,
      prevMonth: all.filter((n) => n.first >= prevMonthStart && n.first < monthStart).length,
      thisWeek: all.filter((n) => n.first >= weekStart).length,
      returnPct: rate(judged.filter((n) => n.back).length, judged.length),
      returnBase: judged.length,
      appDay1Pct: rate(
        all.filter((n) => n.first >= subDays(now, 60) && n.appDay1).length,
        all.filter((n) => n.first >= subDays(now, 60)).length,
      ),
      notBack: judged.filter((n) => !n.back && n.visitDays === 1).length,
    };

    return { kpis, cohorts: withTotal, daily, factors: this.factors(judged) };
  }

  /** Return rate by first-visit facts (only newcomers we can judge). */
  private factors(list: Newcomer[]) {
    const group = (title: string, key: (n: Newcomer) => string | null, order?: string[]) => {
      const m = new Map<string, { count: number; back: number }>();
      for (const n of list) {
        const k = key(n);
        if (!k) continue;
        const g = m.get(k) ?? { count: 0, back: 0 };
        g.count++;
        if (n.back) g.back++;
        m.set(k, g);
      }
      const rows: Row[] = [...m.entries()].map(([label, g]) => ({ label, ...g, pct: rate(g.back, g.count) }));
      rows.sort((a, b) =>
        order ? order.indexOf(a.label) - order.indexOf(b.label) : (b.pct ?? 0) - (a.pct ?? 0),
      );
      const answered = rows.reduce((a, r) => a + r.count, 0);
      return { title, rows, answered };
    };
    const stay = (n: Newcomer) => {
      if (!n.firstLeave) return null;
      const h = (n.firstLeave.getTime() - n.first.getTime()) / 3_600_000;
      return h < 2 ? 'Moins de 2 h' : h < 4 ? '2 à 4 h' : h < 6 ? '4 à 6 h' : '6 h et +';
    };
    return [
      group('App installée', (n) => (n.hasApp ? "Avec l'app" : 'Sans app'), ["Avec l'app", 'Sans app']),
      group('Durée de la 1ʳᵉ visite', stay, ['Moins de 2 h', '2 à 4 h', '4 à 6 h', '6 h et +']),
      group('Jour de la 1ʳᵉ visite', (n) => WEEKDAY[n.first.getDay()], [...WEEKDAY.slice(1), WEEKDAY[0]]),
      group('Profil', (n) => (n.profileType ? PROFILE_LABEL[n.profileType] : null), Object.values(PROFILE_LABEL)),
      group('Connu par', (n) => (n.heardFrom ? HEARD_FROM_LABEL[n.heardFrom] : null)),
    ];
  }
}
