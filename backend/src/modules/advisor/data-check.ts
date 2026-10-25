/**
 * Data problems that would make advice wrong (e.g. a coffee priced 2 000 DT).
 * Rules only: shown on the page and sent to the AI so it doesn't build on a bad number.
 */
export type DataIssue = {
  key: string;
  /** blocking: advice of the listed categories is paused until fixed */
  severity: 'blocking' | 'warning';
  title: string;
  detail: string;
  fixLabel: string;
  fixHref: string;
  blocks: string[];
};

/** No café / snack item costs this much in a coworking: the price is likely in millimes. */
const SUSPECT_PRODUCT_PRICE = 100;

export function dataIssues(
  m: {
    visits: number;
    unpaidVisits: number;
    medianStayHours: number | null;
    expenses: number;
    revenueCafe: number;
    revenueTotal: number;
    stayDistributionPct: { under2h: number | null };
  },
  products: Array<{ name: string; buy: number; sell: number }>,
): DataIssue[] {
  const out: DataIssue[] = [];
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

  const pricey = products.filter((p) => p.sell >= SUSPECT_PRODUCT_PRICE);
  if (pricey.length) {
    const p = pricey[0];
    const share = m.revenueTotal > 0 ? Math.round((m.revenueCafe / m.revenueTotal) * 100) : null;
    out.push({
      key: 'product-price',
      severity: 'blocking',
      title: `${p.name} vendu ${fmt(p.sell)} DT`,
      detail:
        `Achat ${fmt(p.buy)}, vente ${fmt(p.sell)} : sûrement en millimes.` +
        (share != null && share >= 50 ? ` Le café pèse ${share} % du revenu.` : '') +
        (pricey.length > 1 ? ` ${pricey.length - 1} autre(s) produit(s) aussi.` : ''),
      fixLabel: 'Corriger dans Products',
      fixHref: '/products',
      blocks: ['CAFE'],
    });
  }
  const sellsAtLoss = products.filter((p) => p.buy > 0 && p.sell > 0 && p.sell < p.buy);
  if (sellsAtLoss.length) {
    out.push({
      key: 'product-loss',
      severity: 'warning',
      title: `${sellsAtLoss.length} produit(s) vendu(s) à perte`,
      detail: `${sellsAtLoss.map((p) => p.name).slice(0, 3).join(', ')} : prix de vente sous le prix d'achat.`,
      fixLabel: 'Voir Products',
      fixHref: '/products',
      blocks: [],
    });
  }
  if (m.visits >= 10 && m.medianStayHours != null && m.medianStayHours < 0.5) {
    out.push({
      key: 'checkout',
      severity: 'warning',
      title: 'Sorties non pointées',
      detail: `Durée médiane ${String(m.medianStayHours).replace('.', ',')} h. ${m.stayDistributionPct.under2h ?? 0} % des visites durent moins de 2 h.`,
      fixLabel: 'Voir le Journal',
      fixHref: '/journal',
      blocks: [],
    });
  }
  if (m.visits >= 10 && m.unpaidVisits / m.visits > 0.2) {
    out.push({
      key: 'unpaid',
      severity: 'warning',
      title: `${m.unpaidVisits} visites sur ${m.visits} non payées`,
      detail: 'Le revenu affiché est plus bas que ce que vous avez vraiment vendu.',
      fixLabel: 'Voir les Impayés',
      fixHref: '/impayes',
      blocks: [],
    });
  }
  if (m.expenses === 0) {
    out.push({
      key: 'expenses',
      severity: 'warning',
      title: 'Aucune charge saisie',
      detail: "Sans loyer ni internet, l'app ne peut pas dire si vous gagnez de l'argent.",
      fixLabel: 'Ajouter dans Finance',
      fixHref: '/finance',
      blocks: [],
    });
  }
  return out;
}
