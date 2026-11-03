import type { ActionRecord, LeverDef } from '../../business-manager-core';

/** What the app knows about the last 30 days (or as stated), for the lever rules. */
export type CoworkingFacts = {
  visits30: number;
  ticket: number;
  /** Members whose first visit was in the last 30 days */
  new30: number;
  /** Average visit days of a newcomer (those who had at least 30 days) */
  visitsPerNewcomer: number;
  /** % of newcomers (judged, last 60 days) back within 14 days */
  returnRatePct: number | null;
  /** Return rate with / without the app installed */
  returnWithAppPct: number | null;
  returnWithoutAppPct: number | null;
  installDay1Pct: number | null;
  /** Newcomers with a known profile, and the share of students + pupils */
  profileKnown: number;
  studentSharePct: number | null;
  heardFrom: Record<string, number>;
  /** Relance list sizes now */
  lists: Record<string, number>;
  /** Abonnements ending this month (latest per member) */
  aboEndingCount: number;
  aboEndingValue: number;
  renewalRatePct: number | null;
  /** Renewals that really happened in the last 30 days (any offer, logged relance or not) */
  renewals30: number;
  /** …of which with another offer than the previous abonnement */
  renewalsOtherOffer30: number;
  /** Renewal rate of this month so far beats last month's */
  renewalImproving: boolean;
  avgAboPrice: number;
  events60: number;
  paidEvents60: number;
  nextEvent: { title: string; date: string } | null;
  referralPoints: number;
  referrals60: number;
  googleReviewUrl: boolean;
  reviewClicks60: number;
  cafeOrders30: number;
  cafeRevenue30: number;
  /** Average day (visits + café) per weekday, 0 = Sunday */
  weekdayRevenue: number[];
};

