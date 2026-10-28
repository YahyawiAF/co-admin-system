/**
 * Funnel of an action (seen → opened → registered → paid → came) and the rule that finds
 * where it broke. Pure functions: the numbers come from the app, the AI only rewords.
 *
 * Key rule: an action whose planned steps were not all done is "not tested" — never "failed".
 */

export type InitiativeStep = { text: string; done: boolean; doneAt?: string | null };

export type FunnelStageKey = 'seen' | 'opened' | 'registered' | 'paid' | 'came' | 'contacted' | 'won';

export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  /** Where the number comes from (Instagram typed, tracked link, app, desk…) */
  source: string;
  /** null = not known yet (not typed, or the event has not happened) */
  value: number | null;
  /** % of the previous known stage */
  rate: number | null;
  /** true = the value can only be known later (event not held yet) */
  pending?: boolean;
};

export type DiagnosisStatus = 'NOT_TESTED' | 'MISSING_DATA' | 'TOO_EARLY' | 'BOTTLENECK' | 'ON_TRACK';

export type Diagnosis = {
  status: DiagnosisStatus;
  /** Stage where it breaks (or the figure to type) */
  stage: FunnelStageKey | null;
  /** The planned step that was not done and blocks the test */
  brokenStep: string | null;
  title: string;
  known: string[];
  unproven: string[];
  next: string;
};

/** Days before an empty stage counts as a real block (people need time to react). */
export const MIN_DAYS_FOR_BOTTLENECK = 3;

const LINK_STEP = /lien|link|inscri|bio|story|partag/i;
const SOCIAL = ['INSTAGRAM_POST', 'INSTAGRAM_STORY'];

export type EventFunnelInput = {
  kind: 'EVENT';
  channels: string[];
  /** Sum of the reach typed from Instagram; null = never typed */
  reach: number | null;
  /** Number of share links made for the action */
  links: number;
  opens: number;
  registered: number;
  /** null = free event (no payment step) */
  paid: number | null;
  price: number | null;
  /** null = event not held yet */
  came: number | null;
};

export type PromoFunnelInput = { kind: 'PROMOTION'; views: number; clicks: number; uses: number };
export type CampaignFunnelInput = { kind: 'CAMPAIGN'; total: number; contacted: number; won: number };
export type FunnelInput = EventFunnelInput | PromoFunnelInput | CampaignFunnelInput;

/** % with one decimal under 10 % (3 opens out of 800 views is 0,4 %, not 0 %). */
const pct = (a: number, b: number | null) => {
  if (!b) return null;
  const r = (a / b) * 100;
  return r < 10 ? Math.round(r * 10) / 10 : Math.round(r);
};

function withRates(stages: Omit<FunnelStage, 'rate'>[]): FunnelStage[] {
  let prev: number | null = null;
  return stages.map((s) => {
    const rate = s.value != null && prev != null ? pct(s.value, prev) : null;
    if (s.value != null) prev = s.value;
    return { ...s, rate };
  });
}

export function buildFunnel(input: FunnelInput | null): FunnelStage[] | null {
  if (!input) return null;
  if (input.kind === 'PROMOTION') {
    return withRates([
      { key: 'seen', label: 'Ont vu la promo', source: 'app', value: input.views },
      { key: 'opened', label: 'Ont cliqué', source: 'app', value: input.clicks },
      { key: 'paid', label: "L'ont utilisée", source: 'caisse', value: input.uses },
    ]);
  }
  if (input.kind === 'CAMPAIGN') {
    return withRates([
      { key: 'contacted', label: 'Contactés', source: `relance, sur ${input.total}`, value: input.contacted },
      { key: 'won', label: 'Sont revenus', source: 'app', value: input.won },
    ]);
  }
  const stages: Omit<FunnelStage, 'rate'>[] = [];
  const social = input.channels.some((c) => SOCIAL.includes(c));
  if (social || input.reach != null) {
    stages.push({ key: 'seen', label: 'Ont vu', source: 'Instagram, saisi', value: input.reach });
  }
  stages.push({
    key: 'opened',
    label: 'Ont ouvert le lien',
    source: input.links ? 'lien suivi' : 'aucun lien créé',
    value: input.opens,
  });
  stages.push({ key: 'registered', label: 'Inscrits', source: 'app', value: input.registered });
  if (input.price != null && input.price > 0) {
    stages.push({ key: 'paid', label: 'Ont payé', source: 'accueil', value: input.paid ?? 0 });
  }
  stages.push({
    key: 'came',
    label: 'Sont venus',
    source: 'pointage',
    value: input.came,
    pending: input.came == null,
  });
  return withRates(stages);
}

