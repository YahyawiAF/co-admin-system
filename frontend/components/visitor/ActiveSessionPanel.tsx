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
  Journal,
  MobileSeatMode,
  MobileSeatSettings,
  SeatAssignmentInfo,
} from "@/lib/types";

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
  expectedLeaveTime?: string;
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
};

export function ActiveSessionPanel({
  memberId,
  session,
  seat: seatProp,
  seatSettings,
  hasActiveSubscription,
  subscriptionKind,
  allowedSpaceIds,
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();

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
    if (session.expectedLeaveTime) {
      return new Date(session.expectedLeaveTime).getTime() - now;
    }
    return session.remainingMs ?? null;
  }, [session, now, isHoursPool, elapsedMs]);

  const poolProgress = useMemo(() => {
    if (!isHoursPool || !session.hoursQuota) return null;
    const used = (session.hoursUsed ?? 0) + (elapsedMs ?? 0) / 3600_000;
    return Math.min(100, Math.max(0, (used / session.hoursQuota) * 100));
  }, [isHoursPool, session, elapsedMs]);

  const overtime = remainingMs !== null && remainingMs < 0;
  const covered = session.coveredBySubscription || hasActiveSubscription;
  const amount = covered ? 0 : session.amountDue ?? session.payedAmount ?? 0;
  const forfaitName = session.prices?.name || session.price?.name || "Forfait";

  const checkout = useMutation({
    mutationFn: () => mobileApi.checkout(session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
  });

  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Session en cours
      </p>
      <h2 className="mt-0.5 text-base font-bold">{forfaitName}</h2>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {covered ? (
          <Badge>Abonnement actif</Badge>
        ) : (
          <Badge variant={session.isPayed ? "default" : "secondary"}>
            {session.isPayed ? "Payé" : "Non payé"}
          </Badge>
        )}
        {subKind === "SEMI_DAY" ? (
          <Badge variant="outline">Demi-journée 6h</Badge>
        ) : null}
        {subKind === "FULL_DAY" ? (
          <Badge variant="outline">Journée</Badge>
        ) : null}
        {isHoursPool ? <Badge variant="outline">Heures</Badge> : null}
      </div>

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
        <div className="my-2.5 rounded-2xl border bg-slate-50 px-3 py-4">
          <div
            className={`font-mono text-4xl font-bold tabular-nums ${
              overtime ? "text-red-600" : "text-primary"
            }`}
          >
            {remainingMs === null
              ? "—"
              : overtime
                ? `+${formatClock(remainingMs)}`
                : formatClock(remainingMs)}
          </div>
          <p className="mt-2 text-slate-500">
            {overtime
              ? `Temps dépassé · ${formatDurationHm(remainingMs!, { signed: true })}`
              : remainingMs != null
                ? `Temps restant · ${formatDurationHm(remainingMs)}`
                : "Temps restant"}
          </p>
        </div>
      )}

      {overtime && !isHoursPool ? (
        <Alert className="mb-4 text-left">
          <AlertDescription>
            Le prix du forfait reste affiché ; l&apos;accueil peut ajuster.
          </AlertDescription>
        </Alert>
      ) : null}

      {!covered ? (
        <>
          <div className="mb-0.5 text-2xl font-bold">{amount} DT</div>
          <p className="mb-2 text-xs text-slate-500">
            {session.isPayed ? "Payé" : "Non payé"}
          </p>
        </>
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
        className="h-12 w-full rounded-full"
        disabled={checkout.isPending || !!session.leaveTime}
        onClick={() => checkout.mutate()}
      >
        Check-out
      </Button>
    </div>
  );
}
