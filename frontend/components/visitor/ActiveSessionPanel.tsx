"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { mobileApi } from "@/lib/api/resources";
import { VisitorSeatMap } from "@/components/visitor/VisitorSeatMap";
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
import { cn } from "@/lib/utils";

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
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();
  const { slug } = useOrg();
  const [confirmCheckout, setConfirmCheckout] = useState(false);
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
  const forfaitName = live
    ? live.mode === "AUTO"
      ? `Palier ${live.currentTier.name}`
      : live.fixedServiceName || live.currentTier.name
    : session.prices?.name || session.price?.name || "Forfait";

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

  return (
    <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Session en cours
      </p>
      <h2 className="mt-1 text-2xl font-bold leading-tight">{forfaitName}</h2>
      {isOptimistic ? (
        <p className="mt-1 text-xs font-medium text-amber-600">
          Confirmation en cours…
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {covered ? (
          <Badge className="px-2.5 py-1 text-sm">Abonnement actif</Badge>
        ) : (
          <Badge
            variant={session.isPayed ? "default" : "secondary"}
            className="px-2.5 py-1 text-sm"
          >
            {session.isPayed ? "Payé" : "Non payé"}
          </Badge>
        )}
        {subKind === "SEMI_DAY" ? (
          <Badge variant="outline" className="px-2.5 py-1 text-sm">
            Demi-journée 6h
          </Badge>
        ) : null}
        {subKind === "FULL_DAY" ? (
          <Badge variant="outline" className="px-2.5 py-1 text-sm">
            Journée
          </Badge>
        ) : null}
        {isHoursPool ? (
          <Badge variant="outline" className="px-2.5 py-1 text-sm">
            Heures
          </Badge>
        ) : null}
        {live ? (
          <Badge
            variant="secondary"
            className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm text-indigo-700"
          >
            {live.mode === "AUTO"
              ? "Tarif auto"
              : `Forfait fixé ${live.fixedServiceName ?? ""} · ${formatDt(live.fixedAmount ?? live.baseAmount)}`}
          </Badge>
        ) : null}
      </div>

      {!covered ? (
        <p
          className={cn(
            "mx-auto mt-2 max-w-xs text-xs leading-snug",
            session.isPayed ? "text-emerald-700" : "text-amber-700"
          )}
        >
          {session.isPayed
            ? "Payé ✓ — vos points s’ajoutent au check-out (vous ou l’accueil)."
            : "Demandez à l’accueil de confirmer le paiement pour collecter vos points au check-out."}
        </p>
      ) : null}
      {/* Timer + forfait on top */}
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
      ) : (
        <div className="my-2.5 rounded-2xl border bg-white px-3.5 py-3.5 text-left shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Suivi du forfait
            </p>
            <Badge
              variant="secondary"
              className="rounded-md bg-indigo-50 text-indigo-700"
            >
              {live ? (live.mode === "AUTO" ? "Auto" : "Fixé") : "Heures"}
            </Badge>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p
              className={`text-lg font-bold leading-tight ${
                overtime ? "text-red-600" : "text-slate-900"
              }`}
            >
              {remainingMs == null
                ? "—"
                : overtime
                  ? `+${formatDurationHm(remainingMs)}`
                  : `${formatDurationHm(remainingMs)} restantes`}
            </p>
            {dayProgress ? (
              <p className="shrink-0 text-xs text-slate-500">
                sur {formatDurationHm(dayProgress.totalMs)} disponibles
              </p>
            ) : null}
          </div>
          {dayProgress ? (
            <div className="mt-3 space-y-2">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${dayProgress.remainingPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>
                  Utilisé aujourd&apos;hui ·{" "}
                  {elapsedMs != null ? formatDurationHm(elapsedMs) : "—"}
                </span>
                <span>
                  {live
                    ? `Fin ${live.mode === "AUTO" ? "palier" : "forfait"} ${format(live.tierEndsAt, "HH:mm")}`
                    : "Expiration à minuit"}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`mt-3 font-mono text-3xl font-bold tabular-nums ${
                overtime ? "text-red-600" : "text-primary"
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
      )}

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
              {stageLabel(live, now)}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">
            {formatDt(live.amountDue)}
          </p>
          {live.mode === "FIXED" && live.overtime ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              Forfait {live.fixedServiceName} ({formatDt(live.fixedAmount)})
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
          <p className="mt-2 text-[11px] text-slate-500">
            Pour fixer ou changer votre forfait, demandez à l&apos;accueil.
          </p>
        </div>
      ) : overtime && !isHoursPool ? (
        <Alert className="mb-4 text-left">
          <AlertDescription>
            Le prix du forfait reste affiché ; l&apos;accueil peut ajuster.
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

      {!covered && pendingSubscriptionName ? (
        <div className="mb-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-left text-sm text-indigo-800">
          <p className="font-semibold">
            Abonnement {pendingSubscriptionName} demandé
          </p>
          <p className="mt-0.5 text-xs">
            En attente de l&apos;accueil — votre session passera sur
            l&apos;abonnement dès la validation.
          </p>
        </div>
      ) : !covered && onSwitchToSubscription && !isOptimistic ? (
        <button
          type="button"
          onClick={onSwitchToSubscription}
          className="mb-2.5 flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/60 px-3.5 py-3 text-left hover:bg-indigo-50"
        >
          <span>
            <span className="block text-sm font-semibold text-indigo-700">
              Passer à un abonnement
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Votre session en cours bascule sur l&apos;abonnement
            </span>
          </span>
          <span className="text-lg text-indigo-600">›</span>
        </button>
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
          Aucun espace pour ce forfait — l’accueil vous placera.
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
              Votre session a commencé il y a moins de 5 min. Pour changer de
              tarif, demandez plutôt à l&apos;accueil.
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
