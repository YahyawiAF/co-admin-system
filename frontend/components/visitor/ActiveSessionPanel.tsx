"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Clock, Crown, Loader2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { formatDurationHm } from "@/lib/journal-utils";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import type {
  AppInstallGlobalPromo,
  AppInstallPromo,
  Journal,
  MobileSeatMode,
  MobileSeatSettings,
  SeatAssignmentInfo,
} from "@/lib/types";
import { pricedWithPromo, promoCategoriesOf } from "@/lib/promo-price";
import { PromoPrice } from "@/components/visitor/PromoPrice";
import { useOrg } from "@/lib/org";
import { usePricingContext } from "@/lib/hooks/use-pricing-context";
import {
  formatDt,
  formatMinutes,
  liveRowPricing,
  stageLabel,
} from "@/lib/session-pricing";
import { cn } from "@/lib/utils";
import { TierLevelUp } from "@/components/visitor/SessionTariffBoost";
import { PassPickerSheet } from "@/components/visitor/PassPickerSheet";
import { SeatPickerSheet } from "@/components/visitor/SeatPickerSheet";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import {
  SessionSteps,
  type SessionStep,
} from "@/components/visitor/SessionSteps";

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
  promos?: AppInstallPromo[] | null;
  globalPromo?: AppInstallGlobalPromo | null;
  /** Open the subscription picker (session switches to the abo once approved) */
  onSwitchToSubscription?: () => void;
  /** Subscription request waiting for reception */
  pendingSubscriptionName?: string | null;
  /** Opens the Wi-Fi credentials modal (text link under check-out). */
  onWifi?: () => void;
  /** Rendered after the session blocks (e.g. events strip). */
  belowSession?: ReactNode;
};