const fr = (n: number) => n.toLocaleString('fr-FR');

/** What a block at each stage leaves unproven: what to look at next. */
const UNPROVEN: Record<FunnelStageKey, string[]> = {
  seen: ['Si assez de monde a vu les posts'],
  opened: ["Le message et l'appel à l'action", "L'envie de venir"],
  registered: ['Le prix', 'La date et l’heure', "L'inscription dans l'app"],
  paid: ['Le paiement à l’accueil', "L'engagement des inscrits"],
  came: ['Les rappels', "L'heure choisie"],
  contacted: ['Le message'],
  won: ["L'offre proposée", 'Le moment de la relance'],
};

const NEXT: Record<FunnelStageKey, string> = {
  seen: 'Publie plus ou plus souvent, puis recopie les vues.',
  opened: 'Change le message ou l’appel à l’action, une seule chose.',
  registered: 'Demande à 3 personnes ce qui les retient avant de changer le prix.',
  paid: 'Rappelle le prix et encaisse à l’inscription.',
  came: 'Envoie un rappel la veille.',
  contacted: 'Termine les relances.',
  won: 'Change une seule chose dans l’offre et relance.',
};

function stageLine(s: FunnelStage) {
  if (s.value == null) return null;
  if (s.key === 'seen') return `${fr(s.value)} vues`;
  if (s.key === 'opened') return s.value ? `${fr(s.value)} ouvertures du lien` : '0 ouverture du lien';
  return `${s.label} : ${fr(s.value)}`;
}

/**
 * The first broken stage: a stage at 0 when every later stage is 0 too
 * (registrations straight from the app mean the link stage is not the block).
 */
function firstEmpty(stages: FunnelStage[]) {
  const live = stages.filter((s) => !s.pending);
  for (let i = 0; i < live.length; i++) {
    if (live[i].value === 0 && live.slice(i).every((s) => !s.value)) return live[i];
  }
  return null;
}

