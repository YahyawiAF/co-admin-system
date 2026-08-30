"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, Search, Send } from "lucide-react";
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
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import { useOrg } from "@/lib/org";

function nameOf(m?: Member | null) {
  return (
    [m?.firstName, m?.lastName].filter(Boolean).join(" ") ||
    m?.firstName ||
    "Membre"
  );
}

function CommunityInner() {
  const queryClient = useQueryClient();
  const { href } = useOrg();
  const router = useRouter();
  const { memberId } = useVisitorSession();
  const { socket } = useRealtime();
  const searchParams = useSearchParams();
  const peerId = searchParams.get("peer");
  const [q, setQ] = useState("");
  const [peer, setPeer] = useState<Member | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"inbox" | "people">("inbox");
  const [presence, setPresence] = useState<"all" | "present">("all");
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const inboxPoll = useVisibleInterval(45_000);
  const threadPoll = useVisibleInterval(peer ? 20_000 : false);

  useEffect(() => {
    if (peerId === "admin") router.replace(href("/staff"));
  }, [peerId, router, href]);

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
    const onStaff = () => {
      queryClient.invalidateQueries({ queryKey: ["staff-thread", memberId] });
    };
    socket.on("community_message", onMsg);
    socket.on("staff_message", onStaff);
    return () => {
      socket.off("community_message", onMsg);
      socket.off("staff_message", onStaff);
    };
  }, [socket, memberId, queryClient]);

  const { data: inbox = [] } = useQuery({
    queryKey: ["mobile-inbox", memberId],
    queryFn: () => mobileApi.inbox(memberId!),
    enabled: !!memberId,
    staleTime: 30_000,
    refetchInterval: inboxPoll,
  });
  const { data: people = [] } = useQuery({
    queryKey: ["mobile-community", memberId],
    queryFn: () => mobileApi.community(memberId!),
    enabled: !!memberId,
    staleTime: 5 * 60_000,
  });
  const { data: thread = [] } = useQuery({
    queryKey: ["mobile-thread", memberId, peer?.id],
    queryFn: () => mobileApi.thread(memberId!, peer!.id),
    enabled: !!memberId && !!peer?.id,
    refetchInterval: threadPoll,
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

  const professions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      const job = p.functionality?.trim();
      if (job) set.add(job);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [people]);

  const skillChips = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      for (const s of p.skills || []) {
        if (s.trim()) set.add(s.trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [people]);

  const filteredPeople = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((p) => {
      if (presence === "present" && !p.isPresent) return false;
      if (jobFilter && p.functionality?.trim() !== jobFilter) return false;
      if (skillFilter && !(p.skills || []).includes(skillFilter)) return false;
      if (!s) return true;
      return `${p.firstName} ${p.lastName} ${p.functionality} ${p.bio} ${(p.skills || []).join(" ")}`
        .toLowerCase()
        .includes(s);
    });
  }, [people, q, presence, jobFilter, skillFilter]);

  const presentIds = useMemo(
    () => new Set(people.filter((p) => p.isPresent).map((p) => p.id)),
    [people]
  );

  const filteredInbox = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inbox.filter((t) => {
      if (presence === "present" && !presentIds.has(t.peer.id)) return false;
      if (!s) return true;
      return `${nameOf(t.peer)} ${t.peer.functionality} ${t.lastMessage}`
        .toLowerCase()
        .includes(s);
    });
  }, [inbox, q, presence, presentIds]);

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
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            presence === "all"
              ? "bg-slate-800 text-white"
              : "bg-white text-slate-600"
          )}
          onClick={() => setPresence("all")}
        >
          Tous
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            presence === "present"
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-600"
          )}
          onClick={() =>
            setPresence((v) => (v === "present" ? "all" : "present"))
          }
        >
          Présents
        </button>
        {tab === "people"
          ? professions.slice(0, 10).map((job) => (
              <button
                key={job}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  jobFilter === job
                    ? "bg-primary text-white"
                    : "bg-white text-slate-600"
                )}
                onClick={() =>
                  setJobFilter((v) => (v === job ? null : job))
                }
              >
                {job}
              </button>
            ))
          : null}
        {tab === "people"
          ? skillChips.slice(0, 12).map((skill) => (
              <button
                key={skill}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  skillFilter === skill
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-600"
                )}
                onClick={() =>
                  setSkillFilter((v) => (v === skill ? null : skill))
                }
              >
                {skill}
              </button>
            ))
          : null}
      </div>

      {tab === "inbox" ? (
        <div className="overflow-hidden rounded-2xl bg-white">
          <button
            type="button"
            className="flex w-full items-start gap-3 border-b px-4 py-3 text-left"
            onClick={() => router.push(href("/staff"))}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Administration</p>
              <p className="truncate text-sm text-slate-500">
                Écrire à l’accueil · conversation enregistrée
              </p>
            </div>
          </button>
          {filteredInbox.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Pas encore de conversation membre. Ouvrez Annuaire.
            </p>
          ) : (
            filteredInbox.map((t) => (
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
                  <p className="truncate text-sm text-slate-600">
                    {t.lastMessage}
                  </p>
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
