import {
  AlertCircle,
  BadgePercent,
  CalendarDays,
  ClipboardList,
  Coffee,
  Megaphone,
  Package,
  Repeat,
  Sparkles,
  Tag,
  TrendingDown,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { HealthAreaId, HealthStatus, ToolKind } from "@/lib/types";

export const dt = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} DT`;
export const signedDt = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("fr-FR")} DT`;

export const AREA_ICON: Record<HealthAreaId, LucideIcon> = {
  cafe: Coffee,
  abos: Repeat,
  creux: TrendingDown,
  nouveaux: UserPlus,
  retour: Sparkles,
  impayes: Wallet,
};

/** Colours of a point: card, dot and pill. Text is always given too (never colour alone). */
export const STATUS_UI: Record<HealthStatus, { card: string; dot: string; pill: string }> = {
  red: {
    card: "border-rose-200 bg-gradient-to-b from-rose-50 to-white",
    dot: "bg-rose-600 ring-4 ring-rose-100",
    pill: "bg-rose-100 text-rose-800",
  },
  orange: {
    card: "border-amber-200 bg-gradient-to-b from-amber-50 to-white",
    dot: "bg-amber-500 ring-4 ring-amber-100",
    pill: "bg-amber-100 text-amber-900",
  },
  green: {
    card: "border-slate-200 bg-white",
    dot: "bg-emerald-500 ring-4 ring-emerald-100",
    pill: "bg-emerald-100 text-emerald-800",
  },
  grey: {
    card: "border-slate-200 bg-slate-50/60",
    dot: "bg-slate-400 ring-4 ring-slate-100",
    pill: "bg-slate-100 text-slate-600",
  },
};

export const TOOL_UI: Record<ToolKind, { label: string; noun: string; icon: LucideIcon; href: string | null }> = {
  PROMOTION: { label: "Promo", noun: "une promo", icon: BadgePercent, href: "/promotions" },
  EVENT: { label: "Événement", noun: "un événement", icon: CalendarDays, href: "/events" },
  SURVEY: { label: "Enquête", noun: "une enquête", icon: ClipboardList, href: "/learn-share" },
  CAMPAIGN: { label: "Relance", noun: "une relance", icon: Megaphone, href: null },
  PRICE: { label: "Tarif", noun: "un tarif", icon: Tag, href: "/tarifs" },
  PRODUCT: { label: "Produit", noun: "un produit", icon: Package, href: "/products" },
};

export const VERDICTS = [
  ["WORKING", "Ça marche"],
  ["MIXED", "Mitigé"],
  ["NOT_WORKING", "Pas d'effet"],
] as const;

export const DISMISS_REASONS = ["Trop cher", "Pas le temps", "Déjà essayé", "Ne colle pas à mon espace", "Plus tard"];

export const STATUS_TEXT: Record<string, string> = {
  goal_reached: "Objectif atteint",
  below_goal: "En dessous de l'objectif",
  no_effect: "Pas d'effet",
  too_early: "Trop tôt pour juger",
  up: "En hausse",
  down: "En baisse",
};

export const ALERT_ICON = AlertCircle;

// ---------- « Préparer »: a feature's form opened pre-filled, then linked back ----------

/** What travels in ?conseil= to the feature page. */
export type ConseilDraftParam = {
  /** Initiative (solution in progress) */
  i: string;
  /** Objective index the tool fulfils */
  s: number | null;
  /** Health point, to come back to its modal */
  a: HealthAreaId | null;
  k: ToolKind;
  d: Record<string, unknown>;
};

export function encodeDraft(p: ConseilDraftParam) {
  const json = JSON.stringify(p);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDraft(raw: string | null): ConseilDraftParam | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as ConseilDraftParam;
    return p && typeof p.i === "string" && typeof p.k === "string" ? p : null;
  } catch {
    return null;
  }
}

export const prepareHref = (p: ConseilDraftParam) => `${TOOL_UI[p.k].href}?conseil=${encodeDraft(p)}`;
