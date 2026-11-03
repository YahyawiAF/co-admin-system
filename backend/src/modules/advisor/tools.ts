/**
 * Conseil IA: the app features a solution uses (promo, event, survey, relance, tarif,
 * product) and the drafts the AI prepares for them. Plain functions, no Prisma.
 * Nothing is ever created from a draft without the owner: a draft only pre-fills a form.
 */

export const TOOL_KINDS = ['PROMOTION', 'EVENT', 'SURVEY', 'CAMPAIGN', 'PRICE', 'PRODUCT'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const AREAS = ['cafe', 'abos', 'creux', 'nouveaux', 'retour', 'impayes'] as const;
export type Area = (typeof AREAS)[number];

/** Client lists a relance can use (the campaign segments, without hand-picked lists). */
export const TOOL_SEGMENTS = ['ABO_EXPIRING', 'ABO_ENDED', 'INACTIVE', 'TOP_UP', 'CONVERT', 'UNPAID', 'RECENT_30', 'ALL'] as const;

/** What the AI writes for one tool ('' / 0 / [] = not set). Same shape for every kind, so the schema stays simple. */
export type RawToolDraft = {
  title: string;
  text: string;
  price: number;
  discountPct: number;
  date: string;
  days: number[];
  fromHour: number;
  toHour: number;
  capacity: number;
  segment: string;
  items: string[];
};

export type RawTool = { kind: string; step: number; label: string; draft: RawToolDraft };

/** A checked draft: the fields the matching form understands. */
export type ToolDraft = {
  kind: ToolKind;
  /** Objective (step index) this tool fulfils; null = not tied to one */
  step: number | null;
  /** Short button text, e.g. « Préparer la promo » */
  label: string;
  draft: Record<string, unknown>;
};

export const TOOL_LABEL: Record<ToolKind, string> = {
  PROMOTION: 'Préparer la promo',
  EVENT: "Préparer l'événement",
  SURVEY: "Préparer l'enquête",
  CAMPAIGN: 'Préparer la relance',
  PRICE: 'Préparer le tarif',
  PRODUCT: 'Préparer le produit',
};

const clampInt = (n: unknown, lo: number, hi: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
};
const text = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDaysKey = (d: Date, n: number) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));

/** A date the AI gave, kept only when it is a real day from today on; else the fallback. */
function futureDay(s: unknown, now: Date, fallbackDays: number) {
  const today = dayKey(now);
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime()) && s >= today) {
    return s;
  }
  return addDaysKey(now, fallbackDays);
}

/**
 * Cleans one tool the AI proposed. Returns null when it can't be used as is
 * (unknown kind, no title, a relance without a message…).
 * products: the catalogue, to keep only product names that exist.
 */
