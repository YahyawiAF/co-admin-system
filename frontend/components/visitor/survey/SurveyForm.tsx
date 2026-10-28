"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  HandHeart,
  Loader2,
  MapPin,
  MessageSquare,
  Repeat,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_TIMES,
  OTHER,
  asList,
  isVisible,
  type Answers,
  type PublicSurvey,
  type SurveyQuestion,
  type SurveySection,
} from "@/lib/surveys";

/** At most this many questions per screen; a question others depend on ends its screen. */
const PER_STEP = 3;

type QStep = { kind: "questions"; section: SurveySection; firstOfSection: boolean; questions: SurveyQuestion[] };
type Step = QStep | { kind: "contact" };

export type SurveyDraftState = {
  answers: Answers;
  name: string;
  phone: string;
  consent: boolean;
  step: number;
  startedAt: number;
};

export type SubmitPayload = {
  answers: Answers;
  contact?: { name?: string; phone?: string; consent?: boolean };
  hp: string;
  elapsedMs: number;
};

export type SubmitError = Error & { errors?: Array<{ questionId: string; message: string }>; network?: boolean };

function buildSteps(questions: SurveyQuestion[], answers: Answers, sections: SurveySection[], withContact: boolean): Step[] {
  const parents = new Set(questions.map((q) => q.showIf?.questionId).filter(Boolean) as string[]);
  const steps: Step[] = [];
  let cur: (QStep & { closed?: boolean }) | null = null;
  for (const q of questions) {
    if (!isVisible(q, answers, questions)) continue;
    if (!cur || cur.section.id !== q.section || cur.questions.length >= PER_STEP || cur.closed) {
      const section = sections.find((s) => s.id === q.section) ?? sections[0] ?? { id: q.section, title: "" };
      const firstOfSection = !steps.some((s) => s.kind === "questions" && s.section.id === section.id);
      cur = { kind: "questions", section, firstOfSection, questions: [] };
      steps.push(cur);
    }
    cur.questions.push(q);
    if (parents.has(q.id)) cur.closed = true;
  }
  if (withContact) steps.push({ kind: "contact" });
  return steps;
}

/** Same rules as the server, so most mistakes are caught before sending. */
function checkQuestions(questions: SurveyQuestion[], answers: Answers, all: SurveyQuestion[]) {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (!isVisible(q, answers, all)) continue;
    const v = answers[q.id];
    const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
    if (q.required && empty) errors[q.id] = q.type === "multi" || q.type === "availability" ? "Choisis au moins une réponse." : q.type === "single" ? "Choisis une réponse." : "Réponse requise.";
    if (q.type === "long" && typeof v === "string" && v.length > 2000) errors[q.id] = "2000 caractères au maximum.";
    if (q.type === "short" && typeof v === "string" && v.length > 200) errors[q.id] = "200 caractères au maximum.";
  }
  return errors;
}

const phoneDigits = (s: string) => s.replace(/\D/g, "").replace(/^216/, "");

const ROLE_ICON: Record<string, typeof BookOpen> = { LEARN: BookOpen, SHARE: HandHeart, BOTH: Repeat };

