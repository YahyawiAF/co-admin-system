"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StockOverview, StockUnit } from "@/lib/api/resources";

// ---------- numbers & units ----------

const num = (n: number, d: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Totals: "123,45 DT" */
export const dt = (n: number) => `${num(n, 2)} DT`;
/** Unit prices and costs: "0,494 DT" */
export const dt3 = (n: number) => `${num(n, 3)} DT`;
export const signedDt = (n: number) => `${n >= 0 ? "+" : "−"}${num(Math.abs(n), 2)} DT`;

/** Unit used to buy (kg, L, pc) and how many base units it holds. */
export function buyUnit(unit: StockUnit) {
  if (unit === "g") return { label: "kg", factor: 1000 };
  if (unit === "ml") return { label: "L", factor: 1000 };
  return { label: "pc", factor: 1 };
}
/** Unit used to count what is left (grams, litres, pieces). */
export function countUnit(unit: StockUnit) {
  if (unit === "ml") return { label: "L", factor: 1000 };
  return { label: unit === "g" ? "g" : "pc", factor: 1 };
}
export const UNIT_LABEL: Record<StockUnit, string> = { g: "Grammes (g / kg)", ml: "Millilitres (ml / L)", pc: "Pièces" };

/** "410 g", "1,25 kg", "2,4 L", "36 pc" */
export function qty(q: number, unit: StockUnit) {
  if (unit === "g" || unit === "ml") {
    const big = unit === "g" ? "kg" : "L";
    if (Math.abs(q) >= 1000) return `${(q / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${big}`;
    return `${Math.round(q).toLocaleString("fr-FR")} ${unit}`;
  }
  return `${q.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} pc`;
}

/** Accepts "1,5" or "1.5" */
export const parseNum = (v: string) => Number(String(v).replace(",", ".").trim());

export const SOURCE_LABEL: Record<string, string> = {
  CAISSE: "Caisse",
  COFFRE: "Coffre",
  AUTRE: "Autre",
  NONE: "Stock de départ",
};

/** Products possible after adding stock (item id → base quantity). */
export function possibleAfter(overview: StockOverview, add: Record<string, number>) {
  const left = new Map(overview.items.map((i) => [i.id, i.left]));
  return overview.products
    .filter((p) => p.tracked)
    .map((p) => {
      const after = Math.min(
        ...p.recipe.map((r) => Math.floor(((left.get(r.stockItemId) ?? 0) + (add[r.stockItemId] ?? 0) + 1e-9) / r.quantity))
      );
      return { id: p.id, name: p.name, before: p.possible, after: Number.isFinite(after) ? after : 0 };
    });
}

// ---------- building blocks (same look as the check-in / promotions modals) ----------

export function GradientHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
      </div>
      <DialogHeader className="relative min-w-0 space-y-1 pr-10 text-left">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">{eyebrow}</p>
        <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold leading-tight text-white">
          {Icon ? <Icon className="h-6 w-6 shrink-0" /> : null}
          <span className="truncate">{title}</span>
        </DialogTitle>
        {description ? (
          <DialogDescription className="text-[13px] text-indigo-100">{description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{eyebrow}</DialogDescription>
        )}
      </DialogHeader>
      {children ? <div className="relative mt-3">{children}</div> : null}
    </div>
  );
}

/** Close button styling for gradient dialogs */
export const gradientDialogClass =
  "flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30";

export function GlassChip({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm", className)}>
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-indigo-100">{label}</p>
      <p
        key={String(value)}
        className="animate-in fade-in-0 truncate text-lg font-black tabular-nums duration-200 motion-reduce:animate-none"
      >
        {value}
      </p>
      {hint ? <p className="truncate text-[11px] text-indigo-100">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</p>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", className)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "info" | "muted" | "violet"; children: ReactNode }) {
  const cls = {
    ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    bad: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    info: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", cls)}>{children}</span>;
}

/** Choice card (payment source, stock mode…) */
export function ChoiceCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-200 motion-reduce:transition-none",
        active
          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
          : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
          active ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

/** Numbered step pills of a multi-step dialog */
export function StepPills({ steps, current, onPick }: { steps: string[]; current: number; onPick?: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={!onPick || i > current}
          onClick={() => onPick?.(i)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
            i === current
              ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
              : i < current
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-background text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
              i === current ? "bg-white/25" : "bg-muted"
            )}
          >
            {i < current ? "✓" : i + 1}
          </span>
          {s}
        </button>
      ))}
    </div>
  );
}

/** Suggested product categories; any other name can be typed */
export const PRODUCT_CATEGORIES = ["Boisson", "Gâteau", "Snack", "Désodorisant"];

/** Suggested + already used categories, without duplicates */
export function productCategories(products: { category?: string | null }[]) {
  const seen = new Map<string, string>();
  for (const c of [...PRODUCT_CATEGORIES, ...products.map((p) => p.category?.trim() ?? "")]) {
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()];
}