export function sanitizeTool(
  raw: Partial<RawTool> | null | undefined,
  ctx: { steps: number; now: Date; products: Array<{ id: string; name: string }> },
): ToolDraft | null {
  if (!raw || !(TOOL_KINDS as readonly string[]).includes(raw.kind as string)) return null;
  const kind = raw.kind as ToolKind;
  const d = (raw.draft ?? {}) as Partial<RawToolDraft>;
  const step = ctx.steps > 0 ? clampInt(raw.step, 0, ctx.steps - 1) : null;
  const label = text(raw.label, 40) || TOOL_LABEL[kind];
  const title = text(d.title, 120);
  const fromHour = clampInt(d.fromHour, 0, 23);
  const toHour = clampInt(d.toHour, 1, 24);
  const hours = fromHour != null && toHour != null && fromHour !== toHour && (d.fromHour || d.toHour) ? { fromHour, toHour } : {};
  const days = Array.isArray(d.days) ? [...new Set(d.days.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))] : [];

  if (kind === 'PROMOTION') {
    if (!title) return null;
    const pct = clampInt(d.discountPct, 0, 90) ?? 0;
    const price = Number(d.price) > 0 ? Math.round(Number(d.price) * 10) / 10 : 0;
    if (!pct && !price) return null;
    const wanted = (d.items ?? []).map((x) => text(x, 80).toLowerCase()).filter(Boolean);
    const products = ctx.products.filter((p) => wanted.some((w) => p.name.toLowerCase().includes(w) || w.includes(p.name.toLowerCase())));
    const startsAt = futureDay(d.date, ctx.now, 0);
    return {
      kind,
      step,
      label,
      draft: {
        title,
        description: text(d.text, 300),
        // A fixed price is a « formule » (e.g. pass + café 9 DT): kept as a DT amount off
        valueKind: pct ? 'PERCENT' : 'FIXED_DT',
        value: pct || price,
        productIds: products.map((p) => p.id),
        productNames: products.map((p) => p.name),
        daysOfWeek: days.length === 7 ? [] : days,
        ...hours,
        startsAt,
        endsAt: addDaysKey(new Date(`${startsAt}T12:00:00`), 28),
      },
    };
  }
  if (kind === 'EVENT') {
    if (!title) return null;
    const from = fromHour ?? 18;
    return {
      kind,
      step,
      label,
      draft: {
        title,
        description: text(d.text, 600),
        date: futureDay(d.date, ctx.now, 7),
        fromHour: from,
        toHour: toHour && toHour > from ? toHour : Math.min(24, from + 2),
        price: Number(d.price) > 0 ? Math.round(Number(d.price) * 10) / 10 : 0,
        capacity: clampInt(d.capacity, 0, 500) || null,
      },
    };
  }
  if (kind === 'SURVEY') {
    const questions = (d.items ?? []).map((q) => text(q, 160)).filter(Boolean).slice(0, 6);
    if (!title || !questions.length) return null;
    return { kind, step, label, draft: { title, intro: text(d.text, 300), questions } };
  }
  if (kind === 'CAMPAIGN') {
    const message = text(d.text, 1000);
    if (!message) return null;
    const segment = (TOOL_SEGMENTS as readonly string[]).includes(d.segment as string) ? d.segment : 'ALL';
    return { kind, step, label, draft: { title: title || 'Relance', message, segment } };
  }
  if (kind === 'PRICE') {
    const price = Number(d.price);
    if (!title || !(price > 0)) return null;
    return { kind, step, label, draft: { name: title, price: Math.round(price * 10) / 10, description: text(d.text, 300), ...hours } };
  }
  // PRODUCT
  const price = Number(d.price);
  if (!title || !(price > 0)) return null;
  return { kind, step, label, draft: { name: title, price: Math.round(price * 10) / 10 } };
}

/** Tools stored on an initiative (already checked once); unknown rows dropped. */
export function parseTools(raw: unknown): ToolDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is ToolDraft => !!t && (TOOL_KINDS as readonly string[]).includes((t as ToolDraft).kind))
    .map((t) => ({
      kind: t.kind,
      step: typeof t.step === 'number' ? t.step : null,
      label: typeof t.label === 'string' && t.label ? t.label : TOOL_LABEL[t.kind],
      draft: t.draft && typeof t.draft === 'object' ? t.draft : {},
    }))
    .slice(0, 8);
}

// ---------- which health point a solution belongs to ----------

const LEVER_AREA: Record<string, Area> = {
  social: 'nouveaux',
  partner: 'nouveaux',
  events: 'nouveaux',
  referral: 'nouveaux',
  reviews: 'nouveaux',
  app: 'retour',
  newNotBack: 'retour',
  inactive: 'retour',
  renew: 'abos',
  convert: 'abos',
  cafe: 'cafe',
  weakDay: 'creux',
  unpaid: 'impayes',
};

export const leverArea = (leverId?: string | null): Area | null => (leverId && LEVER_AREA[leverId]) || null;

