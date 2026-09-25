/** Shared points catalog (mirrors backend). 100 pts = 1 DT. */

export type PointEvent =
  | "CAFE_ORDER"
  | "INSTALL_PWA"
  | "VISIT_PAID"
  | "PRODUCT_PAID"
  | "ADMIN_ADJUST"
  | "REDEEM_VISIT"
  | "REDEEM_ORDER"
  | "PROFILE_DETAILS"
  | "PROFILE_AVATAR";

/** Fixed awards — visit/product earn are server-side via dtToPoints */
export const POINT_AMOUNTS: Partial<Record<PointEvent, number>> = {
  INSTALL_PWA: 100,
  PROFILE_DETAILS: 800,
  PROFILE_AVATAR: 200,
};

/** Profile mission: details 800 + photo 200 = gold trophy */
export const PROFILE_DETAILS_POINTS = 800;
export const PROFILE_AVATAR_POINTS = 200;
export const PROFILE_MISSION_TOTAL =
  PROFILE_DETAILS_POINTS + PROFILE_AVATAR_POINTS;
export const PROFILE_COMPLETE_TROPHY_ID = "profile_complete";

export const POINTS_PER_DT = 100;

/** Earn: floor(amount_DT × 100). Example: 3.5 DT → 350 pts */
export function dtToPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount * POINTS_PER_DT);
}

/** Redeem: points / 100 → DT. Example: 350 pts → 3.5 DT */
export function pointsToDt(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.round((points / POINTS_PER_DT) * 100) / 100;
}

/** Points needed to fully cover a DT amount */
export function dtToRedeemPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount * POINTS_PER_DT);
}

/** Paliers that spark during score count-up */
export const POINTS_PALIERS = [350, 700, 1000, 2500, 5000, 10000, 20000] as const;

export type TrophyTier = "bronze" | "silver" | "gold";
export type TrophyIcon =
  | "star"
  | "coffee"
  | "calendar"
  | "phone"
  | "medal"
  | "cup";

export type TrophyDef = {
  id: string;
  name: string;
  description: string;
  tier: TrophyTier;
  icon: TrophyIcon;
};

export const TROPHY_CATALOG: TrophyDef[] = [
  {
    id: "first_checkin",
    name: "Premier check-in",
    description: "Première présence enregistrée",
    tier: "gold",
    icon: "star",
  },
  {
    id: "install_pwa",
    name: "App installée",
    description: "Points sauvegardés dans l’app",
    tier: "gold",
    icon: "phone",
  },
  {
    id: "sessions_10",
    name: "Régulier",
    description: "10 sessions de présence",
    tier: "silver",
    icon: "medal",
  },
  {
    id: "points_500",
    name: "Collectionneur",
    description: "Atteindre 500 points (5 DT)",
    tier: "bronze",
    icon: "cup",
  },
  {
    id: "points_2500",
    name: "Explorateur",
    description: "Atteindre 2 500 points (25 DT)",
    tier: "silver",
    icon: "cup",
  },
  {
    id: "points_10000",
    name: "Champion",
    description: "Atteindre 10 000 points (100 DT)",
    tier: "gold",
    icon: "cup",
  },
  {
    id: "cafe_5",
    name: "Habitué café",
    description: "5 commandes café",
    tier: "bronze",
    icon: "coffee",
  },
  {
    id: "checkout_5",
    name: "Fidèle",
    description: "5 check-outs complétés",
    tier: "bronze",
    icon: "calendar",
  },
  {
    id: "profile_complete",
    name: "Profil complet",
    description: "Détails + photo — mission +1000 pts",
    tier: "gold",
    icon: "cup",
  },
];

export type MemberPointsSnapshot = {
  locked: boolean;
  points: number;
  pendingPoints: number;
  displayHint: number;
  nextTrophy: {
    trophyId: string;
    name: string;
    target: number;
    progress: number;
  } | null;
  trophies: Array<
    TrophyDef & { unlocked: boolean; unlockedAt: string | null }
  >;
  stats: { sessions: number; cafeOrders: number; checkouts: number };
};

export type AwardPointsResult = {
  amount: number;
  credited: boolean;
  pending: boolean;
  points: number;
  pendingPoints?: number;
  flash: boolean;
  newTrophies: string[];
  message: string;
};

export type ClaimPointsResult = {
  claimed: number;
  points: number;
  flash: boolean;
  newTrophies: string[];
  message: string;
};
