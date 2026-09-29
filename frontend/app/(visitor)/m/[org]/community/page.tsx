"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Building2,
  Check,
  MessageCircle,
  MessageSquareQuote,
  Moon,
  Pencil,
  QrCode,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { mobileApi } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import {
  DirectoryCard,
  PresenceAvatar,
} from "@/components/visitor/DirectoryCard";
import { CommunityFilterSheet } from "@/components/visitor/CommunityFilterSheet";
import {
  AVAILABILITY,
  EMPTY_FILTERS,
  activeFilterCount,
  countValues,
  filterMembers,
  memberName,
  type CommunityFilters,
} from "@/lib/community";
import type { MemberAvailability } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVisitorSession } from "@/lib/visitor-session";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { useOrg } from "@/lib/org";

const QUICK_SKILLS = 8;
const STACK = 3;

function CommunityInner() {
  const queryClient = useQueryClient();
  const { href } = useOrg();
  const router = useRouter();
  const { memberId } = useVisitorSession();
  const { socket } = useRealtime();
  const searchParams = useSearchParams();
  const peerId = searchParams.get("peer");
  const initialSkill = searchParams.get("skill");
  const [tab, setTab] = useState<"people" | "feed" | "inbox">(() => {
    const t = searchParams.get("tab");
    return t === "messages" ? "inbox" : t === "feed" ? "feed" : "people";
  });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<CommunityFilters>(() =>
    initialSkill ? { ...EMPTY_FILTERS, skills: [initialSkill] } : EMPTY_FILTERS
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const inboxPoll = useVisibleInterval(45_000);
  const presencePoll = useVisibleInterval(60_000);
  const { data: status } = useMobileStatus({ enabled: !!memberId });

  useEffect(() => {
    if (!peerId) return;
    if (peerId === "admin") router.replace(href("/staff"));
    else router.replace(href(`/chat/${peerId}`));
  }, [peerId, router, href]);

  // Arrivals / check-outs change who is on site: refresh the list live.
  const refreshTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!socket || !memberId) return;
    const refreshPresence = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["mobile-community"] });
      }, 1200);
    };
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
    const onNote = () => {
      queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-community"] });
    };
    socket.on("visit_arrival", refreshPresence);
    socket.on("visitor_checkout", refreshPresence);
    socket.on("table_updates", refreshPresence);
    socket.on("community_message", onMsg);
    socket.on("staff_message", onStaff);
    socket.on("community_note", onNote);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      socket.off("visit_arrival", refreshPresence);
      socket.off("visitor_checkout", refreshPresence);
      socket.off("table_updates", refreshPresence);
      socket.off("community_message", onMsg);
      socket.off("staff_message", onStaff);
      socket.off("community_note", onNote);
    };
  }, [socket, memberId, queryClient]);

  const { data: inbox = [] } = useQuery({
    queryKey: ["mobile-inbox", memberId],
    queryFn: () => mobileApi.inbox(memberId!),
    enabled: !!memberId,
    staleTime: 30_000,
    refetchInterval: inboxPoll,
  });
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["mobile-community", memberId],
    queryFn: () => mobileApi.community(memberId!),
    enabled: !!memberId,
    staleTime: 20_000,
    refetchInterval: presencePoll,
  });
  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["community-feed", memberId],
    queryFn: () => mobileApi.communityFeed(memberId!),
    enabled: !!memberId,
    staleTime: 30_000,
    refetchInterval: presencePoll,
  });
  const notes = feed?.notes ?? [];

  const myAvailability = status?.member?.availability ?? null;
  const myFocus = status?.member?.todayFocus ?? null;
  const iAmPresent = !!status?.session;
  const setMyStatus = useMutation({
    mutationFn: (next: MemberAvailability | null) =>
      mobileApi.updateProfile({ memberId: memberId!, availability: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // "Focus du jour" — null draft = not editing
  const [focusDraft, setFocusDraft] = useState<string | null>(null);
  const saveFocus = useMutation({
    mutationFn: (next: string | null) =>
      mobileApi.updateProfile({ memberId: memberId!, todayFocus: next }),
    onSuccess: () => {
      setFocusDraft(null);
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-community"] });
      queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickSkills = useMemo(
    () =>
      countValues(people.flatMap((p) => p.skills || [])).slice(0, QUICK_SKILLS),
    [people]
  );

  const filteredPeople = useMemo(
    () => filterMembers(people, filters, q),
    [people, filters, q]
  );

  const presentIds = useMemo(() => new Set(people.map((p) => p.id)), [people]);

  const filteredInbox = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return inbox;
    return inbox.filter((t) =>
      `${memberName(t.peer)} ${t.peer.functionality} ${t.lastMessage}`
        .toLowerCase()
        .includes(s)
    );
  }, [inbox, q]);

  const unread = inbox.filter((t) => t.unreadHint).length;
  const filterCount = activeFilterCount(filters);
  const toggleQuickSkill = (label: string) =>
    setFilters((f) => {
      const on = f.skills.some((s) => s.toLowerCase() === label.toLowerCase());
      return {
        ...f,
        skills: on
          ? f.skills.filter((s) => s.toLowerCase() !== label.toLowerCase())
          : [...f.skills, label],
      };
    });

  if (!memberId) {
    return (
      <p className="text-sm text-slate-500">
        Connectez-vous pour voir la communauté.
      </p>
    );
  }

  const removable: { key: string; label: string; remove: () => void }[] = [
    ...filters.availability.map((a) => ({
      key: `a-${a}`,
      label: AVAILABILITY[a].short,
      remove: () =>
        setFilters((f) => ({
          ...f,
          availability: f.availability.filter((x) => x !== a),
        })),
    })),
    ...filters.jobs.map((j) => ({
      key: `j-${j}`,
      label: j,
      remove: () =>
        setFilters((f) => ({ ...f, jobs: f.jobs.filter((x) => x !== j) })),
    })),
    ...filters.skills
      .filter(
        (s) =>
          !quickSkills.some((qs) => qs.label.toLowerCase() === s.toLowerCase())
      )
      .map((s) => ({
        key: `s-${s}`,
        label: s,
        remove: () =>
          setFilters((f) => ({
            ...f,
            skills: f.skills.filter((x) => x !== s),
          })),
      })),
    ...(filters.openToCollab
      ? [
          {
            key: "collab",
            label: "Ouverts à collaborer",
            remove: () => setFilters((f) => ({ ...f, openToCollab: false })),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Presence row: who is on site + my status, one line */}
      <div className="flex items-center gap-2.5 rounded-3xl bg-white px-3.5 py-2.5 shadow-sm">
        <span className="relative flex h-2 w-2 shrink-0">
          {people.length ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          ) : null}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              people.length ? "bg-emerald-500" : "bg-slate-300"
            )}
          />
        </span>
        {people.length ? (
          <>
            <p className="shrink-0 text-sm text-slate-500">
              <span className="font-bold tabular-nums text-slate-900">
                {people.length}
              </span>{" "}
              sur place
            </p>
            <div className="hidden -space-x-2 min-[380px]:flex">
              {people.slice(0, STACK).map((p) => (
                <VisitorAvatar
                  key={p.id}
                  name={memberName(p)}
                  src={p.avatarUrl}
                  className="h-7 w-7 border-2 border-white"
                />
              ))}
            </div>
          </>
        ) : (
          <p className="truncate text-sm text-slate-500">Personne sur place</p>
        )}

        <div className="ml-auto flex shrink-0 gap-1">
          {iAmPresent ? (
            (Object.keys(AVAILABILITY) as MemberAvailability[]).map((k) => {
              const meta = AVAILABILITY[k];
              const active = myAvailability === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={setMyStatus.isPending}
                  onClick={() => setMyStatus.mutate(active ? null : k)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition active:scale-95",
                    active ? meta.pill : "bg-slate-50 text-slate-400"
                  )}
                >
                  <meta.icon className="h-3 w-3" />
                  {meta.short}
                </button>
              );
            })
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <QrCode className="h-3.5 w-3.5 text-indigo-500" />
              Scannez pour apparaître
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-sm">
        {(
          [
            { id: "people", label: "Sur place", badge: people.length, tone: "emerald" },
            { id: "feed", label: "Fil du jour", badge: notes.length, tone: "indigo" },
            { id: "inbox", label: "Messages", badge: unread, tone: "indigo" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full text-[13px] font-semibold transition",
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
            {t.badge > 0 ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-[10px] font-bold leading-5",
                  tab === t.id
                    ? "bg-white/20 text-white"
                    : t.tone === "emerald"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-indigo-50 text-indigo-700"
                )}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className={cn("flex gap-2", tab === "feed" && "hidden")}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              tab === "people"
                ? "Nom, métier, compétence…"
                : "Rechercher une conversation…"
            }
            className="h-11 w-full rounded-full bg-white pl-10 pr-9 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {q ? (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {tab === "people" ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filtres"
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95",
              filterCount
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filterCount ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#f3f6fb]">
                {filterCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {tab === "people" ? (
        <>
          {quickSkills.length ? (
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {quickSkills.map((s) => {
                const active = filters.skills.some(
                  (x) => x.toLowerCase() === s.label.toLowerCase()
                );
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => toggleQuickSkill(s.label)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition active:scale-95",
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {removable.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {removable.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={r.remove}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700"
                >
                  {r.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-[11px] font-medium text-slate-500"
              >
                Tout effacer
              </button>
            </div>
          ) : null}

          {peopleLoading ? (
            <div className="space-y-2 rounded-3xl bg-white p-3.5 shadow-sm">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="h-2.5 w-3/4 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : people.length === 0 ? (
            <div className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <Moon className="h-5 w-5" />
              </span>
              <p className="min-w-0 flex-1 text-xs text-slate-500">
                Les membres apparaissent ici dès qu&apos;ils scannent.{" "}
                <button
                  type="button"
                  onClick={() => setTab("feed")}
                  className="font-medium text-indigo-600"
                >
                  Voir le fil du jour ›
                </button>
              </p>
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-7 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                Aucun membre ne correspond
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Essayez une autre compétence ou élargissez les filtres.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setQ("");
                }}
                className="mt-3 rounded-full border border-indigo-200 px-4 py-1.5 text-xs font-semibold text-indigo-700"
              >
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
              {filteredPeople.map((p) => (
                <DirectoryCard
                  key={p.id}
                  member={p}
                  highlightSkills={filters.skills}
                  onOpen={() => router.push(href(`/u/${p.id}`))}
                  onMessage={() => router.push(href(`/chat/${p.id}`))}
                />
              ))}
            </div>
          )}
        </>
      ) : tab === "feed" ? (
        <>
          {iAmPresent ? (
            focusDraft !== null ? (
              <form
                className="flex items-center gap-1.5 rounded-3xl bg-white p-1.5 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveFocus.mutate(focusDraft.trim() || null);
                }}
              >
                <input
                  autoFocus
                  value={focusDraft}
                  onChange={(e) => setFocusDraft(e.target.value)}
                  maxLength={120}
                  placeholder="Aujourd'hui je bosse sur…"
                  className="h-9 min-w-0 flex-1 rounded-full bg-slate-50 px-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="submit"
                  disabled={saveFocus.isPending}
                  aria-label="Publier"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white active:scale-95"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Annuler"
                  onClick={() => setFocusDraft(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setFocusDraft(myFocus ?? "")}
                className="flex w-full items-center gap-2 rounded-3xl bg-white px-3.5 py-2.5 text-left shadow-sm transition active:scale-[0.99]"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    myFocus ? "italic text-indigo-700" : "text-slate-400"
                  )}
                >
                  {myFocus ? `“${myFocus}”` : "Partagez votre note du jour…"}
                </span>
              </button>
            )
          ) : (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
              <QrCode className="h-3.5 w-3.5 text-indigo-500" />
              Scannez à l&apos;accueil pour publier votre note du jour.
            </p>
          )}

          {feedLoading ? (
            <div className="h-24 animate-pulse rounded-3xl bg-white shadow-sm" />
          ) : notes.length === 0 ? (
            <div className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <MessageSquareQuote className="h-5 w-5" />
              </span>
              <p className="text-xs text-slate-500">
                Aucune note aujourd&apos;hui. Le fil repart à zéro chaque
                matin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
              {notes.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => router.push(href(`/u/${n.author.id}`))}
                    aria-label={memberName(n.author)}
                  >
                    <PresenceAvatar member={n.author} size="h-10 w-10" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {n.isMine ? "Vous" : memberName(n.author)}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {format(new Date(n.createdAt), "HH:mm", { locale: fr })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-700">{n.text}</p>
                  </div>
                  {!n.isMine ? (
                    <button
                      type="button"
                      aria-label={`Répondre à ${memberName(n.author)}`}
                      onClick={() => router.push(href(`/chat/${n.author.id}`))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-slate-50"
            onClick={() => router.push(href("/staff"))}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">
                Administration
              </span>
              <span className="block truncate text-xs text-slate-500">
                Écrire à l&apos;accueil
              </span>
            </span>
          </button>
          {filteredInbox.length === 0 ? (
            <p className="px-6 py-6 text-center text-xs text-slate-500">
              Pas encore de conversation. Écrivez à un membre sur place.
            </p>
          ) : (
            filteredInbox.map((t) => {
              const present = presentIds.has(t.peer.id);
              return (
                <button
                  key={t.peer.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-slate-50"
                  onClick={() => router.push(href(`/chat/${t.peer.id}`))}
                >
                  <PresenceAvatar member={{ ...t.peer, isPresent: present }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-slate-900",
                          t.unreadHint ? "font-bold" : "font-semibold"
                        )}
                      >
                        {memberName(t.peer)}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {format(new Date(t.lastAt), "HH:mm", { locale: fr })}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {present ? "Sur place" : t.peer.functionality || "Membre"}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs",
                          t.unreadHint
                            ? "font-semibold text-slate-800"
                            : "text-slate-500"
                        )}
                      >
                        {t.lastMessage}
                      </span>
                      {t.unreadHint ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      <CommunityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        people={people}
        query={q}
        value={filters}
        onApply={setFilters}
      />
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
