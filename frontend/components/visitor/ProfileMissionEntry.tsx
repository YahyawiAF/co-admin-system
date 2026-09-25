"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ProfileMissionCard } from "@/components/visitor/ProfileMissionCard";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { useVisitorSession } from "@/lib/visitor-session";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { PROFILE_COMPLETE_TROPHY_ID } from "@/lib/points-catalog";
import { cn } from "@/lib/utils";

export function isProfileDetailsDone(m?: {
  firstName?: string | null;
  lastName?: string | null;
  functionality?: string | null;
  bio?: string | null;
  skills?: string[] | null;
} | null) {
  if (!m) return false;
  const first = (m.firstName || "").trim();
  const last = (m.lastName || "").trim();
  const role = (m.functionality || "").trim();
  const bio = (m.bio || "").trim();
  const skills = (m.skills || []).filter((s) => !!s?.trim());
  return !!first && !!last && !!role && (skills.length > 0 || !!bio);
}

export function isProfileAvatarDone(m?: { avatarUrl?: string | null } | null) {
  return (m?.avatarUrl || "").trim().length >= 24;
}

type Props = {
  className?: string;
  /** Open local edit dialog instead of navigating to /profile?edit=1 */
  onEdit?: () => void;
  /** Hide when mission already complete */
  hideWhenComplete?: boolean;
};

/**
 * Mission chip wired to mobile status / trophies.
 * Default CTA opens Profil with edit dialog.
 */
export function ProfileMissionEntry({
  className,
  onEdit,
  hideWhenComplete = false,
}: Props) {
  const router = useRouter();
  const { href } = useOrg();
  const { memberId, onboarded } = useVisitorSession();
  const { data: status } = useMobileStatus({
    enabled: !!memberId && onboarded,
  });
  const { data: pointsSnap } = useQuery({
    queryKey: ["member-points", memberId, isStandalonePwa()],
    queryFn: () => mobileApi.getPoints(memberId!, isStandalonePwa()),
    enabled: !!memberId && onboarded,
    staleTime: 30_000,
  });

  if (!memberId || !onboarded) return null;

  const member = status?.member;
  const detailsDone = isProfileDetailsDone(member);
  const avatarDone = isProfileAvatarDone(member);
  const completed =
    !!pointsSnap?.trophies?.some(
      (t) => t.id === PROFILE_COMPLETE_TROPHY_ID && t.unlocked
    ) ||
    (detailsDone && avatarDone);

  if (hideWhenComplete && completed) return null;

  return (
    <ProfileMissionCard
      className={cn(className)}
      detailsDone={detailsDone}
      avatarDone={avatarDone}
      completed={completed}
      onEdit={
        onEdit ||
        (() => {
          router.push(href("/profile?edit=1"));
        })
      }
    />
  );
}
