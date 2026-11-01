import { ADVICE_METRICS, RECOMMENDATION_CATEGORIES, type AdvisorRecommendation, type AdvisorResult } from './advisor-claude';

/** A missing lever as sent to the AI (from the lever map). */
export type MissingLever = {
  leverId: string;
  title: string;
  why: string;
  steps: string[];
  estimatedGainPerMonth: number;
  plan: Record<string, unknown>;
};

export type DismissedIdea = { title: string; leverId?: string | null };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Same idea when the normalized titles match, or one contains the other (long enough). */
export function sameIdea(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 12 && long.includes(short);
}

function fromLever(m: MissingLever): AdvisorRecommendation {
  const p = m.plan as {
    category?: string;
    metric?: string;
    targetPct?: number;
    targetKind?: string;
    targetDays?: number[];
  };
  const category = (RECOMMENDATION_CATEGORIES as readonly string[]).includes(p.category ?? '')
    ? (p.category as AdvisorRecommendation['category'])
    : 'NEW_REVENUE';
  const metric = (ADVICE_METRICS as readonly string[]).includes(p.metric ?? '')
    ? (p.metric as AdvisorRecommendation['metric'])
    : undefined;
  return {
    category,
    priority: m.estimatedGainPerMonth >= 300 ? 'high' : 'medium',
    effort: 'medium',
    title: m.title,
    evidence: m.why,
    actions: m.steps,
    expectedImpact: m.estimatedGainPerMonth > 0 ? `+${Math.round(m.estimatedGainPerMonth)} DT/mois (estimation)` : 'À mesurer',
    measure: 'suivi dans « En cours »',
    metric,
    targetPct: typeof p.targetPct === 'number' ? p.targetPct : undefined,
    target:
      p.targetKind === 'SLOT' && Array.isArray(p.targetDays)
        ? { kind: 'SLOT', days: p.targetDays, fromHour: 0, toHour: 0 }
        : { kind: 'ALL', days: [], fromHour: 0, toHour: 0 },
    outreach: { segment: 'NONE', message: '' },
    leverId: m.leverId,
    source: 'rules',
  };
}

/**
 * Guarantee of the advice list: an idea the owner dismissed never comes back,
 * and every strong lever without an action gets at least one idea — the AI's
 * when it wrote one (leverId), else the rule-based one.
 */
export function ensureCoverage(
  result: AdvisorResult,
  ctx: { missing?: MissingLever[] | null; dismissed?: DismissedIdea[] | null },
): AdvisorResult {
  const dismissed = ctx.dismissed ?? [];
  const isDismissed = (title: string, leverId?: string | null) =>
    dismissed.some((d) => (leverId && d.leverId === leverId) || sameIdea(d.title, title));

  const recs: AdvisorRecommendation[] = result.recommendations
    .filter((r) => !isDismissed(r.title, r.leverId))
    .map((r) => ({ ...r, source: r.source ?? 'ai' }));
  const covered = new Set(recs.map((r) => r.leverId).filter(Boolean));
  for (const m of ctx.missing ?? []) {
    if (covered.has(m.leverId) || isDismissed(m.title, m.leverId)) continue;
    if (recs.some((r) => sameIdea(r.title, m.title))) continue;
    recs.push(fromLever(m));
  }
  return { ...result, recommendations: recs };
}
