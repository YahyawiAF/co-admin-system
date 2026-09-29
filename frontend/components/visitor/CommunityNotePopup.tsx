"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Users, X } from "lucide-react";
import { PresenceAvatar } from "@/components/visitor/DirectoryCard";
import { mobileApi } from "@/lib/api/resources";
import { memberName } from "@/lib/community";
import { useOrg } from "@/lib/org";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useVisitorSession } from "@/lib/visitor-session";
import type { CommunityNote } from "@/lib/types";

const SHOW_AFTER_MS = 1500;
const VISIBLE_MS = 6000;

function seenKey(memberId: string) {
  return `community-notes-seen:${memberId}`;
}

function readSeen(memberId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(seenKey(memberId)) || "[]");
  } catch {
    return [];
  }
}

function markSeen(memberId: string, id: string) {
  const next = [id, ...readSeen(memberId).filter((x) => x !== id)].slice(0, 60);
  localStorage.setItem(seenKey(memberId), JSON.stringify(next));
}

type Nudge =
  | { kind: "note"; id: string; note: CommunityNote }
  | { kind: "presence"; id: string; count: number };

/** Few-second toast pointing to the community: newest unseen note, or a daily "X sur place" teaser. */
export function CommunityNotePopup() {
  const { memberId } = useVisitorSession();
  const { href } = useOrg();
  const { socket } = useRealtime();
  const queryClient = useQueryClient();
  const [nudge, setNudge] = useState<Nudge | null>(null);

  const { data } = useQuery({
    queryKey: ["community-feed", memberId],
    queryFn: () => mobileApi.communityFeed(memberId!),
    enabled: !!memberId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!socket) return;
    const onNote = () =>
      queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    socket.on("community_note", onNote);
    return () => {
      socket.off("community_note", onNote);
    };
  }, [socket, queryClient]);

  const candidate = useMemo<Nudge | null>(() => {
    if (!data || !memberId || typeof window === "undefined") return null;
    const seen = new Set(readSeen(memberId));
    const note = data.notes.find((n) => !n.isMine && !seen.has(n.id));
    if (note) return { kind: "note", id: note.id, note };
    const today = `presence-${new Date().toDateString()}`;
    if (data.presentCount > 0 && !seen.has(today)) {
      return { kind: "presence", id: today, count: data.presentCount };
    }
    return null;
  }, [data, memberId]);

  useEffect(() => {
    if (!candidate || !memberId || nudge) return;
    const show = window.setTimeout(() => {
      markSeen(memberId, candidate.id);
      setNudge(candidate);
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(show);
  }, [candidate, memberId, nudge]);

  useEffect(() => {
    if (!nudge) return;
    const hide = window.setTimeout(() => setNudge(null), VISIBLE_MS);
    return () => window.clearTimeout(hide);
  }, [nudge]);

  if (!nudge) return null;

  const target =
    nudge.kind === "note" ? href("/community?tab=feed") : href("/community");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 px-3">
      <div className="pointer-events-auto mx-auto flex max-w-[456px] items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Link
          href={target}
          onClick={() => setNudge(null)}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          {nudge.kind === "note" ? (
            <PresenceAvatar member={nudge.note.author} size="h-9 w-9" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Users className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {nudge.kind === "note"
                ? `Fil du jour · ${memberName(nudge.note.author)}`
                : "Communauté"}
            </span>
            <span className="block truncate text-sm text-slate-800">
              {nudge.kind === "note"
                ? nudge.note.text
                : `${nudge.count} membre${nudge.count > 1 ? "s" : ""} sur place — dites bonjour`}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setNudge(null)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
