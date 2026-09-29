"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const POINTAGE_GRACE_MS = 10_000;

type Props = {
  forfaitName: string;
  /** When the session started (ISO). Window is 10s from this. */
  registredTime: string;
  onExpired: () => void;
};

/**
 * 10s welcome card right after pointage. No undo: ending the session goes
 * through the confirmed check-out, tariff changes through the session panel.
 */
export function PointageGraceWindow({
  forfaitName,
  registredTime,
  onExpired,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 40);
    return () => clearInterval(t);
  }, []);

  const startedAt = new Date(registredTime).getTime();
  const elapsed = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, POINTAGE_GRACE_MS - elapsed);
  const pct = Math.min(
    100,
    Math.max(0, (remainingMs / POINTAGE_GRACE_MS) * 100)
  );

  useEffect(() => {
    if (remainingMs <= 0) onExpiredRef.current();
  }, [remainingMs]);

  if (remainingMs <= 0) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-indigo-50"
        aria-hidden
      />
      <div className="relative space-y-3">
        <div>
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
            <Sparkles className="h-3 w-3" />
            C&apos;est noté !
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">
            Pointage OK — le compteur démarre
          </h2>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {forfaitName}
          </p>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-75 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-center text-[11px] text-slate-500">
          Vous pourrez fixer votre forfait depuis votre session.
        </p>

        <Button
          type="button"
          className="h-11 w-full rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
          onClick={() => onExpiredRef.current()}
        >
          Voir ma session
        </Button>
      </div>
    </div>
  );
}

/** True while session is still inside the 10s grace window. */
export function isWithinPointageGrace(registredTime?: string | null) {
  if (!registredTime) return false;
  const started = new Date(registredTime).getTime();
  if (Number.isNaN(started)) return false;
  return Date.now() - started < POINTAGE_GRACE_MS;
}
