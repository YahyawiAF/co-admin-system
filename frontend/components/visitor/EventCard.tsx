"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  Clock,
  Mic,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { eventsApi, mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { cn } from "@/lib/utils";
import type { EventKind, SpaceEvent } from "@/lib/types";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Événement",
};

const KIND_STYLE: Record<EventKind, { Icon: typeof Mic; cover: string }> = {
  WORKSHOP: { Icon: Mic, cover: "from-indigo-500 to-violet-500" },
  NETWORKING: { Icon: Users, cover: "from-sky-500 to-cyan-500" },
  OTHER: { Icon: Sparkles, cover: "from-amber-400 to-orange-500" },
};

const CARD = "rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "SAM." for date tiles. */
export const weekdayShort = (d: Date) =>
  format(d, "EEE", { locale: fr }).toUpperCase();

const isActiveReg = (status?: string | null) =>
  status === "REGISTERED" || status === "ATTENDED";

const isFull = (event: SpaceEvent) =>
  event.spotsLeft === 0 ||
  (event.capacity != null && (event.registeredCount || 0) >= event.capacity);

/**
 * Visitor-facing status chip. Product rule: never expose attendee counts or
 * "Plus que N places" — only "Inscrit ✓" or "Complet", otherwise nothing.
 */
export function eventSpots(
  event: SpaceEvent,
  myStatus?: string | null
): { label: string; tone: string } | null {
  if (isActiveReg(myStatus ?? event.registration?.status)) {
    return { label: "Inscrit ✓", tone: "bg-emerald-50 text-emerald-700" };
  }
  if (isFull(event)) return { label: "Complet", tone: "bg-rose-50 text-rose-700" };
  return null;
}

/**
 * The public list carries no per-member data, so registration status comes
 * from the member's own registrations (eventId → status).
 */
export function useMyEventStatuses(): Map<string, string> {
  const { memberId } = useVisitorSession();
  const { data } = useQuery({
    queryKey: ["mobile-events", "mine", memberId],
    queryFn: () => mobileApi.myEvents(memberId!),
    enabled: !!memberId,
    staleTime: 30_000,
  });
  return new Map((data || []).map((r) => [r.id, r.registrationStatus]));
}

function useEventDetail(id: string, enabled = true) {
  const { memberId } = useVisitorSession();
  return useQuery({
    queryKey: ["mobile-events", "detail", id, memberId],
    queryFn: () => eventsApi.get(id, memberId || undefined),
    enabled: enabled && !!memberId,
    staleTime: 30_000,
  });
}

function useInvalidateEvents() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["mobile-events"] });
    queryClient.invalidateQueries({ queryKey: ["mobile-event"] });
  };
}

function DateTile({ date, muted }: { date: Date; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl leading-none",
        muted ? "bg-slate-100 text-slate-700" : "bg-indigo-50 text-indigo-700"
      )}
    >
      <span className="text-[11px] font-extrabold">{weekdayShort(date)}</span>
      <span className="mt-0.5 text-lg font-black tabular-nums">
        {format(date, "d")}
      </span>
    </span>
  );
}

function Chip({ spots }: { spots: { label: string; tone: string } | null }) {
  if (!spots) return null;
  return (
    <span
      className={cn(
        "v-pop shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-extrabold",
        spots.tone
      )}
    >
      {spots.label}
    </span>
  );
}

const rowRing = (highlighted?: boolean) =>
  highlighted
    ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50"
    : "ring-1 ring-slate-900/5";

