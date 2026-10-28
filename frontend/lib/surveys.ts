/**
 * Learn & Share surveys: shared types and pure helpers (admin page + public survey).
 * Mirrors backend/src/modules/surveys/survey-schema.ts.
 */

export type SurveyStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
export type QuestionType = "single" | "multi" | "short" | "long" | "availability";
export type QuestionTag =
  | "role"
  | "learnSubjects"
  | "level"
  | "format"
  | "days"
  | "times"
  | "attend"
  | "teachSubjects"
  | "teachTime"
  | "teachSlots"
  | "host";
export type QuestionOption = { value: string; label: string };
export type SurveyQuestion = {
  id: string;
  section: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: QuestionOption[];
  required: boolean;
  allowOther?: boolean;
  showIf?: { questionId: string; anyOf: string[] };
  tag?: QuestionTag;
};
export type SurveySection = { id: string; title: string; description?: string };
export type ContactMode = "NONE" | "OPTIONAL" | "REQUIRED";
export type DuplicatePolicy = "KEEP_ALL" | "LATEST_PER_BROWSER";
export type SurveySettings = {
  sections: SurveySection[];
  contactMode: ContactMode;
  contactText: string;
  duplicatePolicy: DuplicatePolicy;
  attributionDays: number;
  requireLogin: boolean;
  successMessage: string;
};
export type Answers = Record<string, string | string[]>;
export type RespondentType = "MEMBER" | "NEW_MEMBER" | "KNOWN" | "ANONYMOUS";
export type SurveyRole = "LEARN" | "SHARE" | "BOTH";

export type SurveyLink = {
  id: string;
  code: string;
  channel: string;
  label: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  opens: number;
  visitors: number;
  responses: number;
  createdAt: string;
};

export type SurveySummary = {
  id: string;
  slug: string;
  title: string;
  status: SurveyStatus;
  closesAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  visitors: number;
  responses: number;
};

export type SurveyDetail = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  description: string | null;
  purpose: string | null;
  audience: string | null;
  status: SurveyStatus;
  closesAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  orgSlug: string | null;
  questions: SurveyQuestion[];
  settings: SurveySettings;
  links: SurveyLink[];
};

export type CountRow = { value: string; label: string; count: number };

export type SurveyDashboard = {
  kpis: {
    clicks: number;
    visitors: number;
    started: number;
    responses: number;
    completionRate: number | null;
    flagged: number;
  };
  roles: Record<SurveyRole, number>;
  types: Record<RespondentType, number>;
  subjects: Array<{
    value: string;
    label: string;
    learners: number;
    committed: number;
    volunteers: number;
    others?: string[];
  }>;
  days: CountRow[];
  times: CountRow[];
  attend: CountRow[];
  levels: CountRow[];
  formats: CountRow[];
  host: CountRow[];
  volunteerSlots: Array<{
    day: string;
    label: string;
    times: Array<{ time: string; label: string; count: number }>;
  }>;
  campaigns: Array<{
    source: string;
    medium: string | null;
    visitors: number;
    started: number;
    responses: number;
    /** Responses ÷ started, % (null when nobody started) */
    completionRate: number | null;
    linked: number;
    registered: number;
    attended: number;
    paidVisits: number;
  }>;
  funnel: {
    responses: number;
    linked: number;
    registered: number;
    attended: number;
    visited: number;
    paid: number;
    subscribed: number;
  };
  directSource: string;
};

export type SurveyResponseRow = {
  id: string;
  createdAt: string;
  type: RespondentType;
  role: SurveyRole | null;
  subjects: string[];
  answers: Answers;
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  method: "LINK" | "UTM" | "DIRECT";
  link: { id: string; label: string | null; code: string } | null;
  contactName: string | null;
  contactPhone: string | null;
  contactConsentAt: string | null;
  member: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  memberLinkMethod: string | null;
  flagged: boolean;
  supersededAt: string | null;
};

export type SurveyFilters = {
  linkId?: string;
  source?: string;
  from?: string;
  to?: string;
  type?: RespondentType;
  role?: SurveyRole;
  all?: "0" | "1";
  page?: number;
  pageSize?: number;
};

export type SurveyVolunteer = {
  responseId: string;
  createdAt: string;
  name: string | null;
  phone: string | null;
  memberId: string | null;
  subjects: string[];
  otherSubject: string | null;
  experience: string | null;
  time: string | null;
  slots: string[];
  host: string | null;
};

export type LearningSession = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  capacity: number | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  hostName: string | null;
  hostResponseId: string | null;
  registered: number;
  attended: number;
  rewardGivenAt: string | null;
  rewardNote: string | null;
};

