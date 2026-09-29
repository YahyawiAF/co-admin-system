import { Coffee, Headphones, type LucideIcon } from "lucide-react";
import type { CommunitySeat, Member, MemberAvailability } from "@/lib/types";

/** TEMP: set to false to restrict community to the installed app again. */
export const COMMUNITY_OPEN_ON_WEB = true;

export function isCommunityUnlocked(hasAccount: boolean, isApp: boolean) {
  return hasAccount && (isApp || COMMUNITY_OPEN_ON_WEB);
}

export function memberName(m?: Pick<Member, "firstName" | "lastName"> | null) {
  return (
    [m?.firstName, m?.lastName].filter(Boolean).join(" ") ||
    m?.firstName ||
    "Membre"
  );
}

export const AVAILABILITY: Record<
  MemberAvailability,
  { label: string; short: string; icon: LucideIcon; pill: string }
> = {
  OPEN_TO_CHAT: {
    label: "Dispo pour échanger",
    short: "Dispo",
    icon: Coffee,
    pill: "bg-emerald-50 text-emerald-700",
  },
  FOCUS: {
    label: "Focus — répond plus tard",
    short: "Focus",
    icon: Headphones,
    pill: "bg-amber-50 text-amber-700",
  },
};

export function seatLabel(seat?: CommunitySeat | null) {
  if (!seat) return null;
  return [seat.spaceName, seat.seatLabel].filter(Boolean).join(" · ");
}

export type CommunityFilters = {
  availability: MemberAvailability[];
  jobs: string[];
  skills: string[];
  openToCollab: boolean;
};

export const EMPTY_FILTERS: CommunityFilters = {
  availability: [],
  jobs: [],
  skills: [],
  openToCollab: false,
};

export function activeFilterCount(f: CommunityFilters) {
  return (
    f.availability.length +
    f.jobs.length +
    f.skills.length +
    (f.openToCollab ? 1 : 0)
  );
}

const norm = (s: string) => s.trim().toLowerCase();

/** Case-insensitive skill match count (for ranking). */
export function skillMatches(m: Member, skills: string[]) {
  if (!skills.length) return 0;
  const mine = new Set((m.skills || []).map(norm));
  return skills.filter((s) => mine.has(norm(s))).length;
}

/**
 * Filter + rank present members. Within a group the selection is "any of";
 * across groups it is "all of". More matched skills ranks first.
 */
export function filterMembers(
  people: Member[],
  f: CommunityFilters,
  query: string,
) {
  const q = norm(query);
  const kept = people.filter((p) => {
    if (f.availability.length) {
      if (!p.availability || !f.availability.includes(p.availability)) {
        return false;
      }
    }
    if (
      f.jobs.length &&
      !f.jobs.some((j) => norm(j) === norm(p.functionality || ""))
    ) {
      return false;
    }
    if (f.skills.length && skillMatches(p, f.skills) === 0) return false;
    if (f.openToCollab && !p.openToCollaboration) return false;
    if (!q) return true;
    return [
      p.firstName,
      p.lastName,
      p.functionality,
      p.bio,
      ...(p.skills || []),
      ...(p.lookingFor || []),
      ...(p.services || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  if (!f.skills.length) return kept;
  return [...kept].sort(
    (a, b) => skillMatches(b, f.skills) - skillMatches(a, f.skills),
  );
}

/** Distinct values with counts, most common first. */
export function countValues(values: string[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const key = norm(label);
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"),
  );
}