/** First upcoming event, with inline registration. */
export function FeaturedEventCard({
  event,
  href,
  highlighted,
}: {
  event: SpaceEvent;
  href: string;
  highlighted?: boolean;
}) {
  const { memberId } = useVisitorSession();
  const statuses = useMyEventStatuses();
  const detail = useEventDetail(event.id);
  const invalidate = useInvalidateEvents();
  // Local result of the last mutation, so the UI doesn't flicker while refetching
  const [mine, setMine] = useState<boolean | null>(null);

  const ev = detail.data ?? event;
  const serverStatus = detail.data
    ? detail.data.registration?.status ?? null
    : statuses.get(event.id) ?? null;
  const registered = mine ?? isActiveReg(serverStatus);
  const attended = serverStatus === "ATTENDED";
  const full = !registered && isFull(ev);

  const register = useMutation({
    mutationFn: () => eventsApi.register(event.id, memberId!),
    onSuccess: () => {
      setMine(true);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unregister = useMutation({
    mutationFn: () => eventsApi.unregister(event.id, memberId!),
    onSuccess: () => {
      setMine(false);
      toast.success("Inscription annulée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const style = KIND_STYLE[event.kind] || KIND_STYLE.OTHER;
  const start = new Date(event.startAt);
  const dateLine = [
    cap(format(start, "EEEE d MMMM", { locale: fr })),
    format(start, "HH:mm"),
    event.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const ctaClass =
    "flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-[15px] font-extrabold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none";

  return (
    <article
      id={`event-${event.id}`}
      className={cn(
        "scroll-mt-4 overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow duration-300 motion-reduce:transition-none",
        rowRing(highlighted)
      )}
    >
      <Link href={href} className="block">
        <div className="relative h-32 overflow-hidden">
          {event.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "relative flex h-full w-full items-center justify-center bg-gradient-to-br text-white/90",
                style.cover
              )}
            >
              <span
                aria-hidden
                className="v-twinkle absolute left-10 top-6 h-1 w-1 rounded-full bg-amber-200"
              />
              <span
                aria-hidden
                className="v-twinkle absolute right-14 top-10 h-1.5 w-1.5 rounded-full bg-indigo-100"
                style={{ animationDelay: "0.8s" }}
              />
              <span
                aria-hidden
                className="v-twinkle absolute bottom-5 right-28 h-1 w-1 rounded-full bg-amber-200"
                style={{ animationDelay: "1.4s" }}
              />
              <style.Icon className="v-float h-12 w-12" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-xl bg-white px-2.5 py-1.5 text-center leading-none shadow-sm">
            <span className="block text-[11px] font-extrabold text-indigo-600">
              {weekdayShort(start)}
            </span>
            <span className="mt-0.5 block text-lg font-black tabular-nums text-slate-900">
              {format(start, "d")}
            </span>
          </span>
        </div>
        <div className="px-4 pt-3">
          <h2 className="line-clamp-2 text-[19px] font-black leading-snug text-slate-900">
            {event.title}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-600">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{dateLine}</span>
          </p>
        </div>
      </Link>
      <div className="px-4 pb-4 pt-3">
        {registered ? (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-100 text-[15px] font-black text-emerald-800",
                mine === true && "v-stamp"
              )}
            >
              <Check className="h-[18px] w-[18px]" strokeWidth={3} />
              Inscrit
            </span>
            {!attended ? (
              <button
                type="button"
                disabled={unregister.isPending}
                onClick={() => unregister.mutate()}
                className="h-12 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 motion-reduce:transition-none"
              >
                Annuler
              </button>
            ) : null}
          </div>
        ) : full ? (
          <span className="flex h-12 items-center justify-center rounded-full bg-rose-50 text-[15px] font-black text-rose-700">
            Complet
          </span>
        ) : memberId ? (
          <button
            type="button"
            disabled={register.isPending}
            onClick={() => register.mutate()}
            className={cn(ctaClass, mine === false && "v-rise")}
          >
            {register.isPending ? "Inscription…" : "Je m’inscris"}
          </button>
        ) : (
          <Link href={href} className={ctaClass}>
            Je m’inscris
          </Link>
        )}
      </div>
    </article>
  );
}

/** Compact upcoming row. */
export function EventRow({
  event,
  href,
  myStatus,
  highlighted,
  style,
}: {
  event: SpaceEvent;
  href: string;
  myStatus?: string | null;
  highlighted?: boolean;
  style?: CSSProperties;
}) {
  const start = new Date(event.startAt);
  return (
    <Link
      id={`event-${event.id}`}
      href={href}
      style={style}
      className={cn(
        "v-rise flex scroll-mt-4 items-center gap-3 rounded-[20px] bg-white px-3 py-2.5 shadow-sm transition-[box-shadow,transform] duration-300 active:scale-[0.99] motion-reduce:transition-none",
        rowRing(highlighted)
      )}
    >
      <DateTile date={start} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-slate-900">
          {event.title}
        </span>
        <span className="block truncate text-xs text-slate-600">
          {cap(format(start, "EEEE d MMM · HH:mm", { locale: fr }))}
        </span>
      </span>
      <Chip spots={eventSpots(event, myStatus)} />
    </Link>
  );
}

/** Past row; members who attended and haven't rated get an inline 5-star rating. */
export function PastEventRow({
  event,
  href,
  myStatus,
  style,
}: {
  event: SpaceEvent;
  href: string;
  myStatus?: string | null;
  style?: CSSProperties;
}) {
  const { memberId } = useVisitorSession();
  const attended = myStatus === "ATTENDED";
  const detail = useEventDetail(event.id, attended);
  const invalidate = useInvalidateEvents();
  const [sent, setSent] = useState(0);
  const [hover, setHover] = useState(0);

  const feedback = useMutation({
    mutationFn: (rating: number) =>
      eventsApi.feedback(event.id, { memberId: memberId!, rating }),
    onSuccess: (_d, rating) => {
      setSent(rating);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRate =
    !!memberId &&
    attended &&
    detail.data?.registration?.status === "ATTENDED" &&
    !detail.data.registration.feedbackRating;
  const showRating = canRate || sent > 0;

  const start = new Date(event.startAt);
  const sub = [cap(format(start, "EEEE d MMM", { locale: fr })), event.location]
    .filter(Boolean)
    .join(" · ");
  const lit = sent || hover || (feedback.isPending ? feedback.variables : 0) || 0;

  const row = (
    <Link href={href} className="flex items-center gap-3">
      <DateTile date={start} muted />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold text-slate-900">
          {event.title}
        </span>
        <span className="block truncate text-xs text-slate-600">{sub}</span>
      </span>
    </Link>
  );

  if (!showRating) {
    return (
      <div
        style={style}
        className={cn(
          "v-rise rounded-[20px] px-3 py-2.5 transition-transform active:scale-[0.99] motion-reduce:transition-none",
          CARD
        )}
      >
        {row}
      </div>
    );
  }

  return (
    <article style={style} className={cn("v-rise p-3.5", CARD)}>
      {row}
      <p className="mb-1.5 mt-3 text-[13px] font-bold text-slate-900">
        Vous avez aimé ?
      </p>
      <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            disabled={!!sent || feedback.isPending}
            onMouseEnter={() => !sent && setHover(n)}
            onClick={() => feedback.mutate(n)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 transition-transform active:scale-90 disabled:cursor-default motion-reduce:transition-none"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors duration-200 motion-reduce:transition-none",
                n <= lit
                  ? "fill-amber-400 text-amber-500"
                  : "fill-transparent text-slate-500"
              )}
              strokeWidth={1.8}
            />
          </button>
        ))}
      </div>
      {sent ? (
        <p className="v-stamp mt-2 text-xs font-bold text-emerald-800">
          Merci ! Votre avis aide l’équipe.
        </p>
      ) : null}
    </article>
  );
}

/** Compact one-row event strip (Accueil / session). Renders nothing without events. */
export function EventsPreview() {
  const { slug, href } = useOrg();
  const statuses = useMyEventStatuses();
  const { data = [] } = useQuery({
    queryKey: ["mobile-events", slug, "upcoming"],
    queryFn: () => eventsApi.list(slug, "upcoming"),
    staleTime: 60_000,
  });
  const events = data.slice(0, 4);
  if (!events.length) return null;

  return (
    <div className="rounded-3xl bg-white py-2.5 text-left shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between px-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Événements
        </p>
        <Link
          href={href("/events")}
          className="inline-flex items-center text-[11px] font-medium text-indigo-600"
        >
          Tout voir
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-1.5 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event) => {
          const style = KIND_STYLE[event.kind] || KIND_STYLE.OTHER;
          const spots = eventSpots(event, statuses.get(event.id));
          const start = new Date(event.startAt);
          return (
            <Link
              key={event.id}
              href={href(`/events/${event.id}`)}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2.5 rounded-2xl bg-slate-50 p-1.5 pr-3 ring-1 ring-slate-200/70 transition active:scale-[0.98] motion-reduce:transition-none",
                events.length === 1 ? "w-full" : "w-60"
              )}
            >
              <span
                className={cn(
                  "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br leading-none text-white",
                  style.cover
                )}
              >
                {event.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                ) : null}
                <span className="relative text-base font-bold tabular-nums">
                  {format(start, "d")}
                </span>
                <span className="relative mt-0.5 text-[10px] font-semibold uppercase">
                  {format(start, "MMM", { locale: fr }).replace(".", "")}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-900">
                  {event.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(start, "EEE HH:mm", { locale: fr })}
                  {spots ? (
                    <span
                      className={cn(
                        "ml-1 truncate rounded px-1 text-[11px] font-semibold",
                        spots.tone
                      )}
                    >
                      {spots.label}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
