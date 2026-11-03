/**
 * Conseil IA « bilan »: six points of the business, each with one number, a colour,
 * the problem in one sentence and 1–3 solutions. Rules compute every number;
 * the AI only writes solutions (checked, never trusted for figures). Plain functions.
 */
import type { CoworkingFacts } from '../analytics/levers-coworking';
import type { LeverDef } from '../../business-manager-core';
import { type Area, AREAS, areaOf, leverTools, parseTools, type ToolDraft } from './tools';

export type HealthStatus = 'red' | 'orange' | 'green' | 'grey';
export const STATUS_LABEL: Record<HealthStatus, string> = {
  red: 'À régler',
  orange: 'À surveiller',
  green: 'Ça va',
  grey: 'Pas assez de données',
};

export const AREA_NAME: Record<Area, string> = {
  cafe: 'Café',
  abos: 'Abonnements',
  creux: 'Jours creux',
  nouveaux: 'Nouveaux clients',
  retour: 'Clients qui reviennent',
  impayes: 'Impayés',
};

/** At most this many solutions in progress at once, to stay focused. */
export const MAX_RUNNING = 3;

export type Solution = {
  key: string;
  source: 'ai' | 'rules';
  area: Area;
  title: string;
  why: string;
  /** Estimated DT per month if it works */
  gain: number;
  cost: number;
  effort: 'low' | 'medium' | 'high';
  steps: string[];
  /** Goal over 4 weeks, in DT */
  goalAmount: number;
  tools: ToolDraft[];
  target: { kind: 'ALL' | 'SLOT' | 'LIST'; days: number[]; fromHour: number | null; toHour: number | null } | null;
  segment: string | null;
  metric: string | null;
  category: string;
  objective: string | null;
  channels: string[];
  leverId: string | null;
  reportId: string | null;
};

export type HealthInitiative = {
  id: string;
  title: string;
  area: string | null;
  leverId: string | null;
  category: string | null;
  objective: string | null;
  metric: string | null;
  segment: string | null;
  recommendationTitle: string | null;
  startDate: string;
  endDate: string | null;
  finished: boolean;
  dropped: boolean;
  gain: number | null;
  netGain: number | null;
  goalAmount: number | null;
  verdict: string | null;
  status: string | null;
};

export type AiRecommendation = {
  category: string;
  effort?: string;
  title: string;
  evidence?: string;
  actions?: string[];
  expectedImpact?: string;
  metric?: string;
  target?: { kind: 'ALL' | 'SLOT' | 'LIST'; days: number[]; fromHour: number; toHour: number };
  outreach?: { segment: string; message: string };
  leverId?: string;
  source?: 'ai' | 'rules';
  area?: string;
  gainAmount?: number;
  cost?: number;
  goalAmount?: number;
  tools?: unknown;
};

export type HealthInput = {
  now: Date;
  facts: CoworkingFacts;
  /** Lever rules (ideas) and their status (IN_PROGRESS / WORKING … by id) */
  defs: LeverDef[];
  leverStatus: Record<string, string>;
  /** What the lever map says is already done on each lever (relances, renewals at the desk…) */
  leverNotes?: Record<string, { title: string; note: string | null }>;
  /** Oldest → newest, 8 weeks */
  weekly: {
    cafeAttachPct: Array<number | null>;
    aboSold: number[];
    weakDayRevenue: number[];
    newcomers: number[];
    returnPct: Array<number | null>;
    unpaidVisits: number[];
  };
  cafe: { visits28: number; withCafe28: number; avgCafe: number };
  newcomers: { last28: number; prev28: number };
  unpaid: { total: number; clients: number; oldestDays: number | null };
  report: { id: string; recommendations: AiRecommendation[] } | null;
  dismissed: Array<{ leverId: string | null; title: string }>;
  initiatives: HealthInitiative[];
};

