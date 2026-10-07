"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  isActiveVisit,
  isLikelyForgotCheckout,
  priceOf,
  rowPricing,
  rowPricingAt,
  visitBalanceDue,
  visitPaidAmount,
} from "@/lib/journal-utils";
import { formatDt, formatMinutes, stageLabel } from "@/lib/session-pricing";
import { daysLeft, hoursLeft } from "@/lib/subscription-utils";
import type { Abonnement, Journal } from "@/lib/types";
import { cn } from "@/lib/utils";

function DiscountChip({ percent }: { percent?: number | null }) {
  if (!percent || percent <= 0) return null;
  return (
    <Badge
      variant="outline"
      className="h-5 border-amber-300 bg-amber-50 text-[10px] text-amber-800"
      title="Remise membre / groupe"
    >
      −{percent}%
    </Badge>
  );
}

function ActiveSubChip({ sub }: { sub: Abonnement }) {
  return (
    <Badge
      variant="outline"
      className="h-5 border-violet-300 bg-violet-50 text-[10px] text-violet-700"
      title={`Abonnement actif : ${sub.price?.name || "abonnement"}`}
    >
      Abo actif
    </Badge>
  );
}

function SubscriptionForfait({
  row,
  sub,
}: {
  row: Journal;
  sub?: Abonnement | null;
}) {
  const p = priceOf(row);
  const hours = sub ? hoursLeft(sub) : null;
  const days = sub ? daysLeft(sub) : null;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <Badge className="h-5 bg-violet-600 text-[10px] hover:bg-violet-600">
          Abonnement
        </Badge>
        <DiscountChip percent={sub?.discountPercent} />
      </div>
      <span className="text-sm font-medium">
        {sub?.price?.name || p?.name || "Abonnement"}
      </span>
      {hours != null ? (
        <span className="text-[11px] text-muted-foreground">
          {hours.toFixed(1)} h restantes
        </span>
      ) : days != null ? (
        <span className="text-[11px] text-muted-foreground">
          {days < 0 ? "Expiré" : days === 0 ? "Dernier jour" : `${days} j restants`}
        </span>
      ) : null}
    </div>
  );
}

/** Forfait column: subscription, fixed tariff (original) or AUTO tier. */
export function JournalForfaitCell({
  row,
  now,
  sub,
}: {
  row: Journal;
  now: number;
  /** Member's active abonnement, if any */
  sub?: Abonnement | null;
}) {
  const pricing = rowPricing(row, now);
  const p = priceOf(row);
  if (p?.category === "ABONNEMENT" || p?.type === "abonnement") {
    return <SubscriptionForfait row={row} sub={sub} />;
  }
  if (!pricing) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span>{p?.name || "—"}</span>
        {sub ? <ActiveSubChip sub={sub} /> : null}
      </div>
    );
  }
  if (pricing.mode === "AUTO") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className="h-5 border-indigo-300 bg-indigo-50 text-[10px] text-indigo-700"
          >
            Auto
          </Badge>
          <DiscountChip percent={pricing.discountPercent} />
          {sub ? <ActiveSubChip sub={sub} /> : null}
        </div>
        <span className="text-sm">Palier {pricing.currentTier.name}</span>
      </div>
    );
  }
  const moved = pricing.tierSteps > 0;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <Badge
          variant="outline"
          className="h-5 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800"
          title="Tarif fixé (original)"
        >
          Fixé
        </Badge>
        <DiscountChip percent={pricing.discountPercent} />
        {sub ? <ActiveSubChip sub={sub} /> : null}
      </div>
      <span className="text-sm font-medium">
        {pricing.fixedServiceName || p?.name || "—"}{" "}
        <span className="text-xs text-muted-foreground">
          ({formatDt(pricing.fixedAmount)})
        </span>
      </span>
      {moved ? (
        <span className="text-[11px] font-medium text-rose-700">
          → {pricing.currentTier.name} (dépassement)
        </span>
      ) : null}
      {pricing.fixedAt &&
      Math.abs(
        new Date(pricing.fixedAt).getTime() - new Date(row.registredTime).getTime()
      ) > 60_000 ? (
        <span className="text-[10px] text-muted-foreground">
          fixé à {format(new Date(pricing.fixedAt), "HH:mm")}
        </span>
      ) : null}
    </div>
  );
}

