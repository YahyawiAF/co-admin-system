import { BadgePercent, CalendarDays, ClipboardList, Megaphone, Package, Tag, type LucideIcon } from "lucide-react";
import type { ToolKind } from "@/lib/types";

/** The feature each Directeur draft (leg) opens, and how it is named. */
export const TOOL_UI: Record<ToolKind, { label: string; noun: string; icon: LucideIcon; href: string | null }> = {
  PROMOTION: { label: "Promo", noun: "une promo", icon: BadgePercent, href: "/promotions" },
  EVENT: { label: "Événement", noun: "un événement", icon: CalendarDays, href: "/events" },
  SURVEY: { label: "Enquête", noun: "une enquête", icon: ClipboardList, href: "/learn-share" },
  CAMPAIGN: { label: "Relance", noun: "une relance", icon: Megaphone, href: null },
  PRICE: { label: "Tarif", noun: "un tarif", icon: Tag, href: "/tarifs" },
  PRODUCT: { label: "Produit", noun: "un produit", icon: Package, href: "/products" },
};

// ---------- « Préparer »: a feature's form opened pre-filled, then linked back ----------

/** What travels in ?conseil= to the feature page. */
export type ConseilDraftParam = {
  /** Kept for old links; always '' now */
  i: string;
  /** Directeur priority and the index of its draft (leg) */
  p?: string;
  l?: number;
  s: number | null;
  a: string | null;
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
    return p && (typeof p.i === "string" || typeof p.p === "string") && typeof p.k === "string" ? p : null;
  } catch {
    return null;
  }
}

export const prepareHref = (p: ConseilDraftParam) => `${TOOL_UI[p.k].href}?conseil=${encodeDraft(p)}`;
