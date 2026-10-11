"use client";

import { ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import { checkInQrImageUrl, formatCheckInCode } from "@/lib/check-in-code";
import { cn } from "@/lib/utils";

/** Per-session QR: reception scans it to open this check-in (e.g. to set the place). */
export function SessionCodeCard({
  code,
  needsSeat,
  open,
  onOpenChange,
}: {
  code: string;
  /** No place yet and reception assigns it → highlight the card. */
  needsSeat: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-3xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99]",
          needsSeat && "ring-2 ring-indigo-200"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={checkInQrImageUrl(code, 120)}
          className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-white p-1"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Mon code de session
          </span>
          <span className="block font-mono text-lg font-bold tracking-[0.2em] text-slate-900">
            {formatCheckInCode(code)}
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            {needsSeat
              ? "Montrez-le à l’accueil pour recevoir votre place"
              : "À montrer à l’accueil si on vous le demande"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </button>

      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Mon code de session"
        description="Valable uniquement pour cette session."
      >
        <div className="flex flex-col items-center pb-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`QR de session ${code}`}
            src={checkInQrImageUrl(code, 560)}
            className="h-60 w-60 rounded-2xl border border-slate-100 bg-white p-2"
          />
          <p className="mt-3 font-mono text-3xl font-bold tracking-[0.25em] text-slate-900">
            {formatCheckInCode(code)}
          </p>
          <p className="mt-2 max-w-[18rem] text-sm text-slate-500">
            {needsSeat
              ? "Montrez ce QR à l’accueil : on vous attribue votre place en un scan."
              : "L’accueil scanne ce QR pour retrouver votre session."}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Pas de caméra ? Dictez le code.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
