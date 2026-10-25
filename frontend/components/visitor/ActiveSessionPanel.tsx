"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  Clock,
  CreditCard,
  Crown,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { formatDurationHm } from "@/lib/journal-utils";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import type {
  Journal,
  MobileSeatMode,
  MobileSeatSettings,
  SeatAssignmentInfo,
} from "@/lib/types";
import { PromoPrice } from "@/components/visitor/PromoPrice";
import { useOrg } from "@/lib/org";
import { usePricingContext } from "@/lib/hooks/use-pricing-context";
import {
  formatDt,
  formatMinutes,
  liveRowPricing,
  stageLabel,
  uniqueTiersByDuration,
} from "@/lib/session-pricing";
import { cn } from "@/lib/utils";
import { TierLevelUp } from "@/components/visitor/SessionTariffBoost";
import { PassPickerSheet } from "@/components/visitor/PassPickerSheet";
import { EnergyCupCard } from "@/components/visitor/EnergyCupCard";
import { MemberQrSheet } from "@/components/visitor/MemberQrSheet";
import { CheckinRewardSheet } from "@/components/visitor/CheckinRewardSheet";
import { clearCheckinReward, hasCheckinReward } from "@/lib/visitorCache";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { dtToPoints } from "@/lib/points-catalog";
import { SeatPickerSheet } from "@/components/visitor/SeatPickerSheet";
import { BottomSheet } from "@/components/visitor/BottomSheet";

export type ActiveSession = Journal & {
  seat?: SeatAssignmentInfo | null;
  amountDue?: number;
  overtime?: boolean;
  remainingMs?: number | null;
  expectedLeaveTime?: string | null;
  sessionElapsedMs?: number;
  coveredBySubscription?: boolean;
  subscriptionKind?: "HOURS_POOL" | "SEMI_DAY" | "FULL_DAY" | null;
  hoursQuota?: number | null;
  hoursUsed?: number | null;
};

type Props = {
  memberId: string;
  session: ActiveSession;
  seat?: SeatAssignmentInfo | null;
  seatSettings?: MobileSeatSettings | null;
  hasActiveSubscription?: boolean;
  subscriptionKind?: string | null;
  allowedSpaceIds?: string[];
  /** Called after a successful check-out (web promo CTA). */
  onCheckoutSuccess?: () => void;
  /** Open the subscription picker (session switches to the abo once approved) */
  onSwitchToSubscription?: () => void;
  /** Subscription request waiting for reception */
  pendingSubscriptionName?: string | null;
  /** Opens the Wi-Fi credentials modal (text link under check-out). */
  onWifi?: () => void;
  /** Rendered after the session blocks (e.g. events strip). */
  belowSession?: ReactNode;
  /** QR scanned again during the session: ask "leaving?" right away. */
  promptCheckout?: boolean;
};

function StatTile({
  label,
  value,
  sub,
  extra,
  big,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
  big?: boolean;
  tone?: "indigo" | "rose" | "slate";
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 truncate font-black leading-tight tabular-nums",
          big ? "text-[28px]" : "text-xl",
          tone === "rose"
            ? "text-rose-600"
            : tone === "slate"
              ? "text-slate-900"
              : "text-indigo-600"
        )}
      >
        {value}
      </div>
      {sub ? (
        <p className="mt-0.5 truncate text-[11px] text-slate-600">{sub}</p>
      ) : null}
      {extra}
    </div>
  );
}