function StatTile({
  label,
  value,
  sub,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "indigo" | "rose" | "slate";
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 truncate text-xl font-bold leading-tight tabular-nums",
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
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{sub}</p>
      ) : null}
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
  promos,
  globalPromo,
  onSwitchToSubscription,
  pendingSubscriptionName,
  onWifi,
  belowSession,
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();
  const { slug } = useOrg();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);

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
  const catalogPrice =
    session.prices?.price ?? session.price?.price ?? null;
  const priceId = session.priceId || session.prices?.id || session.price?.id;
  const amountRaw = covered
    ? 0
    : live?.amountDue ?? session.amountDue ?? session.payedAmount ?? 0;
  const priced =
    !covered && !live
      ? pricedWithPromo(
          catalogPrice != null && catalogPrice > 0 ? catalogPrice : amountRaw,
          priceId,
          {
            promos,
            globalPromo,
            categories: promoCategoriesOf(session.prices || session.price),
          }
        )
      : null;
  const passTitle = live
    ? live.mode === "AUTO"
      ? `Pass ${live.currentTier.name}`
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
  const passSubtitle = live
    ? live.mode === "AUTO"
      ? "Tarif auto · selon la durée"
      : `Pass fixé · ${formatDt(live.fixedAmount ?? live.baseAmount)}`
    : covered
      ? subKindLabel
        ? `Abonnement · ${subKindLabel}`
        : "Abonnement"
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
  const timeTile = isHoursPool ? (
    <StatTile
      label="Cette session"
      tone="slate"
      value={elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}
      sub={`Depuis ${format(sessionStart, "HH:mm")}`}
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
      value={formatDt(live.amountDue)}
      sub={
        live.paidAmount > 0
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

  // ----- Steps -----
  const steps: SessionStep[] = [
    {
      key: "checkin",
      label: "Pointé",
      value: format(sessionStart, "HH:mm"),
      state: "done",
    },
    seatLabel
      ? {
          key: "seat",
          label: "Place",
          value: seatLabel,
          state: "done",
          onClick: () => setSeatOpen(true),
        }
      : seatSheetAvailable
        ? {
            key: "seat",
            label: "Place",
            value: "Choisir",
            state: "todo",
            onClick: () => setSeatOpen(true),
          }
        : { key: "seat", label: "Place", value: "Accueil", state: "info" },
    covered
      ? {
          key: "pass",
          label: "Pass",
          value: subKindLabel ?? "Abo",
          state: "done",
        }
      : live
        ? {
            key: "pass",
            label: "Pass",
            value: live.mode === "AUTO" ? "Auto" : live.currentTier.name,
            state: live.mode === "AUTO" ? "info" : "done",
            onClick: canChangeTariff ? openPassSheet : undefined,
          }
        : { key: "pass", label: "Pass", value: passTitle, state: "done" },
    covered
      ? { key: "payment", label: "Paiement", value: "Inclus", state: "done" }
      : session.isPayed
        ? { key: "payment", label: "Paiement", value: "Payé", state: "done" }
        : {
            key: "payment",
            label: "Paiement",
            value: "À l’accueil",
            state: "todo",
          },
  ];
  const stepsHint =
    !covered && !session.isPayed
      ? "Demandez à l’accueil de confirmer le paiement pour collecter vos points au check-out."
      : null;

  return (
    <div className="space-y-3">
      {/* Hero: pass, time left, amount, change pass */}
      <section className="rounded-3xl bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Session en cours
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
              covered
                ? "bg-indigo-50 text-indigo-700"
                : session.isPayed
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                covered
                  ? "bg-indigo-500"
                  : session.isPayed
                    ? "bg-emerald-500"
                    : "bg-amber-500"
              )}
            />
            {covered ? "Abonnement actif" : session.isPayed ? "Payé" : "Non payé"}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            {covered || isHoursPool ? (
              <Crown className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold leading-tight text-slate-900">
              {passTitle}
            </h2>
            {passSubtitle ? (
              <p className="truncate text-[11px] text-slate-500">
                {passSubtitle}
              </p>
            ) : null}
          </div>
          {canChangeTariff ? (
            <button
              type="button"
              aria-label="Changer de pass"
              onClick={openPassSheet}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Changer
            </button>
          ) : null}
        </div>

        {isOptimistic ? (
          <p className="mt-1.5 text-xs font-medium text-amber-600">
            Confirmation en cours…
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {timeTile}
          {secondTile}
        </div>

        {progressPct != null ? (
          <div className="mt-3 space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overtime ? "bg-rose-500" : "bg-indigo-600"
                )}
                style={{ width: `${overtime ? 100 : progressPct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 text-[11px] text-slate-500">
              <span>{progressLeft}</span>
              {progressRight ? <span>{progressRight}</span> : null}
            </div>
          </div>
        ) : null}

        {hint ? (
          <p
            className={cn(
              "mt-2.5 text-[11px] font-medium leading-snug",
              hint.tone === "rose"
                ? "text-rose-600"
                : hint.tone === "amber"
                  ? "text-amber-700"
                  : "text-slate-500"
            )}
          >
            {hint.text}
          </p>
        ) : null}

        {live && !covered && !canChangeTariff ? (
          <p className="mt-1.5 text-[11px] text-slate-500">
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

      <SessionSteps steps={steps} hint={stepsHint} />

      <div className="space-y-2">
        {checkout.isError && !checkoutOpen ? (
          <p className="text-center text-xs font-medium text-rose-600">
            {(checkout.error as Error).message}
          </p>
        ) : null}
        <Button
          className="h-12 w-full rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <Wifi className="h-3.5 w-3.5" />
                Wi‑Fi
              </button>
            ) : null}
            {showSubLink ? (
              pendingSubscriptionName ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  Abonnement en attente
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onSwitchToSubscription}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
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
        onOpenChange={setCheckoutOpen}
        dismissible={!checkout.isPending}
        title="Terminer votre session ?"
        description="Le compteur s’arrête et la session ne pourra pas être reprise."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-slate-200 text-slate-700"
              disabled={checkout.isPending}
              onClick={() => setCheckoutOpen(false)}
            >
              Continuer
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
