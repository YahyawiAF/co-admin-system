"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mobileApi } from "@/lib/api/resources";
import { isStandalonePwa } from "@/lib/visitor-notify";
import type { MemberPointsSnapshot } from "@/lib/points-catalog";

/**
 * Member's game state (points, streak, level, trophies) — same cache as PointsCard.
 * `locked` = points only count in the installed app.
 */
export function usePlayer(memberId: string | null | undefined) {
  const [isPwa, setIsPwa] = useState(false);
  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);
  const query = useQuery<MemberPointsSnapshot>({
    queryKey: ["member-points", memberId, isPwa],
    queryFn: () => mobileApi.getPoints(memberId!, isPwa),
    enabled: !!memberId,
    staleTime: 30_000,
  });
  return { ...query, player: query.data ?? null, isPwa };
}

/** "6/10 vers Habitué" progress of the attendance level (0–100). */
export function levelProgress(player: MemberPointsSnapshot | null) {
  const next = player?.level?.next;
  if (!player || !next) return { pct: 100, label: player?.level?.name ?? "" };
  return {
    pct: Math.max(0, Math.min(100, next.progress)),
    label: `${player.level.sessions}/${next.target} vers ${next.name}`,
  };
}

export function trophyProgress(
  player: MemberPointsSnapshot | null,
  trophyId: string
): { have: number; target: number } | null {
  if (!player) return null;
  const s = player.stats;
  switch (trophyId) {
    case "sessions_10":
      return { have: Math.min(10, s.sessions), target: 10 };
    case "cafe_5":
      return { have: Math.min(5, s.cafeOrders), target: 5 };
    case "checkout_5":
      return { have: Math.min(5, s.checkouts), target: 5 };
    case "points_500":
      return { have: Math.min(500, player.points), target: 500 };
    case "points_2500":
      return { have: Math.min(2500, player.points), target: 2500 };
    case "points_10000":
      return { have: Math.min(10000, player.points), target: 10000 };
    default:
      return null;
  }
}
