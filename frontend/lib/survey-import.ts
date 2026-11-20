import { splitEmoji, type QuestionOption, type QuestionType, type SurveyQuestion } from "@/lib/surveys";

/** Request the owner pastes into Claude so it writes a survey the app can read. */
export function claudeSurveyRequest(orgName: string, topic: string) {
  return `Crée un sondage pour ${orgName}, un espace de coworking pour étudiants.
Sujet : ${topic.trim() || "(à préciser)"}

Règles :
- Tutoie. Phrases courtes et simples.
- Peu de questions (1 à 6). Chaque choix de réponse a un emoji.
- Ne demande pas le nom ni le téléphone : l'appli le fait à la fin.
- "endMessage" : le message de l'équipe affiché à la fin (ex. « Notre équipe va te contacter très vite »).

Donne le sondage en UN bloc JSON, rien d'autre, dans ce format :
{
  "title": "Titre du sondage",
  "intro": "1 phrase d'accueil",
  "endMessage": "Merci ! Notre équipe va te contacter très vite sur WhatsApp.",
  "questions": [
    {
      "label": "Tu veux plutôt…",
      "type": "single",
      "required": true,
      "options": [ { "emoji": "📚", "label": "Apprendre" }, { "emoji": "🤝", "label": "Partager" } ]
    },
    {
      "label": "Dans quoi peux-tu aider ?",
      "type": "multi",
      "onlyIf": { "question": 1, "answers": ["Partager"] },
      "options": [ { "emoji": "💻", "label": "Code" } ]
    }
  ]
}
Types possibles : single (1 choix), multi (plusieurs), text (réponse courte), long (réponse longue), availability (grille jours × moments, sans options).
"onlyIf" est optionnel : la question s'affiche seulement si la question n° X a reçu une de ces réponses.`;
}

export type ImportedQuestion = SurveyQuestion & { fixes: string[] };
export type ImportResult =
  | { ok: true; title: string; intro: string; endMessage: string; questions: ImportedQuestion[]; cut: boolean }
  | { ok: false; error: string; help: string };

const TYPES: Record<string, QuestionType> = {
  single: "single",
  multi: "multi",
  text: "short",
  short: "short",
  long: "long",
  availability: "availability",
};
export const IMPORT_TYPE_LABEL: Record<QuestionType, string> = {
  single: "1 choix",
  multi: "plusieurs choix",
  short: "texte court",
  long: "texte long",
  availability: "grille de dispo",
};
const MAX = 30;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "choix";
const same = (a: string, b: string) => slug(splitEmoji(a).label) === slug(splitEmoji(b).label);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Reads the survey Claude wrote: finds the JSON block in the pasted text, fixes what it can and says what it fixed. */
export function parseClaudeSurvey(raw: string): ImportResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start)
    return { ok: false, error: "Je ne trouve pas de sondage dans ce texte.", help: "Demandez à Claude : « Donne-moi le sondage final en bloc JSON ». Puis collez-le ici." };
  let data: { title?: unknown; intro?: unknown; endMessage?: unknown; questions?: unknown };
  try {
    // Claude sometimes leaves a comma before } or ]
    data = JSON.parse(raw.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1"));
  } catch {
    return { ok: false, error: "Le sondage est coupé ou mal fermé.", help: "Copiez le sondage de Claude en entier, jusqu’à la dernière accolade }. Sinon, demandez-lui de le renvoyer." };
  }
  const list = Array.isArray(data.questions) ? (data.questions as Record<string, unknown>[]) : [];
  if (!list.length) return { ok: false, error: "Ce sondage n’a aucune question.", help: "Demandez à Claude de renvoyer le sondage avec ses questions." };

  const out: ImportedQuestion[] = [];
  list.slice(0, MAX).forEach((q, n) => {
    const fixes: string[] = [];
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const values = new Set<string>();
    let options: QuestionOption[] = [];
    for (const o of rawOptions) {
      const parsed =
        typeof o === "string"
          ? splitEmoji(o)
          : { emoji: text((o as { emoji?: unknown })?.emoji, 16) || undefined, label: text((o as { label?: unknown })?.label, 120) };
      if (!parsed.label) continue;
      let value = slug(parsed.label);
      for (let k = 2; values.has(value); k++) value = `${slug(parsed.label)}_${k}`;
      values.add(value);
      options.push({ value, label: parsed.label, ...(parsed.emoji && { emoji: parsed.emoji }) });
    }
    let type = TYPES[String(q.type ?? "")];
    if (!type) {
      type = options.length >= 2 ? "single" : "short";
      fixes.push(`type inconnu « ${String(q.type ?? "vide")} » → ${IMPORT_TYPE_LABEL[type]}`);
    }
    if ((type === "single" || type === "multi") && options.length < 2) {
      type = "short";
      fixes.push("moins de 2 réponses → texte court");
    }
    if (type !== "single" && type !== "multi") options = [];
    if (options.some((o) => !o.emoji)) {
      options = options.map((o) => ({ ...o, emoji: o.emoji || "✨" }));
      fixes.push("emoji manquant → ✨");
    }

    let showIf: SurveyQuestion["showIf"];
    const only = q.onlyIf as { question?: unknown; answers?: unknown } | undefined;
    if (only && typeof only === "object") {
      const parent = out[Number(only.question) - 1];
      const answers = Array.isArray(only.answers) ? only.answers.filter((a): a is string => typeof a === "string") : [];
      const anyOf = parent?.options?.filter((o) => answers.some((a) => same(a, o.label))).map((o) => o.value) ?? [];
      if (parent && anyOf.length) showIf = { questionId: parent.id, anyOf };
      else fixes.push("condition impossible → toujours affichée");
    }

    const label = text(q.label, 200) || `Question ${n + 1}`;
    const say = text(q.say, 140);
    out.push({
      id: `q${n + 1}`,
      section: "main",
      type,
      label,
      required: q.required === true,
      ...(options.length && { options }),
      ...(showIf && { showIf }),
      ...(say && { say }),
      fixes,
    });
  });
  return {
    ok: true,
    title: text(data.title, 120) || "Sondage sans titre",
    intro: text(data.intro, 1000),
    endMessage: text(data.endMessage, 300),
    questions: out,
    cut: list.length > MAX,
  };
}