export function diagnose(input: {
  steps: InitiativeStep[];
  funnel: FunnelStage[] | null;
  daysSinceStart: number;
  /** Event / offer price in DT, to name it in what is not proven */
  price?: number | null;
}): Diagnosis {
  const { steps, funnel, daysSinceStart } = input;
  const done = steps.filter((s) => s.done);
  const undone = steps.filter((s) => !s.done);
  const known: string[] = [];
  // The checklist shows each step: here a short line only
  if (done.length) {
    known.push(
      done.length <= 2 && undone.length
        ? `Fait : ${done.map((s) => s.text).join(', ')}`
        : `${done.length} étape${done.length > 1 ? 's' : ''} sur ${steps.length} faite${done.length > 1 ? 's' : ''}`,
    );
  }
  for (const s of funnel ?? []) {
    const line = stageLine(s);
    if (line) known.push(line);
  }
  const ideaUnproven = [
    input.price ? `Le prix (${fr(input.price)} DT)` : "L'offre",
    'La date et l’heure',
    'Le format',
  ];

  const empty = funnel ? firstEmpty(funnel) : null;
  // 1. Planned steps not done: the test has not happened yet
  if (undone.length && (empty || !funnel)) {
    const blocking =
      (empty?.key === 'opened' ? undone.find((s) => LINK_STEP.test(s.text)) : null) ?? undone[0];
    return {
      status: 'NOT_TESTED',
      stage: empty?.key ?? null,
      brokenStep: blocking.text,
      title:
        undone.length === 1
          ? `Étape pas faite : ${blocking.text}`
          : `${undone.length} étapes pas faites, dont : ${blocking.text}`,
      known: known.slice(0, 4),
      unproven: ideaUnproven,
      next: `Fais d'abord : ${blocking.text}. Le résultat ne compte qu'après.`,
    };
  }
  // 2. A figure the app cannot know
  const seen = funnel?.find((s) => s.key === 'seen');
  if (seen && seen.value == null) {
    return {
      status: 'MISSING_DATA',
      stage: 'seen',
      brokenStep: null,
      title: 'Vues Instagram non saisies',
      known: known.slice(0, 4),
      unproven: UNPROVEN.seen,
      next: 'Recopie les vues depuis Instagram › Statistiques.',
    };
  }
  // 3. Too soon to call an empty stage a block
  if (daysSinceStart < MIN_DAYS_FOR_BOTTLENECK) {
    return {
      status: 'TOO_EARLY',
      stage: null,
      brokenStep: null,
      title: 'Trop tôt pour juger',
      known: known.slice(0, 4),
      unproven: ideaUnproven,
      next: `Regarde à nouveau dans ${MIN_DAYS_FOR_BOTTLENECK - daysSinceStart} jour(s).`,
    };
  }
  // 4. All steps done, a stage stays at 0
  if (empty) {
    const prev = funnel![funnel!.indexOf(empty) - 1];
    const noLink = empty.key === 'opened' && empty.source === 'aucun lien créé';
    return {
      status: 'BOTTLENECK',
      stage: empty.key,
      brokenStep: noLink ? 'Créer et partager un lien suivi' : null,
      title: prev?.value
        ? `${fr(prev.value)} → 0 à l'étape « ${empty.label} »`
        : `Bloqué à l'étape « ${empty.label} »`,
      known: known.slice(0, 4),
      unproven: UNPROVEN[empty.key],
      next: noLink ? 'Crée un lien de partage et mets-le en story et en bio.' : NEXT[empty.key],
    };
  }
  // 5. Every stage moves: name the weakest one to watch
  const measured = (funnel ?? []).filter((s) => s.rate != null);
  const weakest = measured.length ? measured.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
  const last = [...(funnel ?? [])].reverse().find((s) => s.value != null);
  return {
    status: 'ON_TRACK',
    stage: weakest?.key ?? null,
    brokenStep: null,
    title: last ? stageLine(last)! : 'Toutes les étapes sont faites',
    known: known.slice(0, 4),
    unproven: funnel?.some((s) => s.pending) ? ['Combien viendront vraiment'] : weakest ? UNPROVEN[weakest.key] : [],
    next: weakest ? `Point faible : ${weakest.label.toLowerCase()} (${fr(weakest.rate!)} %). ${NEXT[weakest.key]}` : 'Continue et note ce qui se passe.',
  };
}

/** Steps as stored (JSON) → clean list. */
export function parseSteps(raw: unknown): InitiativeStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s.text === 'string' && s.text.trim())
    .map((s) => ({
      text: String(s.text).trim().slice(0, 200),
      done: !!s.done,
      doneAt: typeof s.doneAt === 'string' ? s.doneAt.slice(0, 10) : null,
    }));
}

/** Reach typed from Instagram (JSON) → clean list. */
export function parseManualFunnel(raw: unknown) {
  if (!Array.isArray(raw)) return [] as Array<{ date: string; channel: string | null; reach: number }>;
  return raw
    .filter((r) => r && Number.isFinite(Number(r.reach)) && Number(r.reach) >= 0)
    .map((r) => ({
      date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      channel: typeof r.channel === 'string' ? r.channel : null,
      reach: Math.round(Number(r.reach)),
    }));
}
