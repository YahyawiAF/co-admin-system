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

  // In PWA with unlocked promo — celebrate activation
  if (standalone && unlocked) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-white px-4 py-3.5 shadow-sm ring-2 ring-emerald-200",
          className
        )}
      >
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <PartyPopper className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Promo activée
            </p>
            {valueLabel ? (
              <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-emerald-700">
                {valueLabel}
              </p>
            ) : (
              <p className="mt-0.5 text-lg font-bold text-slate-900">
                Vous avez gagné
              </p>
            )}
            <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
              Votre réduction s&apos;applique au prochain paiement dans
              l&apos;app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Browser only — urge install to win
  if (standalone) return null;

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
            Vous gagnez
          </p>
          {valueLabel ? (
            <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-indigo-600">
              {valueLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
              Cadeau à l&apos;installation
            </p>
          )}
          <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
            Installez l&apos;app sur votre téléphone pour{" "}
            <span className="font-semibold text-slate-700">
              activer la promo
            </span>{" "}
            et commencer à gagner des points.
          </p>
          <div className="mt-2.5">
            <InstallAppButton className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