export type PublicSurvey = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  description: string | null;
  open: boolean;
  closesAt: string | null;
  questions: SurveyQuestion[];
  settings: Pick<
    SurveySettings,
    "sections" | "contactMode" | "contactText" | "successMessage" | "requireLogin"
  >;
};

/* ───────────── labels ───────────── */

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  PAUSED: "En pause",
  CLOSED: "Fermé",
};

export const TYPE_LABEL: Record<RespondentType, string> = {
  MEMBER: "Client",
  NEW_MEMBER: "Nouveau client",
  KNOWN: "Connu",
  ANONYMOUS: "Anonyme",
};

export const ROLE_LABEL: Record<SurveyRole, string> = {
  LEARN: "Apprendre",
  SHARE: "Partager",
  BOTH: "Les deux",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: "Choix unique",
  multi: "Choix multiple",
  short: "Texte court",
  long: "Texte long",
  availability: "Jours × moments",
};

/** Same keys as backend LINK_PRESETS. */
export const LINK_PRESETS = [
  { key: "instagram_story", label: "Instagram — Story" },
  { key: "instagram_bio", label: "Instagram — Lien en bio" },
  { key: "instagram_post", label: "Instagram — Post / Reel" },
  { key: "whatsapp_community", label: "WhatsApp — Groupe" },
  { key: "whatsapp_message", label: "WhatsApp — Message" },
  { key: "facebook", label: "Facebook" },
  { key: "club", label: "Club universitaire" },
  { key: "qr_poster", label: "Affiche QR" },
  { key: "other", label: "Autre" },
] as const;
export type LinkPresetKey = (typeof LINK_PRESETS)[number]["key"];

export const AVAILABILITY_DAYS = [
  { value: "mon", label: "Lun" },
  { value: "tue", label: "Mar" },
  { value: "wed", label: "Mer" },
  { value: "thu", label: "Jeu" },
  { value: "fri", label: "Ven" },
  { value: "sat", label: "Sam" },
  { value: "sun", label: "Dim" },
];
export const AVAILABILITY_TIMES = [
  { value: "morning", label: "Matin" },
  { value: "afternoon", label: "Après-midi" },
  { value: "evening", label: "Soir" },
];
export const OTHER = "other";

/* ───────────── rules ───────────── */

export const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : typeof v === "string" && v
      ? [v]
      : [];

/** Whether a question is shown, given the answers so far (hidden parent ⇒ hidden child). */
export function isVisible(
  q: SurveyQuestion,
  answers: Answers,
  all: SurveyQuestion[],
  depth = 0
): boolean {
  if (!q.showIf) return true;
  if (depth > 10) return false;
  const parent = all.find((p) => p.id === q.showIf!.questionId);
  if (!parent || !isVisible(parent, answers, all, depth + 1)) return false;
  return asList(answers[parent.id]).some((v) => q.showIf!.anyOf.includes(v));
}

/** "si Vous voulez plutôt… = Partager ou Les deux" */
export function conditionLabel(q: SurveyQuestion, all: SurveyQuestion[]) {
  if (!q.showIf) return null;
  const parent = all.find((p) => p.id === q.showIf!.questionId);
  if (!parent) return null;
  const values = q.showIf.anyOf
    .map((v) => parent.options?.find((o) => o.value === v)?.label ?? v)
    .join(" ou ");
  const name = parent.tag === "role" ? "rôle" : `« ${parent.label} »`;
  return `si ${name} = ${values}`;
}

/** Public address of a survey; a link adds its code and UTM values. */
export function surveyUrl(
  origin: string,
  orgSlug: string,
  slug: string,
  link?: Pick<SurveyLink, "code" | "source" | "medium" | "campaign" | "content"> | null
) {
  const base = `${origin}/m/${orgSlug}/s/${slug}`;
  if (!link) return base;
  const q = new URLSearchParams({ c: link.code });
  if (link.source) q.set("utm_source", link.source);
  if (link.medium) q.set("utm_medium", link.medium);
  if (link.campaign) q.set("utm_campaign", link.campaign);
  if (link.content) q.set("utm_content", link.content);
  return `${base}?${q.toString()}`;
}

export const qrImageUrl = (data: string, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;

/** "1 apprenant", "3 apprenants" */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n > 1 ? many : word}`;

export const pct = (a: number, b: number) =>
  b ? `${Math.round((a / b) * 1000) / 10}`.replace(".", ",") + " %" : "—";
