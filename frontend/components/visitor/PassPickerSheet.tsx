"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Loader2, Timer } from "lucide-react";
import { QuestLabel, QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { QuestOption } from "@/components/visitor/quest/QuestOption";
import { useMemberPromotions } from "@/components/visitor/VisitorSpotlight";
import {
  formatDt,
  uniqueTiersByDuration,
  type PricingTier,
} from "@/lib/session-pricing";
import { dtToPoints } from "@/lib/points-catalog";
import { isStandalonePwa } from "@/lib/visitor-notify";
import type { Promotion, SessionPricingPayload } from "@/lib/types";

const H = 3_600_000;
const AUTO = "auto";

function withDiscount(price: number, discountPercent: number) {
  return Math.round(price * (1 - (discountPercent || 0) / 100) * 1000) / 1000;
}

function tierShort(hours: number) {
  return hours >= 7 ? "Jour" : `${hours}h`;
}

/** Live PRICE promotions → priceId (gift badge on that tarif). */
export function usePricePromos() {
  const { data = [] } = useMemberPromotions();
  return useMemo(() => {
    const m = new Map<string, Promotion>();
    for (const p of data) {
      if (p.liveNow && p.target === "PRICE" && p.priceId && !m.has(p.priceId)) {
        m.set(p.priceId, p);
      }
    }
    return m;
  }, [data]);
}

export function promoBadgeText(p: Promotion) {
  return p.label && p.label.length <= 10 ? p.label : "Cadeau";
}

/**
 * Tarif modal (mission style). AUTO session: "Tarif auto" is preselected —
 * closing or confirming it changes nothing. A live promo on a tarif shows a glowing badge.
 */
export function PassPickerSheet({
  open,
  onOpenChange,
  live,
  currentLabel,
  tiers,
  sessionStart,
  now,
  pending,
  error,
  onConfirm,
  fresh = false,
}: {
  /** Opened right after « Pointer mon arrivée » */
  fresh?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  live: SessionPricingPayload;
  /** e.g. "Tarif auto" / "Pass 4h" */
  currentLabel: string;
  tiers: PricingTier[];
  sessionStart: number;
  now: number;
  pending: boolean;
  error?: string | null;
  onConfirm: (priceId: string) => void;
}) {
  const isAuto = live.mode === "AUTO";
  const [pickedId, setPickedId] = useState<string | null>(isAuto ? AUTO : null);
  const [isPwa, setIsPwa] = useState(false);
  const promos = usePricePromos();

  useEffect(() => {
    if (open) setPickedId(isAuto ? AUTO : null);
  }, [open, isAuto]);
  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const options = useMemo(
    () =>
      uniqueTiersByDuration(tiers)
        .map((t) => ({
          tier: t,
          endsAt: sessionStart + t.durationHours * H,
          amount: withDiscount(t.price, live.discountPercent),
          isCurrent: live.mode === "FIXED" && live.fixedPriceId === t.priceId,
        }))
        .filter((o) => o.isCurrent || o.endsAt > now),
    [tiers, sessionStart, now, live.discountPercent, live.mode, live.fixedPriceId]
  );

  const picked = options.find((o) => o.tier.priceId === pickedId) ?? null;
  const keepAuto = isAuto && pickedId === AUTO;
  const amount = picked ? picked.amount : live.amountDue;
  const delta = picked ? picked.amount - live.amountDue : 0;

  const confirm = () => {
    if (keepAuto) {
      onOpenChange(false);
      return;
    }
    if (picked && !picked.isCurrent) onConfirm(picked.tier.priceId);
  };

  return (
    <QuestSheet
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!pending}
      eyebrow={fresh ? "Arrivée pointée ✓ · votre tarif" : "Votre tarif"}
      icon={<Clock className="h-5 w-5" />}
      title={isAuto ? "Comment payer ?" : "Changer de pass"}
      subtitle={
        isAuto
          ? "Pas sûr ? Gardez l’auto : vous payez juste le temps passé."
          : `Actuel : ${currentLabel} · prix bloqué d’avance`
      }
      reward={{
        label: keepAuto ? "Tarif auto · maintenant" : picked ? picked.tier.name : "Maintenant",
        value: formatDt(amount),
      }}
      chip={
        isPwa
          ? { label: "Points", value: `+${dtToPoints(amount)}` }
          : picked
            ? { label: "Fin", value: format(picked.endsAt, "HH:mm") }
            : null
      }
      footer={
        <>
          {error ? (
            <p className="mb-2 text-center text-xs font-medium text-rose-600">{error}</p>
          ) : picked && !picked.isCurrent ? (
            <p className="mb-2 text-center text-[11px] text-slate-600">
              {Math.abs(delta) < 0.0005
                ? "Même prix qu’actuellement"
                : delta > 0
                  ? `+${formatDt(delta)} par rapport à maintenant`
                  : `${formatDt(-delta)} de moins qu’actuellement`}
              {" · jusqu’à "}
              {format(picked.endsAt, "HH:mm")}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || (!keepAuto && (!picked || picked.isCurrent))}
            onClick={confirm}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-colors duration-200 hover:bg-indigo-700 disabled:opacity-50 motion-reduce:transition-none"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending
              ? "Enregistrement…"
              : keepAuto
                ? "Continuer en tarif auto"
                : picked && !picked.isCurrent
                  ? `${isAuto ? "Bloquer" : "Valider"} ${picked.tier.name} · ${formatDt(picked.amount)}`
                  : "Sélectionnez un pass"}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Changement possible tant que rien n’est payé
          </p>
        </>
      }
    >
      <QuestLabel>Depuis {format(sessionStart, "HH:mm")} · choisissez</QuestLabel>
      <div className="space-y-2.5 pb-1 pt-1">
        {isAuto ? (
          <QuestOption
            selected={keepAuto}
            disabled={pending}
            onClick={() => setPickedId(AUTO)}
            icon={<Timer className="h-5 w-5" />}
            title="Tarif auto"
            hint={`Le prix suit votre temps · ${formatDt(live.amountDue)} pour l’instant`}
            badge={
              <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Recommandé
              </span>
            }
          />
        ) : null}
        {options.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600">
            Aucun pass disponible pour le temps restant. Demandez à l’accueil.
          </p>
        ) : (
          options.map((o, i) => {
            const promo = promos.get(o.tier.priceId) ?? null;
            return (
              <div
                key={o.tier.priceId}
                className="v-rise"
                style={{ animationDelay: `${Math.min(i + 1, 6) * 40}ms` }}
              >
                <QuestOption
                  selected={pickedId === o.tier.priceId}
                  disabled={o.isCurrent || pending}
                  onClick={() => setPickedId(o.tier.priceId)}
                  icon={tierShort(o.tier.durationHours)}
                  title={o.tier.name}
                  hint={
                    o.isCurrent
                      ? "Pass actuel"
                      : `Prix bloqué · jusqu’à ${format(o.endsAt, "HH:mm")}`
                  }
                  price={formatDt(o.amount)}
                  gift={promo ? promoBadgeText(promo) : null}
                  giftLine={promo ? `+ ${promo.title} avec ce pass` : null}
                  badge={
                    o.isCurrent ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        Actuel
                      </span>
                    ) : null
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </QuestSheet>
  );
}
