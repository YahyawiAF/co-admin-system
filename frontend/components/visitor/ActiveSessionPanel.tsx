"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { mobileApi } from "@/lib/api/resources";
import { VisitorSeatMap } from "@/components/visitor/VisitorSeatMap";
import { formatDurationHm } from "@/lib/journal-utils";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import {
  BillingUnit,
  type AppInstallGlobalPromo,
  type AppInstallPromo,
  type Journal,
  type MobileSeatMode,
  type MobileSeatSettings,
  type PriceCategory,
  type SeatAssignmentInfo,
} from "@/lib/types";
import { TarifOptionCard } from "@/components/visitor/TarifOption";
import { pricedWithPromo, promoCategoriesOf } from "@/lib/promo-price";
import { PromoPrice } from "@/components/visitor/PromoPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrg } from "@/lib/org";
import { usePricingContext } from "@/lib/hooks/use-pricing-context";
import {
  formatDt,
  formatMinutes,
  liveRowPricing,
  stageLabel,
} from "@/lib/session-pricing";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ChevronRight,
  Check,
  Clock,
  Crown,
  Info,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TierLevelUp } from "@/components/visitor/SessionTariffBoost";

function ActionTile({
  icon: Icon,
  label,
  hint,
  onClick,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition",
        muted
          ? "border-slate-200 bg-slate-50"
          : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 active:scale-[0.98]"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          muted ? "bg-white text-slate-400" : "bg-white text-indigo-600 shadow-sm"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-semibold",
            muted ? "text-slate-600" : "text-indigo-700"
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className="block truncate text-[10px] text-slate-500">{hint}</span>
        ) : null}
      </span>
      {onClick ? (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
      ) : null}
    </button>
  );
}

