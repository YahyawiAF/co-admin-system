"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { mobileApi } from "@/lib/api/resources";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { PointFlash } from "@/components/visitor/PointFlash";
import { TrophyShelf } from "@/components/visitor/TrophyShelf";
import type { AwardPointsResult, PointEvent } from "@/lib/points-catalog";
import { POINTS_PALIERS } from "@/lib/points-catalog";

type Props = {
  memberId: string;
  className?: string;
  /** Compact: hide trophy grid until expanded */
  compact?: boolean;
};

function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (!active) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);

  return value;
}

export function PointsCard({ memberId, className, compact = true }: Props) {
  const queryClient = useQueryClient();
  const [isPwa, setIsPwa] = useState(false);
  const [showTrophies, setShowTrophies] = useState(!compact);
  const [flash, setFlash] = useState<{
    amount: number;
    key: number;
    from?: number;
    to?: number;
  } | null>(null);
  const [newTrophyIds, setNewTrophyIds] = useState<string[]>([]);
  const [counting, setCounting] = useState(false);
  const [palierBurst, setPalierBurst] = useState<number | null>(null);
  const claimedRef = useRef(false);
  const lastPointsRef = useRef<number | null>(null);

  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["member-points", memberId, isPwa],
    queryFn: () => mobileApi.getPoints(memberId, isPwa),
    enabled: !!memberId,
    staleTime: 30_000,
  });

  const claim = useMutation({
    mutationFn: () => mobileApi.claimPoints(memberId),
    onSuccess: (res) => {
      if (res.flash && res.claimed > 0) {
        setFlash({
          amount: res.claimed,
          key: Date.now(),
          to: res.points,
          from: Math.max(0, res.points - res.claimed),
        });
        setCounting(true);
      }
      if (res.newTrophies?.length) setNewTrophyIds(res.newTrophies);
      void queryClient.invalidateQueries({
        queryKey: ["member-points", memberId],
      });
    },
  });

  useEffect(() => {
    if (!isPwa || !memberId || claimedRef.current) return;
    claimedRef.current = true;
    claim.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPwa, memberId]);

  const triggerFlash = useCallback(
    (amount: number, trophies?: string[], toPoints?: number) => {
      if (amount <= 0) return;
      const from =
        lastPointsRef.current ??
        Math.max(0, (toPoints ?? amount) - amount);
      const to = toPoints ?? from + amount;
      setFlash({ amount, key: Date.now(), from, to });
      setCounting(true);
      if (trophies?.length) setNewTrophyIds(trophies);
      const hit = POINTS_PALIERS.find((p) => from < p && to >= p);
      if (hit != null) setPalierBurst(hit);
    },
    []
  );

  useEffect(() => {
    const onAward = (e: Event) => {
      const detail = (e as CustomEvent<AwardPointsResult>).detail;
      if (!detail || detail.amount <= 0) return;
      triggerFlash(detail.amount, detail.newTrophies, detail.points);
      void queryClient.invalidateQueries({
        queryKey: ["member-points", memberId],
      });
    };
    window.addEventListener("visitor-points-award", onAward);
    return () => window.removeEventListener("visitor-points-award", onAward);
  }, [memberId, queryClient, triggerFlash]);

  const locked = data?.locked ?? !isPwa;
  const displayTarget = locked
    ? data?.pendingPoints ?? 0
    : data?.points ?? 0;
  const animated = useCountUp(displayTarget, counting && !locked);
  const display = counting && !locked ? animated : displayTarget;

  useEffect(() => {
    if (data && !locked) lastPointsRef.current = data.points;
  }, [data, locked]);

  useEffect(() => {
    if (!counting) return;
    const t = window.setTimeout(() => {
      setCounting(false);
      setPalierBurst(null);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [counting, flash?.key]);

  if (isLoading && !data) {
    return (
      <div
        className={cn(
          "rounded-3xl bg-white px-4 py-3.5 shadow-sm",
          className
        )}
      >
        <p className="text-[11px] text-slate-400">Chargement points…</p>
      </div>
    );
  }

  if (!data) return null;

  const next = data.nextTrophy;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-white px-4 py-3.5 shadow-sm",
        palierBurst != null && "ring-2 ring-amber-400",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-100/70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-indigo-100/60"
        aria-hidden
      />

      {flash ? (
        <PointFlash
          key={flash.key}
          amount={flash.amount}
          fromPoints={flash.from}
          toPoints={flash.to}
          onDone={() => setFlash(null)}
        />
      ) : null}

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Points
          </p>
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              <Lock className="h-3 w-3" />
              À sauver
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">
              100 pts = 1 DT
            </span>
          )}
        </div>

        <div className="mt-1 flex items-end gap-2">
          <p
            className={cn(
              "text-4xl font-bold tabular-nums leading-none",
              locked ? "text-slate-400" : "text-indigo-600"
            )}
            style={
              counting && !locked
                ? { animation: "visitorPointsCountUp 1.2s ease-out" }
                : undefined
            }
          >
            {locked && display === 0
              ? "???"
              : display.toLocaleString("fr-FR")}
          </p>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
            pts
          </p>
        </div>

        {locked ? (
          <p className="mt-2 text-sm text-slate-500">
            {display > 0
              ? "Installez l’app pour les garder"
              : "Installez l’app pour collecter"}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Paiement confirmé par l’accueil + check-out → vos points
            s’ajoutent ici.
          </p>
        )}

        {!locked && next ? (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{next.name}</span>
              <span className="tabular-nums">
                {data.points}/{next.target}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  palierBurst != null
                    ? "bg-gradient-to-r from-amber-400 to-orange-500"
                    : "bg-indigo-600"
                )}
                style={{ width: `${next.progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {locked ? (
          <div className="mt-3">
            <InstallAppButton className="w-full" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTrophies((v) => !v)}
            className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            {showTrophies ? "Masquer" : "Trophées"}
          </button>
        )}

        {showTrophies && !locked ? (
          <TrophyShelf
            trophies={data.trophies}
            highlightIds={newTrophyIds}
            className="mt-3"
          />
        ) : null}
      </div>
    </div>
  );
}

/** Fire after a successful action; dispatches UI flash + awards on server. */
export async function awardVisitorPoints(
  memberId: string,
  event: PointEvent
): Promise<AwardPointsResult | null> {
  try {
    const isPwa = isStandalonePwa();
    const res = await mobileApi.awardPoints({ memberId, event, isPwa });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("visitor-points-award", { detail: res })
      );
    }
    return res;
  } catch {
    return null;
  }
}

export function dispatchPointsAward(detail: AwardPointsResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("visitor-points-award", { detail })
  );
}
