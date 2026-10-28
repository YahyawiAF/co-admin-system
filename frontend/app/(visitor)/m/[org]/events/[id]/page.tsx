"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays, MapPin, Star, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { eventsApi } from "@/lib/api/resources";
import { DirectoryCard } from "@/components/visitor/DirectoryCard";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { markEventSeen } from "@/components/visitor/VisitorSpotlight";
import { readShareSource } from "@/lib/share-source";
import { lastResponse } from "@/lib/survey-attribution";
import type { EventKind, Member } from "@/lib/types";
import { Input } from "@/components/ui/input";

const KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Événement",
  LEARNING: "Séance gratuite",
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { href } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (params.id) markEventSeen(params.id);
  }, [params.id]);

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
    mutationFn: () => eventsApi.register(params.id, memberId!, readShareSource(params.id)),
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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt=""
            className="block h-44 w-full object-cover"
          />
        ) : null}
        <div className="p-4">
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
          {event.price ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Ticket className="h-4 w-4" />
              {event.price} DT la place · à payer à l&apos;accueil
            </p>
          ) : null}
          {full ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-rose-600">
              <Users className="h-4 w-4" />
              Complet
            </p>
          ) : null}
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
            ) : !memberId ? (
              full ? (
                <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Complet.</p>
              ) : (
                <GuestSignup eventId={params.id} free={!event.price} />
              )
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
      </div>

      {showQr ? (
        <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
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

      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Qui y va ?</h2>
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
                onOpen={() => router.push(href(`/u/${a.id}`))}
              />
            ))
          )}
        </div>
      </div>

      {showFeedback ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
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

/** No account yet (e.g. came from an Instagram survey): first name + phone, no password. */
function GuestSignup({ eventId, free }: { eventId: string; free: boolean }) {
  const { slug } = useOrg();
  const { confirm } = useVisitorSession();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const signup = useMutation({
    mutationFn: () => {
      const answer = lastResponse(slug);
      return eventsApi.registerGuest(eventId, {
        firstName: firstName.trim(),
        phone: phone.trim(),
        sourceCode: readShareSource(eventId),
        ...(answer && { surveyResponseId: answer.responseId, visitorKey: answer.visitorKey }),
      });
    },
    onSuccess: (res) => {
      confirm(res.member, res.accessToken);
      toast.success("Inscription confirmée");
      queryClient.invalidateQueries({ queryKey: ["mobile-event"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-event-attendees"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-events"] });
    },
    onError: (e: Error) => setError(e.message),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return setError("Indique ton prénom.");
    if (phone.replace(/\D/g, "").replace(/^216/, "").length !== 8) return setError("Numéro tunisien attendu : 8 chiffres, ex. 22 123 456.");
    setError("");
    signup.mutate();
  };
  return (
    <form onSubmit={submit} className="ls-enter mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">
        {free ? "Inscription gratuite" : "Inscription"} : pas de compte à créer.
      </p>
      <label htmlFor="guest-name" className="block space-y-1 text-sm font-medium text-slate-700">
        Prénom
        <Input id="guest-name" autoComplete="given-name" maxLength={56} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 bg-white" />
      </label>
      <label htmlFor="guest-phone" className="block space-y-1 text-sm font-medium text-slate-700">
        Téléphone
        <span className="flex gap-2">
          <span className="grid h-11 place-items-center rounded-md border bg-white px-3 text-sm font-semibold text-slate-500">+216</span>
          <Input id="guest-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="22 123 456" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 bg-white" />
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full rounded-full" disabled={signup.isPending}>
        {signup.isPending ? "Inscription…" : "M’inscrire"}
      </Button>
      <p className="text-xs text-slate-500">Si ce numéro a déjà un compte, connecte-toi depuis l&apos;accueil de l&apos;app pour t&apos;inscrire.</p>
    </form>
  );
}
