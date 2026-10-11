/** Key stored in `Member.appInstallPromosUsed` for the facility-wide promo. */
export const GLOBAL_APP_PROMO_KEY = 'global';

type PromoUsageMember = {
  appInstallPromoClaimedAt?: Date | null;
  appInstallPromosUsed?: string[] | null;
};

/**
 * Each app-install promo (global + every tarif-linked one) is single-use per member.
 * Members who claimed before per-promo tracking existed have nothing left.
 */
export function appPromoUsage(member: PromoUsageMember) {
  const used = member.appInstallPromosUsed ?? [];
  const exhausted = !!member.appInstallPromoClaimedAt && used.length === 0;
  return {
    used,
    exhausted,
    isUsed: (key: string) => exhausted || used.includes(key),
  };
}
