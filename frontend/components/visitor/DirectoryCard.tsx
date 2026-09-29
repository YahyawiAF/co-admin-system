"use client";

import { Handshake, MapPin, MessageCircle } from "lucide-react";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { AVAILABILITY, memberName, seatLabel } from "@/lib/community";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SKILLS = 3;

/** Avatar with the live presence dot when the member is on site. */
export function PresenceAvatar({
  member,
  size = "h-12 w-12",
}: {
  member: Pick<Member, "firstName" | "lastName" | "avatarUrl" | "isPresent">;
  size?: string;
}) {
  return (
    <span className="relative shrink-0">
      <VisitorAvatar
        name={memberName(member)}
        src={member.avatarUrl}
        className={size}
      />
      {member.isPresent ? (
        <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      ) : null}
    </span>
  );
}

export function DirectoryCard({
  member,
  highlightSkills = [],
  onOpen,
  onMessage,
}: {
  member: Member;
  /** Skills selected in the filters — shown first and highlighted */
  highlightSkills?: string[];
  onOpen?: () => void;
  onMessage?: () => void;
}) {
  const name = memberName(member);
  const where = seatLabel(member.seat);
  const avail = member.availability ? AVAILABILITY[member.availability] : null;
  const wanted = new Set(highlightSkills.map((s) => s.toLowerCase()));
  const skills = [...(member.skills || []).filter(Boolean)].sort(
    (a, b) =>
      Number(wanted.has(b.toLowerCase())) - Number(wanted.has(a.toLowerCase())),
  );
  const shown = skills.slice(0, MAX_SKILLS);
  const lookingFor = (member.lookingFor || []).filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className="flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition active:bg-slate-50"
    >
      <PresenceAvatar member={member} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{name}</p>
            <p className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
              <span className="truncate">
                {member.functionality || "Membre du coworking"}
              </span>
              {where ? (
                <>
                  <span className="text-slate-300">·</span>
                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{where}</span>
                </>
              ) : null}
            </p>
          </div>
          {onMessage ? (
            <button
              type="button"
              aria-label={`Écrire à ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onMessage();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {avail ? (
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              avail.pill,
            )}
          >
            <avail.icon className="h-3 w-3" />
            {avail.label}
          </span>
        ) : null}

        {member.todayFocus ? (
          <p className="mt-1.5 truncate rounded-lg bg-indigo-50/70 px-2 py-1 text-[11px] italic text-indigo-700">
            “{member.todayFocus}”
          </p>
        ) : null}

        {shown.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {shown.map((s) => (
              <span
                key={s}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  wanted.has(s.toLowerCase())
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {s}
              </span>
            ))}
            {skills.length > MAX_SKILLS ? (
              <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                +{skills.length - MAX_SKILLS}
              </span>
            ) : null}
          </div>
        ) : null}

        {lookingFor.length ? (
          <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-slate-600">
            <Handshake className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            <span className="font-medium text-slate-500">Recherche :</span>
            <span className="truncate">{lookingFor.join(", ")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
