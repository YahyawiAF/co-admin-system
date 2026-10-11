import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

/** "lundi 13 oct." (+ year when not the current one). */
export function dayLabel(date: Date | string, now = new Date()) {
  const d = new Date(date);
  const pattern =
    d.getFullYear() === now.getFullYear() ? "EEEE d MMM" : "EEEE d MMM yyyy";
  const s = format(d, pattern, { locale: fr });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "lundi" */
export function weekdayLabel(date: Date | string) {
  return format(new Date(date), "EEEE", { locale: fr });
}

export type SubscriptionTone = "indigo" | "amber" | "rose" | "slate";

export type SubscriptionTiming = {
  state: "upcoming" | "active" | "ended";
  /** Days left including today (leaveDate is valid until the end of that day). */
  daysRemaining: number | null;
  /** Calendar days since the last valid day (ended only, ≥ 1). */
  endedDaysAgo: number | null;
  /** Calendar days until the first day (upcoming only, ≥ 1). */
  startsInDays: number | null;
  /** Short status phrase, e.g. "Se termine demain (mardi)". */
  headline: string;
  /** Renewal nudge (ends today / tomorrow / ended). */
  renewHint: string | null;
  tone: SubscriptionTone;
  /** 0–100 share of the period already used (active with an end date). */
  progressPct: number | null;
  startLabel: string;
  endLabel: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Calendar wording for an abonnement period: start → leaveDate (inclusive). */
export function subscriptionTiming(
  sub: { registredDate: string | Date; leaveDate?: string | Date | null },
  now = new Date()
): SubscriptionTiming {
  const today = startOfDay(now);
  const start = startOfDay(new Date(sub.registredDate));
  const end = sub.leaveDate ? startOfDay(new Date(sub.leaveDate)) : null;
  const startLabel = dayLabel(start, now);
  const endLabel = end ? dayLabel(end, now) : null;

  const base = {
    daysRemaining: null,
    endedDaysAgo: null,
    startsInDays: null,
    progressPct: null,
    startLabel,
    endLabel,
  };

  const startsIn = differenceInCalendarDays(start, today);
  if (startsIn > 0) {
    return {
      ...base,
      state: "upcoming",
      startsInDays: startsIn,
      headline:
        startsIn === 1
          ? `Commence demain (${weekdayLabel(start)})`
          : `Commence dans ${plural(startsIn, "jour")} · ${startLabel.toLowerCase()}`,
      renewHint: null,
      tone: "indigo",
    };
  }

  if (!end) {
    return {
      ...base,
      state: "active",
      headline: "Sans date de fin",
      renewHint: null,
      tone: "indigo",
    };
  }

  const left = differenceInCalendarDays(end, today);
  if (left < 0) {
    const ago = -left;
    return {
      ...base,
      state: "ended",
      endedDaysAgo: ago,
      headline:
        ago === 1
          ? `Terminé hier (${weekdayLabel(end)})`
          : `Terminé il y a ${plural(ago, "jour")} · ${endLabel?.toLowerCase()}`,
      renewHint: "Renouvelez pour continuer à profiter de l’espace.",
      tone: "rose",
    };
  }

  const remaining = left + 1;
  const total = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const used = Math.min(total, Math.max(0, differenceInCalendarDays(today, start)));
  const progressPct = Math.round((used / total) * 100);

  if (left === 0) {
    return {
      ...base,
      state: "active",
      daysRemaining: remaining,
      progressPct,
      headline: `Se termine aujourd’hui (${weekdayLabel(end)})`,
      renewHint: "C’est le dernier jour — renouvelez pour demain.",
      tone: "amber",
    };
  }
  if (left === 1) {
    return {
      ...base,
      state: "active",
      daysRemaining: remaining,
      progressPct,
      headline: `Se termine demain (${weekdayLabel(end)})`,
      renewHint: "Pensez à renouveler avant demain soir.",
      tone: "amber",
    };
  }
  return {
    ...base,
    state: "active",
    daysRemaining: remaining,
    progressPct,
    headline: `${plural(remaining, "jour")} restant${remaining > 1 ? "s" : ""} · fin ${endLabel?.toLowerCase()}`,
    renewHint: left <= 3 ? "Bientôt la fin — pensez à renouveler." : null,
    tone: left <= 3 ? "amber" : "indigo",
  };
}

/** Ended abonnements stay visible on Accueil this many days. */
export const ENDED_SUBSCRIPTION_VISIBLE_DAYS = 30;
