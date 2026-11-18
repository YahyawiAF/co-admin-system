import { http } from "./httpClient";

/** Directeur: the business mastermind (backend: advisor/director). */

export type DirectorEntryKind = "DECISION" | "FACT" | "LESSON" | "TEST";
export type DirectorStatus = "red" | "orange" | "green" | "grey";

export type DirectorEntry = {
  id: string;
  date: string;
  kind: DirectorEntryKind;
  kindLabel: string;
  corner: string;
  text: string;
  detail: string | null;
  source: "OWNER" | "CLAUDE" | "APP";
};

export type DirectorCorner = {
  id: string;
  name: string;
  status: DirectorStatus;
  statusLabel: string;
  fact: string;
  notes: number;
  custom: boolean;
};

export type DirectorAlert = {
  moneyNow: number;
  moneyBefore: number;
  clientsNow: number;
  clientsBefore: number;
  moneyPct: number;
  clientsPct: number;
  status: "red" | "orange" | null;
  from: string;
  to: string;
  startedOn: string | null;
};

export type DirectorOverview = {
  goal: { profit: number; date: string | null };
  month: { year: number; month: number; income: number; charges: number; profit: number | null };
  alert: DirectorAlert | null;
  corners: DirectorCorner[];
  memory: DirectorEntry[];
  questions: Array<{ id: string; question: string }>;
  suggestions: Array<{ title: string; corner: string; why: string; gain: number | null; href: string | null }>;
  brief: DirectorBrief | null;
  maxRunning: number;
  priorities: DirectorPriority[];
  watches: DirectorWatch[];
  needs: DirectorNeed[];
  lessons: DirectorLesson[];
  /** Texts waiting for the next export, for the brain to learn */
  learn: Array<{ id: string; text: string; at: string }>;
};

export type DirectorLessonStatus = "CANDIDATE" | "TESTING" | "ADOPTED" | "ADAPTED" | "REJECTED" | "RETIRED";

/** Knowledge the director kept after challenging it; results move its confidence. */
export type DirectorLesson = {
  id: string;
  rule: string;
  why: string | null;
  corner: string;
  date: string;
  source: "OWNER" | "CLAUDE" | "APP";
  status: DirectorLessonStatus;
  confidence: number;
  domain: string;
  origin: string | null;
  results: Array<{ priority: string; watch: string; change: number | null; unit: string; sales: number | null; date: string }>;
  evidence: Array<{ date: string; text: string }>;
  debate: Array<{ by: "OWNER" | "DIRECTOR"; text: string; date: string }>;
  history: Array<{ date: string; change: string; why: string }>;
  canContest: boolean;
  contested: boolean;
  flag: "review" | "promote" | null;
};

export type DirectorLegKind = "PROMOTION" | "EVENT" | "SURVEY" | "CAMPAIGN" | "PRICE" | "PRODUCT";

/** A draft the brain prepared: the owner opens it, checks it and creates it (OK). */
export type DirectorLeg = {
  index: number;
  kind: DirectorLegKind;
  label: string;
  draft: Record<string, unknown>;
  status: "DRAFT" | "DONE" | "SKIPPED";
  targetId: string | null;
  doneAt: string | null;
};

export type DirectorWatchResult = {
  status: "waiting" | "running" | "done";
  daysMeasured: number;
  length: number;
  before: number | null;
  after: number | null;
  change: number | null;
  changeUnit: "%" | "pts";
  splits: Array<{ key: string; before: number; after: number }>;
  periods: string[];
  sales: { count: number; revenue: number } | null;
  goal: number | null;
  goalReached: boolean | null;
};

/** A number the app follows by itself after a change. */
export type DirectorWatch = {
  id: string;
  eye: string;
  params: Record<string, string | number>;
  label: string;
  unit: string;
  aggregate: "sum" | "ratio";
  startDate: string;
  days: number;
  goal: number | null;
  stopped: boolean;
  result: DirectorWatchResult | null;
};

export type DirectorPriority = {
  id: string;
  title: string;
  corner: string;
  why: string;
  steps: Array<{ text: string; done: boolean }>;
  legs: DirectorLeg[];
  status: "ACTIVE" | "DONE" | "DROPPED";
  source: "CLAUDE" | "OWNER";
  startDate: string;
  closedAt: string | null;
  watches: DirectorWatch[];
};

/** What the brain can't see or do yet: the owner decides whether to have it coded. */
export type DirectorNeed = {
  key: string;
  title: string;
  problem: string | null;
  capability: string | null;
  stage: "SUGGESTED" | "APPROVED" | "TICKET_READY" | "DEFERRED";
};

export type DirectorBrief = {
  date: string;
  basedOn: string | null;
  summary: string | null;
  priorities: Array<{ title: string; corner: string; why: string }>;
};