/** The health point a solution or an action works on; null = none (e.g. fixing data). */
export function areaOf(x: {
  area?: string | null;
  leverId?: string | null;
  segment?: string | null;
  objective?: string | null;
  category?: string | null;
  metric?: string | null;
}): Area | null {
  if (x.area && (AREAS as readonly string[]).includes(x.area)) return x.area as Area;
  const byLever = leverArea(x.leverId);
  if (byLever) return byLever;
  if (x.segment === 'UNPAID') return 'impayes';
  if (x.segment && ['ABO_EXPIRING', 'ABO_ENDED', 'CONVERT', 'TOP_UP'].includes(x.segment)) return 'abos';
  if (x.segment === 'INACTIVE') return 'retour';
  if (x.objective === 'SUBSCRIBERS' || x.metric === 'revenueSubscriptions') return 'abos';
  if (x.objective === 'CAFE' || x.metric === 'revenueCafe' || x.metric === 'cafeAttachRatePct') return 'cafe';
  if (x.objective === 'QUIET_HOURS') return 'creux';
  if (x.metric === 'newMembers') return 'nouveaux';
  switch (x.category) {
    case 'CAFE':
      return 'cafe';
    case 'RETENTION':
      return 'retour';
    case 'PRICING':
      return 'abos';
    case 'PROMO':
      return 'creux';
    case 'ACQUISITION':
    case 'NEW_REVENUE':
      return 'nouveaux';
    default:
      return null;
  }
}

// ---------- default tools for the rule ideas (levers) ----------

const relance = (segment: string, message: string, step = 0): ToolDraft => ({
  kind: 'CAMPAIGN',
  step,
  label: TOOL_LABEL.CAMPAIGN,
  draft: { title: 'Relance', segment, message },
});

/** The feature each rule idea naturally uses, pre-filled. */
export function leverTools(leverId: string, ctx: { now: Date; weakDay?: number | null }): ToolDraft[] {
  switch (leverId) {
    case 'renew':
      return [relance('ABO_EXPIRING', 'Bonjour {prenom}, votre abonnement se termine dans quelques jours. Vous pouvez le renouveler à l’accueil ou dans l’app pour garder votre place. À bientôt !')];
    case 'convert':
      return [relance('CONVERT', 'Bonjour {prenom}, vous venez souvent : avec l’abonnement du mois, vous payeriez moins que vos passes. Passez à l’accueil, on vous montre le calcul.', 1)];
    case 'inactive':
      return [relance('INACTIVE', 'Bonjour {prenom}, cela fait un moment ! Votre place vous attend : revenez cette semaine, le café est offert à votre arrivée.', 1)];
    case 'unpaid':
      return [relance('UNPAID', 'Bonjour {prenom}, il reste un petit montant à régler pour votre dernière visite. Vous pourrez le payer à l’accueil lors de votre prochain passage. Merci !', 1)];
    case 'events':
      return [
        {
          kind: 'EVENT',
          step: 0,
          label: TOOL_LABEL.EVENT,
          draft: { title: 'Soirée révision', description: '', date: addDaysKey(ctx.now, 10), fromHour: 18, toHour: 21, price: 5, capacity: 20 },
        },
      ];
    case 'cafe':
      return [
        {
          kind: 'PROMOTION',
          step: 0,
          label: TOOL_LABEL.PROMOTION,
          draft: { title: 'Café à prix doux avec le pass', description: '', valueKind: 'PERCENT', value: 20, productIds: [], productNames: [], daysOfWeek: [], startsAt: dayKey(ctx.now), endsAt: addDaysKey(ctx.now, 28) },
        },
      ];
    case 'weakDay':
      return [
        {
          kind: 'PROMOTION',
          step: 0,
          label: TOOL_LABEL.PROMOTION,
          draft: {
            title: 'Offre du jour calme',
            description: '',
            valueKind: 'PERCENT',
            value: 20,
            productIds: [],
            productNames: [],
            daysOfWeek: ctx.weakDay != null ? [ctx.weakDay] : [],
            startsAt: dayKey(ctx.now),
            endsAt: addDaysKey(ctx.now, 28),
          },
        },
      ];
    case 'partner':
      return [
        {
          kind: 'SURVEY',
          step: 1,
          label: TOOL_LABEL.SURVEY,
          draft: {
            title: 'Où et quand révisez-vous ?',
            intro: 'Deux minutes pour nous aider à préparer la période des examens.',
            questions: ['Vous êtes étudiant, élève ou en activité ?', 'Où révisez-vous en général ?', 'Quels jours et quelles heures vous arrangent ?', 'Quel prix vous semble juste pour une demi-journée ?'],
          },
        },
      ];
    default:
      return [];
  }
}
