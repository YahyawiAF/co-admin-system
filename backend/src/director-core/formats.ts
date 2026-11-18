/**
 * The round trip with Claude without an API key: the app exports one JSON, Claude answers
 * with an update. v2 adds what the brain asks the app to do: legs (drafts the owner
 * approves), watches (what the app measures by itself), looks (data for the next round)
 * and needs (what the app can't do yet). Nothing unknown is ever applied.
 */
import { checkParams, type EyeParams, type EyeSpec, type LegSpec } from './catalogue';
import { ANY_DOMAIN, LESSON_STATUSES, VERDICTS, type LessonStatus, type Verdict } from './lessons';
import { cornerId, ENTRY_KINDS, type EntryKind, type ImportedEntry } from './memory';

export const EXPORT_FORMAT = 'directeur/v2';
export const UPDATE_FORMAT = 'directeur-update/v2';
const UPDATE_FORMATS = ['directeur-update/v1', UPDATE_FORMAT];

export const MAX_PRIORITIES = 3;
const MAX_LEGS = 2;
const MAX_WATCHES = 2;
const MAX_LOOKS = 5;
const MAX_NEEDS = 3;
const MAX_VERDICTS = 12;
export const WATCH_DAYS = { min: 7, max: 42, default: 14 };

/** Written into every export so any Claude chat knows what to send back. `business` = the host's own words. */
export function updateInstructions(business: string, domain = ANY_DOMAIN): string[] {
  return [
    `Tu es le cerveau du Directeur de ${business}. L'app est tes yeux et tes jambes : elle mesure toute seule (eyes) et agit (legs).`,
    'Lis goal, month, alert, corners, memory, priorities (en cours, avec leurs watches mesurés), data (les jours récents), looks (réponses à ce que tu as demandé), needs, questions et numbers.',
    'Réponds par UN objet JSON, sans texte autour :',
    '{ "format": "directeur-update/v2", "basedOn": <exportedAt>, "summary": "3 phrases au plus", ' +
      '"priorities": [{ "title": "…", "corner": "<id de coin>", "why": "le chiffre qui le montre", "steps": ["ce que fait le propriétaire, 12 mots max"], ' +
      '"legs": [{ "kind": "<kind de catalogue.legs>", "label": "texte du bouton", "draft": { "title": "", "text": "", "price": 0, "discountPct": 0, "date": "AAAA-MM-JJ", "days": [], "fromHour": 0, "toHour": 0, "capacity": 0, "segment": "", "items": [] } }], ' +
      '"watch": [{ "eye": "<id de catalogue.eyes>", "params": { … }, "days": 14, "label": "ce qu’on suit", "goal": null }] }], ' +
      '"look": [{ "eye": "<id>", "params": { … }, "from": "AAAA-MM-JJ", "to": "AAAA-MM-JJ", "why": "…" }], ' +
      '"needs": [{ "title": "…", "problem": "ce que je ne peux pas voir ou faire", "capability": "ce qu’il faudrait coder" }], ' +
      '"add": [{ "date": "AAAA-MM-JJ", "kind": "DECISION|FACT|LESSON|TEST", "corner": "<id>", "text": "…", "detail": "…" }], ' +
      '"update": [{ "id": "<id d’une note>", "text": "…", "detail": "…" }], "remove": ["<id>"], ' +
      '"corners": [{ "name": "Nouveau coin" }], "questions": ["…"], ' +
      '"lessons": [{ "learnId": "<id de learn>", "claim": "ce que dit le texte", "verdict": "ADOPT|ADAPT|TEST|REJECT|SAME", "rule": "la leçon, une phrase", "why": "pourquoi, avec les chiffres", "changed": "ce que tu as changé (ADAPT)", "changeMind": "ce qui te ferait changer d’avis (REJECT)", "sameAs": "<id de leçon> (SAME)", "corner": "<id>", "domain": "* ou ${domain}" }], ' +
      '"confidence": [{ "id": "<id de leçon>", "confidence": 0-100, "why": "le résultat qui la fait bouger", "status": "ADOPTED|ADAPTED|TESTING|RETIRED" }], ' +
      '"replies": [{ "id": "<id de leçon contestée>", "reply": "ta réponse", "rule": "nouvelle phrase si tu changes", "status": "…" }] }',
    `Règles : ${MAX_PRIORITIES} priorités au plus ; elles remplacent celles en cours (leurs watches continuent). Chaque priorité qui change quelque chose a au moins un watch : l'app compare toute seule aux mêmes jours de semaine des 4 semaines avant et compte les ventes des legs.`,
    'legs : brouillons que le propriétaire valide (promo, relance, événement, enquête, tarif, produit) ; champs inutiles = "" / 0 / []. Une relance (CAMPAIGN) : segment = une liste connue, text = le message WhatsApp prêt, vouvoiement.',
    'Juge les watches terminés ou bien avancés de priorities : écris le résultat en note (FACT) et ce qu’il apprend (LESSON), avec les chiffres. Une étape pas faite n’est pas un échec.',
    'Si un chiffre manque dans data, demande-le dans look (réponse au prochain export). Si l’app ne peut pas le voir ou le faire (pas d’eye ou de leg), mets-le dans needs : le propriétaire décide de le faire coder.',
    'learn : textes que le propriétaire veut t’apprendre. Découpe chacun en idées testables et juge chacune avec les principes, les leçons et les chiffres : ADOPT (tient), ADAPT (vrai mais exagéré : réécris-la et dis ce qui change), TEST (plausible, pas prouvé : ajoute aussi une priorité avec un watch qui la teste, et mets "new:<index dans lessons>" dans ses lessonIds), REJECT (fausse ou contredite : dis ce qui te ferait changer d’avis), SAME (déjà dans lessons : sameAs). Tu peux refuser : ne garde que ce qui aide CE business.',
    'lessons (export) : les leçons les plus utiles avec leurs results (les watches des priorités qui les ont utilisées). Fais bouger confidence avec ces résultats et dis pourquoi ; review = à réécrire ou retirer ; ne repropose jamais une idée de rejected. contested : le propriétaire conteste une fois, réponds dans replies (garde ou change, avec une raison). Dans chaque priorité, lessonIds = les ids des leçons qu’elle applique.',
    'N’invente aucun chiffre. add = seulement le nouveau. Une question seulement si la réponse change une priorité. corner = un id de corners ou un coin ajouté dans corners.',
  ];
}