const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DT`;
const round10 = (n: number) => Math.max(0, Math.round(n / 10) * 10);
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** « +120 DT/mois : 4 clients × 30 DT » → 120 (first amount in DT). */
export function gainFromText(s?: string) {
  const m = (s ?? '').replace(/\s/g, ' ').match(/([+-]?\d[\d  .,]*)\s*DT/i);
  if (!m) return 0;
  const n = Number(m[1].replace(/[  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Goal for 4 weeks from a monthly gain: rounded, never below 50 DT. */
export const defaultGoal = (gain: number) => Math.max(50, round10(gain));

/** AI recommendation → solution (numbers and tools already checked by the service). */
export function solutionFromAi(r: AiRecommendation, i: number, reportId: string): Solution | null {
  const area = areaOf({ area: r.area, leverId: r.leverId, segment: r.outreach?.segment, category: r.category, metric: r.metric });
  if (!area) return null;
  const gain = typeof r.gainAmount === 'number' && r.gainAmount > 0 ? Math.round(r.gainAmount) : gainFromText(r.expectedImpact);
  const tools = parseTools(r.tools);
  // A rule idea copied in the report: the lever's ready tools
  if (!tools.length && r.source === 'rules' && r.leverId) tools.push(...leverTools(r.leverId, { now: new Date() }));
  // An old report: the relance message becomes a tool
  if (!tools.length && r.outreach && r.outreach.segment !== 'NONE' && r.outreach.message) {
    tools.push({ kind: 'CAMPAIGN', step: 0, label: 'Préparer la relance', draft: { title: r.title, segment: r.outreach.segment, message: r.outreach.message } });
  }
  return {
    key: `ai:${reportId}:${i}`,
    source: r.source === 'rules' ? 'rules' : 'ai',
    area,
    title: r.title,
    why: r.evidence ?? '',
    gain,
    cost: typeof r.cost === 'number' && r.cost > 0 ? Math.round(r.cost) : 0,
    effort: r.effort === 'high' ? 'high' : r.effort === 'medium' ? 'medium' : 'low',
    steps: (r.actions ?? []).filter(Boolean).slice(0, 6),
    goalAmount: typeof r.goalAmount === 'number' && r.goalAmount > 0 ? Math.round(r.goalAmount) : defaultGoal(gain),
    tools,
    target: r.target
      ? {
          kind: r.target.kind,
          days: r.target.days ?? [],
          fromHour: r.target.fromHour || r.target.toHour ? r.target.fromHour : null,
          toHour: r.target.fromHour || r.target.toHour ? r.target.toHour : null,
        }
      : null,
    segment: r.outreach && r.outreach.segment !== 'NONE' ? r.outreach.segment : null,
    metric: r.metric ?? null,
    category: r.category,
    objective: null,
    channels: [],
    leverId: r.leverId || null,
    reportId,
  };
}

/** Lever rule idea → solution. */
export function solutionFromLever(def: LeverDef, now: Date, weakDay: number | null): Solution | null {
  const area = areaOf({ leverId: def.id });
  if (!area || !def.idea) return null;
  const plan = def.idea.plan as {
    category?: string;
    objective?: string;
    channels?: string[];
    metric?: string;
    targetKind?: 'SLOT';
    targetDays?: number[];
  };
  const gain = Math.round(def.gain);
  const tools = leverTools(def.id, { now, weakDay });
  const segment = (tools.find((t) => t.kind === 'CAMPAIGN')?.draft.segment as string | undefined) ?? null;
  return {
    key: `lever:${def.id}`,
    source: 'rules',
    area,
    title: def.idea.title,
    why: def.idea.why,
    gain,
    cost: 0,
    effort: 'low',
    steps: def.idea.steps,
    goalAmount: defaultGoal(gain),
    tools,
    target: plan.targetKind === 'SLOT' ? { kind: 'SLOT', days: plan.targetDays ?? [], fromHour: null, toHour: null } : segment ? { kind: 'LIST', days: [], fromHour: null, toHour: null } : null,
    segment,
    metric: plan.metric ?? null,
    category: plan.category ?? 'NEW_REVENUE',
    objective: plan.objective ?? null,
    channels: plan.channels ?? [],
    leverId: def.id,
    reportId: null,
  };
}

/** The unpaid point has no lever in the map: its rule idea lives here. */
function unpaidSolution(u: HealthInput['unpaid'], now: Date): Solution {
  return {
    key: 'lever:unpaid',
    source: 'rules',
    area: 'impayes',
    title: `Relancer les ${u.clients} impayé${u.clients > 1 ? 's' : ''}`,
    why: 'Un message poli suffit souvent : la plupart ont simplement oublié.',
    gain: Math.round(u.total),
    cost: 0,
    effort: 'low',
    steps: ['Ouvrir la liste des impayés', 'Envoyer le message prêt à chacun', 'Encaisser à leur prochaine visite'],
    goalAmount: Math.max(10, round10(u.total * 0.7)),
    tools: leverTools('unpaid', { now }),
    target: { kind: 'LIST', days: [], fromHour: null, toHour: null },
    segment: 'UNPAID',
    metric: 'revenuePerDay',
    category: 'OPERATIONS',
    objective: 'OTHER',
    channels: ['WHATSAPP'],
    leverId: 'unpaid',
    reportId: null,
  };
}

type AreaFigures = {
  status: HealthStatus;
  big: string;
  sub: string;
  headline: string;
  compare: { value: string; label: string };
  lost: { value: string; label: string } | null;
  problem: string;
  trend: { label: string; unit: string; values: Array<number | null> };
  how: string;
};

/** Each point: its number, colour and sentence, from the rules only. */
export function areaFigures(area: Area, x: HealthInput): AreaFigures {
  const f = x.facts;
  switch (area) {
    case 'cafe': {
      const pct = x.cafe.visits28 ? Math.round((x.cafe.withCafe28 / x.cafe.visits28) * 100) : null;
      const status: HealthStatus = pct == null || x.cafe.visits28 < 20 ? 'grey' : pct >= 40 ? 'green' : pct >= 20 ? 'orange' : 'red';
      const missing = pct == null ? 0 : Math.max(0, 0.4 - pct / 100) * x.cafe.visits28 * (30 / 28) * x.cafe.avgCafe;
      const oneIn = pct && pct > 0 ? Math.max(1, Math.round(100 / pct)) : null;
      return {
        status,
        big: pct == null ? '—' : `${pct} %`,
        sub: 'des visites avec un café',
        headline:
          pct == null
            ? 'Pas encore assez de visites pour juger le café'
            : status === 'green'
              ? `${pct} % des visites prennent un café`
              : oneIn
                ? `Seulement 1 client sur ${oneIn} prend un café`
                : 'Presque personne ne prend de café',
        compare: { value: '40 %', label: 'visé' },
        lost: missing >= 10 ? { value: `≈ ${dt(missing)}`, label: 'de café pas vendu par mois' } : null,
        problem:
          pct == null
            ? 'Moins de 20 visites ces 4 dernières semaines.'
            : `Sur ${x.cafe.visits28} visites en 4 semaines, ${x.cafe.withCafe28} ont pris un café ou un snack. Une vente café rapporte en moyenne ${dt(x.cafe.avgCafe)}.`,
        trend: { label: '% des visites avec un café, par semaine', unit: ' %', values: x.weekly.cafeAttachPct },
        how: 'On compte la part des visites avec un café et chaque vente liée (formule, promo), comparées aux autres heures et aux semaines d’avant.',
      };
    }
    case 'abos': {
      const rate = f.renewalRatePct;
      const status: HealthStatus =
        rate == null ? (f.aboEndingCount >= 2 ? 'orange' : 'grey') : rate >= 60 ? 'green' : rate >= 40 ? 'orange' : 'red';
      const notBack = rate == null ? null : Math.round((100 - rate) / 10);
      return {
        status,
        big: rate == null ? `${f.aboEndingCount}` : `${rate} %`,
        sub: rate == null ? 'abonnements finissent ce mois' : 'renouvelés le mois dernier',
        headline:
          rate == null
            ? `${f.aboEndingCount} abonnement${f.aboEndingCount > 1 ? 's finissent' : ' finit'} ce mois`
            : status === 'green'
              ? `${rate} % des abonnés renouvellent`
              : `${notBack} abonné${(notBack ?? 0) > 1 ? 's' : ''} sur 10 ne renouvellent pas`,
        compare: { value: `${f.aboEndingCount}`, label: `finissent ce mois (${dt(f.aboEndingValue)})` },
        lost:
          rate != null && rate < 60 && f.aboEndingValue > 0
            ? { value: `≈ ${dt(f.aboEndingValue * (0.6 - rate / 100))}`, label: "d'abonnements perdus ce mois" }
            : null,
        problem: `${f.aboEndingCount} abonnement${f.aboEndingCount > 1 ? 's se terminent' : ' se termine'} ce mois, pour ${dt(f.aboEndingValue)}.${
          rate != null ? ` Le mois dernier, ${rate} % ont été renouvelés.` : ''
        } Abonnement moyen : ${dt(f.avgAboPrice)}.`,
        trend: { label: 'abonnements vendus par semaine', unit: '', values: x.weekly.aboSold },
        how: 'On compare les abonnés relancés à ceux qu’on n’a pas relancés, et on compte chaque renouvellement (même avec une autre offre).',
      };
    }
    case 'creux': {
      const days = f.weekdayRevenue.map((v, wd) => ({ wd, v })).filter((d) => d.v > 0);
      if (days.length < 5) {
        return {
          status: 'grey',
          big: '—',
          sub: 'pas assez de jours ouverts',
          headline: 'Pas encore assez de jours pour comparer',
          compare: { value: '—', label: 'meilleur jour' },
          lost: null,
          problem: 'Il faut au moins 5 jours de semaine avec des ventes ces 4 dernières semaines.',
          trend: { label: 'argent du jour le plus calme, par semaine', unit: ' DT', values: x.weekly.weakDayRevenue },
          how: 'On compare le jour visé aux autres jours de la semaine.',
        };
      }
      const worst = days.reduce((a, b) => (b.v < a.v ? b : a));
      const best = days.reduce((a, b) => (b.v > a.v ? b : a));
      const ratio = best.v > 0 ? worst.v / best.v : 1;
      const status: HealthStatus = ratio < 0.5 ? 'red' : ratio < 0.7 ? 'orange' : 'green';
      const others = days.filter((d) => d.wd !== worst.wd);
      const avgOthers = others.reduce((a, d) => a + d.v, 0) / Math.max(1, others.length);
      return {
        status,
        big: dt(worst.v),
        sub: `par ${WD[worst.wd]} en moyenne`,
        headline: status === 'green' ? 'Les jours de la semaine sont équilibrés' : `Le ${WD[worst.wd]} rapporte ${Math.round((1 - ratio) * 100)} % de moins que le ${WD[best.wd]}`,
        compare: { value: dt(best.v), label: `le ${WD[best.wd]}` },
        lost: status !== 'green' ? { value: `≈ ${dt((avgOthers - worst.v) * 0.3 * 4.3)}`, label: 'à gagner par mois en le remplissant un peu' } : null,
        problem: `Passes + café : ${dt(worst.v)} par ${WD[worst.wd]} contre ${dt(best.v)} le ${WD[best.wd]} (moyenne des 4 dernières semaines).`,
        trend: { label: `argent du ${WD[worst.wd]}, par semaine`, unit: ' DT', values: x.weekly.weakDayRevenue },
        how: `On compare les ${WD[worst.wd]}s aux autres jours : si tous les jours montent pareil, ce n’est pas la solution.`,
      };
    }
    case 'nouveaux': {
      const { last28, prev28 } = x.newcomers;
      const ratio = prev28 > 0 ? last28 / prev28 : last28 > 0 ? 2 : 0;
      const status: HealthStatus = last28 === 0 && prev28 === 0 ? 'grey' : ratio >= 0.9 ? 'green' : ratio >= 0.7 ? 'orange' : 'red';
      const insta = f.heardFrom.INSTAGRAM ?? 0;
      return {
        status,
        big: `${last28}`,
        sub: 'nouveaux en 4 semaines',
        headline:
          status === 'green'
            ? last28 > prev28
              ? 'Les nouveaux clients augmentent'
              : 'Les nouveaux clients se maintiennent'
            : `${prev28 - last28} nouveau${prev28 - last28 > 1 ? 'x' : ''} de moins qu'avant`,
        compare: { value: `${prev28}`, label: 'les 4 semaines d’avant' },
        lost: status !== 'green' && prev28 > last28 ? { value: `≈ ${dt((prev28 - last28) * f.ticket * Math.max(1, Math.min(6, f.visitsPerNewcomer)))}`, label: 'de visites en moins par mois' } : null,
        problem: `${last28} nouveaux clients ces 4 semaines, contre ${prev28} les 4 semaines d’avant.${insta ? ` ${insta} disent venir d’Instagram (90 jours).` : ''}`,
        trend: { label: 'nouveaux clients par semaine', unit: '', values: x.weekly.newcomers },
        how: 'On compte les nouveaux clients et d’où ils viennent (lien suivi, « comment nous avez-vous connus »). Pour un événement, chaque billet compte.',
      };
    }
    case 'retour': {
      const rate = f.returnRatePct;
      const status: HealthStatus = rate == null ? 'grey' : rate >= 50 ? 'green' : rate >= 30 ? 'orange' : 'red';
      const notBack = f.lists.NEW_NOT_BACK ?? 0;
      return {
        status,
        big: rate == null ? '—' : `${rate} %`,
        sub: 'des nouveaux reviennent en 14 jours',
        headline: rate == null ? 'Pas encore assez de nouveaux pour juger' : status === 'green' ? 'Plus de la moitié des nouveaux reviennent' : `Seulement ${rate} % des nouveaux reviennent`,
        compare: { value: `${notBack}`, label: 'nouveaux pas revenus à relancer' },
        lost: null,
        problem:
          rate == null
            ? 'Il faut au moins 10 nouveaux clients jugés (60 derniers jours).'
            : `${rate} % des nouveaux clients reviennent dans les 14 jours.${
                f.returnWithAppPct != null && f.returnWithoutAppPct != null ? ` Avec l’app : ${f.returnWithAppPct} %, sans : ${f.returnWithoutAppPct} %.` : ''
              }`,
        trend: { label: '% des nouveaux revenus en 14 jours, par semaine d’arrivée', unit: ' %', values: x.weekly.returnPct },
        how: 'On suit chaque nouveau client et s’il revient dans les 14 jours ; une relance compte ceux qui reviennent après le message.',
      };
    }
    case 'impayes': {
      const u = x.unpaid;
      const status: HealthStatus = u.total <= 0 ? 'green' : u.total < 200 && (u.oldestDays ?? 0) < 30 ? 'orange' : 'red';
      return {
        status,
        big: dt(u.total),
        sub: 'pas encore payés',
        headline: u.total <= 0 ? 'Aucun impayé' : `${u.clients} client${u.clients > 1 ? 's doivent' : ' doit'} ${dt(u.total)}`,
        compare: { value: u.oldestDays != null ? `${u.oldestDays} j` : '—', label: 'pour le plus ancien' },
        lost: u.total > 0 ? { value: dt(u.total), label: 'à récupérer' } : null,
        problem: u.total > 0 ? 'Des visites ne sont pas payées. Plus on attend, moins on récupère.' : 'Toutes les visites sont payées.',
        trend: { label: 'visites non payées, par semaine', unit: '', values: x.weekly.unpaidVisits },
        how: 'On compte ce qui est encaissé sur ces impayés : chaque dinar récupéré compte, pas besoin de comparaison.',
      };
    }
  }
}