function formatClock(ms: number) {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

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
  /** Rendered right under the session hero (e.g. events strip). */
  aboveTracking?: ReactNode;
};

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
  aboveTracking,
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();
  const { slug } = useOrg();
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [tariffOpen, setTariffOpen] = useState(false);
  const [pickedTierId, setPickedTierId] = useState<string | null>(null);
  const tariffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tariffOpen) return;
    tariffRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [tariffOpen]);
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

  const poolProgress = useMemo(() => {
    if (!isHoursPool || !session.hoursQuota) return null;
    const used = (session.hoursUsed ?? 0) + (elapsedMs ?? 0) / 3600_000;
    return Math.min(100, Math.max(0, (used / session.hoursQuota) * 100));
  }, [isHoursPool, session, elapsedMs]);

  const dayProgress = useMemo(() => {
    if (isHoursPool || remainingMs == null || elapsedMs == null) return null;
    const total = elapsedMs + Math.max(0, remainingMs);
    if (total <= 0) return null;
    const remainingPct = Math.min(
      100,
      Math.max(0, (Math.max(0, remainingMs) / total) * 100)
    );
    const usedPct = 100 - remainingPct;
    return { remainingPct, usedPct, totalMs: total };
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
  const passSubtitle = live
    ? live.mode === "AUTO"
      ? "Tarif auto · le prix suit le temps passé"
      : `Pass fixé · ${formatDt(live.fixedAmount ?? live.baseAmount)}`
    : covered
      ? "Abonnement actif"
      : null;

  const checkout = useMutation({
    mutationFn: () => mobileApi.checkout(session.id),
    onSuccess: (res: {
      pointsAwarded?: number;
      newTrophies?: string[];
      memberPoints?: number;
    }) => {
      setConfirmCheckout(false);
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
  const showSubTile =
    !covered &&
    (!!pendingSubscriptionName || (!!onSwitchToSubscription && !isOptimistic));

  const fixTariff = useMutation({
    mutationFn: (vars: { priceId: string; upgrade?: boolean }) =>
      mobileApi.fixMySessionTariff(session.id, vars.priceId, memberId),
    onSuccess: (_res, vars) => {
      const name = tiers.find((t) => t.priceId === vars.priceId)?.name;
      if (vars.upgrade) {
        toast.success(`Niveau supérieur ! Pass ${name ?? ""} activé`);
      } else {
        toast.success(`Pass ${name ?? ""} fixé ✓`);
      }
      setTariffOpen(false);
      setPickedTierId(null);
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
  });
  const pickedTier = tiers.find((t) => t.priceId === pickedTierId) || null;
  const recommendedTierId =
    tiers.find((t) => sessionStart + t.durationHours * 3_600_000 > now)
      ?.priceId ?? null;
  const openTariffPicker = (open: boolean) => {
    fixTariff.reset();
    setPickedTierId(null);
    setTariffOpen(open);
  };

  return (
    <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
      {/* Hero: which pass, hours left, payment, change pass */}
      <div className="text-left">
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
              aria-expanded={tariffOpen}
              onClick={() => openTariffPicker(!tariffOpen)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition active:scale-95",
                tariffOpen
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
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

        {!isHoursPool ? (
          <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold leading-none tabular-nums",
                    overtime ? "text-rose-600" : "text-indigo-600"
                  )}
                >
                  {remainingMs == null ? "—" : formatDurationHm(remainingMs)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {overtime ? "de dépassement" : "restantes"}
                </p>
              </div>
              {dayProgress ? (
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {formatDurationHm(dayProgress.totalMs)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">incluses</p>
                </div>
              ) : null}
            </div>
            {dayProgress ? (
              <div className="mt-3 space-y-1.5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${dayProgress.remainingPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>
                    Utilisé ·{" "}
                    {elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}
                  </span>
                  <span>
                    {live
                      ? `Jusqu’à ${format(live.tierEndsAt, "HH:mm")}`
                      : "Expiration à minuit"}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className={`mt-2 font-mono text-3xl font-bold tabular-nums ${
                  overtime ? "text-rose-600" : "text-indigo-600"
                }`}
              >
                {remainingMs === null
                  ? "—"
                  : overtime
                    ? `+${formatClock(remainingMs)}`
                    : formatClock(remainingMs)}
              </div>
            )}
          </div>
        ) : null}

        {!covered ? (
          <p
            className={cn(
              "mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug",
              session.isPayed ? "text-emerald-700" : "text-amber-700"
            )}
          >
            {session.isPayed ? (
              <Check className="mt-px h-3.5 w-3.5 shrink-0" />
            ) : (
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            )}
            {session.isPayed
              ? "Payé — vos points s’ajoutent au check-out."
              : "Demandez à l’accueil de confirmer le paiement pour collecter vos points au check-out."}
          </p>
        ) : null}
      </div>
      {aboveTracking}
      {isHoursPool ? (
        <>
          <div className="my-2.5 rounded-2xl border bg-slate-50 px-3 py-3.5">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Temps de cette session
            </p>
            <div className="mt-2 font-mono text-4xl font-bold tabular-nums text-primary">
              {elapsedMs != null ? formatClock(elapsedMs) : "—"}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {elapsedMs != null ? formatDurationHm(elapsedMs) : "Chronomètre"}
            </p>
          </div>
          <div className="mb-2.5 rounded-2xl border bg-slate-50 px-3 py-3.5">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Heures restantes (abonnement)
            </p>
            <div
              className={`mt-2 font-mono text-4xl font-bold tabular-nums ${
                overtime ? "text-red-600" : "text-primary"
              }`}
            >
              {remainingMs === null
                ? "—"
                : overtime
                  ? `+${formatClock(remainingMs)}`
                  : formatClock(remainingMs)}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {remainingMs == null
                ? null
                : overtime
                  ? `Dépassement ${formatDurationHm(remainingMs, { signed: true })}`
                  : `Reste ${formatDurationHm(remainingMs)}`}
            </p>
            {session.hoursQuota != null ? (
              <div className="mt-4 space-y-2 text-left">
                <Progress value={poolProgress ?? 0} className="h-2" />
                <p className="text-xs text-slate-500">
                  {formatDurationHm(
                    ((session.hoursUsed ?? 0) + (elapsedMs ?? 0) / 3600_000) *
                      3600_000
                  )}{" "}
                  consommées / {session.hoursQuota} h au total
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {live && !covered ? (
        <div className="mb-2.5 rounded-2xl border bg-white px-3.5 py-3 text-left shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Montant actuel
            </p>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                live.stage === "WITHIN"
                  ? "bg-indigo-50 text-indigo-700"
                  : live.stage === "WARNING" || live.stage === "GRACE"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-rose-50 text-rose-700"
              )}
            >
              {stageLabel(live, now, "visitor")}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">
            {formatDt(live.amountDue)}
          </p>
          {live.mode === "FIXED" && live.overtime ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              Pass {live.fixedServiceName} ({formatDt(live.fixedAmount)})
              dépassé de {formatMinutes(live.overtimeMs)}
              {live.extraAmount > 0 ? ` · +${formatDt(live.extraAmount)}` : ""}
            </p>
          ) : null}
          {live.nextChangeAt != null && live.nextAmount != null ? (
            <p className="mt-1 text-[11px] text-slate-500">
              {live.nextTierName
                ? `Tarif ${live.nextTierName}`
                : "Supplément"}{" "}
              dans {formatMinutes(live.nextChangeAt - now)} →{" "}
              <span className="font-semibold text-slate-700">
                {formatDt(live.nextAmount)}
              </span>
              {" "}({format(live.nextChangeAt, "HH:mm")})
            </p>
          ) : null}
          {live.paidAmount > 0 ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Payé {formatDt(live.paidAmount)}
              {live.balanceDue > 0 ? (
                <span className="font-semibold text-rose-600">
                  {" "}· reste {formatDt(live.balanceDue)}
                </span>
              ) : null}
            </p>
          ) : null}
          {!canChangeTariff ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Pour changer votre pass, demandez à l&apos;accueil.
            </p>
          ) : null}
        </div>
      ) : overtime && !isHoursPool ? (
        <Alert className="mb-4 text-left">
          <AlertDescription>
            Le prix du pass reste affiché ; l&apos;accueil peut ajuster.
          </AlertDescription>
        </Alert>
      ) : null}

      {!covered && priced ? (
        <>
          <div className="mb-0.5 flex justify-center">
            <PromoPrice
              original={priced.original}
              final={priced.hasPromo ? priced.final : amountRaw}
              hasPromo={priced.hasPromo}
              size="lg"
              align="center"
            />
          </div>
          <p className="mb-2 text-xs text-slate-500">
            {session.isPayed ? "Payé" : "Non payé"}
            {priced.hasPromo ? " · promo appliquée" : ""}
          </p>
        </>
      ) : null}

      {canChangeTariff && live?.mode === "FIXED" && !tariffOpen ? (
        <TierLevelUp
          live={live}
          tiers={tiers}
          sessionStart={sessionStart}
          now={now}
          pending={fixTariff.isPending}
          error={
            fixTariff.isError ? (fixTariff.error as Error).message : null
          }
          onUpgrade={(id) => fixTariff.mutate({ priceId: id, upgrade: true })}
          onOpenAll={() => openTariffPicker(true)}
        />
      ) : null}

      {showSubTile ? (
        <div className="mb-2.5 grid grid-cols-1 gap-2">
          {pendingSubscriptionName ? (
              <ActionTile
                icon={Clock}
                label="Abonnement"
                hint="En attente"
                muted
              />
            ) : (
              <ActionTile
                icon={Crown}
                label="Abonnement"
                hint="Sans compteur"
                onClick={onSwitchToSubscription}
              />
            )}
        </div>
      ) : null}

      {tariffOpen && canChangeTariff ? (
        <div
          ref={tariffRef}
          className="mb-2.5 scroll-mt-20 rounded-2xl bg-slate-50 p-2.5 text-left ring-1 ring-slate-200/70"
        >
          <div className="flex items-start justify-between gap-2 px-0.5">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Choisir mon pass
              </p>
              <p className="text-[11px] text-slate-500">
                {live?.mode === "AUTO"
                  ? "Fixez un pass pour connaître votre prix à l’avance."
                  : `Arrivé à ${format(sessionStart, "HH:mm")} · supplément au-delà du pass`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              disabled={fixTariff.isPending}
              onClick={() => openTariffPicker(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {tiers.map((t) => {
              const endsAt = sessionStart + t.durationHours * 3_600_000;
              const tooShort = endsAt <= now;
              const isCurrent =
                live?.mode === "FIXED" && live.fixedPriceId === t.priceId;
              return (
                <TarifOptionCard
                  key={t.priceId}
                  price={{
                    name: t.name,
                    durationHours: t.durationHours,
                    category: (t.category as PriceCategory | null) ?? null,
                    billingUnit: BillingUnit.PACK,
                  }}
                  selected={pickedTierId === t.priceId}
                  disabled={fixTariff.isPending || tooShort || isCurrent}
                  badge={
                    live?.mode === "AUTO" && t.priceId === recommendedTierId
                      ? "Recommandé"
                      : null
                  }
                  meta={
                    isCurrent
                      ? "Pass actuel"
                      : tooShort
                        ? "Déjà dépassé"
                        : `Jusqu’à ${format(endsAt, "HH:mm")}`
                  }
                  priceNode={
                    <span className="text-sm font-bold tabular-nums text-indigo-600">
                      {formatDt(t.price)}
                    </span>
                  }
                  onSelect={() =>
                    setPickedTierId((cur) =>
                      cur === t.priceId ? null : t.priceId
                    )
                  }
                />
              );
            })}
          </div>
          {fixTariff.isError ? (
            <p className="mt-2 text-xs text-rose-600">
              {(fixTariff.error as Error).message}
            </p>
          ) : null}
          <Button
            className="mt-2.5 h-11 w-full rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
            disabled={!pickedTier || fixTariff.isPending}
            onClick={() =>
              pickedTier && fixTariff.mutate({ priceId: pickedTier.priceId })
            }
          >
            {fixTariff.isPending
              ? "Enregistrement…"
              : pickedTier
                ? `Choisir « ${pickedTier.name} »`
                : "Choisissez un pass"}
          </Button>
        </div>
      ) : null}

      {seatLabel ? (
        <div className="mb-2 rounded-xl border bg-slate-50 px-3 py-2 text-left text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Votre place
          </p>
          <p className="mt-0.5 font-semibold">
            {[seat?.spaceName, seat?.tableName, seatLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {seat?.isOverflow ? (
            <Badge className="mt-2" variant="outline">
              Overflow
            </Badge>
          ) : null}
        </div>
      ) : canPickSeat && allowedSpaceIds && allowedSpaceIds.length === 0 ? (
        <p className="mb-2 text-xs text-slate-500">
          Aucun espace pour ce pass — l’accueil vous placera.
        </p>
      ) : canPickSeat ? (
        <p className="mb-1.5 text-left text-xs font-medium text-slate-600">
          Choisissez votre place
        </p>
      ) : (
        <p className="mb-2 text-xs text-slate-500">Place gérée par l’accueil</p>
      )}

      {(canPickSeat && (!allowedSpaceIds || allowedSpaceIds.length > 0)) ||
      seatLabel ? (
        <div className="mb-3 text-left">
          <VisitorSeatMap
            memberId={memberId}
            assignedSeatLabel={seatLabel}
            assignedSpaceId={seat?.spaceId}
            seatMode={seatMode}
            canPick={canPickSeat}
            allowedSpaceIds={allowedSpaceIds}
          />
        </div>
      ) : null}

      {checkout.isError ? (
        <Alert variant="destructive" className="mb-3 text-left">
          <AlertDescription>
            {(checkout.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="h-12 w-full rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
        disabled={checkout.isPending || !!session.leaveTime || isOptimistic}
        onClick={() => setConfirmCheckout(true)}
      >
        {isOptimistic
          ? "Confirmation…"
          : checkout.isPending
            ? "Check-out…"
            : "Check-out"}
      </Button>

      <Dialog
        open={confirmCheckout}
        onOpenChange={(open) => {
          if (!checkout.isPending) setConfirmCheckout(open);
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Terminer votre session ?</DialogTitle>
            <DialogDescription>
              Le compteur s&apos;arrête et la session ne pourra pas être reprise.
            </DialogDescription>
          </DialogHeader>
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
            <p className="text-xs text-amber-700">
              Votre session a commencé il y a moins de 5 min.{" "}
              {canChangeTariff
                ? "Pour changer de tarif, utilisez plutôt « Changer »."
                : "Pour changer de tarif, demandez plutôt à l’accueil."}
            </p>
          ) : null}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={checkout.isPending}
              onClick={() => setConfirmCheckout(false)}
            >
              Continuer
            </Button>
            <Button
              type="button"
              className="h-11 rounded-full bg-rose-600 hover:bg-rose-700"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Check-out…" : "Terminer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
