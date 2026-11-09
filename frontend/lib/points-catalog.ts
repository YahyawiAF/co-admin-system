/** Shared points catalog (mirrors backend). Earn: 1 DT → 50 pts · Redeem: 1000 pts = 1 DT (whole blocks). */

export type PointEvent =
  | "CAFE_ORDER"
  | "INSTALL_PWA"
  | "VISIT_PAID"
  | "PRODUCT_PAID"
  | "ADMIN_ADJUST"
  | "REDEEM_VISIT"
  | "REDEEM_ORDER"
  | "PROFILE_DETAILS"
  | "PROFILE_AVATAR"
  | "REFERRAL";

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

export const POINTS_PER_DT = 1000;

/** Earn rate: 1 DT spent → 50 pts (redeem: 1000 pts = 1 DT) */
export const EARN_POINTS_PER_DT = 50;

/** Earn: floor(amount_DT × 50). Example: 3.5 DT → 175 pts */
export function dtToPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount * EARN_POINTS_PER_DT);
}

/** Points value in DT: points / 1000. Example: 3500 pts → 3.5 DT */
export function pointsToDt(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.round((points / POINTS_PER_DT) * 100) / 100;
}

/** Points needed to fully cover a DT amount */
export function dtToRedeemPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount * POINTS_PER_DT);
}

/**
 * Points usable to pay `dueDt`: whole blocks of 1000 pts (1 DT) only,
 * never more than the balance or the amount due. 1200 pts → 1000 pts.
 */
export function redeemablePoints(balance: number, dueDt: number): number {
  if (!Number.isFinite(balance) || !Number.isFinite(dueDt)) return 0;
  const blocks = Math.floor(Math.min(balance / POINTS_PER_DT, dueDt + 1e-9));
  return Math.max(0, blocks) * POINTS_PER_DT;
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
    description: "Atteindre 500 points (0,5 DT)",
    tier: "bronze",
    icon: "cup",
  },
  {
    id: "points_2500",
    name: "Explorateur",
    description: "Atteindre 2 500 points (2,5 DT)",
    tier: "silver",
    icon: "cup",
  },
  {
    id: "points_10000",
    name: "Champion",
    description: "Atteindre 10 000 points (10 DT)",
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

/** Attendance level computed server-side from session count */
export type MemberLevel = {
  /** Look: l1 / l2 / l3, then « elite » from level 4 */
  id: string;
  /** 1 + sessions paid and closed */
  number: number;
  name: string;
  sessions: number;
  next: { name: string; target: number; progress: number } | null;
};

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
  /** Private — own profile only unless shareAttendance */
  streak: number;
  level: MemberLevel;
  shareAttendance: boolean;
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
