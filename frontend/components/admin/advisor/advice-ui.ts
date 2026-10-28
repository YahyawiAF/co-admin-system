import {
  Coffee,
  Megaphone,
  Rocket,
  Settings2,
  Sparkles,
  Tags,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import type {
  AdviceMetric,
  AdvisorCategory,
  DiagnosisStatus,
  InitiativeChannel,
  InitiativeObjective,
  InitiativeStatus,
  InitiativeVerdict,
} from "@/lib/types";

export const CATEGORY_UI: Record<
  AdvisorCategory,
  { label: string; icon: typeof Sparkles; tone: string }
> = {
  NEW_REVENUE: { label: "Nouveau revenu", icon: Rocket, tone: "bg-emerald-100 text-emerald-800" },
  PROMO: { label: "Promo", icon: Megaphone, tone: "bg-violet-100 text-violet-800" },
  PRICING: { label: "Prix & formules", icon: Tags, tone: "bg-sky-100 text-sky-800" },
  CAFE: { label: "Café", icon: Coffee, tone: "bg-amber-100 text-amber-800" },
  RETENTION: { label: "Fidélisation", icon: UserCheck, tone: "bg-rose-100 text-rose-700" },
  OPERATIONS: { label: "Organisation", icon: Settings2, tone: "bg-slate-100 text-slate-700" },
};

export const METRIC_UI: Record<AdviceMetric, { label: string; unit: string }> = {
  revenuePerDay: { label: "Revenu par jour", unit: " DT" },
  visitsPerDay: { label: "Visites par jour", unit: "" },
  revenueCafe: { label: "Ventes café", unit: " DT" },
  cafeAttachRatePct: { label: "Visites avec café", unit: " %" },
  avgStayHours: { label: "Durée moyenne", unit: " h" },
  newMembers: { label: "Nouveaux membres", unit: "" },
  revenueSubscriptions: { label: "Revenu abonnements", unit: " DT" },
  avgOccupancyPct: { label: "Occupation", unit: " %" },
};

export const METRICS = Object.keys(METRIC_UI) as AdviceMetric[];

export const STATUS_UI: Record<InitiativeStatus, { label: string; tone: string }> = {
  too_early: { label: "Trop tôt", tone: "bg-muted text-muted-foreground" },
  goal_reached: { label: "Objectif atteint", tone: "bg-emerald-600 text-white" },
  below_goal: { label: "Sous l'objectif", tone: "bg-amber-100 text-amber-800" },
  no_effect: { label: "Pas d'effet", tone: "bg-rose-100 text-rose-700" },
  up: { label: "En hausse", tone: "bg-emerald-100 text-emerald-800" },
  down: { label: "En baisse", tone: "bg-rose-100 text-rose-700" },
};

export const VERDICT_UI: Record<InitiativeVerdict, { label: string; active: string }> = {
  WORKING: { label: "Ça marche", active: "border-emerald-600 bg-emerald-600 text-white" },
  MIXED: { label: "Mitigé", active: "border-amber-500 bg-amber-500 text-white" },
  NOT_WORKING: { label: "Pas d'effet", active: "border-rose-600 bg-rose-600 text-white" },
};

export const dt = (n: number) => `${fr1(n)} DT`;
export const today = () => format(new Date(), "yyyy-MM-dd");

export const metricValue = (m: AdviceMetric, v: number | null) =>
  v == null ? "—" : `${String(Math.round(v * 10) / 10).replace(".", ",")}${METRIC_UI[m].unit}`;

/** French number: 1,5 not 1.5 */
export const fr1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export const signed = (n: number, suffix = "") =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${fr1(Math.abs(n))}${suffix}`;

/** Monday-first week, values are JS days (0 = Sunday). */
export const WEEK = [
  { d: 1, short: "L", label: "Lun" },
  { d: 2, short: "M", label: "Mar" },
  { d: 3, short: "M", label: "Mer" },
  { d: 4, short: "J", label: "Jeu" },
  { d: 5, short: "V", label: "Ven" },
  { d: 6, short: "S", label: "Sam" },
  { d: 0, short: "D", label: "Dim" },
];

/** "Mar, Mer · 18h–00h" from days + hours (0/0 or null = all day). */
export function slotText(days: number[], from: number | null, to: number | null) {
  const d = days.length && days.length < 7
    ? WEEK.filter((w) => days.includes(w.d)).map((w) => w.label).join(", ")
    : "Tous les jours";
  const allDay = from == null || to == null || from === to;
  return allDay ? d : `${d} · ${from}h–${to === 24 ? "00" : to}h`;
}

export const RATE_METRICS: AdviceMetric[] = ["cafeAttachRatePct", "avgOccupancyPct"];
export const goalUnit = (m: AdviceMetric) => (RATE_METRICS.includes(m) ? " pts" : " %");

/** First number of a gain headline: "+60 DT/mois" → 60. */
export function gainAmount(expectedImpact: string) {
  const head = gainHeadline(expectedImpact);
  const n = head ? Number(head.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * The gain headline of an advice: "+120 DT/mois : 4 × 30 DT" → "+120 DT/mois".
 * Long sentences (older reports) stay in the details only.
 */
export function gainHeadline(expectedImpact: string) {
  const head = expectedImpact.split(/\s[:(–-]\s?|[:(]/)[0]?.trim() ?? "";
  return head.length > 0 && head.length <= 26 && /\d/.test(head) ? head : null;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Non-HTTPS origins have no clipboard API: fall back to a hidden textarea
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export const OBJECTIVE_UI: Record<InitiativeObjective, string> = {
  TICKETS: "Vendre des places",
  SUBSCRIBERS: "Nouveaux abonnés",
  CAFE: "Ventes café",
  QUIET_HOURS: "Remplir les heures creuses",
  OTHER: "Autre",
};
export const OBJECTIVES = Object.keys(OBJECTIVE_UI) as InitiativeObjective[];

export const CHANNEL_UI: Record<InitiativeChannel, string> = {
  INSTAGRAM_POST: "Post Instagram",
  INSTAGRAM_STORY: "Story Instagram",
  WHATSAPP: "WhatsApp",
  APP: "App membres",
  PARTNER: "Partenaire",
  WALK_IN: "À l'accueil",
};
export const CHANNELS = Object.keys(CHANNEL_UI) as InitiativeChannel[];

/** Diagnosis badge: label + colours (banner border / background / ink). */
export const DIAGNOSIS_UI: Record<DiagnosisStatus, { label: string; box: string; badge: string }> = {
  NOT_TESTED: { label: "Pas encore testé", box: "border-orange-300 bg-orange-50", badge: "border-orange-300 text-orange-800" },
  BOTTLENECK: { label: "Blocage trouvé", box: "border-orange-300 bg-orange-50", badge: "border-orange-300 text-orange-800" },
  MISSING_DATA: { label: "Chiffre manquant", box: "border-blue-300 bg-blue-50", badge: "border-blue-300 text-blue-800" },
  TOO_EARLY: { label: "Trop tôt", box: "border-slate-300 bg-slate-50", badge: "border-slate-300 text-slate-700" },
  ON_TRACK: { label: "En bonne voie", box: "border-emerald-300 bg-emerald-50", badge: "border-emerald-300 text-emerald-800" },
};
