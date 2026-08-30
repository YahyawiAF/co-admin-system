"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays, MapPin, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { eventsApi } from "@/lib/api/resources";
import { DirectoryCard } from "@/components/visitor/DirectoryCard";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import type { EventKind, Member } from "@/lib/types";

const KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Événement",
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { href } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: event, isLoading } = useQuery({
    queryKey: ["mobile-event", params.id, memberId],
    queryFn: () => eventsApi.get(params.id, memberId || undefined),
  });
  const { data: who } = useQuery({
    queryKey: ["mobile-event-attendees", params.id, memberId],
    queryFn: () => eventsApi.attendees(params.id, memberId || undefined),
    enabled: !!event,
  });

  const register = useMutation({
    mutationFn: () => eventsApi.register(params.id, memberId!),
    onSuccess: () => {
      toast.success("Inscription confirmée");
      queryClient.invalidateQueries({ queryKey: ["mobile-event"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-event-attendees"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unregister = useMutation({
    mutationFn: () => eventsApi.unregister(params.id, memberId!),
    onSuccess: () => {
      toast.success("Inscription annulée");
      queryClient.invalidateQueries({ queryKey: ["mobile-event"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-event-attendees"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendFeedback = useMutation({
    mutationFn: () =>
      eventsApi.feedback(params.id, {
        memberId: memberId!,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Merci pour votre avis");
      queryClient.invalidateQueries({ queryKey: ["mobile-event"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !event) {
    return <p className="text-sm text-slate-500">Chargement…</p>;
  }

  const mine = event.registration;
  const active =
    mine && (mine.status === "REGISTERED" || mine.status === "ATTENDED");
  const ended = new Date(event.endAt) < new Date();
  const full =
    event.capacity != null && (event.registeredCount || 0) >= event.capacity;
  const cancelled = event.status === "CANCELLED";
  const showQr =
    !!active &&
    mine?.status === "REGISTERED" &&
    !ended &&
    mine.attendanceCode;
  const showFeedback =
    ended && mine?.status === "ATTENDED" && !mine.feedbackRating;

  return (
    <div className="space-y-4">
      {event.coverImage ? (
        <img
          src={event.coverImage}
          alt=""
          className="-mx-4 h-48 w-[calc(100%+2rem)] object-cover sm:mx-0 sm:w-full sm:rounded-2xl"
        />
      ) : null}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <Badge variant="outline">{KIND_LABEL[event.kind]}</Badge>
        {cancelled ? (
          <Badge variant="destructive" className="ml-2">
            Annulé
          </Badge>
        ) : null}
        <h1 className="mt-2 text-xl font-bold">{event.title}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4" />
          {format(new Date(event.startAt), "EEEE d MMMM · HH:mm", { locale: fr })}
          {" → "}
          {format(new Date(event.endAt), "HH:mm")}
        </p>
        {event.location ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {event.location}
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <Users className="h-4 w-4" />
          {event.capacity == null
            ? `${event.registeredCount || 0} inscrits · Illimité`
            : `${event.registeredCount || 0}/${event.capacity} places`}
        </p>
        {event.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
            {event.description}
          </p>
        ) : null}

        {!cancelled && !ended ? (
          active ? (
            <Button
              variant="outline"
              className="mt-4 h-11 w-full rounded-full"
              disabled={unregister.isPending || mine?.status === "ATTENDED"}
              onClick={() => unregister.mutate()}
            >
              Annuler mon inscription
            </Button>
          ) : (
            <Button
              className="mt-4 h-11 w-full rounded-full"
              disabled={!memberId || register.isPending || full}
              onClick={() => register.mutate()}
            >
              {full ? "Complet" : "S’inscrire"}
            </Button>
          )
        ) : null}
      </div>

      {showQr ? (
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Présence
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Montrez ce code à l&apos;accueil.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="QR présence"
            className="mx-auto mt-3 h-40 w-40 rounded-lg border bg-white p-2"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              mine!.attendanceCode
            )}`}
          />
          <p className="mt-2 font-mono text-lg font-bold tracking-widest">
            {mine!.attendanceCode}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Qui y va ?</h2>
        <p className="mt-1 text-xs text-slate-500">
          {who?.total || 0} inscrit
          {(who?.total || 0) > 1 ? "s" : ""}
          {who?.hiddenCount
            ? ` · ${who.hiddenCount} profil${who.hiddenCount > 1 ? "s" : ""} masqué${who.hiddenCount > 1 ? "s" : ""}`
            : ""}
        </p>
        <div className="mt-2 divide-y">
          {(who?.attendees || []).length === 0 ? (
            <p className="py-4 text-sm text-slate-400">
              Personne n&apos;a encore publié son profil.
            </p>
          ) : (
            (who?.attendees || []).map((a) => (
              <DirectoryCard
                key={a.id}
                member={a as Member}
                onClick={() =>
                  router.push(href(`/u/${a.id}`))
                }
              />
            ))
          )}
        </div>
      </div>

      {showFeedback ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Votre avis</h2>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-7 w-7 ${
                    n <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            rows={3}
            placeholder="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            className="mt-3 h-11 w-full rounded-full"
            disabled={!rating || sendFeedback.isPending}
            onClick={() => sendFeedback.mutate()}
          >
            Envoyer
          </Button>
        </div>
      ) : mine?.feedbackRating ? (
        <p className="text-center text-sm text-slate-500">
          Merci, avis envoyé ({mine.feedbackRating}/5).
        </p>
      ) : null}

      <Button variant="link" className="w-full text-slate-500" asChild>
        <Link href={href("/events")}>Retour au calendrier</Link>
      </Button>
    </div>
  );
}
