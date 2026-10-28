/**
 * Survey questions and answers: pure rules, no Prisma.
 * Questions keep a stable id so editing or reordering never breaks old answers.
 */

export const QUESTION_TYPES = [
  'single',
  'multi',
  'short',
  'long',
  'availability',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** What a question means for the dashboard, so results survive wording changes. */
export const QUESTION_TAGS = [
  'role',
  'learnSubjects',
  'level',
  'format',
  'days',
  'times',
  'attend',
  'teachSubjects',
  'teachTime',
  'teachSlots',
  'host',
] as const;
export type QuestionTag = (typeof QUESTION_TAGS)[number];

export type QuestionOption = { value: string; label: string };

export type SurveyQuestion = {
  id: string;
  section: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: QuestionOption[];
  required: boolean;
  /** Adds a free-text field when the "other" option is picked */
  allowOther?: boolean;
  /** Shown only when another question's answer contains one of these values */
  showIf?: { questionId: string; anyOf: string[] };
  tag?: QuestionTag;
};

export type SurveySection = { id: string; title: string; description?: string };

export type ContactMode = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type DuplicatePolicy = 'KEEP_ALL' | 'LATEST_PER_BROWSER';

export type SurveySettings = {
  sections: SurveySection[];
  contactMode: ContactMode;
  /** Shown above the consent checkbox */
  contactText: string;
  duplicatePolicy: DuplicatePolicy;
  /** How long a campaign link keeps credit for a browser */
  attributionDays: number;
  requireLogin: boolean;
  successMessage: string;
};

export type Answers = Record<string, string | string[]>;

export const OTHER = 'other';
export const AVAILABILITY_DAYS = [
  { value: 'mon', label: 'Lun' },
  { value: 'tue', label: 'Mar' },
  { value: 'wed', label: 'Mer' },
  { value: 'thu', label: 'Jeu' },
  { value: 'fri', label: 'Ven' },
  { value: 'sat', label: 'Sam' },
  { value: 'sun', label: 'Dim' },
];
export const AVAILABILITY_TIMES = [
  { value: 'morning', label: 'Matin' },
  { value: 'afternoon', label: 'Après-midi' },
  { value: 'evening', label: 'Soir' },
];

const MAX_QUESTIONS = 60;
const MAX_OPTIONS = 30;
const SHORT_MAX = 200;
const LONG_MAX = 2000;
const OTHER_MAX = 120;
const ID_RE = /^[a-z0-9_]{1,40}$/i;

export const DEFAULT_SETTINGS: SurveySettings = {
  sections: [{ id: 'main', title: 'Questions' }],
  contactMode: 'OPTIONAL',
  contactText:
    'Laisse ton prénom et ton WhatsApp si tu veux être prévenu des prochaines séances. Ton numéro sert uniquement à cela et n’est jamais partagé.',
  duplicatePolicy: 'LATEST_PER_BROWSER',
  attributionDays: 30,
  requireLogin: false,
  successMessage: 'Merci ! Ta réponse est bien enregistrée.',
};

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Coerce stored JSON into full settings (old rows, partial updates). */
export function normalizeSettings(raw: unknown): SurveySettings {
  const s = (
    raw && typeof raw === 'object' ? raw : {}
  ) as Partial<SurveySettings>;
  const sections = Array.isArray(s.sections)
    ? s.sections
        .filter((x) => x && typeof x.id === 'string' && ID_RE.test(x.id))
        .slice(0, 12)
        .map((x) => ({
          id: x.id,
          title: str(x.title, 80) || 'Section',
          ...(str(x.description, 400) && {
            description: str(x.description, 400),
          }),
        }))
    : [];
  const days = Number(s.attributionDays);
  return {
    sections: sections.length ? sections : DEFAULT_SETTINGS.sections,
    contactMode: (['NONE', 'OPTIONAL', 'REQUIRED'] as const).includes(
      s.contactMode as ContactMode,
    )
      ? (s.contactMode as ContactMode)
      : DEFAULT_SETTINGS.contactMode,
    contactText: str(s.contactText, 400) || DEFAULT_SETTINGS.contactText,
    duplicatePolicy:
      s.duplicatePolicy === 'KEEP_ALL' ? 'KEEP_ALL' : 'LATEST_PER_BROWSER',
    attributionDays: Number.isFinite(days)
      ? Math.min(180, Math.max(1, Math.round(days)))
      : 30,
    requireLogin: s.requireLogin === true,
    successMessage:
      str(s.successMessage, 300) || DEFAULT_SETTINGS.successMessage,
  };
}

/** Check a question list written by the admin. Returns the cleaned list or the first problem. */
export function validateQuestions(
  raw: unknown,
  sectionIds: string[],
): { ok: true; questions: SurveyQuestion[] } | { ok: false; error: string } {
  if (!Array.isArray(raw))
    return { ok: false, error: 'Liste de questions invalide' };
  if (raw.length > MAX_QUESTIONS)
    return { ok: false, error: `${MAX_QUESTIONS} questions au maximum` };
  const out: SurveyQuestion[] = [];
  const seen = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const q = (item || {}) as Partial<SurveyQuestion>;
    const n = i + 1;
    if (typeof q.id !== 'string' || !ID_RE.test(q.id))
      return { ok: false, error: `Question ${n} : identifiant invalide` };
    if (seen.has(q.id))
      return { ok: false, error: `Question ${n} : identifiant en double` };
    seen.add(q.id);
    if (!QUESTION_TYPES.includes(q.type as QuestionType))
      return { ok: false, error: `Question ${n} : type invalide` };
    const label = str(q.label, 200);
    if (!label) return { ok: false, error: `Question ${n} : texte manquant` };
    const section =
      typeof q.section === 'string' && sectionIds.includes(q.section)
        ? q.section
        : sectionIds[0];
    const needsOptions = q.type === 'single' || q.type === 'multi';
    let options: QuestionOption[] | undefined;
    if (needsOptions) {
      const opts = Array.isArray(q.options) ? q.options : [];
      options = [];
      const values = new Set<string>();
      for (const o of opts.slice(0, MAX_OPTIONS)) {
        const value = str(o?.value, 40);
        const optLabel = str(o?.label, 120);
        if (!value || !optLabel || values.has(value)) continue;
        values.add(value);
        options.push({ value, label: optLabel });
      }
      if (options.length < 2)
        return { ok: false, error: `Question ${n} : au moins 2 choix` };
    }
    const tag = QUESTION_TAGS.includes(q.tag as QuestionTag)
      ? (q.tag as QuestionTag)
      : undefined;
    let showIf: SurveyQuestion['showIf'];
    if (q.showIf && typeof q.showIf === 'object') {
      const parent = out.find((p) => p.id === q.showIf!.questionId);
      if (!parent)
        return {
          ok: false,
          error: `Question ${n} : la condition doit viser une question placée avant`,
        };
      const anyOf = (
        Array.isArray(q.showIf.anyOf) ? q.showIf.anyOf : []
      ).filter(
        (v): v is string =>
          typeof v === 'string' && !!parent.options?.some((o) => o.value === v),
      );
      if (!anyOf.length)
        return {
          ok: false,
          error: `Question ${n} : condition sans réponse choisie`,
        };
      showIf = { questionId: parent.id, anyOf };
    }
    out.push({
      id: q.id,
      section,
      type: q.type as QuestionType,
      label,
      ...(str(q.help, 300) && { help: str(q.help, 300) }),
      ...(options && { options }),
      required: q.required === true,
      ...(needsOptions &&
        q.allowOther === true &&
        options!.some((o) => o.value === OTHER) && { allowOther: true }),
      ...(showIf && { showIf }),
      ...(tag && { tag }),
    });
  }
  return { ok: true, questions: out };
}