/** Durée column chip: grace / surcharge / next tier countdown. */
export function JournalPricingStageChip({
  row,
  now,
}: {
  row: Journal;
  now: number;
}) {
  const pricing = rowPricing(row, now);
  if (!pricing || !isActiveVisit(row)) return null;
  if (pricing.stage === "WITHIN" && pricing.mode === "FIXED") return null;
  const tone =
    pricing.stage === "WITHIN"
      ? "border-indigo-300 text-indigo-700"
      : pricing.stage === "WARNING" || pricing.stage === "GRACE"
        ? "border-amber-400 text-amber-800"
        : "border-rose-400 text-rose-700";
  return (
    <Badge variant="outline" className={cn("h-auto py-0.5 text-[10px]", tone)}>
      {stageLabel(pricing, now)}
    </Badge>
  );
}

type TimelineEvent = {
  at: number;
  label: string;
  detail?: string;
  tone?: "default" | "warn" | "danger" | "ok";
};

/** Visit story for the edit sheet: arrival, fixed tariff, pack end, grace, surcharge, next tier, payment, departure. */
export function JournalPricingTimeline({ row }: { row: Journal }) {
  const now = Date.now();
  const pricing = rowPricing(row, now);
  if (!pricing) return null;
  const start = new Date(row.registredTime).getTime();
  const leave = row.leaveTime ? new Date(row.leaveTime).getTime() : null;
  const horizon = leave ?? now;
  const events: TimelineEvent[] = [];

  const first = rowPricingAt(row, start);
  events.push({
    at: start,
    label: "Arrivée",
    detail:
      pricing.mode === "FIXED"
        ? `Forfait ${pricing.fixedServiceName ?? ""} fixé · ${formatDt(pricing.fixedAmount)}`
        : `Tarif auto · palier ${first?.currentTier.name ?? pricing.currentTier.name} · ${formatDt(first?.amountDue ?? pricing.baseAmount)}`,
  });
  const promoPrice = promoPriceOf(row);
  if (promoPrice != null) {
    events.push({
      at: pricing.mode === "AUTO" && leave ? leave : start,
      label: row.promoLabel ?? "Promo appliquée",
      detail: `${formatDt(row.priceBeforePromo)} → ${formatDt(promoPrice)} (−${formatDt(row.promoDiscount)})`,
      tone: "ok",
    });
  }
  if (
    pricing.fixedAt &&
    Math.abs(new Date(pricing.fixedAt).getTime() - start) > 60_000
  ) {
    events.push({
      at: new Date(pricing.fixedAt).getTime(),
      label: "Forfait fixé",
      detail: `${pricing.fixedServiceName ?? ""} · ${formatDt(pricing.fixedAmount)}`,
      tone: "ok",
    });
  }
  if (pricing.mode === "FIXED" && pricing.fixedEndsAt) {
    events.push({
      at: pricing.fixedEndsAt,
      label: `Fin du forfait ${pricing.fixedServiceName ?? ""}`,
      detail: `Tolérance ${pricing.rules.fixedGraceMin} min`,
      tone: "warn",
    });
  }

  // Price changes (surcharge / next tier), up to departure + the next upcoming one
  let cursor = rowPricingAt(row, start);
  let futureShown = 0;
  for (let i = 0; i < 12 && cursor?.nextChangeAt != null; i++) {
    const at = cursor.nextChangeAt;
    const after = rowPricingAt(row, at + 1);
    if (!after) break;
    const future = at > horizon;
    if (future && (leave || futureShown >= 1)) break;
    events.push({
      at,
      label:
        after.stage === "SURCHARGE"
          ? `Supplément +${formatDt(after.amountDue - (cursor.amountDue ?? 0))}`
          : `Tarif ${after.currentTier.name}${pricing.mode === "FIXED" ? " (tarif suivant)" : ""}`,
      detail: `${formatDt(after.amountDue)}${future ? " · à venir" : ""}`,
      tone: pricing.mode === "FIXED" ? "danger" : "default",
    });
    if (future) futureShown += 1;
    cursor = after;
  }

  const paid = visitPaidAmount(row);
  if (paid > 0) {
    events.push({
      at: row.paidAt ? new Date(row.paidAt).getTime() : horizon,
      label: "Payé",
      detail: formatDt(paid),
      tone: "ok",
    });
  }
  if (leave) {
    events.push({
      at: leave,
      label: "Départ (check-out)",
      detail: `Montant ${formatDt(row.payedAmount)}`,
    });
  }
  events.sort((a, b) => a.at - b.at);

  const total = leave ? row.payedAmount || 0 : pricing.amountDue;
  const balance = visitBalanceDue(row, now);

  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tarif & dépassement
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span>
            Total <span className="font-semibold">{formatDt(total)}</span>
          </span>
          {pricing.mode === "FIXED" ? (
            <span className="text-muted-foreground">
              · original {formatDt(pricing.fixedAmount)}
            </span>
          ) : null}
          {balance > 0.0005 ? (
            <span className="font-semibold text-rose-700">
              · reste {formatDt(balance)}
            </span>
          ) : null}
        </div>
      </div>
      <ol className="space-y-1.5">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex items-start gap-2">
            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
              {format(e.at, "HH:mm")}
            </span>
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                e.tone === "danger"
                  ? "bg-rose-500"
                  : e.tone === "warn"
                    ? "bg-amber-500"
                    : e.tone === "ok"
                      ? "bg-emerald-500"
                      : "bg-slate-400"
              )}
            />
            <span className="min-w-0">
              <span className="font-medium">{e.label}</span>
              {e.detail ? (
                <span className="text-muted-foreground"> · {e.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {isLikelyForgotCheckout(row, now) ? (
        <p className="mt-2 text-xs text-violet-700">
          A payé son forfait mais la session est toujours ouverte : checkout
          probablement oublié. Utilisez « Clôturer à une heure » pour fermer à
          l’heure réelle de départ.
        </p>
      ) : null}
    </div>
  );
}

/** Montant column: base + extra = total, paid / balance. */
type PromoSnapshot = {
  priceBeforePromo?: number | null;
  promoDiscount?: number | null;
  promoLabel?: string | null;
};

/** Promo price actually charged (before − discount), or null when no promo landed. */
export function promoPriceOf(row: PromoSnapshot): number | null {
  if (!row.promoDiscount || row.promoDiscount <= 0.0005) return null;
  if (row.priceBeforePromo == null) return null;
  return Math.max(0, Math.round((row.priceBeforePromo - row.promoDiscount) * 1000) / 1000);
}

/** Old price struck through + promo price + badge (journal / abonnements). */
export function PromoPriceTag({
  row,
  amount,
  compact,
}: {
  row: PromoSnapshot;
  /** Price shown after the struck one (defaults to the promo price) */
  amount?: number;
  compact?: boolean;
}) {
  const after = promoPriceOf(row);
  if (after == null) return null;
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 tabular-nums",
        compact ? "text-[11px]" : "text-sm"
      )}
      title={row.promoLabel ?? "Promo appliquée"}
    >
      <s className="text-muted-foreground">{formatDt(row.priceBeforePromo)}</s>
      <span className="font-semibold text-emerald-700">
        {formatDt(amount ?? after)}
      </span>
      <Badge
        variant="outline"
        className="h-auto border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-800"
      >
        {row.promoLabel ?? "Promo"}
      </Badge>
    </span>
  );
}