const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DT`;
const has = (re: RegExp) => (a: ActionRecord) => re.test(a.title);
const clamp = (n: number) => Math.max(0, n);

/** The ways a coworking space grows, judged on its own numbers. */
export function coworkingLevers(f: CoworkingFacts): LeverDef[] {
  const newShare = f.visits30 > 0 ? Math.round((f.new30 / f.visits30) * 100) : 0;
  // Money brought by one more newcomer over a month
  const newcomerValue = f.ticket * Math.max(1, Math.min(6, f.visitsPerNewcomer));
  const insta = f.heardFrom.INSTAGRAM ?? 0;
  const school = f.heardFrom.SCHOOL ?? 0;
  const out: LeverDef[] = [];

  // ---------- Attirer ----------
  out.push({
    id: 'social',
    group: 'ATTRACT',
    title: 'Publications régulières',
    signal: `${f.new30} nouveaux en 30 j, soit ${newShare} % des visites${insta ? ` · ${insta} disent venir d'Instagram` : ''}.`,
    strength: newShare >= 25 ? 0.8 : newShare >= 15 ? 0.6 : 0.4,
    gain: f.new30 * 0.15 * newcomerValue,
    matchesAction: (a) =>
      a.channels.some((c) => c.startsWith('INSTAGRAM')) || /insta|réseau|reseau|post|story|reel|facebook|tiktok|publication/i.test(a.title),
    idea: {
      title: 'Publier 3 fois par semaine, toujours avec l’offre 1ʳᵉ visite',
      why: `Les nouveaux font ${newShare} % des visites (${f.new30} en 30 jours) et aucune action pour en attirer n'est en cours.`,
      steps: ['3 jours fixes (ex. lundi, mercredi, vendredi)', 'Montrer la salle, les horaires et le prix d’1 h', 'Suivre les nouveaux par semaine, contre le prévu'],
      plan: {
        title: 'Publier 3 fois par semaine avec l’offre 1ʳᵉ visite',
        category: 'ACQUISITION',
        objective: 'TICKETS',
        channels: ['INSTAGRAM_POST', 'INSTAGRAM_STORY'],
        metric: 'newMembers',
        targetPct: 15,
      },
    },
  });

  const students = f.studentSharePct ?? 0;
  out.push({
    id: 'partner',
    group: 'ATTRACT',
    title: 'Partenariat fac / lycées',
    signal:
      f.profileKnown >= 10
        ? `${students} % des nouveaux sont étudiants ou élèves${school ? ` · ${school} viennent par la fac` : ''}.`
        : 'Profil des nouveaux encore peu renseigné.',
    strength: f.profileKnown >= 10 ? (students >= 50 ? 0.8 : students >= 30 ? 0.6 : 0.3) : 0.5,
    gain: f.new30 * 0.2 * newcomerValue,
    matchesAction: (a) => a.channels.includes('PARTNER') || /fac|lyc|école|ecole|univ|partenai|étudiant|etudiant/i.test(a.title),
    idea: {
      title: 'Partenariat avec la fac et les lycées voisins avant les examens',
      why: `${f.profileKnown >= 10 ? `${students} % de tes nouveaux sont étudiants ou élèves. ` : ''}Les examens arrivent : c'est le moment où ils cherchent une place pour réviser.`,
      steps: ['Affiche + QR à la fac / au lycée : « 1ʳᵉ visite 2 h au prix d’1 h »', 'Tarif groupe de révision (3 personnes et +)', 'Mesurer les nouveaux qui répondent « Fac / école »'],
      plan: {
        title: 'Partenariat fac / lycées avant les examens',
        category: 'ACQUISITION',
        objective: 'TICKETS',
        channels: ['PARTNER'],
        metric: 'newMembers',
        targetPct: 20,
      },
    },
  });

  out.push({
    id: 'events',
    group: 'ATTRACT',
    title: 'Événements',
    signal: f.events60
      ? `${f.events60} événement${f.events60 > 1 ? 's' : ''} en 60 j, ${f.paidEvents60} payant${f.paidEvents60 > 1 ? 's' : ''}.`
      : 'Aucun événement en 60 jours.',
    strength: f.events60 === 0 ? 0.6 : f.paidEvents60 === 0 ? 0.5 : 0.3,
    gain: 2 * 12 * 5 + f.new30 * 0.05 * newcomerValue,
    matchesAction: (a) => a.linkedKind === 'EVENT' || /événement|evenement|atelier|soirée|soiree|tournoi|meetup/i.test(a.title),
    builtIn: f.nextEvent ? `prévu : ${f.nextEvent.title} (${f.nextEvent.date})` : undefined,
    idea: {
      title: f.events60 ? 'Passer un événement en payant (5 DT)' : 'Organiser un événement par mois',
      why: f.events60
        ? `${f.events60} événement${f.events60 > 1 ? 's' : ''} en 60 jours, aucun payant : ils amènent des visages, pas encore de l'argent.`
        : 'Aucun événement en 60 jours : c’est le moyen le plus simple d’amener des gens qui ne te connaissent pas.',
      steps: ['Choisir un format (révision, échecs, atelier)', 'Place à 5 DT avec 1 h offerte après', 'Mesurer inscrits → payés → venus'],
      plan: { title: 'Un événement payant par mois', category: 'NEW_REVENUE', objective: 'TICKETS', metric: 'newMembers' },
    },
  });

  if (f.referralPoints > 0) {
    out.push({
      id: 'referral',
      group: 'ATTRACT',
      title: 'Parrainage',
      signal: `${f.referrals60} parrainage${f.referrals60 > 1 ? 's' : ''} en 60 j (${f.referralPoints} points offerts).`,
      strength: f.referrals60 < 3 ? 0.5 : 0.2,
      gain: f.new30 * 0.1 * newcomerValue,
      builtIn: f.referrals60 >= 3 ? `${f.referrals60} parrainages en 60 j` : undefined,
      matchesAction: has(/parrain/i),
      idea: {
        title: 'Rappeler le parrainage au moment de payer',
        why: `Le parrainage est réglé (${f.referralPoints} points) mais seulement ${f.referrals60} en 60 jours : les membres ne le connaissent pas.`,
        steps: ['Phrase à la caisse : « ton ami vient, vous gagnez tous les deux »', 'Carte avec le code du membre', 'Suivre les parrainages par semaine'],
        plan: { title: 'Rappeler le parrainage à la caisse', category: 'ACQUISITION', objective: 'TICKETS', channels: ['WALK_IN'], metric: 'newMembers' },
      },
    });
  }

  out.push({
    id: 'reviews',
    group: 'ATTRACT',
    title: 'Avis Google',
    signal: f.googleReviewUrl ? `${f.reviewClicks60} clic${f.reviewClicks60 > 1 ? 's' : ''} vers l'avis en 60 j.` : "Lien d'avis Google pas réglé.",
    strength: f.googleReviewUrl ? 0.2 : 0.5,
    gain: f.new30 * 0.05 * newcomerValue,
    builtIn: f.googleReviewUrl ? 'demande automatique dans l’app' : undefined,
    matchesAction: has(/avis|google/i),
    idea: {
      title: "Régler le lien d'avis Google",
      why: "Les gens qui cherchent « coworking » sur Google choisissent l'endroit qui a des avis. L'app peut les demander toute seule.",
      steps: ['Google Business Profile → « Demander des avis » → copier le lien', 'Le coller dans Finance → Réglages', "L'app le propose après quelques visites"],
      plan: { title: "Régler le lien d'avis Google", category: 'ACQUISITION', objective: 'OTHER' },
    },
  });

  // ---------- Faire revenir ----------
  const appGap =
    f.returnWithAppPct != null && f.returnWithoutAppPct != null ? f.returnWithAppPct - f.returnWithoutAppPct : null;
  out.push({
    id: 'app',
    group: 'RETURN',
    title: "L'app dès la 1ʳᵉ visite",
    signal:
      appGap != null
        ? `${f.returnWithAppPct} % reviennent avec l'app, ${f.returnWithoutAppPct} % sans. ${f.installDay1Pct ?? 0} % l'installent le 1ᵉʳ jour.`
        : "Pas encore assez de nouveaux pour comparer avec / sans l'app.",
    strength: appGap != null && appGap >= 15 && (f.installDay1Pct ?? 0) < 50 ? 0.7 : 0.3,
    gain: f.new30 * 0.15 * (appGap ?? 0) / 100 * newcomerValue * 3,
    matchesAction: has(/\bapp\b|install/i),
    idea: {
      title: "Faire installer l'app à l'accueil, dès la 1ʳᵉ visite",
      why: `Avec l'app, ${f.returnWithAppPct} % reviennent, contre ${f.returnWithoutAppPct} % sans. Seulement ${f.installDay1Pct ?? 0} % l'installent le 1ᵉʳ jour.`,
      steps: ["QR « installe l'app » posé à l'accueil", "Le proposer au moment du check-in, avec le cadeau d'installation", 'Objectif : 1 nouveau sur 2 le 1ᵉʳ jour'],
      plan: { title: "Faire installer l'app dès la 1ʳᵉ visite", category: 'RETENTION', objective: 'OTHER', channels: ['WALK_IN', 'APP'], metric: 'visitsPerDay' },
    },
  });

  const notBack = f.lists.NEW_NOT_BACK ?? 0;
  out.push({
    id: 'newNotBack',
    group: 'RETURN',
    title: 'Relancer les nouveaux pas revenus',
    signal: `${f.returnRatePct ?? '—'} % reviennent en 14 j · ${notBack} à relancer.`,
    strength: notBack >= 5 && (f.returnRatePct ?? 100) < 50 ? 0.7 : 0.3,
    gain: notBack * 0.2 * newcomerValue,
    outreachReasons: ['NEW_NOT_BACK'],
    matchesAction: has(/pas revenu|2e visite|2ᵉ visite|seconde visite|revenir/i),
    idea: {
      title: 'Offrir la 2ᵉ visite aux nouveaux pas revenus',
      why: `Seulement ${f.returnRatePct ?? '—'} % des nouveaux reviennent en 14 jours. ${notBack} sont dans la liste à relancer.`,
      steps: ['Relances → « Nouveaux pas revenus »', 'Message : 1 h offerte valable 14 jours', 'Mesurer combien reviennent'],
      plan: { title: 'Relancer les nouveaux pas revenus', category: 'RETENTION', objective: 'TICKETS', channels: ['WHATSAPP'], metric: 'visitsPerDay' },
    },
  });

  const away = (f.lists.INACTIVE ?? 0) + (f.lists.RECALL ?? 0);
  out.push({
    id: 'inactive',
    group: 'RETURN',
    title: 'Habitués absents',
    signal: `${away} habitué${away > 1 ? 's' : ''} absent${away > 1 ? 's' : ''} ou à rappeler.`,
    strength: away >= 5 ? 0.6 : 0.2,
    gain: away * 0.25 * f.ticket * 4,
    outreachReasons: ['INACTIVE', 'RECALL'],
    matchesAction: has(/habitué|habitue|absent|rappel/i),
    idea: {
      title: 'Rappeler les habitués absents avec une raison de revenir',
      why: `${away} habitués ne viennent plus. Un message personnel avec une offre précise en fait revenir une partie.`,
      steps: ['Relances → « Habitués absents »', 'Demander pourquoi (1 clic) et proposer une place', 'Rappeler ceux qui révisent chez eux à la période d’examens'],
      plan: { title: 'Rappeler les habitués absents', category: 'RETENTION', objective: 'TICKETS', channels: ['WHATSAPP'], metric: 'visitsPerDay' },
    },
  });

  // ---------- Faire payer plus ----------
  const renew = f.renewalRatePct;
  out.push({
    id: 'renew',
    group: 'SPEND',
    title: 'Renouveler les abonnements',
    signal: `${f.aboEndingCount} finissent ce mois (${dt(f.aboEndingValue)})${renew != null ? ` · ${renew} % renouvelés le mois dernier` : ''}.`,
    strength: f.aboEndingCount >= 2 && (renew == null || renew < 60) ? 0.8 : 0.3,
    gain: clamp(f.aboEndingValue * (0.6 - (renew ?? 40) / 100)),
    outreachReasons: ['ABO_EXPIRING', 'ABO_ENDED'],
    // Renewals done at the desk count even with no relance logged, whatever the offer
    observed: {
      count: f.renewals30,
      improving: f.renewalImproving,
      note: `${f.renewals30} renouvelé${f.renewals30 > 1 ? 's' : ''} en 30 j${
        f.renewalsOtherOffer30 ? ` · ${f.renewalsOtherOffer30} avec une autre offre` : ''
      }`,
    },
    matchesAction: (a) => a.objective === 'SUBSCRIBERS' || /renouvel|abonnement/i.test(a.title),
    idea: {
      title: 'Relancer chaque abonnement 3 jours avant la fin',
      why: `${f.aboEndingCount} abonnements finissent ce mois (${dt(f.aboEndingValue)}).${renew != null ? ` Le mois dernier, ${renew} % ont été renouvelés.` : ''}`,
      steps: ['Relances → « Abonnement qui finit », chaque matin', 'Message prêt avec le prix du renouvellement', 'Mesurer le taux de renouvellement contre le mois dernier'],
      plan: { title: 'Relancer les abonnements 3 jours avant la fin', category: 'RETENTION', objective: 'SUBSCRIBERS', channels: ['WHATSAPP'], metric: 'revenueSubscriptions' },
    },
  });

  const convert = (f.lists.CONVERT ?? 0) + (f.lists.TOP_UP ?? 0);
  out.push({
    id: 'convert',
    group: 'SPEND',
    title: 'Passer les réguliers en abonnement',
    signal: `${convert} client${convert > 1 ? 's' : ''} paient en passes au rythme d'un abonnement.`,
    strength: convert >= 3 ? 0.6 : 0.2,
    gain: convert * 0.3 * f.avgAboPrice * 0.3,
    outreachReasons: ['CONVERT', 'TOP_UP'],
    matchesAction: has(/convert|passer en abonnement|pack/i),
    idea: {
      title: "Proposer l'abonnement aux clients qui paient déjà autant en passes",
      why: `${convert} clients paient en passes à peu près le prix d'un abonnement : ils gagnent à passer en abonnement, toi tu sécurises le mois.`,
      steps: ['Relances → « À convertir »', 'Montrer le calcul : ce qu’ils ont payé contre le prix de l’abonnement', 'Mesurer les abonnements vendus'],
      plan: { title: "Proposer l'abonnement aux clients réguliers en passes", category: 'PRICING', objective: 'SUBSCRIBERS', channels: ['WHATSAPP', 'WALK_IN'], metric: 'revenueSubscriptions' },
    },
  });

  const attach = f.visits30 > 0 ? Math.round((f.cafeOrders30 / f.visits30) * 100) : 0;
  const avgCafe = f.cafeOrders30 > 0 ? f.cafeRevenue30 / f.cafeOrders30 : 2;
  out.push({
    id: 'cafe',
    group: 'SPEND',
    title: 'Café et snacks',
    signal: `${f.cafeOrders30} ventes pour ${f.visits30} visites (${attach} %).`,
    noData:
      f.visits30 >= 100 && attach < 5
        ? `${f.cafeOrders30} ventes notées pour ${f.visits30} visites : les ventes sont-elles toutes saisies ?`
        : undefined,
    strength: attach < 20 ? 0.6 : 0.3,
    gain: f.visits30 * 0.1 * avgCafe,
    matchesAction: (a) => a.category === 'CAFE' || /café|cafe|snack|boisson/i.test(a.title),
    idea: {
      title: 'Proposer le café au check-in',
      why: `Seulement ${attach} % des visites prennent quelque chose.`,
      steps: ['Formule « 2 h + café » au check-in', 'Afficher les prix à la caisse', 'Mesurer le % de visites avec café'],
      plan: { title: 'Proposer le café au check-in', category: 'CAFE', objective: 'CAFE', channels: ['WALK_IN'], metric: 'cafeAttachRatePct', targetPct: 5 },
    },
  });

  // ---------- Remplir les creux ----------
  const days = f.weekdayRevenue.map((v, wd) => ({ wd, v })).filter((d) => d.v > 0);
  if (days.length >= 5) {
    const worst = days.reduce((a, b) => (b.v < a.v ? b : a));
    const best = days.reduce((a, b) => (b.v > a.v ? b : a));
    const ratio = best.v > 0 ? worst.v / best.v : 1;
    const others = days.filter((d) => d.wd !== worst.wd);
    const avgOthers = others.reduce((a, d) => a + d.v, 0) / Math.max(1, others.length);
    out.push({
      id: 'weakDay',
      group: 'FILL',
      title: `Le ${WD[worst.wd]}`,
      signal: `${dt(worst.v)} par ${WD[worst.wd]} contre ${dt(best.v)} le ${WD[best.wd]}.`,
      strength: ratio < 0.5 ? 0.7 : ratio < 0.7 ? 0.5 : 0.2,
      gain: clamp(avgOthers - worst.v) * 0.3 * 4.3,
      matchesAction: (a) => (a.targetDays ?? []).includes(worst.wd) || new RegExp(WD[worst.wd], 'i').test(a.title),
      idea: {
        title: `Une offre ou un atelier le ${WD[worst.wd]}`,
        why: `Le ${WD[worst.wd]} rapporte ${dt(worst.v)} contre ${dt(best.v)} le ${WD[best.wd]} : c'est le jour où une offre coûte le moins.`,
        steps: [`Choisir l'offre (−20 % ou un atelier le ${WD[worst.wd]})`, 'Annonce la veille aux membres', `Mesurer les ${WD[worst.wd]}s contre les autres jours`],
        plan: {
          title: `Remplir le ${WD[worst.wd]}`,
          category: 'PROMO',
          objective: 'QUIET_HOURS',
          targetKind: 'SLOT',
          targetDays: [worst.wd],
          metric: 'revenuePerDay',
          targetPct: 20,
        },
      },
    });
  }

  return out;
}
