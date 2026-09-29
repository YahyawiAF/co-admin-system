"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Briefcase,
  Calendar,
  CalendarDays,
  Coffee,
  Flame,
  Handshake,
  Linkedin,
  MapPin,
  Medal,
  MessageCircle,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { PresenceAvatar } from "@/components/visitor/DirectoryCard";
import { mobileApi } from "@/lib/api/resources";
import { AVAILABILITY, memberName, seatLabel } from "@/lib/community";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { cn } from "@/lib/utils";
import type { TrophyIcon, TrophyTier } from "@/lib/points-catalog";

const TROPHY_ICON: Record<TrophyIcon, LucideIcon> = {
  star: Star,
  coffee: Coffee,
  calendar: Calendar,
  phone: Smartphone,
  medal: Medal,
  cup: Trophy,
};

const TIER_RING: Record<TrophyTier, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-300",
  gold: "from-amber-400 to-yellow-300",
};

function TagSection({
  title,
  icon: Icon,
  tags,
  tone,
  linkFor,
}: {
  title: string;
  icon: LucideIcon;
  tags: string[];
  tone: string;
  linkFor?: (tag: string) => string;
}) {
  if (!tags.length) return null;
  return (
    <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((t) =>
          linkFor ? (
            <Link
              key={t}
              href={linkFor(t)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95",
                tone,
              )}
            >
              {t}
            </Link>
          ) : (
            <span
              key={t}
              className={cn("rounded-full px-2.5 py-1 text-xs font-medium", tone)}
            >
              {t}
            </span>
          ),
        )}
      </div>
    </section>
  );
}

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
    return (
      <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm" />
    );
  }
  if (error || !data?.member) {
    return (
      <div className="rounded-3xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
        Profil introuvable ou privé.
      </div>
    );
  }

  const m = data.member;
  const name = memberName(m);
  const skills = (m.skills || []).filter(Boolean);
  const offers = (m.services || []).filter(Boolean);
  const lookingFor = (m.lookingFor || []).filter(Boolean);
  const events = data.events || [];
  const trophies = data.trophies || [];
  const attendance = data.attendance || null;
  const isSelf = me === m.id;
  const where = m.isPresent ? seatLabel(m.seat) : null;
  const avail = m.isPresent && m.availability ? AVAILABILITY[m.availability] : null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500" />
        <div className="-mt-10 px-4 pb-4">
          <div className="flex items-end justify-between gap-3">
            <span className="rounded-full border-4 border-white bg-white shadow">
              <PresenceAvatar member={m} size="h-20 w-20" />
            </span>
            {!isSelf && me ? (
              <Link
                href={href(`/chat/${m.id}`)}
                className="mb-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </Link>
            ) : null}
          </div>

          <h1 className="mt-2 text-xl font-bold text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500">
            {m.functionality || "Membre du coworking"}
          </p>

          {m.isPresent || avail || attendance ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.isPresent ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Sur place
                  {where ? (
                    <>
                      <MapPin className="ml-0.5 h-3 w-3" />
                      {where}
                    </>
                  ) : null}
                </span>
              ) : null}
              {avail ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                    avail.pill,
                  )}
                >
                  <avail.icon className="h-3 w-3" />
                  {avail.label}
                </span>
              ) : null}
              {attendance && (attendance.shared || isSelf) ? (
                <>
                  {attendance.streak > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-600">
                      <Flame className="h-3 w-3" />
                      {attendance.streak} jour
                      {attendance.streak > 1 ? "s" : ""} d&apos;affilée
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                    <Medal className="h-3 w-3" />
                    {attendance.level.name}
                  </span>
                  {isSelf && !attendance.shared ? (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                      Visible par vous seul
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {m.isPresent && m.todayFocus ? (
            <p className="mt-2.5 rounded-xl bg-indigo-50/70 px-3 py-2 text-sm italic text-indigo-700">
              “{m.todayFocus}”
            </p>
          ) : null}

          {m.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{m.bio}</p>
          ) : null}

          {m.openToCollaboration || m.linkedinUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {m.openToCollaboration ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ouvert à la collaboration
                </span>
              ) : null}
              {m.linkedinUrl ? (
                <a
                  href={m.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn / portfolio
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <TagSection
        title="Je recherche"
        icon={Handshake}
        tags={lookingFor}
        tone="bg-indigo-50 text-indigo-700"
      />
      <TagSection
        title="Compétences"
        icon={Sparkles}
        tags={skills}
        tone="bg-slate-100 text-slate-700 hover:bg-slate-200"
        linkFor={(s) => href(`/community?skill=${encodeURIComponent(s)}`)}
      />
      <TagSection
        title="Je propose"
        icon={Briefcase}
        tags={offers}
        tone="bg-emerald-50 text-emerald-700"
      />

      {trophies.length ? (
        <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Trophy className="h-3.5 w-3.5" />
            Trophées · {trophies.length}
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {trophies.map((t) => {
              const Icon = TROPHY_ICON[t.icon] || Star;
              return (
                <div
                  key={t.id}
                  className="flex flex-col items-center rounded-2xl bg-amber-50/80 px-1.5 py-2 text-center"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm",
                      TIER_RING[t.tier],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-tight text-slate-800">
                    {t.name}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          Événements
        </h2>
        {!events.length ? (
          <p className="mt-2 text-xs text-slate-500">
            Pas encore d&apos;événements.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={href(`/events/${e.id}`)}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {e.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {format(new Date(e.startAt), "d MMM yyyy · HH:mm", {
                        locale: fr,
                      })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      e.registrationStatus === "ATTENDED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-indigo-50 text-indigo-700",
                    )}
                  >
                    {e.registrationStatus === "ATTENDED" ? "Présent" : "Inscrit"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
