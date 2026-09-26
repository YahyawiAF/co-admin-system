import { PointEvent } from '@prisma/client';

/** 100 pts = 1 DT (earn & redeem). Example: 3.5 DT → 350 pts */
export const POINTS_PER_DT = 100;

/** Convert paid amount (DT) → points earned */
export function dtToPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount * POINTS_PER_DT);
}

/** Convert points → DT value for payment */
export function pointsToDt(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.round((points / POINTS_PER_DT) * 100) / 100;
}

/** DT due → points needed to fully cover */
export function dtToRedeemPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount * POINTS_PER_DT);
}

/** Score paliers for spark animations (crossing during count-up) */
export const POINTS_PALIERS = [350, 700, 1000, 2500, 5000, 10000, 20000] as const;

/** Legacy fixed amounts (INSTALL / profile mission; visit/product use dtToPoints) */
export const POINT_AMOUNTS: Partial<Record<PointEvent, number>> = {
  CHECK_IN: 0,
  CHECK_OUT: 0,
  CAFE_ORDER: 0,
  INSTALL_PWA: 100,
  PROFILE_DETAILS: 800,
  PROFILE_AVATAR: 200,
};

/** Profile mission: details + photo = 1000 pts gold trophy */
export const PROFILE_DETAILS_POINTS = 800;
export const PROFILE_AVATAR_POINTS = 200;
export const PROFILE_MISSION_TOTAL =
  PROFILE_DETAILS_POINTS + PROFILE_AVATAR_POINTS;

export type TrophyDef = {
  id: string;
  name: string;
  description: string;
  /** bronze | silver | gold */
  tier: 'bronze' | 'silver' | 'gold';
  icon: 'star' | 'coffee' | 'calendar' | 'phone' | 'medal' | 'cup';
};

export const TROPHY_CATALOG: TrophyDef[] = [
  {
    id: 'first_checkin',
    name: 'Premier check-in',
    description: 'Première présence enregistrée',
    tier: 'gold',
    icon: 'star',
  },
  {
    id: 'install_pwa',
    name: 'App installée',
    description: 'Points sauvegardés dans l’app',
    tier: 'gold',
    icon: 'phone',
  },
  {
    id: 'sessions_10',
    name: 'Régulier',
    description: '10 sessions de présence',
    tier: 'silver',
    icon: 'medal',
  },
  {
    id: 'points_500',
    name: 'Collectionneur',
    description: 'Atteindre 500 points (5 DT)',
    tier: 'bronze',
    icon: 'cup',
  },
  {
    id: 'points_2500',
    name: 'Explorateur',
    description: 'Atteindre 2 500 points (25 DT)',
    tier: 'silver',
    icon: 'cup',
  },
  {
    id: 'points_10000',
    name: 'Champion',
    description: 'Atteindre 10 000 points (100 DT)',
    tier: 'gold',
    icon: 'cup',
  },
  {
    id: 'cafe_5',
    name: 'Habitué café',
    description: '5 commandes café',
    tier: 'bronze',
    icon: 'coffee',
  },
  {
    id: 'checkout_5',
    name: 'Fidèle',
    description: '5 check-outs complétés',
    tier: 'bronze',
    icon: 'calendar',
  },
  {
    id: 'profile_complete',
    name: 'Profil complet',
    description: 'Détails + photo — mission +1000 pts',
    tier: 'gold',
    icon: 'cup',
  },
];

export function nextTrophyThreshold(points: number): {
  trophyId: string;
  name: string;
  target: number;
  progress: number;
} | null {
  const steps = [
    { trophyId: 'points_500', name: 'Collectionneur', target: 500 },
    { trophyId: 'points_2500', name: 'Explorateur', target: 2500 },
    { trophyId: 'points_10000', name: 'Champion', target: 10000 },
  ];
  for (const s of steps) {
    if (points < s.target) {
      return {
        ...s,
        progress: Math.min(100, Math.round((points / s.target) * 100)),
      };
    }
  }
  return null;
}