const RANK: Record<HealthStatus, number> = { red: 0, orange: 1, grey: 2, green: 3 };

/** Builds the whole bilan. */
export function buildHealth(x: HealthInput) {
  const refused = (s: Pick<Solution, 'leverId' | 'title'>) =>
    x.dismissed.some((d) => (s.leverId && d.leverId === s.leverId) || norm(d.title) === norm(s.title));
  // A solution already started (or finished lately) is not proposed again
  const recentCut = new Date(x.now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const taken = x.initiatives.filter((i) => !i.dropped && (!i.finished || (i.endDate ?? i.startDate) >= recentCut));
  const started = (s: Solution) =>
    taken.some(
      (i) =>
        (i.recommendationTitle && norm(i.recommendationTitle) === norm(s.title)) ||
        norm(i.title) === norm(s.title) ||
        (s.source === 'rules' && s.leverId && i.leverId === s.leverId),
    );

  const facts = x.facts;
  const days = facts.weekdayRevenue.map((v, wd) => ({ wd, v })).filter((d) => d.v > 0);
  const weakDay = days.length >= 5 ? days.reduce((a, b) => (b.v < a.v ? b : a)).wd : null;

  const ai = (x.report?.recommendations ?? [])
    .map((r, i) => solutionFromAi(r, i, x.report!.id))
    .filter((s): s is Solution => !!s);
  const rules = x.defs
    .filter((d) => d.idea && !['IN_PROGRESS', 'WORKING'].includes(x.leverStatus[d.id] ?? ''))
    .map((d) => solutionFromLever(d, x.now, weakDay))
    .filter((s): s is Solution => !!s);
  if (x.unpaid.total > 0) rules.push(unpaidSolution(x.unpaid, x.now));

  const initiativeArea = (i: HealthInitiative) =>
    areaOf({ area: i.area, leverId: i.leverId, segment: i.segment, objective: i.objective, category: i.category, metric: i.metric });

  const areas = AREAS.map((area) => {
    const fig = areaFigures(area, x);
    // AI first (more precise), then rule ideas on levers the AI left empty
    const aiHere = ai.filter((s) => s.area === area && !refused(s) && !started(s));
    const covered = new Set(aiHere.map((s) => s.leverId).filter(Boolean));
    const rulesHere = rules
      .filter((s) => s.area === area && !refused(s) && !started(s) && !covered.has(s.leverId))
      .sort((a, b) => b.gain - a.gain);
    // Rule ideas only where the number is bad (on a healthy or unknown point they are noise)
    const bad = fig.status === 'red' || fig.status === 'orange';
    const solutions = [...aiHere, ...(bad ? rulesHere : [])].slice(0, 3);
    // Already done on this point, outside the solutions (relances sent, renewals at the desk…)
    const alreadyDone = Object.entries(x.leverNotes ?? {})
      .filter(([id]) => areaOf({ leverId: id }) === area && ['IN_PROGRESS', 'WORKING'].includes(x.leverStatus[id] ?? ''))
      .map(([id, l]) => ({ leverId: id, title: l.title, note: l.note, working: x.leverStatus[id] === 'WORKING' }));
    const mine = x.initiatives.filter((i) => initiativeArea(i) === area && !i.dropped);
    return {
      id: area,
      name: AREA_NAME[area],
      statusLabel: STATUS_LABEL[fig.status],
      ...fig,
      solutions,
      alreadyDone,
      running: mine.filter((i) => !i.finished).map((i) => i.id),
      history: mine
        .filter((i) => i.finished)
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          title: i.title,
          when: i.endDate ?? i.startDate,
          netGain: i.netGain,
          verdict: i.verdict,
          status: i.status,
        })),
    };
  }).sort((a, b) => RANK[a.status] - RANK[b.status]);

  const running = x.initiatives.filter((i) => !i.finished && !i.dropped);
  const finished = x.initiatives.filter((i) => i.finished && !i.dropped && i.netGain != null);
  return {
    areas,
    max: MAX_RUNNING,
    runningCount: running.length,
    toFix: areas.filter((a) => a.status === 'red' || a.status === 'orange').length,
    gainedTotal: Math.round(finished.reduce((a, i) => a + (i.netGain ?? 0), 0)),
    finishedCount: finished.length,
    // Ideas that fix no point (e.g. data to correct): shown apart
    other: ai.length < (x.report?.recommendations.length ?? 0)
      ? (x.report?.recommendations ?? [])
          .filter((r) => !areaOf({ area: r.area, leverId: r.leverId, segment: r.outreach?.segment, category: r.category, metric: r.metric }))
          .map((r) => ({ title: r.title, why: r.evidence ?? '' }))
      : [],
  };
}

export type Health = ReturnType<typeof buildHealth>;
export type HealthArea = Health['areas'][number];