export function JournalPricingAmountCell({
  row,
  now,
}: {
  row: Journal;
  now: number;
}) {
  const pricing = rowPricing(row, now);
  if (!pricing) return null;
  const active = isActiveVisit(row);
  const total = active ? pricing.amountDue : row.payedAmount || 0;
  const base = pricing.baseAmount;
  const extra = Math.max(0, Math.round((total - base) * 1000) / 1000);
  const paid = visitPaidAmount(row);
  const balance = visitBalanceDue(row, now);
  const forgot = isLikelyForgotCheckout(row, now);
  const promoPrice = promoPriceOf(row);
  const promoIsTotal =
    promoPrice != null && Math.abs(promoPrice - total) < 0.0005;

  return (
    <div className="flex flex-col items-start gap-0.5">
      {promoIsTotal ? (
        <PromoPriceTag row={row} amount={total} />
      ) : (
        <span className="font-medium tabular-nums">{formatDt(total)}</span>
      )}
      {promoPrice != null && !promoIsTotal ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          Forfait <PromoPriceTag row={row} compact />
        </span>
      ) : null}
      {extra > 0.0005 ? (
        <span className="text-[11px] tabular-nums text-rose-700">
          {pricing.mode === "FIXED"
            ? pricing.tierSteps > 0
              ? `${formatDt(base)} → ${pricing.currentTier.name} (tarif suivant)`
              : `${formatDt(base)} + ${formatDt(extra)}`
            : null}
        </span>
      ) : null}
      {pricing.mode === "FIXED" && pricing.overtime ? (
        <span className="text-[11px] text-amber-700">
          Dépassé de {formatMinutes(pricing.overtimeMs)}
        </span>
      ) : null}
      {paid > 0 ? (
        <span className="text-[11px] tabular-nums text-muted-foreground">
          Payé {formatDt(paid)}
          {balance > 0.0005 ? (
            <span className="font-semibold text-rose-700">
              {" "}· reste {formatDt(balance)}
            </span>
          ) : null}
        </span>
      ) : null}
      {forgot ? (
        <Badge
          variant="outline"
          className="h-auto border-violet-400 bg-violet-50 py-0.5 text-[10px] text-violet-800"
          title="A payé son forfait mais n’a pas fait le check-out"
        >
          Payé · checkout oublié ?
        </Badge>
      ) : null}
    </div>
  );
}
