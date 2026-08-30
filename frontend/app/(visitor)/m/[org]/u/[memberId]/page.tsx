"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  Linkedin,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";

export default function VisitorPublicProfilePage() {
  const params = useParams<{ org: string; memberId: string }>();
  const { href } = useOrg();
  const { memberId: me } = useVisitorSession();
  const id = params.memberId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["community-member", id, me],
    queryFn: () => mobileApi.communityMember(id, me || undefined),
    enabled: !!id,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Chargement…</p>;
  }
  if (error || !data?.member) {
    return (
      <div className="space-y-3">
        <MobileBackHome label="Communauté" />
        <p className="text-sm text-slate-500">Profil introuvable ou privé.</p>
      </div>
    );
  }

  const m = data.member;
  const name =
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    m.firstName ||
    "Membre";
  const skills = (m.skills || []).filter(Boolean);
  const services = (m.services || []).filter(Boolean);
  const events = data.events || [];
  const isSelf = me === m.id;

  return (
    <div className="space-y-4">
      <MobileBackHome label="Communauté" />

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-sky-900 px-5 pb-12 pt-6" />
        <div className="-mt-10 px-5 pb-5">
          <VisitorAvatar
            name={name}
            src={m.avatarUrl}
            className="h-20 w-20 border-4 border-white shadow"
          />
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold">{name}</h1>
              <p className="text-sm text-slate-500">
                {m.functionality || "Membre du coworking"}
                {m.visitorNumber != null ? ` · #${m.visitorNumber}` : ""}
              </p>
              {m.isPresent ? (
                <Badge className="mt-2 bg-emerald-600 hover:bg-emerald-600">
                  Présent maintenant
                </Badge>
              ) : null}
            </div>
            {!isSelf && me ? (
              <Button size="sm" className="rounded-full" asChild>
                <Link href={href(`/chat/${m.id}`)}>
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Message
                </Link>
              </Button>
            ) : null}
          </div>
          {m.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {m.bio}
            </p>
          ) : null}
          {m.openToCollaboration ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" />
              Ouvert à la collaboration
            </p>
          ) : null}
          {m.linkedinUrl ? (
            <a
              href={m.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn / portfolio
            </a>
          ) : null}
        </div>
      </div>

      {skills.length ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Compétences
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {services.length ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Services
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          Événements
        </h2>
        {!events.length ? (
          <p className="mt-3 text-sm text-slate-500">
            Pas encore d’événements inscrits.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={href(`/events/${e.id}`)}
                  className="block rounded-xl border px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(e.startAt), "d MMM yyyy · HH:mm", {
                      locale: fr,
                    })}
                    {e.registrationStatus === "ATTENDED"
                      ? " · présent"
                      : " · inscrit"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
