"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mobileApi } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { DirectoryCard } from "@/components/visitor/DirectoryCard";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVisitorSession } from "@/lib/visitor-session";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

function nameOf(m?: Member | null) {
  return (
    [m?.firstName, m?.lastName].filter(Boolean).join(" ") ||
    m?.firstName ||
    "Membre"
  );
}

function CommunityInner() {
  const queryClient = useQueryClient();
  const { memberId } = useVisitorSession();
  const { socket } = useRealtime();
  const searchParams = useSearchParams();
  const peerId = searchParams.get("peer");
  const [q, setQ] = useState("");
  const [peer, setPeer] = useState<Member | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"inbox" | "people">("inbox");

  useEffect(() => {
    if (!socket || !memberId) return;
    const onMsg = (payload: { toMemberId?: string; fromMemberId?: string }) => {
      if (
        payload.toMemberId !== memberId &&
        payload.fromMemberId !== memberId
      ) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mobile-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-thread"] });
    };
    socket.on("community_message", onMsg);
    return () => {
      socket.off("community_message", onMsg);
    };
  }, [socket, memberId, queryClient]);

  const { data: inbox = [] } = useQuery({
    queryKey: ["mobile-inbox", memberId],
    queryFn: () => mobileApi.inbox(memberId!),
    enabled: !!memberId,
    refetchInterval: 8000,
  });
  const { data: people = [] } = useQuery({
    queryKey: ["mobile-community", memberId],
    queryFn: () => mobileApi.community(memberId!),
    enabled: !!memberId,
  });
  const { data: thread = [] } = useQuery({
    queryKey: ["mobile-thread", memberId, peer?.id],
    queryFn: () => mobileApi.thread(memberId!, peer!.id),
    enabled: !!memberId && !!peer?.id,
    refetchInterval: peer ? 4000 : false,
  });

  useEffect(() => {
    if (!peerId || !people.length) return;
    const found = people.find((p) => p.id === peerId);
    if (found) setPeer(found);
  }, [peerId, people]);

  const send = useMutation({
    mutationFn: () =>
      mobileApi.sendMessage({
        fromMemberId: memberId!,
        toMemberId: peer!.id,
        text: draft,
      }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["mobile-thread"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPeople = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return people;
    return people.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.functionality} ${p.bio} ${(p.skills || []).join(" ")}`
        .toLowerCase()
        .includes(s)
    );
  }, [people, q]);

  const filteredInbox = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return inbox;
    return inbox.filter((t) =>
      `${nameOf(t.peer)} ${t.peer.functionality} ${t.lastMessage}`
        .toLowerCase()
        .includes(s)
    );
  }, [inbox, q]);

  if (!memberId) {
    return (
      <p className="text-sm text-slate-500">
        Connectez-vous pour voir la communauté.
      </p>
    );
  }

  if (peer) {
    return (
      <div className="flex min-h-[70vh] flex-col">
        <button
          type="button"
          className="mb-3 flex items-center gap-3 text-left"
          onClick={() => setPeer(null)}
        >
          <VisitorAvatar
            name={nameOf(peer)}
            src={peer.avatarUrl}
            className="h-11 w-11"
          />
          <div>
            <p className="font-semibold">{nameOf(peer)}</p>
            <p className="text-xs text-slate-500">
              {peer.functionality || "Membre"}
            </p>
          </div>
        </button>
        <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white p-3">
          {thread.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Dites bonjour — présentez vos compétences.
            </p>
          ) : (
            thread.map((m) => {
              const mine = m.fromMemberId === memberId;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-800"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) send.mutate();
          }}
        >
          <Input
            className="h-11 rounded-full bg-white"
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-full"
            disabled={send.isPending || !draft.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Trouvez des membres selon leur métier et leurs compétences.
      </p>
      <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-sm">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full py-1.5 font-medium",
            tab === "inbox" ? "bg-white shadow-sm" : "text-slate-500"
          )}
          onClick={() => setTab("inbox")}
        >
          Messages
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full py-1.5 font-medium",
            tab === "people" ? "bg-white shadow-sm" : "text-slate-500"
          )}
          onClick={() => setTab("people")}
        >
          Annuaire
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 rounded-xl bg-white pl-9"
          placeholder="Rechercher nom, métier, skill…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === "inbox" ? (
        <div className="overflow-hidden rounded-2xl bg-white">
          {filteredInbox.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Pas encore de conversation. Ouvrez Annuaire.
            </p>
          ) : (
            filteredInbox.map((t, i) => (
              <button
                key={t.peer.id}
                type="button"
                className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0"
                onClick={() => setPeer(t.peer)}
              >
                <VisitorAvatar
                  name={nameOf(t.peer)}
                  src={t.peer.avatarUrl}
                  className="h-12 w-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{nameOf(t.peer)}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {format(new Date(t.lastAt), "HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {t.peer.functionality || "Membre"}
                  </p>
                  {i === 0 ? (
                    <p className="mt-1 rounded-2xl bg-primary px-3 py-2 text-sm text-white">
                      {t.lastMessage}
                    </p>
                  ) : (
                    <p className="truncate text-sm text-slate-600">
                      {t.lastMessage}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white">
          {filteredPeople.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Personne n&apos;a encore activé l&apos;annuaire.
            </p>
          ) : (
            filteredPeople.map((p) => (
              <div key={p.id} className="border-b last:border-b-0">
                <DirectoryCard member={p} onClick={() => setPeer(p)} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense>
      <CommunityInner />
    </Suspense>
  );
}
