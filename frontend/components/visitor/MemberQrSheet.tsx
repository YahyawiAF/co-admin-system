"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, QrCode } from "lucide-react";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { mobileApi } from "@/lib/api/resources";
import { formatCheckInCode } from "@/lib/check-in-code";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { usePlayer } from "@/lib/hooks/use-player";

/** QR image for a payload (same provider as the session code card). */
function qrImageUrl(data: string, size = 480) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

const SPARKS = [
  { tx: "-70px", ty: "-60px", c: "bg-amber-400" },
  { tx: "72px", ty: "-54px", c: "bg-emerald-400" },
  { tx: "-66px", ty: "62px", c: "bg-indigo-300" },
  { tx: "70px", ty: "58px", c: "bg-pink-300" },
];

/**
 * "Mon QR": reception picks a place in their app, then scans this code.
 * Watches the member status while open and celebrates when a place arrives.
 */
export function MemberQrSheet({
  open,
  onOpenChange,
  memberId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
}) {
  const { data: status } = useMobileStatus({ intervalMs: open ? 4_000 : undefined });
  const { player } = usePlayer(memberId);
  const { data: qr, isLoading, isError, refetch } = useQuery({
    queryKey: ["member-qr", memberId],
    queryFn: () => mobileApi.memberQr(memberId),
    enabled: open && !!memberId,
    // Signed for 15 min: refresh well before it expires
    refetchInterval: open ? 10 * 60_000 : false,
    staleTime: 5 * 60_000,
  });

  const seat =
    status?.seat?.seatLabel ||
    (status?.session as { seat?: { seatLabel?: string | null } } | null | undefined)?.seat
      ?.seatLabel ||
    null;
  const spaceName = status?.seat?.spaceName ?? null;
  /** Place when the sheet opened: only a change counts as "just assigned". */
  const seatAtOpen = useRef<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      seatAtOpen.current = seat;
      setAssigned(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot on open only
  }, [open]);
  useEffect(() => {
    if (open && seat && seat !== seatAtOpen.current) setAssigned(seat);
  }, [open, seat]);

  const member = status?.member;
  const name =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") || "Visiteur";
  const code = qr?.checkInCode ?? null;

  return (
    <QuestSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Mon QR"
      icon={<QrCode className="h-5 w-5" />}
      title="Montrez-le à l’accueil"
      subtitle="L’accueil choisit votre place, puis scanne ce code."
      banner={
        <div className="mt-3 flex items-center gap-2.5">
          <VisitorAvatar
            name={name}
            src={member?.avatarUrl}
            className="h-9 w-9 shrink-0 ring-2 ring-amber-400"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{name}</span>
            <span className="block truncate text-xs text-indigo-100">
              {player ? `Niveau ${player.level.name}` : "Membre"}
              {member?.visitorNumber ? ` · #${member.visitorNumber}` : ""}
            </span>
          </span>
          {code ? (
            <span className="shrink-0 rounded-2xl bg-white/15 px-2.5 py-1.5 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-indigo-100">
                Code
              </span>
              <span className="block text-sm font-black tracking-[0.12em] tabular-nums">
                {formatCheckInCode(code)}
              </span>
            </span>
          ) : null}
        </div>
      }
      footer={
        assigned ? (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-full items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white transition-colors duration-200 hover:bg-indigo-700 motion-reduce:transition-none"
          >
            Parfait, merci
          </button>
        ) : null
      }
    >
      <div className="flex flex-col items-stretch gap-3 pb-2">
        <div className="relative mx-auto flex h-60 w-60 items-center justify-center rounded-3xl bg-white shadow-[0_12px_28px_-14px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
          {(
            [
              "left-2 top-2 border-l-4 border-t-4 rounded-tl-[10px]",
              "right-2 top-2 border-r-4 border-t-4 rounded-tr-[10px]",
              "left-2 bottom-2 border-l-4 border-b-4 rounded-bl-[10px]",
              "right-2 bottom-2 border-r-4 border-b-4 rounded-br-[10px]",
            ] as const
          ).map((c) => (
            <span key={c} aria-hidden className={`absolute h-7 w-7 border-indigo-600 ${c}`} />
          ))}
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          ) : isError || !qr ? (
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-6 text-center text-sm font-semibold text-slate-600"
            >
              QR indisponible · toucher pour réessayer
            </button>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImageUrl(qr.payload)}
              alt="QR code de votre profil"
              className="h-[200px] w-[200px]"
            />
          )}
          {!assigned && qr ? (
            <span
              aria-hidden
              className="v-laser absolute inset-x-4 h-[3px] rounded-full bg-gradient-to-r from-indigo-600/0 via-indigo-600 to-indigo-600/0 shadow-[0_0_12px_2px] shadow-indigo-500/60"
            />
          ) : null}
          {assigned ? (
            <span className="v-rise absolute inset-0 flex items-center justify-center rounded-3xl bg-white/90">
              {SPARKS.map((s) => (
                <span
                  key={s.tx}
                  aria-hidden
                  className={`v-spark absolute h-2 w-2 rounded-full ${s.c}`}
                  style={{ ["--tx" as string]: s.tx, ["--ty" as string]: s.ty }}
                />
              ))}
              <span className="v-pop flex h-24 w-24 flex-col items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-700/40">
                <span className="text-[11px] font-extrabold tracking-wide">PLACE</span>
                <span className="text-3xl font-black leading-none">{assigned}</span>
              </span>
            </span>
          ) : null}
        </div>

        {assigned ? (
          <div className="v-rise flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-200">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-emerald-900">
                Place {assigned} attribuée
              </span>
              <span className="block text-xs text-emerald-800">
                {spaceName ? `${spaceName} · ` : ""}par l’accueil
              </span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-2xl bg-indigo-50 px-3 py-2.5" role="status">
              <span className="flex gap-1" aria-hidden>
                <span className="v-dot h-[7px] w-[7px] rounded-full bg-indigo-600" />
                <span className="v-dot h-[7px] w-[7px] rounded-full bg-indigo-600 [animation-delay:.15s]" />
                <span className="v-dot h-[7px] w-[7px] rounded-full bg-indigo-600 [animation-delay:.3s]" />
              </span>
              <span className="text-sm font-bold text-indigo-900">
                {seat ? `Place actuelle ${seat} · l’accueil peut la changer` : "En attente du scan de l’accueil"}
              </span>
            </div>
            <p className="text-center text-xs text-slate-600">
              {code ? (
                <>
                  Pas de scanner ? Donnez le code{" "}
                  <strong className="tracking-[0.08em] text-slate-900">{formatCheckInCode(code)}</strong>
                </>
              ) : (
                "Pointez d’abord votre arrivée pour recevoir une place."
              )}
            </p>
          </>
        )}
      </div>
    </QuestSheet>
  );
}
