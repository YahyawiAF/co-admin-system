"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Lock, Trophy } from "lucide-react";
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
  /** Render nothing while locked (another card already pushes the install) */
  hideLocked?: boolean;
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

export function PointsCard({
  memberId,
  className,
  compact = true,
  hideLocked = false,
}: Props) {
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
    mutationFn: () => mobileApi.claimPoints(memberId, isPwa),
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
      // Don't celebrate balance credits until the installed PWA unlocks points
      if (!isStandalonePwa()) {
        void queryClient.invalidateQueries({
          queryKey: ["member-points", memberId],
        });
        return;
      }
      if (detail.pending) {
        void queryClient.invalidateQueries({
          queryKey: ["member-points", memberId],
        });
        return;
      }
      triggerFlash(detail.amount, detail.newTrophies, detail.points);
      void queryClient.invalidateQueries({
        queryKey: ["member-points", memberId],
      });
    };
    window.addEventListener("visitor-points-award", onAward);
    return () => window.removeEventListener("visitor-points-award", onAward);
  }, [memberId, queryClient, triggerFlash]);

  const locked = data?.locked ?? !isPwa;
  const displayTarget = locked ? 0 : data?.points ?? 0;
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

  if (hideLocked && locked) return null;

  if (isLoading && !data) {
    return (
      <div
        className={cn("h-14 rounded-3xl bg-white shadow-sm", className)}
        aria-hidden
      />
    );
  }

  if (!data) return null;

  const next = data.nextTrophy;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-white px-3.5 py-2.5 shadow-sm",
        palierBurst != null && "ring-2 ring-amber-400",
        className
      )}
    >
      {flash ? (
        <PointFlash
          key={flash.key}
          amount={flash.amount}
          fromPoints={flash.from}
          toPoints={flash.to}
          onDone={() => setFlash(null)}
        />
      ) : null}

      {locked ? (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Lock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Points</p>
            <p className="truncate text-[11px] text-slate-500">
              Collectés dans l&apos;app uniquement
            </p>
          </div>
          <InstallAppButton variant="pill" />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowTrophies((v) => !v)}
            aria-expanded={showTrophies}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <Trophy className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1">
                <span
                  className="text-xl font-bold tabular-nums leading-none text-indigo-600"
                  style={
                    counting
                      ? { animation: "visitorPointsCountUp 1.2s ease-out" }
                      : undefined
                  }
                >
                  {display.toLocaleString("fr-FR")}
                </span>
                <span className="text-xs font-semibold text-slate-400">pts</span>
                <span className="ml-auto text-[10px] text-slate-400">
                  100 pts = 1 DT
                </span>
              </span>
              {next ? (
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className={cn(
                        "block h-full rounded-full transition-all duration-500",
                        palierBurst != null
                          ? "bg-gradient-to-r from-amber-400 to-orange-500"
                          : "bg-indigo-600"
                      )}
                      style={{ width: `${next.progress}%` }}
                    />
                  </span>
                  <span className="max-w-[45%] truncate text-[10px] text-slate-500">
                    {next.name} · {data.points}/{next.target}
                  </span>
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-300 transition-transform",
                showTrophies && "rotate-180"
              )}
            />
          </button>

          {showTrophies ? (
            <TrophyShelf
              trophies={data.trophies}
              highlightIds={newTrophyIds}
              className="mt-3"
            />
          ) : null}
        </>
      )}
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
