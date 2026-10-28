import { http } from "./httpClient";

/** Conseiller « Questions » and « Argent » tabs (backend: advisor/manager). */

export type ManagerChoice = { label: string; value: number; note?: string; recommended?: boolean };

export type ManagerQuestion = {
  key: string;
  short: string;
  title: string;
  why: string;
  choices: ManagerChoice[];
  exactLabel?: string;
  unknownLabel?: string;
  more?: { label: string; href: string };
  reason: "MISSING" | "STALE" | "UNKNOWN";
  priority: number;
};

export type ManagerQuestions = {
  pending: ManagerQuestion[];
  /** Every question, to change an answer already given */
  editable: ManagerQuestion[];
  toAsk: number;
  known: number;
  total: number;
  answers: Array<{ key: string; short: string; label: string; note: string | null; unknown: boolean; answeredAt: string }>;
  read: Array<{ title: string; detail: string; value?: string; source: string; warn?: boolean }>;
  later: Array<{ title: string; detail: string }>;
};

export type MoneySourceKind = "APP" | "APP_UNCONFIRMED" | "ANSWER" | "DEFAULT" | "MISSING" | "UNKNOWN" | "CALC";

export type MoneyPlan = {
  state: "UNKNOWN" | "PARTIAL" | "OK";
  missing: string[];
  liquid: number | null;
  keep: number | null;
  invest: number | null;
  monthlyCosts: number | null;
  reserveMonths: number;
  lines: Array<{
    key: string;
    label: string;
    detail?: string;
    amount: number | null;
    sign: 1 | -1;
    source: { kind: MoneySourceKind; at?: string };
  }>;
  verdict:
    | { kind: "MISSING" }
    | { kind: "NO"; shortfall: number }
    | { kind: "SMALL_TEST"; invest: number; income: number; incomeLabel: string; costs: number }
    | { kind: "OK"; invest: number };
};

export type MoneyIdea = {
  key: string;
  title: string;
  why: string;
  cost: number;
  test: string;
  goal: string;
  stop: string;
  notNow: boolean;
  fit: "NOT_NOW" | "WAITING" | "IN_BUDGET" | "OVER_BUDGET";
  draft?: { category: string; metric: string; targetPct: number; fromHour: number; toHour: number };
};

export type FeatureProposal = {
  key: string;
  title: string;
  problem: string;
  capability: string;
  test: string;
  stage: "SUGGESTED" | "APPROVED" | "TICKET_READY";
  ticket: string | null;
};

export type MoneyView = {
  asOf: string;
  plan: MoneyPlan;
  months: Array<{ month: string; label: string; longLabel: string; income: number; current: boolean; asOfDay: number | null }>;
  unpaid: { total: number; clients: number };
  ideas: MoneyIdea[];
  features: FeatureProposal[];
};

export type AnswerBody = { value?: number | null; label?: string; note?: string | null; unknown?: boolean };

export const managerApi = {
  questions() {
    return http.get<ManagerQuestions>("/advisor/manager/questions");
  },
  answer(key: string, body: AnswerBody) {
    return http.put<ManagerQuestions>(`/advisor/manager/answers/${key}`, body);
  },
  money() {
    return http.get<MoneyView>("/advisor/manager/money");
  },
  setFeatureStage(key: string, stage: "APPROVED" | "TICKET_READY" | "DEFERRED" | "REJECTED") {
    return http.patch<MoneyView>(`/advisor/manager/features/${key}`, { stage });
  },
};

export const dt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} DT`;
