"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Clock, X } from "lucide-react";
import { eventsApi, promotionsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { PromoGoldenCard } from "@/components/visitor/PromoGoldenCard";
import { cn } from "@/lib/utils";
import type { Promotion, SpaceEvent } from "@/lib/types";

const SHOW_AFTER_MS = 1200;
const EVENT_AHEAD_DAYS = 14;

const today = () => format(new Date(), "yyyy-MM-dd");
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: popup may show again */
  }
}
const promoSeenKey = (id: string) => `promo-seen:${id}`;
const eventSeenKey = (id: string) => `event-seen:${id}`;
const SHOWN_THIS_VISIT = "spotlight-shown";

/** Live offers for the signed-in member (refreshed every few minutes for happy hours). */
export function useMemberPromotions() {
  const { slug } = useOrg();
  const { memberId, onboarded } = useVisitorSession();
  return useQuery({
    queryKey: ["mobile-promotions", slug, memberId],
    queryFn: () => promotionsApi.forMember(slug, memberId),
    enabled: !!slug && onboarded,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

function useUpcomingEvents() {
  const { slug } = useOrg();
  return useQuery({
    queryKey: ["mobile-events", slug, "upcoming"],
    queryFn: () => eventsApi.list(slug, "upcoming"),
    staleTime: 60_000,
  });
}

/** Upcoming events the member has neither opened nor registered to (nav badge). */
export function useUnseenEventCount() {
  const { data = [] } = useUpcomingEvents();
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener("visitor-event-seen", on);
    return () => window.removeEventListener("visitor-event-seen", on);
  }, []);
  return data.filter(
    (e) => !e.registration?.status && !read(eventSeenKey(e.id))
  ).length;
}

export function markEventSeen(id: string) {
  write(eventSeenKey(id), "1");
  window.dispatchEvent(new Event("visitor-event-seen"));
}

/** Where "J'en profite" leads. */
function usePromoAction() {
  const router = useRouter();
  const { href } = useOrg();
  return (p: Promotion) => {
    void promotionsApi.track(p.id, "click").catch(() => null);
    if (p.target === "PRODUCT") router.push(href(`/cafe?promo=${p.id}`));
    else if (p.target === "PRICE" && p.priceId) {
      router.push(href(`/choose?mode=day&priceId=${encodeURIComponent(p.priceId)}`));
    }
  };
}

function CtaButton({
  promo,
  onUse,
  shown,
}: {
  promo: Promotion;
  onUse: () => void;
  shown?: boolean;
}) {
  const dark = promo.style === "GOLD";
  return (
    <button
      type="button"
      onClick={onUse}
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-full text-sm font-bold shadow-sm transition active:scale-[0.98]",
        dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      )}
    >
      {promo.target === "OTHER"
        ? shown
          ? "Montrez cette carte à l’accueil"
          : "Montrer à l’accueil"
        : promo.target === "PRODUCT"
          ? "Commander avec la remise"
          : "Prendre ce pass"}
    </button>
  );
}

type Spot = { kind: "promo"; promo: Promotion } | { kind: "event"; event: SpaceEvent };

/**
 * One popup per visit, never stacked: a live offer the member hasn't seen today
 * (golden card), otherwise a new upcoming event they haven't opened yet.
 */
export function VisitorSpotlight() {
  const { href } = useOrg();
  const router = useRouter();
  const { memberId } = useVisitorSession();
  const { data: promos = [] } = useMemberPromotions();
  const { data: events = [] } = useUpcomingEvents();
  const openPromo = usePromoAction();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [showingAtDesk, setShowingAtDesk] = useState(false);

  const candidate = useMemo<Spot | null>(() => {
    const promo = promos.find((p) => p.liveNow && read(promoSeenKey(p.id)) !== today());
    if (promo) return { kind: "promo", promo };
    const limit = Date.now() + EVENT_AHEAD_DAYS * 86_400_000;
    const event = events.find(
      (e) =>
        !e.registration?.status &&
        !read(eventSeenKey(e.id)) &&
        new Date(e.startAt).getTime() <= limit
    );
    return event ? { kind: "event", event } : null;
  }, [promos, events]);

  useEffect(() => {
    if (!candidate || spot) return;
    try {
      if (sessionStorage.getItem(SHOWN_THIS_VISIT)) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      setSpot(candidate);
      try {
        sessionStorage.setItem(SHOWN_THIS_VISIT, "1");
      } catch {
        /* ignore */
      }
      if (candidate.kind === "promo") {
        write(promoSeenKey(candidate.promo.id), today());
        void promotionsApi.track(candidate.promo.id, "view").catch(() => null);
      } else {
        markEventSeen(candidate.event.id);
      }
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [candidate, spot]);

  if (!spot) return null;
  const close = () => {
    setSpot(null);
    setShowingAtDesk(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-6 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Fermer"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {spot.kind === "promo" ? (
          <PromoGoldenCard
            promo={spot.promo}
            action={
              <>
                {showingAtDesk && memberId ? (
                  <p className="mb-2 rounded-xl bg-white/70 px-3 py-2 text-center text-xs font-semibold text-slate-900">
                    Carte valable aujourd’hui · {format(new Date(), "d MMM HH:mm", { locale: fr })}
                  </p>
                ) : null}
                <CtaButton
                  promo={spot.promo}
                  shown={showingAtDesk}
                  onUse={() => {
                    if (spot.promo.target === "OTHER") {
                      void promotionsApi.track(spot.promo.id, "click").catch(() => null);
                      setShowingAtDesk(true);
                      return;
                    }
                    close();
                    openPromo(spot.promo);
                  }}
                />
              </>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
            {spot.event.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.event.coverImage} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                <CalendarDays className="h-10 w-10" />
              </div>
            )}
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">
                Nouvel événement
              </p>
              <p className="mt-1 text-xl font-bold leading-tight text-slate-900">{spot.event.title}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                {format(new Date(spot.event.startAt), "EEEE d MMMM · HH:mm", { locale: fr })}
              </p>
              <button
                type="button"
                onClick={() => {
                  close();
                  router.push(href(`/events/${spot.event.id}`));
                }}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white"
              >
                Voir et m’inscrire
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Live offers as small golden cards (home, café): the popup can always be found again. */
export function OffersStrip({ only }: { only?: Promotion["target"] }) {
  const { data = [] } = useMemberPromotions();
  const openPromo = usePromoAction();
  const [desk, setDesk] = useState<string | null>(null);
  const list = data.filter((p) => p.liveNow && (!only || p.target === only));
  if (!list.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Offres du moment
      </p>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((p) => (
          <PromoGoldenCard
            key={p.id}
            promo={p}
            compact
            className={cn("shrink-0 snap-start", list.length === 1 ? "w-full" : "w-[85%]")}
            action={
              <CtaButton
                promo={p}
                shown={desk === p.id}
                onUse={() => {
                  if (p.target === "OTHER") {
                    void promotionsApi.track(p.id, "click").catch(() => null);
                    setDesk(p.id);
                    return;
                  }
                  openPromo(p);
                }}
              />
            }
          />
        ))}
      </div>
    </div>
  );
}