export function ActiveSessionPanel({
  memberId,
  session,
  seat: seatProp,
  seatSettings,
  hasActiveSubscription,
  subscriptionKind,
  allowedSpaceIds,
  onCheckoutSuccess,
  onSwitchToSubscription,
  pendingSubscriptionName,
  onWifi,
  belowSession,
  promptCheckout,
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();
  const { slug } = useOrg();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const isOptimisticSession =
    !!(session as { _optimistic?: boolean })._optimistic ||
    String(session.id || "").startsWith("optimistic");
  const [passOpen, setPassOpen] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  // Fresh QR check-in: reward + quote of the day, once
  useEffect(() => {
    if (!isOptimisticSession && hasCheckinReward(slug)) setRewardOpen(true);
  }, [slug, isOptimisticSession]);
  const onRewardOpenChange = (open: boolean) => {
    setRewardOpen(open);
    if (!open) clearCheckinReward(slug);
  };

  useEffect(() => {
    if (!promptCheckout) return;
    setLeaving(true);
    setCheckoutOpen(true);
  }, [promptCheckout]);

  const { data: pricingCtx } = usePricingContext({
    orgSlug: slug,
    enabled: !!session.pricing,
  });
  const live = useMemo(
    () => liveRowPricing(session, pricingCtx?.allTiers, now),
    [session, pricingCtx?.allTiers, now]
  );

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const subKind = session.subscriptionKind || subscriptionKind || null;
  const isHoursPool = subKind === "HOURS_POOL";
  const seat = session.seat || seatProp || null;
  const seatMode = (seatSettings?.mobileSeatMode || null) as MobileSeatMode | null;
  const seatLabel = seat?.seatLabel || null;
  const canPickSeat =
    !!session &&
    !seatLabel &&
    seatMode === "VISITOR_CHOOSE" &&
    !isHoursPool;
  const seatSheetAvailable =
    !!seatLabel ||
    (canPickSeat && (!allowedSpaceIds || allowedSpaceIds.length > 0));

  // Seat claimed from the sheet → close it.
  useEffect(() => {
    if (seatLabel) setSeatOpen(false);
  }, [seatLabel]);

  const elapsedMs = useMemo(() => {
    if (session.registredTime) {
      return Math.max(0, now - new Date(session.registredTime).getTime());
    }
    return session.sessionElapsedMs ?? null;
  }, [session, now]);

  const remainingMs = useMemo(() => {
    if (isHoursPool && session.hoursQuota != null) {
      const poolLeft =
        session.hoursQuota -
        (session.hoursUsed ?? 0) -
        (elapsedMs ?? 0) / 3600_000;
      return poolLeft * 3600_000;
    }
    if (live) return live.tierEndsAt - now;
    if (session.expectedLeaveTime) {
      return new Date(session.expectedLeaveTime).getTime() - now;
    }
    return session.remainingMs ?? null;
  }, [session, now, isHoursPool, elapsedMs, live]);

  const poolUsedHours = isHoursPool
    ? (session.hoursUsed ?? 0) + (elapsedMs ?? 0) / 3600_000
    : 0;
  const poolProgress =
    isHoursPool && session.hoursQuota
      ? Math.min(100, Math.max(0, (poolUsedHours / session.hoursQuota) * 100))
      : null;

  const dayProgress = useMemo(() => {
    if (isHoursPool || remainingMs == null || elapsedMs == null) return null;
    const total = elapsedMs + Math.max(0, remainingMs);
    if (total <= 0) return null;
    const usedPct = Math.min(100, Math.max(0, (elapsedMs / total) * 100));
    return { usedPct, totalMs: total };
  }, [isHoursPool, remainingMs, elapsedMs]);

  const overtime = remainingMs !== null && remainingMs < 0;
  const covered = session.coveredBySubscription || hasActiveSubscription;
  const isOptimistic =
    !!(session as { _optimistic?: boolean })._optimistic ||
    String(session.id || "").startsWith("optimistic");
  const amountRaw = covered
    ? 0
    : live?.amountDue ?? session.amountDue ?? session.payedAmount ?? 0;
  const promoOff =
    !covered && session.promoDiscount && session.promoDiscount > 0.0005
      ? session.promoDiscount
      : null;
  const priced =
    promoOff && !live
      ? {
          original: session.priceBeforePromo ?? amountRaw + promoOff,
          final: amountRaw,
          hasPromo: true,
        }
      : null;
  const passTitle = live
    ? live.mode === "AUTO"
      ? "Tarif auto"
      : live.fixedServiceName || live.currentTier.name
    : session.prices?.name || session.price?.name || "Pass";
  const subKindLabel =
    subKind === "SEMI_DAY"
      ? "Demi-journée"
      : subKind === "FULL_DAY"
        ? "Journée"
        : isHoursPool
          ? "Heures"
          : null;

  const checkout = useMutation({
    mutationFn: () => mobileApi.checkout(session.id),
    onSuccess: (res: {
      pointsAwarded?: number;
      newTrophies?: string[];
      memberPoints?: number;
    }) => {
      setCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
      queryClient.invalidateQueries({ queryKey: ["member-points", memberId] });
      const awarded = res?.pointsAwarded ?? 0;
      if (awarded > 0 && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("visitor-points-award", {
            detail: {
              amount: awarded,
              credited: true,
              pending: false,
              points: res.memberPoints ?? awarded,
              flash: true,
              newTrophies: res.newTrophies ?? [],
              message: `+${awarded} pts`,
            },
          })
        );
      }
      onCheckoutSuccess?.();
    },
  });

  const tiers = useMemo(
    () =>
      [...(pricingCtx?.allTiers ?? [])].sort(
        (a, b) => a.durationHours - b.durationHours
      ),
    [pricingCtx?.allTiers]
  );
  const sessionStart = session.registredTime
    ? new Date(session.registredTime).getTime()
    : now;
  const canChangeTariff =
    !!live &&
    !covered &&
    !isOptimistic &&
    !session.isPayed &&
    !(live.paidAmount > 0) &&
    tiers.length > 0;

  const fixTariff = useMutation({
    mutationFn: (vars: { priceId: string; upgrade?: boolean }) =>
      mobileApi.fixMySessionTariff(session.id, vars.priceId, memberId),
    onSuccess: (_res, vars) => {
      const name = tiers.find((t) => t.priceId === vars.priceId)?.name;
      if (vars.upgrade) {
        toast.success(`Niveau supérieur ! Pass ${name ?? ""} activé`);
      } else {
        toast.success(`Pass ${name ?? ""} choisi ✓`);
      }
      setPassOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
  });
  const fixError = fixTariff.isError
    ? (fixTariff.error as Error).message
    : null;
  const openPassSheet = () => {
    fixTariff.reset();
    setPassOpen(true);
  };

  const showSubLink =
    !covered &&
    (!!pendingSubscriptionName || (!!onSwitchToSubscription && !isOptimistic));

  // ----- Hero figures -----
  const pointsForSession =
    !covered && live && isPwa ? dtToPoints(live.amountDue) : 0;

  const timeTile = isHoursPool ? (
    <StatTile
      label="Cette session"
      tone="slate"
      value={elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}
      sub={`Depuis ${format(sessionStart, "HH:mm")}`}
    />
  ) : live?.mode === "AUTO" && !covered ? (
    <StatTile
      label="Temps passé"
      tone="indigo"
      big
      value={
        elapsedMs != null ? (
          <>
            {formatDurationHm(elapsedMs)}
            <span className="text-sm font-bold text-slate-500">
              :{String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0")}
            </span>
          </>
        ) : (
          "—"
        )
      }
    />
  ) : (
    <StatTile
      label={overtime ? "Dépassement" : "Temps restant"}
      tone={overtime ? "rose" : "indigo"}
      value={remainingMs == null ? "—" : formatDurationHm(remainingMs)}
      sub={
        dayProgress
          ? `sur ${formatDurationHm(dayProgress.totalMs)} incluses`
          : null
      }
    />
  );

  const secondTile = isHoursPool ? (
    <StatTile
      label="Heures restantes"
      tone={overtime ? "rose" : "indigo"}
      value={
        remainingMs == null
          ? "—"
          : `${overtime ? "+" : ""}${formatDurationHm(remainingMs)}`
      }
      sub={session.hoursQuota != null ? `sur ${session.hoursQuota} h` : null}
    />
  ) : covered ? (
    <StatTile
      label="Montant"
      tone="slate"
      value="Inclus"
      sub="Dans votre abonnement"
    />
  ) : live ? (
    <StatTile
      label="À payer"
      tone="slate"
      big
      value={formatDt(live.amountDue)}
      extra={
        pointsForSession > 0 ? (
          <p className="mt-0.5 text-xs font-extrabold text-amber-700">
            +{pointsForSession} pts à gagner
          </p>
        ) : null
      }
      sub={
        promoOff && live.paidAmount <= 0 && !session.isPayed
          ? `Promo appliquée · −${formatDt(promoOff)}`
          : live.paidAmount > 0
          ? `Payé ${formatDt(live.paidAmount)}${
              live.balanceDue > 0 ? ` · reste ${formatDt(live.balanceDue)}` : ""
            }`
          : session.isPayed
            ? "Payé"
            : "À régler à l’accueil"
      }
    />
  ) : (
    <StatTile
      label="À payer"
      tone="slate"
      value={
        priced ? (
          <PromoPrice
            original={priced.original}
            final={priced.hasPromo ? priced.final : amountRaw}
            hasPromo={priced.hasPromo}
            size="sm"
            align="start"
          />
        ) : (
          formatDt(amountRaw)
        )
      }
      sub={
        priced?.hasPromo
          ? "Promo appliquée"
          : session.isPayed
            ? "Payé"
            : "À régler à l’accueil"
      }
    />
  );

  const progressPct = isHoursPool ? poolProgress : dayProgress?.usedPct ?? null;
  const progressLeft = isHoursPool
    ? `${formatDurationHm(poolUsedHours * 3600_000)} consommées`
    : `Utilisé · ${elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}`;
  const progressRight = isHoursPool
    ? session.hoursQuota != null
      ? `${session.hoursQuota} h au total`
      : null
    : live
      ? `Jusqu’à ${format(live.tierEndsAt, "HH:mm")}`
      : "Expiration à minuit";

  let hint: { text: string; tone: "slate" | "amber" | "rose" } | null = null;
  if (live && live.mode === "FIXED" && live.overtime) {
    hint = {
      text: `Pass ${live.fixedServiceName ?? ""} dépassé de ${formatMinutes(live.overtimeMs)}${
        live.extraAmount > 0 ? ` · +${formatDt(live.extraAmount)}` : ""
      }`,
      tone: "rose",
    };
  } else if (live && live.nextChangeAt != null && live.nextAmount != null) {
    hint = {
      text: `Dans ${formatMinutes(live.nextChangeAt - now)} → ${
        live.nextTierName ? `Pass ${live.nextTierName}` : "supplément"
      } · ${formatDt(live.nextAmount)} (${format(live.nextChangeAt, "HH:mm")})`,
      tone: live.stage === "WITHIN" ? "slate" : "amber",
    };
  } else if (live && live.stage !== "WITHIN") {
    hint = { text: stageLabel(live, now, "visitor"), tone: "rose" };
  } else if (!live && overtime && !isHoursPool) {
    hint = {
      text: "Le prix du pass reste affiché ; l’accueil peut ajuster.",
      tone: "rose",
    };
  }


  const stepsHint =
    !covered && !session.isPayed
      ? "Demandez à l’accueil de confirmer le paiement pour collecter vos points au check-out."
      : null;

  // ----- Tarif auto track (2h → 4h → 6h → Jour) -----
  const track = useMemo(() => {
    if (!live || live.mode !== "AUTO" || covered || !tiers.length) return null;
    const shown = uniqueTiersByDuration(tiers).slice(0, 4);
    const elapsedH = (elapsedMs ?? 0) / 3_600_000;
    let idx = shown.findIndex((t) => elapsedH < t.durationHours);
    if (idx < 0) idx = shown.length - 1;
    const prevH = idx > 0 ? shown[idx - 1].durationHours : 0;
    const span = Math.max(0.0001, shown[idx].durationHours - prevH);
    const frac = Math.min(1, Math.max(0, (elapsedH - prevH) / span));
    const fill = shown.length > 1 ? Math.min(1, (idx + frac) / (shown.length - 1)) : 1;
    return { shown, idx, fill };
  }, [live, covered, tiers, elapsedMs]);

  const statusChip = covered
    ? { text: subKindLabel ? `Abonnement · ${subKindLabel}` : "Abonnement", cls: "bg-violet-100 text-violet-800" }
    : live?.mode === "AUTO"
      ? { text: "Tarif auto", cls: "bg-indigo-100 text-indigo-800" }
      : { text: passTitle, cls: "bg-indigo-100 text-indigo-800" };

  const seatChip = seatLabel
    ? {
        label: (
          <>
            Place <strong className="text-slate-900">{seatLabel}</strong>
          </>
        ),
        onClick: seatSheetAvailable ? () => setSeatOpen(true) : () => setQrOpen(true),
        accent: false,
      }
    : canPickSeat && seatSheetAvailable
      ? { label: "Choisir ma place", onClick: () => setSeatOpen(true), accent: true }
      : { label: "Mon QR · place", onClick: () => setQrOpen(true), accent: true };

  return (
    <div className="space-y-3">
      {/* Hero: live status, time, amount, tarif track */}
      <section className="v-rise rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-extrabold text-emerald-800">
            <span className="v-live h-[7px] w-[7px] rounded-full bg-emerald-500" />
            En direct · depuis {format(sessionStart, "HH:mm")}
          </span>
          <span className={cn("max-w-[45%] truncate rounded-lg px-2 py-1 text-[11px] font-extrabold", statusChip.cls)}>
            {statusChip.text}
          </span>
          <span className="flex-1" />
          {canChangeTariff ? (
            <button
              type="button"
              aria-label="Changer de tarif"
              onClick={openPassSheet}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-800 ring-1 ring-indigo-200 transition-colors duration-200 hover:bg-indigo-100 active:scale-95 motion-reduce:transition-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {live?.mode === "AUTO" ? "Fixer" : "Changer"}
            </button>
          ) : null}
        </div>

        {isOptimistic ? (
          <p className="mt-1.5 text-xs font-medium text-amber-700">Confirmation en cours…</p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {timeTile}
          {secondTile}
        </div>

        {track ? (
          <div className="mt-3.5">
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `repeat(${track.shown.length}, minmax(0, 1fr))` }}
            >
              <span
                aria-hidden
                className="absolute top-4 h-1 rounded-full bg-slate-200"
                style={{ left: `${50 / track.shown.length}%`, right: `${50 / track.shown.length}%` }}
              />
              <span
                aria-hidden
                className="absolute top-4 h-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{
                  left: `${50 / track.shown.length}%`,
                  width: `${(100 - 100 / track.shown.length) * track.fill}%`,
                }}
              />
              {track.shown.map((t, i) => (
                <div key={t.priceId} className="relative flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-black transition-colors duration-300 motion-reduce:transition-none",
                      i === track.idx
                        ? "v-node-pulse bg-indigo-600 text-white"
                        : i < track.idx
                          ? "bg-indigo-200 text-indigo-900"
                          : "border-2 border-indigo-200 bg-white text-indigo-800"
                    )}
                  >
                    {i < track.idx ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : t.durationHours >= 7 ? (
                      "Jour"
                    ) : (
                      `${t.durationHours}h`
                    )}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-slate-700">
                    {formatDt(t.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : progressPct != null ? (
          <div className="mt-3 space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
                  overtime ? "bg-rose-500" : "bg-indigo-600"
                )}
                style={{ width: `${overtime ? 100 : progressPct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 text-[11px] text-slate-600">
              <span>{progressLeft}</span>
              {progressRight ? <span>{progressRight}</span> : null}
            </div>
          </div>
        ) : null}

        {hint ? (
          <p
            className={cn(
              "mt-2.5 rounded-xl px-2.5 py-2 text-xs font-medium leading-snug",
              hint.tone === "rose"
                ? "bg-rose-50 text-rose-700"
                : hint.tone === "amber"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-700"
            )}
          >
            {hint.text}
          </p>
        ) : null}

        {live && !covered && !canChangeTariff ? (
          <p className="mt-1.5 text-[11px] text-slate-600">
            Pour changer de pass, demandez à l&apos;accueil.
          </p>
        ) : null}
      </section>

      {canChangeTariff && live?.mode === "FIXED" ? (
        <TierLevelUp
          live={live}
          tiers={tiers}
          sessionStart={sessionStart}
          now={now}
          pending={fixTariff.isPending}
          error={passOpen ? null : fixError}
          onUpgrade={(id) => fixTariff.mutate({ priceId: id, upgrade: true })}
          onOpenAll={openPassSheet}
        />
      ) : null}

      {!isOptimistic && session.registredTime ? (
        <EnergyCupCard memberId={memberId} since={String(session.registredTime)} />
      ) : null}

      {/* Place + payment */}
      <div className="v-rise space-y-1.5 [animation-delay:120ms]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={seatChip.onClick}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-transform duration-150 active:scale-95 motion-reduce:transition-none",
              seatChip.accent
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            )}
          >
            {seatChip.accent && !canPickSeat ? (
              <QrCode className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="truncate">{seatChip.label}</span>
          </button>
          <span
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold",
              covered || session.isPayed
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            )}
          >
            <CreditCard className="h-4 w-4" />
            {covered ? "Inclus" : session.isPayed ? "Payé" : "Payer à l’accueil"}
          </span>
        </div>
        {stepsHint ? (
          <p className="px-2 text-center text-[11px] leading-snug text-slate-600">{stepsHint}</p>
        ) : null}
        {seatLabel ? (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="mx-auto flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            <QrCode className="h-3.5 w-3.5" />
            Mon QR
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        {checkout.isError && !checkoutOpen ? (
          <p className="text-center text-xs font-medium text-rose-600">
            {(checkout.error as Error).message}
          </p>
        ) : null}
        <Button
          variant="outline"
          className="h-12 w-full rounded-full border-2 border-rose-600 bg-white text-sm font-extrabold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          disabled={checkout.isPending || !!session.leaveTime || isOptimistic}
          onClick={() => {
            checkout.reset();
            setCheckoutOpen(true);
          }}
        >
          {isOptimistic ? "Confirmation…" : "Terminer ma session"}
        </Button>
        {onWifi || showSubLink ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-0.5">
            {onWifi ? (
              <button
                type="button"
                onClick={onWifi}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                <Wifi className="h-3.5 w-3.5" />
                Wi‑Fi
              </button>
            ) : null}
            {showSubLink ? (
              pendingSubscriptionName ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Abonnement en attente
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onSwitchToSubscription}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Passer à un abonnement
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {belowSession}

      {live && canChangeTariff ? (
        <PassPickerSheet
          open={passOpen}
          onOpenChange={setPassOpen}
          live={live}
          currentLabel={passTitle}
          tiers={tiers}
          sessionStart={sessionStart}
          now={now}
          pending={fixTariff.isPending}
          error={fixError}
          onConfirm={(id) => fixTariff.mutate({ priceId: id })}
        />
      ) : null}

      <MemberQrSheet open={qrOpen} onOpenChange={setQrOpen} memberId={memberId} />

      <CheckinRewardSheet
        open={rewardOpen}
        onOpenChange={onRewardOpenChange}
        memberId={memberId}
        firstName={session.members?.firstName}
        startedAt={sessionStart}
        covered={!!covered}
        tarifLine={
          covered
            ? `${subKindLabel ? `Abonnement · ${subKindLabel}` : "Abonnement"} · inclus`
            : live?.mode === "AUTO" || !live
              ? "Tarif auto activé · rien à choisir"
              : `${passTitle} · prix bloqué`
        }
      />

      {seatSheetAvailable ? (
        <SeatPickerSheet
          open={seatOpen}
          onOpenChange={setSeatOpen}
          memberId={memberId}
          seat={seat}
          seatMode={seatMode}
          canPick={canPickSeat}
          allowedSpaceIds={allowedSpaceIds}
        />
      ) : null}

      <BottomSheet
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) setLeaving(false);
        }}
        dismissible={!checkout.isPending}
        title={leaving ? "Vous partez ?" : "Terminer votre session ?"}
        description={
          leaving
            ? "Vous avez scanné le QR pendant votre session. Terminez-la pour arrêter le compteur."
            : "Le compteur s’arrête et la session ne pourra pas être reprise."
        }
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-slate-200 text-slate-700"
              disabled={checkout.isPending}
              onClick={() => setCheckoutOpen(false)}
            >
              Je reste
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full bg-rose-600 font-semibold hover:bg-rose-700"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {checkout.isPending ? "Check-out…" : "Terminer"}
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5 rounded-2xl bg-slate-50 px-3.5 py-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Temps passé</span>
            <span className="font-semibold tabular-nums">
              {elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}
            </span>
          </div>
          {!covered ? (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Montant</span>
              <span className="font-semibold tabular-nums">
                {formatDt(live?.amountDue ?? amountRaw)}
              </span>
            </div>
          ) : null}
          {live && live.balanceDue > 0 && live.paidAmount > 0 ? (
            <div className="flex justify-between gap-2 text-rose-600">
              <span>Reste à payer</span>
              <span className="font-semibold tabular-nums">
                {formatDt(live.balanceDue)}
              </span>
            </div>
          ) : null}
        </div>
        {elapsedMs != null && elapsedMs < 5 * 60_000 ? (
          <p className="mt-2.5 text-xs text-amber-700">
            Votre session a commencé il y a moins de 5 min.{" "}
            {canChangeTariff
              ? "Pour changer de tarif, utilisez plutôt « Changer »."
              : "Pour changer de tarif, demandez plutôt à l’accueil."}
          </p>
        ) : null}
        {checkout.isError ? (
          <p className="mt-2.5 text-xs font-medium text-rose-600">
            {(checkout.error as Error).message}
          </p>
        ) : null}
      </BottomSheet>
    </div>
  );
}
