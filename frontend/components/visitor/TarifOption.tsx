"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  Check,
  Coffee,
  Crown,
  Gem,
  Presentation,
  Sun,
  Sunrise,
  Ticket,
  Timer,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BillingUnit, PriceCategory, PriceType, type Price } from "@/lib/types";

type Tone =
  | "amber"
  | "sky"
  | "orange"
  | "indigo"
  | "violet"
  | "rose"
  | "emerald"
  | "slate";

const TONE_CHIP: Record<Tone, string> = {
  amber: "bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-600",
  sky: "bg-gradient-to-br from-sky-100 to-cyan-50 text-sky-600",
  orange: "bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600",
  indigo: "bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-600",
  violet: "bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-600",
  rose: "bg-gradient-to-br from-rose-100 to-pink-50 text-rose-600",
  emerald: "bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600",
  slate: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600",
};

export type TarifVisual = { Icon: LucideIcon; tone: Tone; tag: string | null };

type TarifLike = Partial<
  Pick<
    Price,
    "category" | "categories" | "type" | "billingUnit" | "durationHours" | "periodDays"
  >
>;

function categoriesOf(p: TarifLike): string[] {
  return [p.category, ...(p.categories || [])].filter(Boolean) as string[];
}

export function isSubscriptionTarif(p: TarifLike): boolean {
  return (
    categoriesOf(p).includes(PriceCategory.ABONNEMENT) ||
    p.type === PriceType.abonnement
  );
}

export function tarifVisual(p: TarifLike): TarifVisual {
  const cats = categoriesOf(p);
  if (isSubscriptionTarif(p)) {
    const d = p.periodDays ?? 0;
    if (d > 0 && d <= 7) return { Icon: CalendarRange, tone: "sky", tag: "Semaine" };
    if (d > 31) return { Icon: Gem, tone: "rose", tag: "Longue durée" };
    return { Icon: Crown, tone: "violet", tag: d > 0 ? "Mois" : null };
  }
  if (cats.includes(PriceCategory.SALLE)) {
    return { Icon: Presentation, tone: "emerald", tag: "Salle" };
  }
  if (p.billingUnit === BillingUnit.HOURLY) {
    return { Icon: Timer, tone: "sky", tag: "À l’heure" };
  }
  const h = p.durationHours ?? 0;
  if (h > 0 && h <= 2) return { Icon: Coffee, tone: "amber", tag: "Rapide" };
  if (h > 2 && h <= 4) return { Icon: Zap, tone: "sky", tag: "Focus" };
  if (h > 4 && h < 7) return { Icon: Sun, tone: "orange", tag: "Demi-journée" };
  if (h >= 7 || cats.includes(PriceCategory.JOURNEE)) {
    return { Icon: Sunrise, tone: "indigo", tag: "Journée" };
  }
  return { Icon: Ticket, tone: "slate", tag: null };
}

export function tarifDurationLabel(p: TarifLike): string {
  if (p.billingUnit === BillingUnit.HOURLY) return "Par heure";
  if (p.durationHours) {
    return p.durationHours >= 7 ? "Journée" : `${p.durationHours} h`;
  }
  if (p.periodDays) return `${p.periodDays} jours`;
  return "";
}

export function TarifIcon({
  price,
  className,
  iconClassName,
}: {
  price: TarifLike;
  className?: string;
  iconClassName?: string;
}) {
  const { Icon, tone } = tarifVisual(price);
  return (
    <span
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
        TONE_CHIP[tone],
        className
      )}
    >
      <Icon className={cn("h-6 w-6", iconClassName)} />
    </span>
  );
}

/** Selectable "game option" card (choose page grid). */
export function TarifOptionCard({
  price,
  selected,
  disabled,
  badge,
  meta,
  priceNode,
  onSelect,
}: {
  price: TarifLike & { name: string };
  selected: boolean;
  disabled?: boolean;
  badge?: string | null;
  /** Replaces the "duration · tag" line. */
  meta?: string | null;
  priceNode: ReactNode;
  onSelect: () => void;
}) {
  const visual = tarifVisual(price);
  const duration = tarifDurationLabel(price);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full flex-col items-start gap-2.5 rounded-3xl bg-white p-3.5 text-left shadow-sm ring-1 transition duration-200 active:scale-[0.96] disabled:opacity-60",
        selected
          ? "-translate-y-0.5 shadow-md ring-2 ring-indigo-600"
          : "ring-slate-200/70 hover:ring-indigo-200"
      )}
    >
      <span
        className={cn(
          "absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full transition",
          selected
            ? "scale-100 bg-indigo-600 text-white"
            : "scale-90 border border-slate-200 bg-white text-transparent"
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <TarifIcon
        price={price}
        className={cn("transition", selected && "scale-110")}
      />
      <div className="min-w-0 pr-4">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
          {price.name}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {meta ?? [duration, badge || visual.tag].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="mt-auto">{priceNode}</div>
    </button>
  );
}

/** Small tile (Accueil "Pas de pass ?" row). */
export function TarifMiniTile({
  price,
  label,
  amount,
  onClick,
}: {
  price: TarifLike;
  label: string;
  amount: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center transition hover:bg-slate-50 active:scale-[0.95]"
    >
      <TarifIcon
        price={price}
        className="h-10 w-10 rounded-xl"
        iconClassName="h-5 w-5"
      />
      <span className="text-xs font-semibold leading-tight text-slate-900">
        {label}
      </span>
      <span className="text-xs font-bold tabular-nums text-indigo-600">
        {amount}
      </span>
    </button>
  );
}