export function SurveyForm({
  survey,
  orgName,
  preview = false,
  knownMember = false,
  alreadyAnsweredAt,
  initialDraft,
  onStart,
  onDraft,
  onSubmit,
  doneActions,
  framed = false,
}: {
  survey: Pick<PublicSurvey, "title" | "intro" | "questions" | "settings">;
  orgName: string;
  /** Admin preview: nothing is sent */
  preview?: boolean;
  /** The app already knows this person: no contact step */
  knownMember?: boolean;
  alreadyAnsweredAt?: number | null;
  initialDraft?: SurveyDraftState | null;
  onStart?: () => void;
  onDraft?: (d: SurveyDraftState) => void;
  onSubmit?: (p: SubmitPayload) => Promise<{ successMessage: string }>;
  doneActions?: ReactNode;
  /** Inside a fixed-height frame (admin preview) instead of the whole screen */
  framed?: boolean;
}) {
  const { questions, settings } = survey;
  const [phase, setPhase] = useState<"intro" | "steps" | "done">(initialDraft ? "steps" : "intro");
  const [answers, setAnswers] = useState<Answers>(initialDraft?.answers ?? {});
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [phone, setPhone] = useState(initialDraft?.phone ?? "");
  const [consent, setConsent] = useState(initialDraft?.consent ?? false);
  const [stepIdx, setStepIdx] = useState(initialDraft?.step ?? 0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState(settings.successMessage);
  const [hp, setHp] = useState("");
  const startedAt = useRef(initialDraft?.startedAt ?? 0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const withContact = settings.contactMode !== "NONE" && !knownMember;
  // Before the role is chosen, count the steps as for its first choice so the total does not jump
  const steps = useMemo(() => {
    const roleQ = questions.find((x) => x.tag === "role");
    const assumed = roleQ && !asList(answers[roleQ.id]).length && roleQ.options?.[0] ? { ...answers, [roleQ.id]: roleQ.options[0].value } : answers;
    return buildSteps(questions, assumed, settings.sections, withContact);
  }, [questions, answers, settings.sections, withContact]);
  const idx = Math.min(stepIdx, Math.max(steps.length - 1, 0));
  const step = steps[idx];

  useEffect(() => {
    if (phase !== "steps") return;
    onDraft?.({ answers, name, phone, consent, step: idx, startedAt: startedAt.current });
  }, [phase, answers, name, phone, consent, idx, onDraft]);

  const go = (to: number, d: 1 | -1) => {
    setDir(d);
    setErrors({});
    setFormError("");
    setStepIdx(to);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  const start = () => {
    startedAt.current = Date.now();
    setPhase("steps");
    setDir(1);
    setStepIdx(0);
    onStart?.();
  };

  const setAnswer = (id: string, v: string | string[]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setErrors((e) => {
      if (!e[id]) return e;
      const n = { ...e };
      delete n[id];
      return n;
    });
  };
  const toggle = (id: string, v: string) => {
    const list = asList(answers[id]);
    setAnswer(id, list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const checkContact = () => {
    const e: Record<string, string> = {};
    const digits = phoneDigits(phone);
    if (phone.trim() && digits.length !== 8) e["contact.phone"] = "Numéro tunisien attendu : 8 chiffres, ex. 22 123 456.";
    if (!phone.trim() && settings.contactMode === "REQUIRED") e["contact.phone"] = "Indique ton WhatsApp.";
    if (phone.trim() && !consent) e["contact.consent"] = "Coche la case pour qu’on puisse t’écrire, ou laisse le numéro vide.";
    return e;
  };

  /** Only answers to questions still shown are sent. */
  const visibleAnswers = () => {
    const out: Answers = {};
    for (const q of questions) {
      if (!isVisible(q, answers, questions)) continue;
      const v = answers[q.id];
      if (v === undefined || (Array.isArray(v) && !v.length) || (!Array.isArray(v) && !String(v).trim())) continue;
      out[q.id] = v;
      const other = answers[`${q.id}__other`];
      if (q.allowOther && asList(v).includes(OTHER) && typeof other === "string" && other.trim()) out[`${q.id}__other`] = other.trim();
    }
    return out;
  };

  const next = async () => {
    if (!step) return;
    const e = step.kind === "contact" ? checkContact() : checkQuestions(step.questions, answers, questions);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (idx < steps.length - 1) return go(idx + 1, 1);
    // Last screen: send
    if (preview || !onSubmit) {
      setPhase("done");
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const res = await onSubmit({
        answers: visibleAnswers(),
        contact: withContact && (name.trim() || phone.trim()) ? { name: name.trim() || undefined, phone: phone.trim() || undefined, consent } : undefined,
        hp,
        elapsedMs: startedAt.current ? Date.now() - startedAt.current : 0,
      });
      setSuccessMessage(res.successMessage || settings.successMessage);
      setDir(1);
      setPhase("done");
    } catch (err) {
      const se = err as SubmitError;
      if (se.errors?.length) {
        const map = Object.fromEntries(se.errors.map((x) => [x.questionId, x.message]));
        const target = steps.findIndex((s) =>
          s.kind === "contact"
            ? Object.keys(map).some((k) => k.startsWith("contact."))
            : s.questions.some((q) => map[q.id])
        );
        if (target >= 0 && target !== idx) go(target, -1);
        setErrors(map);
        setFormError(se.message);
      } else {
        setFormError(
          se.network
            ? "Pas de connexion. Réessaie : ta réponse ne sera pas comptée deux fois."
            : se.message || "Envoi impossible, réessaie."
        );
      }
    } finally {
      setSending(false);
    }
  };

  const qSteps = steps.length;
  const showBar = phase === "steps";

  return (
    <div className={cn("flex flex-col bg-white text-slate-900", framed ? "min-h-full" : "min-h-dvh")}>
      <header className="sticky top-0 z-10 space-y-2.5 bg-white/95 px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span className="tracking-wide text-indigo-700">{orgName.toUpperCase()}</span>
          {showBar ? (
            <span className="tabular-nums" aria-live="polite">
              Étape {idx + 1} sur {qSteps}
            </span>
          ) : preview ? (
            <span>Aperçu</span>
          ) : null}
        </div>
        {showBar ? (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={qSteps}
            aria-valuenow={idx + 1}
            aria-label="Progression"
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${((idx + 1) / qSteps) * 100}%` }}
            />
          </div>
        ) : null}
      </header>

      <div ref={bodyRef} className="flex-1 px-5 pb-6">
        {phase === "intro" ? (
          <div className="ls-enter space-y-5 pt-2">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">{survey.title}</h1>
              {survey.intro ? <p className="mt-3 text-[15px] leading-relaxed text-white/90">{survey.intro}</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
              {[
                ["2 min", "à remplir"],
                ["Sans compte", "ni appli"],
                ["Gratuit", "les séances"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-2xl bg-slate-50 px-2 py-3">
                  <b className="block text-[15px] text-slate-900">{a}</b>
                  {b}
                </div>
              ))}
            </div>
            <ul className="space-y-2.5 text-sm text-slate-700">
              <li className="flex items-center gap-2.5"><MessageSquare className="h-4 w-4 text-indigo-600" />Langues, code, maths, CV…</li>
              <li className="flex items-center gap-2.5"><Users className="h-4 w-4 text-indigo-600" />Des étudiants qui s’entraident</li>
              <li className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-indigo-600" />Chez {orgName}</li>
            </ul>
            {alreadyAnsweredAt ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Tu as déjà répondu depuis ce téléphone. Tu peux répondre à nouveau si tes envies ont changé.
              </p>
            ) : null}
          </div>
        ) : phase === "done" ? (
          <div className="ls-enter flex flex-col items-center gap-4 pt-14 text-center">
            <svg viewBox="0 0 88 88" className="ls-check h-[88px] w-[88px]" aria-hidden="true">
              <circle cx="44" cy="44" r="44" className="fill-emerald-50" />
              <path d="M27 45 l11 11 l23 -24" fill="none" stroke="#15803d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-2xl font-bold">Merci{name.trim() ? ` ${name.trim()}` : ""} !</h2>
            <p className="max-w-[32ch] text-[15px] text-slate-600">{successMessage}</p>
            {preview ? <p className="text-xs text-slate-400">Aperçu : rien n’a été envoyé.</p> : null}
          </div>
        ) : step ? (
          <div key={idx} className={cn("space-y-6 pt-1", dir > 0 ? "ls-in-right" : "ls-in-left")}>
            {step.kind === "contact" ? (
              <ContactStep
                orgName={orgName}
                text={settings.contactText}
                required={settings.contactMode === "REQUIRED"}
                name={name}
                phone={phone}
                consent={consent}
                errors={errors}
                onName={setName}
                onPhone={(v) => {
                  setPhone(v);
                  setErrors((e) => ({ ...e, "contact.phone": "" }));
                }}
                onConsent={(v) => {
                  setConsent(v);
                  setErrors((e) => ({ ...e, "contact.consent": "" }));
                }}
              />
            ) : (
              <>
                {step.section.title ? (
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{step.section.title}</p>
                ) : null}
                {step.firstOfSection && step.section.description && settings.sections[0]?.id !== step.section.id ? (
                  <p className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                    <BadgeCheck className="h-5 w-5 shrink-0" />
                    {step.section.description}
                  </p>
                ) : null}
                {step.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    q={q}
                    value={answers[q.id]}
                    other={typeof answers[`${q.id}__other`] === "string" ? (answers[`${q.id}__other`] as string) : ""}
                    error={errors[q.id]}
                    onPick={(v) => (q.type === "single" ? setAnswer(q.id, v) : toggle(q.id, v))}
                    onText={(v) => setAnswer(q.id, v)}
                    onOther={(v) => setAnswers((a) => ({ ...a, [`${q.id}__other`]: v }))}
                  />
                ))}
              </>
            )}
            {formError ? (
              <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Hidden from people; bots fill it */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
        />
      </div>

      <footer className="sticky bottom-0 flex gap-2.5 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
        {phase === "intro" ? (
          <button type="button" onClick={start} className={PRIMARY}>
            Commencer <ArrowRight className="h-5 w-5" />
          </button>
        ) : phase === "done" ? (
          doneActions ?? (
            <button type="button" onClick={() => { setAnswers({}); setName(""); setPhone(""); setConsent(false); setPhase("intro"); }} className={PRIMARY}>
              <Sparkles className="h-5 w-5" /> Revoir depuis le début
            </button>
          )
        ) : (
          <>
            <button
              type="button"
              aria-label="Retour"
              onClick={() => (idx === 0 ? setPhase("intro") : go(idx - 1, -1))}
              className="flex h-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 px-5 text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98] motion-reduce:transform-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={next} disabled={sending} className={PRIMARY}>
              {sending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Envoi…
                </>
              ) : idx === steps.length - 1 ? (
                <>
                  Envoyer <Send className="h-5 w-5" />
                </>
              ) : (
                <>
                  Suivant <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

const PRIMARY =
  "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-base font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 motion-reduce:transform-none";

const OPTION =
  "inline-flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] px-4 py-2.5 text-left text-[15px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:transform-none";
const optionTone = (on: boolean) =>
  on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300";

function QuestionField({
  q,
  value,
  other,
  error,
  onPick,
  onText,
  onOther,
}: {
  q: SurveyQuestion;
  value: string | string[] | undefined;
  other: string;
  error?: string;
  onPick: (v: string) => void;
  onText: (v: string) => void;
  onOther: (v: string) => void;
}) {
  const picked = asList(value);
  const labelId = `q-${q.id}`;
  const errId = `q-${q.id}-err`;
  const optional = !q.required ? <span className="text-[13px] font-medium text-slate-400"> (optionnel)</span> : null;
  const long = (q.options ?? []).some((o) => o.label.length > 18);

  return (
    <fieldset className="space-y-2.5" aria-describedby={error ? errId : undefined}>
      <legend id={labelId} className="text-[17px] font-bold leading-snug tracking-tight">
        {q.label}
        {optional}
      </legend>
      {q.help ? <p className="-mt-1 text-[13px] text-slate-500">{q.help}</p> : null}

      {q.tag === "role" && q.type === "single" ? (
        <div className="flex flex-col gap-2.5">
          {(q.options ?? []).map((o) => {
            const on = picked.includes(o.value);
            const Icon = ROLE_ICON[o.value] ?? Sparkles;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(o.value)}
                className={cn(OPTION, "min-h-[72px] w-full", optionTone(on))}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors",
                    o.value === "SHARE" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      ) : q.type === "single" || q.type === "multi" ? (
        <div className={cn("flex gap-2", long ? "flex-col" : "flex-wrap")}>
          {(q.options ?? []).map((o) => {
            const on = picked.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role={q.type === "single" ? "radio" : "checkbox"}
                aria-checked={on}
                onClick={() => onPick(o.value)}
                className={cn(OPTION, long && "w-full", optionTone(on))}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : q.type === "availability" ? (
        <table className="w-full table-fixed border-separate border-spacing-1" aria-labelledby={labelId}>
          <thead>
            <tr>
              <th className="w-11" />
              {AVAILABILITY_TIMES.map((t) => (
                <th key={t.value} className="text-[11px] font-semibold text-slate-500">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AVAILABILITY_DAYS.map((d) => (
              <tr key={d.value}>
                <th className="pr-1 text-left text-xs font-semibold text-slate-500">{d.label}</th>
                {AVAILABILITY_TIMES.map((t) => {
                  const k = `${d.value}:${t.value}`;
                  const on = picked.includes(k);
                  return (
                    <td key={t.value}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${d.label} ${t.label}`}
                        onClick={() => onPick(k)}
                        className={cn(
                          "h-10 w-full rounded-xl border-[1.5px] transition-colors duration-150",
                          on ? "border-emerald-600 bg-emerald-600" : "border-slate-200 bg-white"
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : q.type === "long" ? (
        <textarea
          id={`in-${q.id}`}
          aria-labelledby={labelId}
          rows={3}
          maxLength={2000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onText(e.target.value)}
          className={INPUT}
        />
      ) : (
        <input
          id={`in-${q.id}`}
          aria-labelledby={labelId}
          maxLength={200}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onText(e.target.value)}
          className={INPUT}
        />
      )}

      {q.allowOther && picked.includes(OTHER) ? (
        <input
          id={`in-${q.id}-other`}
          aria-label="Précise"
          maxLength={120}
          placeholder="Précise : ex. guitare, photo…"
          value={other}
          onChange={(e) => onOther(e.target.value)}
          className={cn(INPUT, "ls-enter")}
        />
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const INPUT =
  "w-full rounded-2xl border-[1.5px] border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100";

function ContactStep({
  orgName,
  text,
  required,
  name,
  phone,
  consent,
  errors,
  onName,
  onPhone,
  onConsent,
}: {
  orgName: string;
  text: string;
  required: boolean;
  name: string;
  phone: string;
  consent: boolean;
  errors: Record<string, string>;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onConsent: (v: boolean) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <h2 className="text-[17px] font-bold">On te prévient des séances ?</h2>
        <p className="text-[13px] text-slate-500">{text}</p>
        <p className="text-[13px] text-slate-500">{required ? "Ton WhatsApp est demandé pour ce sondage." : "Optionnel. Sans numéro, ta réponse reste anonyme."}</p>
      </div>
      <label className="block space-y-2" htmlFor="contact-name">
        <span className="text-[15px] font-bold">Prénom</span>
        <input id="contact-name" autoComplete="given-name" maxLength={80} placeholder="Ton prénom" value={name} onChange={(e) => onName(e.target.value)} className={INPUT} />
      </label>
      <div className="space-y-2">
        <label htmlFor="contact-phone" className="text-[15px] font-bold">
          WhatsApp
        </label>
        <div className="flex gap-2">
          <span className="grid min-h-12 place-items-center rounded-2xl border-[1.5px] border-slate-200 px-3 font-semibold text-slate-500">+216</span>
          <input
            id="contact-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="22 123 456"
            maxLength={20}
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            aria-invalid={!!errors["contact.phone"]}
            className={INPUT}
          />
        </div>
        {errors["contact.phone"] ? <p role="alert" className="text-sm font-medium text-rose-600">{errors["contact.phone"]}</p> : null}
      </div>
      <label htmlFor="contact-consent" className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700">
        <input
          id="contact-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
        />
        <span>
          J’accepte que {orgName} m’écrive sur WhatsApp <b>uniquement</b> pour les séances Learn &amp; Share. Mon numéro n’est jamais partagé.
        </span>
      </label>
      {errors["contact.consent"] ? <p role="alert" className="text-sm font-medium text-rose-600">{errors["contact.consent"]}</p> : null}
    </>
  );
}
