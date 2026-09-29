"use client";

import { useEffect, useState } from "react";
import { Gift, PartyPopper } from "lucide-react";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { cn } from "@/lib/utils";
import {
  PromoValueKind,
  type AppInstallGlobalPromo,
  type AppInstallPromo as PromoOffer,
} from "@/lib/types";
import { PROMO_SCOPE_LABEL } from "@/lib/promo-price";

type Props = {
  /** @deprecated Prefer `promos` / `globalPromo` */
  amountDt?: number | null;
  globalPromo?: AppInstallGlobalPromo | null;
  promos?: PromoOffer[] | null;
  /** Stronger highlight right after check-out */
  emphasize?: boolean;
  /** Promo already unlocked (PWA installed, not yet claimed on a payment) */
  unlocked?: boolean;
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
 * Accueil promo: browser = install to win; PWA = promo activated.
 */
export function AppInstallPromo({
  amountDt,
  globalPromo,
  promos,
  emphasize = false,
  unlocked = false,
  className,
}: Props) {
  const [standalone, setStandalone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePwa());
    setReady(true);
  }, []);

  if (!ready) return null;

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

  const valueLabel = hasGlobal
    ? formatValue(globalPromo!.valueKind, globalPromo!.value)
    : legacyAmount != null
      ? `${legacyAmount} DT`
      : active.length > 0
        ? formatValue(
            active[0]!.valueKind,
            active[0]!.value,
            active[0]!.priceName
          ) + (active.length > 1 ? ` +${active.length - 1}` : "")
        : null;
  const scopeLabel =
    hasGlobal && globalPromo!.scopes?.length
      ? `Valable sur : ${globalPromo!.scopes
          .map((s) => PROMO_SCOPE_LABEL[s])
          .join(", ")}`
      : null;

  // In PWA with unlocked promo — celebrate activation
  if (standalone && unlocked) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-3xl bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-emerald-200",
          className
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <PartyPopper className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-emerald-700">
            {valueLabel ? `Promo ${valueLabel}` : "Promo activée"}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {scopeLabel ?? "Appliquée à votre prochain paiement"}
          </p>
        </div>
      </div>
    );
  }

  // Browser only — urge install to win
  if (standalone) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-3xl bg-white px-3.5 py-2.5 shadow-sm",
        emphasize && "ring-2 ring-indigo-200",
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Gift className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {valueLabel ? (
            <>
              <span className="text-indigo-600">{valueLabel}</span> offerts
            </>
          ) : (
            "Cadeau à l’installation"
          )}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {scopeLabel
            ? `Promo + points · ${scopeLabel}`
            : "Installez l’app : promo + points"}
        </p>
      </div>
      <InstallAppButton variant="pill" />
    </div>
  );
}