export type PlanLeg = { kind: string; label: string; draft: Record<string, unknown> };
export type PlanWatch = { eye: string; params: EyeParams; days: number; label: string | null; goal: number | null };
export type PlanPriority = { title: string; corner: string; why: string; steps: string[]; legs: PlanLeg[]; watch: PlanWatch[]; lessonIds: string[] };
export type PlanVerdict = {
  /** Index in the answer's lessons, for a priority that tests it ("new:<ref>") */
  ref: number;
  learnId: string | null;
  claim: string;
  verdict: Verdict;
  rule: string;
  why: string | null;
  changed: string | null;
  changeMind: string | null;
  sameAs: string | null;
  corner: string;
  domain: string;
};
export type PlanConfidence = { id: string; confidence: number; why: string; status: LessonStatus | null };
export type PlanReply = { id: string; reply: string; rule: string | null; status: LessonStatus | null };
export type PlanLook = { eye: string; params: EyeParams; from: string; to: string; why: string };
export type PlanNeed = { title: string; problem: string; capability: string };

export type UpdatePlan = {
  format: string;
  basedOn: string | null;
  summary: string | null;
  priorities: PlanPriority[];
  look: PlanLook[];
  needs: PlanNeed[];
  lessons: PlanVerdict[];
  confidence: PlanConfidence[];
  replies: PlanReply[];
  add: ImportedEntry[];
  update: Array<{ id: string; text?: string; detail?: string | null; kind?: EntryKind; corner?: string; date?: string }>;
  remove: string[];
  corners: Array<{ id: string; name: string }>;
  questions: string[];
  warnings: string[];
};

