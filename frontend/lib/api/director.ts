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
};

export type DirectorBrief = {
  date: string;
  basedOn: string | null;
  summary: string | null;
  priorities: Array<{ title: string; corner: string; why: string }>;
};

/** Claude's answer, checked by the app before anything is saved. */
export type DirectorUpdatePlan = {
  basedOn: string | null;
  summary: string | null;
  priorities: DirectorBrief["priorities"];
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
    return http.post<{ added: number; updated: number; removed: number; corners: number; questions: number; brief: boolean; warnings: string[] }>(
      "/director/update",
      { json },
    );
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
