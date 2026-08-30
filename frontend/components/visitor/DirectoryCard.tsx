"use client";

import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import type { Member } from "@/lib/types";

function nameOf(m: Pick<Member, "firstName" | "lastName">) {
  return (
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    m.firstName ||
    "Membre"
  );
}

export function DirectoryCard({
  member,
  onClick,
}: {
  member: Member;
  onClick?: () => void;
}) {
  const name = nameOf(member);
  const job = member.functionality;
  const skills = (member.skills || []).filter(Boolean);
  const Inner = (
    <div className="flex w-full items-start gap-3 px-4 py-3 text-left">
      <VisitorAvatar
        name={name}
        src={member.avatarUrl}
        className="h-12 w-12 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {name}
          {job ? (
            <span className="font-normal text-slate-600"> — {job}</span>
          ) : null}
          {member.isPresent ? (
            <span className="ml-2 text-xs font-medium text-emerald-600">
              Présent
            </span>
          ) : null}
        </p>
        {skills.length ? (
          <p className="mt-0.5 text-sm text-slate-500">
            {skills.join(" • ")}
          </p>
        ) : member.bio ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
            {member.bio}
          </p>
        ) : null}
        {(member.services || []).length ? (
          <p className="mt-0.5 text-xs text-slate-400">
            {(member.services || []).join(" • ")}
          </p>
        ) : null}
        {member.openToCollaboration ? (
          <p className="mt-1 text-xs font-medium text-emerald-600">
            Disponible pour collaboration
          </p>
        ) : null}
      </div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className="w-full text-left" onClick={onClick}>
        {Inner}
      </button>
    );
  }
  return Inner;
}
