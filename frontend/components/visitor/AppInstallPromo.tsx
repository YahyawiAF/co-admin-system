"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { cn } from "@/lib/utils";
import {
  PromoValueKind,
  type AppInstallGlobalPromo,
  type AppInstallPromo as PromoOffer,
} from "@/lib/types";

type Props = {
  /** @deprecated Prefer `promos` / `globalPromo` */
  amountDt?: number | null;
  globalPromo?: AppInstallGlobalPromo | null;
  promos?: PromoOffer[] | null;
  /** Stronger highlight right after check-out */
  emphasize?: boolean;
  className?: string;
};

function formatValue(
  valueKind: PromoValueKind,
  value: number,
  priceName?: string
): string {
  const core =
    valueKind === PromoValueKind.PERCENT ? `${value} %` : `${value} DT`;
  return priceName ? `${core} sur ${priceName}` : core;
}

/**
 * Always-on Accueil promo (browser only): install the app to unlock the offer.
 */
export function AppInstallPromo({
  amountDt,
  globalPromo,
  promos,
  emphasize = false,
  className,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!isStandalonePwa());
  }, []);

  if (!show) return null;

  const active = (promos ?? []).filter(
    (p) => p.isActive !== false && Number.isFinite(p.value) && p.value > 0
  );
  const hasGlobal =
    globalPromo != null &&
    Number.isFinite(globalPromo.value) &&
    globalPromo.value > 0;
  const legacyAmount =
    amountDt != null && Number.isFinite(amountDt) && amountDt > 0
      ? amountDt
      : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-white px-4 py-3.5 shadow-sm",
        emphasize && "ring-2 ring-indigo-200",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-indigo-100/80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-amber-100/70"
        aria-hidden
      />

      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 animate-[bounce_1.6s_ease-in-out_infinite] items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Gift className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Bonus
          </p>
          {hasGlobal ? (
            <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-indigo-600">
              {formatValue(globalPromo!.valueKind, globalPromo!.value)}
            </p>
          ) : legacyAmount != null ? (
            <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-indigo-600">
              {legacyAmount} DT
            </p>
          ) : active.length > 0 ? (
            <p className="mt-0.5 text-lg font-bold leading-snug text-indigo-600">
              {formatValue(
                active[0]!.valueKind,
                active[0]!.value,
                active[0]!.priceName
              )}
              {active.length > 1 ? ` +${active.length - 1}` : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
              Cadeau app
            </p>
          )}
          <div className="mt-2.5">
            <InstallAppButton className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
