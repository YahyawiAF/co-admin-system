"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Loader2, Timer } from "lucide-react";
import { QuestLabel, QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { QuestOption } from "@/components/visitor/quest/QuestOption";
import { GiftAnswerLine, GiftOfferPanel } from "@/components/visitor/quest/GiftOffer";
import {
  acceptedBundleIds,
  bestDeal,
  dealTag,
  giftTag,
  indexTarifPromos,
} from "@/lib/tarif-promos";
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

/** Live tarif promos of the member: priceId → { deals, bundles } (category promos included). */
export function useTarifPromos() {
  const { data = [] } = useMemberPromotions();
  return useMemo(() => indexTarifPromos(data), [data]);
}

/** Live PRICE / BUNDLE promotions → priceId (badge on that tarif); gifts first. */
export function usePricePromos() {
  const { data = [] } = useMemberPromotions();
  return useMemo(() => {
    const m = new Map<string, Promotion>();
    const get = indexTarifPromos(data);
    for (const p of data) {
      for (const id of p.priceIds?.length ? p.priceIds : p.priceId ? [p.priceId] : []) {
        if (m.has(id)) continue;
        const t = get(id);
        const pick = t.bundles[0] ?? t.deals[0];
        if (pick) m.set(id, pick);
      }
    }
    return m;
  }, [data]);
}

export function promoBadgeText(p: Promotion) {
  if (p.target === "BUNDLE") return giftTag(p);
  if (p.target === "PRICE") return dealTag(p);
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
  onConfirm: (priceId: string, bundleIds?: string[]) => void;
}) {
  const isAuto = live.mode === "AUTO";
  const [pickedId, setPickedId] = useState<string | null>(isAuto ? AUTO : null);
  const [isPwa, setIsPwa] = useState(false);
  const promosOf = useTarifPromos();
  /** Gift answers (promo id → yes / no) and the pass whose gift panel is open */
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [giftOpenFor, setGiftOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPickedId(isAuto ? AUTO : null);
      setAnswers({});
      setGiftOpenFor(null);
    }
  }, [open, isAuto]);
  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const options = useMemo(
    () =>
      uniqueTiersByDuration(tiers)
        .map((t) => {
          const listAmount = withDiscount(t.price, live.discountPercent);
          const promos = promosOf(t.priceId);
          const deal = bestDeal(promos.deals, listAmount);
          return {
            tier: t,
            endsAt: sessionStart + t.durationHours * H,
            listAmount,
            amount: deal ? deal.final : listAmount,
            deal: deal?.promo ?? null,
            bundles: promos.bundles,
            isCurrent: live.mode === "FIXED" && live.fixedPriceId === t.priceId,
          };
        })
        .filter((o) => o.isCurrent || o.endsAt > now),
    [tiers, sessionStart, now, live.discountPercent, live.mode, live.fixedPriceId, promosOf]
  );

  const picked = options.find((o) => o.tier.priceId === pickedId) ?? null;
  const keepAuto = isAuto && pickedId === AUTO;
  const amount = picked ? picked.amount : live.amountDue;
  const delta = picked ? picked.amount - live.amountDue : 0;

  const gift = picked?.bundles[0] ?? null;
  const giftYes = !!gift && answers[gift.id] === true;

  const pick = (o: (typeof options)[number]) => {
    setPickedId(o.tier.priceId);
    // First tap on a pass with a gift: show the offer
    const g = o.bundles[0];
    setGiftOpenFor(g && answers[g.id] === undefined ? o.tier.priceId : null);
  };

  const confirm = () => {
    if (keepAuto) {
      onOpenChange(false);
      return;
    }
    if (picked && !picked.isCurrent) {
      onConfirm(picked.tier.priceId, acceptedBundleIds(picked.bundles, answers));
    }
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
          ) : picked && !picked.isCurrent && (giftYes || picked.deal) ? (
            <p
              key={picked.tier.priceId}
              className={`v-rise mb-2 text-center text-xs font-bold ${giftYes ? "text-amber-700" : "text-rose-700"}`}
            >
              {giftYes
                ? `Pass ${picked.tier.name} + ${gift!.itemName ?? "cadeau"} ${gift!.label} pour cette visite`
                : `Promo ${picked.deal!.label} · vous économisez ${formatDt(picked.listAmount - picked.amount)} DT`}
            </p>
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
            const g = o.bundles[0] ?? null;
            const answer = g ? answers[g.id] : undefined;
            const panelOpen = !!g && giftOpenFor === o.tier.priceId && !o.isCurrent;
            return (
              <div
                key={o.tier.priceId}
                className="v-rise"
                style={{ animationDelay: `${Math.min(i + 1, 6) * 40}ms` }}
              >
                <QuestOption
                  selected={pickedId === o.tier.priceId}
                  disabled={o.isCurrent || pending}
                  onClick={() => pick(o)}
                  icon={tierShort(o.tier.durationHours)}
                  title={o.tier.name}
                  hint={
                    o.isCurrent
                      ? "Pass actuel"
                      : o.deal
                        ? `Promo · jusqu’à ${format(o.endsAt, "HH:mm")}`
                        : `Prix bloqué · jusqu’à ${format(o.endsAt, "HH:mm")}`
                  }
                  price={
                    o.deal ? (
                      <span className="flex flex-col items-end">
                        <span className="text-[11px] font-medium text-slate-500 line-through">
                          {formatDt(o.listAmount)}
                        </span>
                        <span className="text-rose-700">{formatDt(o.amount)}</span>
                      </span>
                    ) : (
                      formatDt(o.amount)
                    )
                  }
                  gift={g ? giftTag(g) : null}
                  deal={o.deal ? dealTag(o.deal) : null}
                  badge={
                    o.isCurrent ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        Actuel
                      </span>
                    ) : null
                  }
                />
                {g && panelOpen ? (
                  <GiftOfferPanel
                    promo={g}
                    answer={answer}
                    disabled={pending}
                    onAnswer={(yes) => {
                      setAnswers((a) => ({ ...a, [g.id]: yes }));
                      setGiftOpenFor(null);
                      setPickedId(o.tier.priceId);
                    }}
                  />
                ) : g && answer !== undefined && !o.isCurrent ? (
                  <GiftAnswerLine
                    promo={g}
                    answer={answer}
                    onChange={() => {
                      setPickedId(o.tier.priceId);
                      setGiftOpenFor(o.tier.priceId);
                    }}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </QuestSheet>
  );
}