/** Questions are stored as JSON: read them back without trusting the shape. */
export function parseQuestions(raw: unknown): SurveyQuestion[] {
  return Array.isArray(raw)
    ? (raw as SurveyQuestion[]).filter((q) => q && typeof q.id === 'string')
    : [];
}

const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : typeof v === 'string' && v
    ? [v]
    : [];

/** Whether a question is shown, given the answers so far (hidden parent ⇒ hidden child). */
export function isVisible(
  q: SurveyQuestion,
  answers: Answers,
  all: SurveyQuestion[],
  depth = 0,
): boolean {
  if (!q.showIf) return true;
  if (depth > 10) return false;
  const parent = all.find((p) => p.id === q.showIf!.questionId);
  if (!parent || !isVisible(parent, answers, all, depth + 1)) return false;
  const picked = asList(answers[parent.id]);
  return picked.some((v) => q.showIf!.anyOf.includes(v));
}

export type AnswerError = { questionId: string; message: string };

/**
 * Check the respondent's answers. Answers to hidden or unknown questions are dropped,
 * text is trimmed and capped, and every required visible question must be answered.
 */
export function validateAnswers(
  questions: SurveyQuestion[],
  raw: unknown,
): { ok: true; answers: Answers } | { ok: false; errors: AnswerError[] } {
  const input = (
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  ) as Record<string, unknown>;
  const clean: Answers = {};
  const errors: AnswerError[] = [];
  const allowedSlots = new Set(
    AVAILABILITY_DAYS.flatMap((d) =>
      AVAILABILITY_TIMES.map((t) => `${d.value}:${t.value}`),
    ),
  );

  for (const q of questions) {
    // Visibility uses what has been cleaned so far (parents come first)
    if (!isVisible(q, clean, questions)) continue;
    const v = input[q.id];
    let value: string | string[] | undefined;

    if (q.type === 'single') {
      const s = typeof v === 'string' ? v : '';
      if (s && !q.options?.some((o) => o.value === s)) {
        errors.push({ questionId: q.id, message: 'Choix invalide' });
        continue;
      }
      value = s || undefined;
    } else if (q.type === 'multi' || q.type === 'availability') {
      const list = [...new Set(asList(v))];
      const okValue = (x: string) =>
        q.type === 'availability'
          ? allowedSlots.has(x)
          : !!q.options?.some((o) => o.value === x);
      if (list.some((x) => !okValue(x))) {
        errors.push({ questionId: q.id, message: 'Choix invalide' });
        continue;
      }
      value = list.length ? list : undefined;
    } else {
      const max = q.type === 'long' ? LONG_MAX : SHORT_MAX;
      if (typeof v === 'string' && v.trim().length > max) {
        errors.push({
          questionId: q.id,
          message: `${max} caractères au maximum`,
        });
        continue;
      }
      value = str(v, max) || undefined;
    }

    if (value === undefined) {
      if (q.required)
        errors.push({ questionId: q.id, message: 'Réponse requise' });
      continue;
    }
    clean[q.id] = value;

    if (q.allowOther && asList(value).includes(OTHER)) {
      const other = str(input[`${q.id}__other`], OTHER_MAX);
      if (other) clean[`${q.id}__other`] = other;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, answers: clean };
}

/** Answer of the first question carrying a tag. */
export function tagged(
  questions: SurveyQuestion[],
  answers: Answers,
  tag: QuestionTag,
): string[] {
  const q = questions.find((x) => x.tag === tag);
  return q ? asList(answers[q.id]) : [];
}

/** Learner / volunteer / both, from the role question (no role question = learner). */
export function deriveRole(
  questions: SurveyQuestion[],
  answers: Answers,
): 'LEARN' | 'SHARE' | 'BOTH' | null {
  const hasRoleQuestion = questions.some((q) => q.tag === 'role');
  const v = tagged(questions, answers, 'role')[0];
  if (v === 'LEARN' || v === 'SHARE' || v === 'BOTH') return v;
  return hasRoleQuestion ? null : 'LEARN';
}

/** Subjects the respondent wants to learn (indexed column). */
export function deriveSubjects(
  questions: SurveyQuestion[],
  answers: Answers,
): string[] {
  return tagged(questions, answers, 'learnSubjects').slice(0, 20);
}
