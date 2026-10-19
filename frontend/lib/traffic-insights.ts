import { isSameDay, parseISO } from "date-fns";
import type { DayTrafficResponse, WeeklyTrafficDay } from "@/lib/types";
import {
  WEEKDAY_LABELS,
  hourLabel,
  percentDelta,
} from "@/lib/traffic-utils";

export type InsightTone = "good" | "bad" | "info";
export type Insight = { tone: InsightTone; text: string };

const MIN_AVG_VISITS = 3;
const SIGNIFICANT_PCT = 15;
const QUIET_RATIO = 0.35;
const MAX_INSIGHTS = 7;

function push(out: Insight[], item: Insight) {
  if (out.length < MAX_INSIGHTS) out.push(item);
}

function sumHours(arr: number[], untilHour: number) {
  let s = 0;
  for (let h = 0; h <= untilHour && h < arr.length; h++) s += arr[h] || 0;
  return s;
}

function spendPerVisit(revenueVisits: number, visits: number) {
  return visits > 0 ? revenueVisits / visits : 0;
}

/** Conclusions for Finance → Jour (from data already loaded). */
export function dayInsights(
  data: DayTrafficResponse,
  now = new Date(),
): Insight[] {
  const out: Insight[] = [];
  const target = data.target;
  const avg = data.average.totals;
  const isToday = isSameDay(parseISO(data.date), now);
  const dayName = WEEKDAY_LABELS[target.weekday].toLowerCase();

  if (isToday) {
    const h = now.getHours();
    const arrivals = sumHours(target.arrivals, h);
    const usual = sumHours(data.average.arrivals, h);
    const delta = percentDelta(arrivals, usual);
    push(out, {
      tone: "info",
      text:
        delta == null
          ? `Journée en cours : à ${hourLabel(h)} vous avez ${arrivals} arrivée${arrivals > 1 ? "s" : ""}.`
          : `Journée en cours : à ${hourLabel(h)} vous avez ${arrivals} arrivée${arrivals > 1 ? "s" : ""} contre ${usual.toFixed(0)} en moyenne à la même heure (${delta > 0 ? "+" : ""}${delta} %).`,
    });
  }

  if (avg.visits < MIN_AVG_VISITS) {
    push(out, {
      tone: "info",
      text: "Pas assez d'historique pour comparer ce jour — les écarts en % sont peu fiables.",
    });
    return out;
  }

  const revDelta = percentDelta(target.totals.revenue, avg.revenue);
  const visitDelta = percentDelta(target.totals.visits, avg.visits);
  const basketT = spendPerVisit(
    target.totals.revenueVisits,
    target.totals.visits,
  );
  const basketA = spendPerVisit(avg.revenueVisits, avg.visits);
  const basketDelta = percentDelta(basketT, basketA);
  const aboDelta =
    target.totals.revenueAbonnements - avg.revenueAbonnements;

  if (
    revDelta != null &&
    Math.abs(revDelta) >= SIGNIFICANT_PCT &&
    !isToday
  ) {
    const sign = revDelta > 0 ? "+" : "";
    if (
      Math.abs(aboDelta) > Math.abs(target.totals.revenue - avg.revenue) * 0.5 &&
      Math.abs(aboDelta) >= 1
    ) {
      push(out, {
        tone: revDelta > 0 ? "good" : "bad",
        text: `Revenu ${sign}${revDelta} % : la différence vient surtout des abonnements (${aboDelta > 0 ? "+" : ""}${aboDelta.toFixed(1)} DT), pas des visites.`,
      });
    } else if (
      visitDelta != null &&
      Math.abs(visitDelta) >= SIGNIFICANT_PCT &&
      (basketDelta == null || Math.abs(basketDelta) < SIGNIFICANT_PCT)
    ) {
      push(out, {
        tone: revDelta > 0 ? "good" : "bad",
        text: `Revenu ${sign}${revDelta} % surtout parce qu'il y a ${visitDelta > 0 ? "plus" : "moins"} de visites (${visitDelta > 0 ? "+" : ""}${visitDelta} %). Le panier moyen est stable.`,
      });
    } else if (
      basketDelta != null &&
      Math.abs(basketDelta) >= SIGNIFICANT_PCT &&
      (visitDelta == null || Math.abs(visitDelta) < SIGNIFICANT_PCT)
    ) {
      push(out, {
        tone: revDelta > 0 ? "good" : "bad",
        text: `Autant de visites, mais panier moyen ${basketDelta > 0 ? "plus haut" : "plus bas"} (${basketDelta > 0 ? "+" : ""}${basketDelta} %). ${basketDelta < 0 ? "Plus de passes courts ou de promos." : "Meilleurs passes ou moins de promos."}`,
      });
    } else {
      push(out, {
        tone: revDelta > 0 ? "good" : "bad",
        text: `Revenu ${sign}${revDelta} % vs moyenne (${target.totals.revenue.toFixed(1)} DT contre ${avg.revenue.toFixed(1)} DT).`,
      });
    }
  } else if (
    !isToday &&
    (revDelta == null || Math.abs(revDelta) < SIGNIFICANT_PCT) &&
    (visitDelta == null || Math.abs(visitDelta) < SIGNIFICANT_PCT)
  ) {
    push(out, {
      tone: "info",
      text: `Journée normale pour un ${dayName} — proche de la moyenne.`,
    });
  }

  let bestH = 0;
  let bestGap = 0;
  for (let h = 0; h < 24; h++) {
    const gap = Math.abs((target.present[h] || 0) - (data.average.present[h] || 0));
    if (gap > bestGap) {
      bestGap = gap;
      bestH = h;
    }
  }
  if (bestGap >= 2) {
    const t = target.present[bestH] || 0;
    const a = data.average.present[bestH] || 0;
    push(out, {
      tone: t < a ? "bad" : "good",
      text: `Le plus gros écart de présence est à ${hourLabel(bestH)} : ${Math.round(t)} présent${t > 1 ? "s" : ""} contre ${a.toFixed(0)} en moyenne.`,
    });
  }

  if (data.comparisons.length >= 2 && !isToday) {
    const revenues = data.comparisons.map((c) => c.totals.revenue);
    const maxC = Math.max(...revenues);
    const minC = Math.min(...revenues);
    const r = target.totals.revenue;
    const n = data.comparisons.length;
    if (r >= maxC && r > minC + 0.5) {
      push(out, {
        tone: "good",
        text: `Meilleur ${dayName} des ${n} ${data.compare === "weekday" ? "mêmes jours" : "jours"} précédents.`,
      });
    } else if (r <= minC && r < maxC - 0.5) {
      push(out, {
        tone: "bad",
        text: `Plus faible ${dayName} des ${n} ${data.compare === "weekday" ? "mêmes jours" : "jours"} précédents.`,
      });
    }
  }

  if (target.totals.leftUnpaid > 0) {
    push(out, {
      tone: "bad",
      text: `${target.totals.leftUnpaid} personne${target.totals.leftUnpaid > 1 ? "s" : ""} partie${target.totals.leftUnpaid > 1 ? "s" : ""} sans payer. À relancer dans Impayés.`,
    });
  }

  const durDelta = percentDelta(
    target.totals.avgDurationMin,
    avg.avgDurationMin,
  );
  if (
    durDelta != null &&
    durDelta <= -SIGNIFICANT_PCT &&
    revDelta != null &&
    revDelta < 0 &&
    !isToday
  ) {
    push(out, {
      tone: "info",
      text: `Visites plus courtes (${durDelta} % : ${target.totals.avgDurationMin} min vs ${Math.round(avg.avgDurationMin)}). Moins de dépassements facturés possibles.`,
    });
  }

  // Morning vs afternoon fill — actionable for pricing / promo windows
  const morningArr = sumRange(target.arrivals, 7, 12);
  const afternoonArr = sumRange(target.arrivals, 13, 18);
  const morningAvg = sumRange(data.average.arrivals, 7, 12);
  const afternoonAvg = sumRange(data.average.arrivals, 13, 18);
  if (morningArr + afternoonArr >= 4) {
    if (morningArr >= afternoonArr * 1.4 && afternoonAvg >= 1) {
      push(out, {
        tone: "info",
        text: `Matinée pleine (${morningArr} arrivées avant 13h) vs après-midi plus calme (${afternoonArr}). Idée : pass après-midi ou promo café 14h–17h.`,
      });
    } else if (afternoonArr >= morningArr * 1.4 && morningAvg >= 1) {
      push(out, {
        tone: "info",
        text: `Après-midi plus fort (${afternoonArr} arrivées 13h–18h) que le matin (${morningArr}). Ouvrez / animez le matin (petit-déj, open desk) pour lisser la journée.`,
      });
    }
  }

  const revPerVisit =
    target.totals.visits > 0
      ? target.totals.revenueVisits / target.totals.visits
      : 0;
  const revPerVisitAvg =
    avg.visits > 0 ? avg.revenueVisits / avg.visits : 0;
  if (
    !isToday &&
    target.totals.visits >= MIN_AVG_VISITS &&
    revPerVisitAvg > 0 &&
    revPerVisit < revPerVisitAvg * 0.85
  ) {
    push(out, {
      tone: "bad",
      text: `Panier visite bas (${revPerVisit.toFixed(1)} DT vs ${revPerVisitAvg.toFixed(1)} DT en moyenne). Proposez un upgrade de forfait ou un add-on café à l'accueil.`,
    });
  }

  if (
    !isToday &&
    visitDelta != null &&
    visitDelta <= -SIGNIFICANT_PCT &&
    target.totals.visits < avg.visits
  ) {
    push(out, {
      tone: "info",
      text: `${Math.round(avg.visits - target.totals.visits)} visite${avg.visits - target.totals.visits > 1 ? "s" : ""} en moins qu'un ${dayName} habituel. Relancez les absents (onglet Relances) ou publiez une offre ce jour-là.`,
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}

function sumRange(arr: number[], from: number, to: number) {
  let s = 0;
  for (let h = from; h <= to && h < arr.length; h++) s += arr[h] || 0;
  return s;
}

/** Conclusions for Finance → Fréquentation (from weekly averages already loaded). */
export function weeklyInsights(
  days: WeeklyTrafficDay[],
  weeks: number,
): Insight[] {
  const out: Insight[] = [];
  const usable = days.filter((d) => d.occurrences >= Math.max(2, weeks / 2));
  if (usable.length < 2) {
    return [
      {
        tone: "info",
        text: "Pas assez de semaines pour comparer les jours entre eux.",
      },
    ];
  }

  const byVisits = [...usable].sort((a, b) => b.avgVisits - a.avgVisits);
  const best = byVisits[0];
  const worst = byVisits[byVisits.length - 1];
  if (best && worst && best.weekday !== worst.weekday && best.avgVisits > 0) {
    const ratio =
      worst.avgVisits > 0
        ? Math.round((best.avgVisits / worst.avgVisits) * 10) / 10
        : null;
    const bestN = Math.max(1, Math.round(best.avgVisits));
    const worstN = Math.round(worst.avgVisits);
    push(out, {
      tone: "info",
      text:
        ratio != null && ratio >= 1.5
          ? `Le ${WEEKDAY_LABELS[best.weekday].toLowerCase()} est votre meilleur jour (~${bestN} visites), le ${WEEKDAY_LABELS[worst.weekday].toLowerCase()} le plus calme (~${worstN < 1 ? "< 1" : worstN}). C'est ${ratio}× moins.`
          : `Meilleur jour : ${WEEKDAY_LABELS[best.weekday].toLowerCase()} (~${bestN} visites). Plus calme : ${WEEKDAY_LABELS[worst.weekday].toLowerCase()} (~${worstN < 1 ? "< 1" : worstN}).`,
    });
  }

  const peakHours = usable.map((d) => d.peakPresentHour);
  const buckets = new Map<number, number>();
  for (const h of peakHours) {
    const key = Math.floor(h / 2) * 2;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let topBucket = 0;
  let topCount = 0;
  for (const [k, c] of buckets) {
    if (c > topCount) {
      topCount = c;
      topBucket = k;
    }
  }
  if (topCount >= Math.ceil(usable.length * 0.6)) {
    push(out, {
      tone: "good",
      text: `Votre pic est presque toujours entre ${hourLabel(topBucket)} et ${hourLabel(topBucket + 2)}. Prévoyez quelqu'un à l'accueil et du café prêt.`,
    });
  }

  const quietCount = new Map<number, number>();
  for (const d of usable) {
    if (d.peakPresent <= 0) continue;
    for (const h of d.hours) {
      if (h.avgPresent < QUIET_RATIO * d.peakPresent) {
        quietCount.set(h.hour, (quietCount.get(h.hour) ?? 0) + 1);
      }
    }
  }
  const need = Math.max(4, Math.ceil(usable.length * 0.6));
  const quietHours = [...quietCount.entries()]
    .filter(([, c]) => c >= need)
    .map(([h]) => h)
    .sort((a, b) => a - b);
  if (quietHours.length >= 2) {
    let runStart = quietHours[0];
    let runEnd = quietHours[0];
    let bestStart = runStart;
    let bestEnd = runEnd;
    for (let i = 1; i < quietHours.length; i++) {
      if (quietHours[i] === runEnd + 1) {
        runEnd = quietHours[i];
      } else {
        if (runEnd - runStart > bestEnd - bestStart) {
          bestStart = runStart;
          bestEnd = runEnd;
        }
        runStart = quietHours[i];
        runEnd = quietHours[i];
      }
    }
    if (runEnd - runStart > bestEnd - bestStart) {
      bestStart = runStart;
      bestEnd = runEnd;
    }
    if (bestEnd > bestStart) {
      push(out, {
        tone: "info",
        text: `Creux de ${hourLabel(bestStart)} à ${hourLabel(bestEnd + 1)} la plupart des jours. Idée : un pass après-midi moins cher ou un petit événement.`,
      });
    }
  }

  if (worst && best && worst.avgVisits < best.avgVisits * 0.7) {
    push(out, {
      tone: "info",
      text: `Pour remplir le ${WEEKDAY_LABELS[worst.weekday].toLowerCase()}, testez une promo ce jour-là (menu Promotions) ou un événement court (atelier, afterwork).`,
    });
  }

  // Strongest weekday peak hour → staffing / café prep
  if (best && best.peakPresent > 0) {
    const peakLabel =
      best.peakPresent < 0.5
        ? "moins d'1 présent"
        : `~${Math.max(1, Math.round(best.peakPresent))} présent${best.peakPresent >= 1.5 ? "s" : ""}`;
    push(out, {
      tone: "good",
      text: `Le ${WEEKDAY_LABELS[best.weekday].toLowerCase()} pic à ${hourLabel(best.peakPresentHour)} (${peakLabel}). Ayez l'accueil prêt et le café prêt 30 min avant.`,
    });
  }

  // Opening / closing hour weakness across weekdays
  const morningWeak: number[] = [];
  const eveningWeak: number[] = [];
  for (const d of usable) {
    if (d.peakPresent <= 0) continue;
    const h9 = d.hours.find((h) => h.hour === 9)?.avgPresent ?? 0;
    const h10 = d.hours.find((h) => h.hour === 10)?.avgPresent ?? 0;
    const h17 = d.hours.find((h) => h.hour === 17)?.avgPresent ?? 0;
    const h18 = d.hours.find((h) => h.hour === 18)?.avgPresent ?? 0;
    if ((h9 + h10) / 2 < QUIET_RATIO * d.peakPresent) morningWeak.push(d.weekday);
    if ((h17 + h18) / 2 < QUIET_RATIO * d.peakPresent) eveningWeak.push(d.weekday);
  }
  if (morningWeak.length >= Math.ceil(usable.length * 0.5)) {
    push(out, {
      tone: "info",
      text: "Les démarrages (9h–11h) sont souvent calmes. Offre « early bird » ou forfait matinée pour remplir les places vides du début de journée.",
    });
  } else if (eveningWeak.length >= Math.ceil(usable.length * 0.5)) {
    push(out, {
      tone: "info",
      text: "Les fins de journée (17h–19h) sont souvent calmes. Afterwork, séance focus ou tarif soirée peuvent récupérer du CA.",
    });
  }

  const totalVisits = Math.round(
    days.reduce((s, d) => s + d.avgVisits * d.occurrences, 0),
  );
  if (totalVisits > 0 && best && worst && best.avgVisits > 0) {
    const gap = Math.round(best.avgVisits - worst.avgVisits);
    if (gap >= 2) {
      push(out, {
        tone: "info",
        text: `${totalVisits} visites sur la période. Si chaque jour calme gagnait ${gap} visite${gap > 1 ? "s" : ""} (niveau ${WEEKDAY_LABELS[best.weekday].toLowerCase()}), vous gagneriez ~${gap * Math.max(1, worst.occurrences)} passages supplémentaires.`,
      });
    }
  }

  if (days.some((d) => d.occurrences < weeks / 2)) {
    push(out, {
      tone: "info",
      text: "Certains jours ont peu d'occurrences dans la période — leurs moyennes sont moins fiables.",
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}

export function insightDotClass(tone: InsightTone) {
  if (tone === "good") return "bg-emerald-500";
  if (tone === "bad") return "bg-red-500";
  return "bg-slate-400";
}