export type UpdateContext = {
  corners: Array<{ id: string; name: string }>;
  entryIds: string[];
  eyes?: EyeSpec[];
  legs?: LegSpec[];
  /** Host check of one leg's draft (same rules as its create form); null = can't be used */
  checkLeg?: (kind: string, raw: { label?: unknown; draft?: unknown }) => PlanLeg | null;
  /** Ids of LESSON notes, of pending texts to learn, and of lessons the owner contested */
  lessonIds?: string[];
  learnIds?: string[];
  contestedIds?: string[];
  /** The host's trade, for lessons that aren't principles */
  domain?: string;
};

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const list = (v: unknown) => (Array.isArray(v) ? v : []);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Checks Claude's answer before anything is saved: known ids only, known or new corners,
 * eyes and legs from the catalogue, valid dates and kinds. What can't be used is listed
 * in `warnings`, never applied.
 */
export function parseUpdate(raw: unknown, known: UpdateContext, today: string): UpdatePlan {
  let x: Record<string, unknown>;
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      x = JSON.parse(text);
    } catch {
      throw new Error('Ce n’est pas du JSON valide');
    }
  } else x = raw as Record<string, unknown>;
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Il faut un objet JSON');
  if (!UPDATE_FORMATS.includes(x.format as string)) throw new Error(`Format attendu : « ${UPDATE_FORMAT} »`);

  const warnings: string[] = [];
  const corners: Array<{ id: string; name: string }> = [];
  for (const c of list(x.corners)) {
    const name = str((c as { name?: unknown })?.name, 40);
    if (!name) continue;
    const id = cornerId(name);
    if ([...known.corners, ...corners].some((k) => k.id === id)) continue;
    corners.push({ id, name });
  }
  const all = [...known.corners, ...corners];
  const corner = (v: unknown) => {
    const s = str(v, 60);
    if (!s) return null;
    return all.find((c) => c.id === s || c.id === cornerId(s) || cornerId(c.name) === cornerId(s))?.id ?? null;
  };
  const kind = (v: unknown) => (typeof v === 'string' && (ENTRY_KINDS as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as EntryKind) : null);
  const eyeOf = (v: unknown) => (known.eyes ?? []).find((e) => e.id === v) ?? null;

  const add: ImportedEntry[] = [];
  for (const [i, e] of list(x.add).entries()) {
    const o = obj(e);
    const text = str(o.text, 300);
    const c = corner(o.corner);
    if (!text || !c) {
      warnings.push(`add[${i}] ignoré : ${!text ? 'texte vide' : `coin inconnu « ${String(o.corner)} »`}`);
      continue;
    }
    const date = typeof o.date === 'string' && DAY_KEY.test(o.date) ? o.date : today;
    add.push({ date, kind: kind(o.kind) ?? 'FACT', corner: c, text, detail: str(o.detail, 500) });
  }

  const ids = new Set(known.entryIds);
  const update: UpdatePlan['update'] = [];
  for (const [i, e] of list(x.update).entries()) {
    const o = obj(e);
    if (typeof o.id !== 'string' || !ids.has(o.id)) {
      warnings.push(`update[${i}] ignoré : note inconnue`);
      continue;
    }
    const u: UpdatePlan['update'][number] = { id: o.id };
    if (o.text !== undefined) {
      const t = str(o.text, 300);
      if (t) u.text = t;
    }
    if (o.detail !== undefined) u.detail = str(o.detail, 500);
    if (o.kind !== undefined && kind(o.kind)) u.kind = kind(o.kind)!;
    if (o.corner !== undefined) {
      const c = corner(o.corner);
      if (c) u.corner = c;
      else warnings.push(`update[${i}] : coin inconnu « ${String(o.corner)} », gardé tel quel`);
    }
    if (typeof o.date === 'string' && DAY_KEY.test(o.date)) u.date = o.date;
    if (Object.keys(u).length > 1) update.push(u);
  }

  const remove: string[] = [];
  for (const id of list(x.remove)) {
    if (typeof id === 'string' && ids.has(id)) remove.push(id);
    else warnings.push(`remove : note inconnue « ${String(id)} »`);
  }

  const watchOf = (w: unknown, where: string): PlanWatch | null => {
    const o = obj(w);
    const spec = eyeOf(o.eye);
    if (!spec) {
      warnings.push(`${where} ignoré : l’app n’a pas d’œil « ${String(o.eye)} »`);
      return null;
    }
    const params = checkParams(spec, o.params);
    if (!params) {
      warnings.push(`${where} ignoré : paramètre inconnu pour « ${spec.id} »`);
      return null;
    }
    const d = Math.round(Number(o.days));
    const days = Number.isFinite(d) && d > 0 ? Math.min(WATCH_DAYS.max, Math.max(WATCH_DAYS.min, d)) : WATCH_DAYS.default;
    const goal = o.goal === null || o.goal === undefined || o.goal === '' ? null : Number(o.goal);
    return { eye: spec.id, params, days, label: str(o.label, 120), goal: goal != null && Number.isFinite(goal) ? goal : null };
  };

  const lessonSet = new Set(known.lessonIds ?? []);
  const status = (v: unknown) => (typeof v === 'string' && (LESSON_STATUSES as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as LessonStatus) : null);
  const priorities: PlanPriority[] = [];
  for (const [i, p] of list(x.priorities).slice(0, MAX_PRIORITIES).entries()) {
    const o = obj(p);
    const title = str(o.title, 200);
    if (!title) continue;
    const legs: PlanLeg[] = [];
    for (const [k, l] of list(o.legs).entries()) {
      const lo = obj(l);
      const legKind = String(lo.kind ?? '').toUpperCase();
      const spec = (known.legs ?? []).find((s) => s.kind === legKind && s.needsOk);
      const leg = spec && known.checkLeg ? known.checkLeg(legKind, lo) : null;
      if (leg && legs.length >= MAX_LEGS) warnings.push(`priorities[${i}].legs[${k}] ignoré : ${MAX_LEGS} brouillons au plus`);
      else if (leg) legs.push(leg);
      else warnings.push(`priorities[${i}].legs[${k}] ignoré : ${spec ? 'brouillon incomplet' : `l’app n’a pas de jambe « ${legKind} »`}`);
    }
    const watch = list(o.watch)
      .map((w, k) => watchOf(w, `priorities[${i}].watch[${k}]`))
      .filter((w): w is PlanWatch => !!w);
    if (watch.length > MAX_WATCHES) warnings.push(`priorities[${i}] : ${MAX_WATCHES} suivis au plus, les autres sont ignorés`);
    watch.splice(MAX_WATCHES);
    priorities.push({
      title,
      corner: corner(o.corner) ?? 'clients',
      why: str(o.why, 300) ?? '',
      steps: list(o.steps).map((s) => str(s, 160)).filter((s): s is string => !!s).slice(0, 4),
      legs,
      watch,
      lessonIds: list(o.lessonIds).filter((l): l is string => typeof l === 'string' && (lessonSet.has(l) || /^new:\d+$/.test(l))),
    });
  }
  if (list(x.priorities).length > MAX_PRIORITIES) warnings.push(`Plus de ${MAX_PRIORITIES} priorités : seules les ${MAX_PRIORITIES} premières sont gardées`);

  const look: PlanLook[] = [];
  for (const [i, l] of list(x.look).slice(0, MAX_LOOKS).entries()) {
    const o = obj(l);
    const w = watchOf({ eye: o.eye, params: o.params }, `look[${i}]`);
    if (!w) continue;
    const from = typeof o.from === 'string' && DAY_KEY.test(o.from) ? o.from : null;
    const to = typeof o.to === 'string' && DAY_KEY.test(o.to) ? o.to : today;
    if (!from || from > to) {
      warnings.push(`look[${i}] ignoré : dates invalides`);
      continue;
    }
    look.push({ eye: w.eye, params: w.params, from, to: to > today ? today : to, why: str(o.why, 200) ?? '' });
  }

  const needs: PlanNeed[] = [];
  for (const n of list(x.needs).slice(0, MAX_NEEDS)) {
    const o = obj(n);
    const title = str(o.title, 120);
    const problem = str(o.problem, 300);
    const capability = str(o.capability, 300);
    if (title && problem && capability) needs.push({ title, problem, capability });
  }

  const learnSet = new Set(known.learnIds ?? []);
  const lessons: PlanVerdict[] = [];
  for (const [i, v] of list(x.lessons).entries()) {
    const o = obj(v);
    const verdict = typeof o.verdict === 'string' && (VERDICTS as readonly string[]).includes(o.verdict.toUpperCase()) ? (o.verdict.toUpperCase() as Verdict) : null;
    const claim = str(o.claim, 300);
    const rule = str(o.rule, 300) ?? claim;
    if (!verdict || !rule) {
      warnings.push(`lessons[${i}] ignoré : ${!verdict ? 'verdict inconnu' : 'pas de règle'}`);
      continue;
    }
    const sameAs = typeof o.sameAs === 'string' && lessonSet.has(o.sameAs) ? o.sameAs : null;
    if (verdict === 'SAME' && !sameAs) {
      warnings.push(`lessons[${i}] ignoré : SAME sans leçon connue (sameAs)`);
      continue;
    }
    if (lessons.length >= MAX_VERDICTS) {
      warnings.push(`lessons[${i}] ignoré : ${MAX_VERDICTS} idées au plus par réponse`);
      continue;
    }
    const domain = o.domain === ANY_DOMAIN || o.domain === known.domain ? (o.domain as string) : (known.domain ?? ANY_DOMAIN);
    lessons.push({
      ref: i,
      learnId: typeof o.learnId === 'string' && learnSet.has(o.learnId) ? o.learnId : null,
      claim: claim ?? rule,
      verdict,
      rule,
      why: str(o.why, 500),
      changed: str(o.changed, 300),
      changeMind: str(o.changeMind, 300),
      sameAs,
      corner: corner(o.corner) ?? 'marketing',
      domain,
    });
  }

  // A priority may test a lesson of this same answer: "new:<index>" must point to one that was kept (not SAME / REJECT)
  const testable = new Set(lessons.filter((l) => l.verdict !== 'SAME' && l.verdict !== 'REJECT').map((l) => `new:${l.ref}`));
  for (const p of priorities) p.lessonIds = p.lessonIds.filter((l) => !l.startsWith('new:') || testable.has(l));

  const confidence: PlanConfidence[] = [];
  for (const [i, c] of list(x.confidence).entries()) {
    const o = obj(c);
    const n = Math.round(Number(o.confidence));
    const why = str(o.why, 300);
    if (typeof o.id !== 'string' || !lessonSet.has(o.id) || !Number.isFinite(n) || !why) {
      warnings.push(`confidence[${i}] ignoré : ${typeof o.id !== 'string' || !lessonSet.has(o.id) ? 'leçon inconnue' : !why ? 'sans raison' : 'nombre invalide'}`);
      continue;
    }
    confidence.push({ id: o.id, confidence: Math.min(100, Math.max(0, n)), why, status: status(o.status) });
  }

  const contested = new Set(known.contestedIds ?? []);
  const replies: PlanReply[] = [];
  for (const [i, r] of list(x.replies).entries()) {
    const o = obj(r);
    const reply = str(o.reply, 500);
    if (typeof o.id !== 'string' || !contested.has(o.id) || !reply) {
      warnings.push(`replies[${i}] ignoré : ${typeof o.id === 'string' && contested.has(o.id) ? 'réponse vide' : 'pas de contestation en attente'}`);
      continue;
    }
    replies.push({ id: o.id, reply, rule: str(o.rule, 300), status: status(o.status) });
  }

  const questions = list(x.questions).map((q) => str(q, 300)).filter((q): q is string => !!q).slice(0, 5);

  return {
    format: x.format as string,
    basedOn: str(x.basedOn, 40),
    summary: str(x.summary, 800),
    priorities,
    look,
    needs,
    lessons,
    confidence,
    replies,
    add,
    update,
    remove,
    corners,
    questions,
    warnings,
  };
}
