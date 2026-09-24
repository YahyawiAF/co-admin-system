"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { mobileApi } from "@/lib/api/resources";
import { Button } from "@/components/ui/button";

export const POINTAGE_GRACE_MS = 10_000;

type Props = {
  sessionId: string;
  forfaitName: string;
  /** When the session started (ISO). Window is 10s from this. */
  registredTime: string;
  onExpired: () => void;
  onCancelled: () => void;
  onChangeTarif: () => void;
};

/**
 * 10s undo window after pointage — cancel or change tarif.
 * Playful but on-brand (indigo Accueil language).
 */
export function PointageGraceWindow({
  sessionId,
  forfaitName,
  registredTime,
  onExpired,
  onCancelled,
  onChangeTarif,
}: Props) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 40);
    return () => clearInterval(t);
  }, []);

  const startedAt = new Date(registredTime).getTime();
  const elapsed = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, POINTAGE_GRACE_MS - elapsed);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = Math.min(
    100,
    Math.max(0, (remainingMs / POINTAGE_GRACE_MS) * 100)
  );

  useEffect(() => {
    if (remainingMs <= 0) onExpiredRef.current();
  }, [remainingMs]);

  const undo = useMutation({
    mutationFn: () => mobileApi.checkout(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
  });

  const runUndo = async (next: "cancel" | "tarif") => {
    if (busy || remainingMs <= 0) return;
    setBusy(true);
    try {
      await undo.mutateAsync();
      if (next === "tarif") {
        toast.message("Choisissez un autre forfait");
        onChangeTarif();
      } else {
        toast.message("Pointage annulé");
        onCancelled();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
      setBusy(false);
    }
  };

  if (remainingMs <= 0) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-indigo-50"
        aria-hidden
      />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
              <Sparkles className="h-3 w-3" />
              C&apos;est noté !
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              Pointage OK
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {forfaitName}
            </p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
              Encore
            </p>
            <p className="text-2xl font-bold tabular-nums text-indigo-600">
              {remainingSec}
              <span className="text-sm font-semibold">s</span>
            </p>
          </div>
        </div>

        <div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-75 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-500">
            Annuler ou changer de tarif pendant encore {remainingSec}s
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 rounded-full border-slate-200 text-slate-700"
            onClick={() => void runUndo("cancel")}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="h-11 rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
            onClick={() => void runUndo("tarif")}
          >
            Changer tarif
          </Button>
        </div>
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
