/**
 * Lessons: knowledge the director keeps after challenging it. The owner pastes a text
 * (a book note, a video summary, an idea), the brain splits it into claims and judges each:
 * adopt, adapt (rewritten), test (becomes a priority with a watch), reject (kept so it
 * never comes back) or same (merged with a lesson it already has). Results move the confidence.
 */

export const LESSON_STATUSES = ['CANDIDATE', 'TESTING', 'ADOPTED', 'ADAPTED', 'REJECTED', 'RETIRED'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export const VERDICTS = ['ADOPT', 'ADAPT', 'TEST', 'REJECT', 'SAME'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_STATUS: Record<Exclude<Verdict, 'SAME'>, LessonStatus> = {
  ADOPT: 'ADOPTED',
  ADAPT: 'ADAPTED',
  TEST: 'TESTING',
  REJECT: 'REJECTED',
};
/** Starting confidence: only results move it after that. */
export const START_CONFIDENCE: Record<Exclude<Verdict, 'SAME'>, number> = { ADOPT: 60, ADAPT: 50, TEST: 30, REJECT: 0 };

/** Every business: a principle. Else the trade it was learned in (coworking, retail…). */
export const ANY_DOMAIN = '*';
export const MAX_BRIEF = 15;

export type LessonResult = { priority: string; watch: string; change: number | null; unit: string; sales: number | null; date: string };

export type LessonView = {
  id: string;
  rule: string;
  why: string | null;
  corner: string;
  status: LessonStatus;
  confidence: number;
  domain: string;
  /** Results of the watches of priorities that used this lesson */
  results: LessonResult[];
  /** Domains where a result backs it (filled by the shared brain later; the host's own domain today) */
  provenIn?: string[];
};

export type LessonFlag = 'review' | 'promote' | null;

/**
 * review: below 20 after 3 results, the brain should rewrite or retire it.
 * promote: above 80 and backed in 2 trades, it becomes a principle.
 */
export function lessonFlag(l: Pick<LessonView, 'confidence' | 'results' | 'domain' | 'provenIn'>): LessonFlag {
  if (l.results.length >= 3 && l.confidence < 20) return 'review';
  if (l.domain !== ANY_DOMAIN && l.confidence > 80 && (l.provenIn?.length ?? 0) >= 2) return 'promote';
  return null;
}

/**
 * The lessons that go into an export: the host's domain and principles, never the rejected or
 * retired ones, the corners in trouble first, then the most trusted. The prompt stays short
 * while the brain grows.
 */
export function pickLessons<T extends LessonView>(all: T[], ctx: { domain: string; hotCorners?: string[]; max?: number }): T[] {
  const hot = new Set(ctx.hotCorners ?? []);
  return all
    .filter((l) => (l.domain === ANY_DOMAIN || l.domain === ctx.domain) && l.status !== 'REJECTED' && l.status !== 'RETIRED')
    .sort(
      (a, b) =>
        Number(hot.has(b.corner)) - Number(hot.has(a.corner)) ||
        Number(b.status === 'TESTING') - Number(a.status === 'TESTING') ||
        b.confidence - a.confidence ||
        b.results.length - a.results.length,
    )
    .slice(0, ctx.max ?? MAX_BRIEF);
}

/** Same idea written twice (case, accents and punctuation ignored): used when importing a lessons file. */
export const sameRule = (a: string, b: string) => {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return norm(a) === norm(b);
};

export const LESSONS_FILE_FORMAT = 'directeur-lessons/v1';