/** Claude's answer, checked by the app before anything is saved. */
export type DirectorUpdatePlan = {
  format: string;
  basedOn: string | null;
  summary: string | null;
  priorities: Array<{
    title: string;
    corner: string;
    why: string;
    steps: string[];
    legs: Array<{ kind: DirectorLegKind; label: string; draft: Record<string, unknown> }>;
    watch: Array<{ eye: string; params: Record<string, string | number>; days: number; label: string | null; goal: number | null }>;
  }>;
  look: Array<{ eye: string; params: Record<string, string | number>; from: string; to: string; why: string }>;
  needs: Array<{ title: string; problem: string; capability: string }>;
  lessons: Array<{
    ref: number;
    learnId: string | null;
    claim: string;
    verdict: "ADOPT" | "ADAPT" | "TEST" | "REJECT" | "SAME";
    rule: string;
    why: string | null;
    changed: string | null;
    changeMind: string | null;
    sameAs: string | null;
    corner: string;
    domain: string;
  }>;
  confidence: Array<{ id: string; confidence: number; why: string; status: DirectorLessonStatus | null }>;
  replies: Array<{ id: string; reply: string; rule: string | null; status: DirectorLessonStatus | null }>;
  add: Array<{ date: string; kind: DirectorEntryKind; corner: string; text: string; detail: string | null }>;
  update: Array<{ id: string; text?: string; detail?: string | null; kind?: DirectorEntryKind; corner?: string; date?: string }>;
  remove: string[];
  corners: Array<{ id: string; name: string }>;
  questions: string[];
  warnings: string[];
};

export type DirectorEntryInput = {
  date?: string;
  kind?: DirectorEntryKind;
  corner?: string;
  text?: string;
  detail?: string | null;
};

export const DIRECTOR_KEY = ["director"] as const;

export const directorApi = {
  overview() {
    return http.get<DirectorOverview>("/director");
  },
  exportForClaude() {
    return http.get<Record<string, unknown> & { exportedAt: string }>("/director/export");
  },
  previewUpdate(json: string) {
    return http.post<DirectorUpdatePlan>("/director/update/preview", { json });
  },
  applyUpdate(json: string) {
    return http.post<{
      priorities: number;
      watches: number;
      drafts: number;
      looks: number;
      needs: number;
      lessons: number;
      confidence: number;
      replies: number;
      added: number;
      updated: number;
      removed: number;
      corners: number;
      questions: number;
      brief: boolean;
      warnings: string[];
    }>(
      "/director/update",
      { json },
    );
  },
  setPriority(id: string, status: DirectorPriority["status"]) {
    return http.patch<{ ok: true }>(`/director/priorities/${id}`, { status });
  },
  setLeg(id: string, index: number, data: { targetId?: string | null; status?: DirectorLeg["status"] }) {
    return http.patch<{ ok: true }>(`/director/priorities/${id}/legs/${index}`, data);
  },
  setStep(id: string, index: number, done: boolean) {
    return http.patch<{ ok: true }>(`/director/priorities/${id}/steps/${index}`, { done });
  },
  stopWatch(id: string) {
    return http.patch<{ ok: true }>(`/director/watches/${id}/stop`, {});
  },
  setNeed(key: string, stage: "APPROVED" | "DEFERRED" | "REJECTED") {
    return http.patch<{ ok: true }>(`/director/needs/${encodeURIComponent(key)}`, { stage });
  },
  addLearn(text: string) {
    return http.post<{ id: string; text: string; at: string }>("/director/learn", { text });
  },
  removeLearn(id: string) {
    return http.delete<{ ok: true }>(`/director/learn/${encodeURIComponent(id)}`);
  },
  contestLesson(id: string, text: string) {
    return http.post<{ ok: true }>(`/director/lessons/${id}/contest`, { text });
  },
  lessonsFile() {
    return http.get<Record<string, unknown> & { exportedAt: string }>("/director/lessons/file");
  },
  importLessonsFile(json: string) {
    return http.post<{ added: number; skipped: number }>("/director/lessons/file", { json });
  },
  setGoal(data: { profit?: number; date?: string | null }) {
    return http.patch<DirectorOverview>("/director/goal", data);
  },
  createEntry(data: DirectorEntryInput) {
    return http.post<DirectorEntry>("/director/entries", data);
  },
  updateEntry(id: string, data: DirectorEntryInput) {
    return http.patch<DirectorEntry>(`/director/entries/${id}`, data);
  },
  deleteEntry(id: string) {
    return http.delete<{ ok: true }>(`/director/entries/${id}`);
  },
  importEntries(text: string) {
    return http.post<{ added: number; skipped: string[]; newCorners: Array<{ id: string; name: string }> }>("/director/entries/import", { text });
  },
  addCorner(name: string) {
    return http.post<{ id: string; name: string }>("/director/corners", { name });
  },
  removeCorner(id: string) {
    return http.delete<{ ok: true }>(`/director/corners/${id}`);
  },
};
