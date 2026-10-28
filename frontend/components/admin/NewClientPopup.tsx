"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Star, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";
import { membersApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type NewClientEvent = {
  memberId: string;
  journalId?: string;
  memberName: string;
  memberPhone?: string | null;
  seatLabel?: string | null;
  at: string;
};

type Card = NewClientEvent & { key: string; leaving?: boolean };

const SHOW_MS = 12_000;
const LEAVE_MS = 200;
const MAX_CARDS = 3;

/**
 * "Nouveau client" pop-up: a member's very first check-in reaches reception
 * live (bottom-right, any admin page) so someone goes to greet them.
 */
export function NewClientPopup() {
  const { socket } = useRealtime();
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<Card[]>([]);
  const [detail, setDetail] = useState<Member | null>(null);
  const timers = useRef(new Map<string, number>());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((key: string) => {
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    setCards((cs) =>
      cs.map((c) => (c.key === key ? { ...c, leaving: true } : c)),
    );
    window.setTimeout(
      () => setCards((cs) => cs.filter((c) => c.key !== key)),
      LEAVE_MS,
    );
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (e: NewClientEvent) => {
      if (!e?.memberId) return;
      const key = `${e.memberId}-${e.journalId ?? e.at}`;
      setCards((cs) =>
        cs.some((c) => c.key === key)
          ? cs
          : [...cs, { ...e, key }].slice(-MAX_CARDS),
      );
      timers.current.set(
        key,
        window.setTimeout(() => dismiss(key), SHOW_MS),
      );
      // badges in journal / members / arrivals
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    };
    socket.on("new_client", onNew);
    return () => {
      socket.off("new_client", onNew);
    };
  }, [socket, dismiss, queryClient]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => window.clearTimeout(t));
  }, []);

  const openFiche = async (card: Card) => {
    dismiss(card.key);
    try {
      const res = await membersApi.listPage({
        memberIds: [card.memberId],
        perPage: 1,
      });
      if (res.data[0]) setDetail(res.data[0]);
    } catch {
      /* ignore: the card is gone anyway */
    }
  };

  // Portal: the sticky header's backdrop blur would trap `position: fixed`
  const stack = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3"
    >
      {cards.map((c) => (
        <aside
          key={c.key}
          role="status"
          className={cn(
            "nc-toast-in pointer-events-auto overflow-hidden rounded-2xl border border-violet-200 bg-card shadow-[0_24px_50px_-16px_rgba(76,29,149,0.45)] transition-[opacity,transform] duration-200 ease-out",
            c.leaving && "translate-x-6 opacity-0",
          )}
        >
          <div className="flex items-center gap-3 bg-gradient-to-br from-indigo-700 to-violet-600 px-4 py-3 text-white">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Star className="h-5 w-5 fill-amber-200 text-amber-200" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">
                Nouveau client
              </p>
              <p className="truncate text-[17px] font-extrabold">
                {c.memberName}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => dismiss(c.key)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition-colors hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Première visite
              {c.seatLabel ? (
                <>
                  {" "}
                  · Place <b className="text-foreground">{c.seatLabel}</b>
                </>
              ) : null}{" "}
              · {format(new Date(c.at), "HH:mm")}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => dismiss(c.key)}>
                Accueillir
              </Button>
              <Button variant="outline" onClick={() => void openFiche(c)}>
                Voir la fiche
              </Button>
            </div>
          </div>
          <div
            className="nc-timer h-[3px] bg-violet-600"
            style={{ ["--nc-timer" as string]: `${SHOW_MS}ms` }}
          />
        </aside>
      ))}
    </div>
  );

  return (
    <>
      {mounted ? createPortal(stack, document.body) : null}
      <MemberDetailSheet
        member={detail}
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      />
    </>
  );
}

/** Shimmering "Nouveau" pill used in the journal, members and arrivals lists. */
export function NewClientBadge({
  label = "Nouveau",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "nc-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 text-white",
        className,
      )}
      title="Première visite"
    >
      <Star className="h-2.5 w-2.5 fill-white" aria-hidden />
      {label}
    </span>
  );
}
