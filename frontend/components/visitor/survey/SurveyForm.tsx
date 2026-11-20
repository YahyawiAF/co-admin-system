"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Chakra_Petch } from "next/font/google";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_TIMES,
  OTHER,
  asList,
  isVisible,
  optionEmoji,
  type Answers,
  type PublicSurvey,
  type SurveyQuestion,
  type SurveySection,
} from "@/lib/surveys";

/** HUD and title face of the "pro gaming" survey */
const hud = Chakra_Petch({ weight: ["500", "600", "700"], subsets: ["latin"], display: "swap" });

type QStep = { kind: "question"; section: SurveySection; firstOfSection: boolean; q: SurveyQuestion };
type Step = QStep | { kind: "contact" };

export type SurveyDraftState = {
  answers: Answers;
  name: string;
  phone: string;
  consent: boolean;
  step: number;
  startedAt: number;
  xp?: number;
  awarded?: string[];
};

export type SubmitPayload = {
  answers: Answers;
  contact?: { name?: string; phone?: string; consent?: boolean };
  hp: string;
  elapsedMs: number;
};

export type SubmitError = Error & { errors?: Array<{ questionId: string; message: string }>; network?: boolean };

/* XP is for fun only, it never reaches member points */
const XP_ANSWER = 10;
const XP_BONUS = 5;
const XP_MAX_STEP = 30;
const KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TIME_EMOJI: Record<string, string> = { morning: "🌅", afternoon: "☀️", evening: "🌙" };

function buildSteps(questions: SurveyQuestion[], answers: Answers, sections: SurveySection[], withContact: boolean): Step[] {
  const steps: Step[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    if (!isVisible(q, answers, questions)) continue;
    const section = sections.find((s) => s.id === q.section) ?? sections[0] ?? { id: q.section, title: "" };
    steps.push({ kind: "question", section, firstOfSection: !seen.has(section.id), q });
    seen.add(section.id);
  }
  if (withContact) steps.push({ kind: "contact" });
  return steps;
}

/** Same rules as the server, so most mistakes are caught before sending. */
function checkQuestion(q: SurveyQuestion, answers: Answers) {
  const v = answers[q.id];
  const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
  if (q.required && empty) return q.type === "multi" || q.type === "availability" ? "Choisis au moins une réponse." : q.type === "single" ? "Choisis une réponse." : "Réponse requise.";
  if (q.type === "long" && typeof v === "string" && v.length > 2000) return "2000 caractères au maximum.";
  if (q.type === "short" && typeof v === "string" && v.length > 200) return "200 caractères au maximum.";
  return "";
}

const phoneDigits = (s: string) => s.replace(/\D/g, "").replace(/^216/, "");
const answered = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!String(v ?? "").trim());
const two = (n: number) => String(n).padStart(2, "0");

type Fx = { id: number; text: string; x: number; y: number };

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
  const [phase, setPhase] = useState<"steps" | "done">("steps");
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
  const [xp, setXp] = useState(initialDraft?.xp ?? 0);
  const [awarded, setAwarded] = useState<string[]>(initialDraft?.awarded ?? []);
  const [fx, setFx] = useState<Fx[]>([]);
  const startedAt = useRef(initialDraft?.startedAt ?? 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fxId = useRef(0);
  /** A screen is already moving on: ignore extra taps */
  const advancing = useRef(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const withContact = settings.contactMode !== "NONE" && !knownMember;
  const contactRequired = settings.contactMode === "REQUIRED";
  const roleQ = questions.find((x) => x.tag === "role");
  // Before the role is chosen, count the steps as for its first choice so the total does not jump
  const steps = useMemo(() => {
    const assumed = roleQ && !asList(answers[roleQ.id]).length && roleQ.options?.[0] ? { ...answers, [roleQ.id]: roleQ.options[0].value } : answers;
    return buildSteps(questions, assumed, settings.sections, withContact);
  }, [questions, answers, settings.sections, withContact, roleQ]);
  const idx = Math.min(stepIdx, Math.max(steps.length - 1, 0));
  const step = steps[idx];
  const lastStep = idx === steps.length - 1;

  // Opening the page starts the survey (a saved draft already started it)
  const started = useRef(!!initialDraft);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startedAt.current = Date.now();
    onStart?.();
  }, [onStart]);

  useEffect(() => {
    if (phase !== "steps") return;
    onDraft?.({ answers, name, phone, consent, step: idx, startedAt: startedAt.current, xp, awarded });
  }, [phase, answers, name, phone, consent, idx, onDraft, xp, awarded]);

  useEffect(() => {
    advancing.current = false;
  }, [idx]);

  const go = (to: number, d: 1 | -1) => {
    setDir(d);
    setErrors({});
    setFormError("");
    setStepIdx(to);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  /** XP once per question, shown as a small "+10 XP" above what was tapped. */
  const gain = (key: string, pts: number, el?: HTMLElement | null) => {
    if (!pts || awarded.includes(key)) return;
    pts = Math.min(pts, XP_MAX_STEP);
    const root = rootRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (root && r) {
      const f = { id: ++fxId.current, text: `+${pts} XP`, x: r.right - 44 - root.left, y: r.top - root.top };
      setFx((l) => [...l, f]);
      later(() => setFx((l) => l.filter((x) => x.id !== f.id)), 900);
    }
    setXp((x) => x + pts);
    setAwarded((a) => [...a, key]);
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

  const checkContact = () => {
    const e: Record<string, string> = {};
    const digits = phoneDigits(phone);
    if (!name.trim() && contactRequired) e["contact.name"] = "Indique ton nom et prénom.";
    if (phone.trim() && digits.length !== 8) e["contact.phone"] = "Numéro tunisien attendu : 8 chiffres, ex. 22 123 456.";
    if (!phone.trim() && contactRequired) e["contact.phone"] = "Indique ton WhatsApp.";
    if (phone.trim() && !consent) e["contact.consent"] = "Coche la case pour qu’on puisse t’écrire.";
    return e;
  };

  /** Only answers to questions still shown are sent. */
  const visibleAnswers = (a: Answers) => {
    const out: Answers = {};
    for (const q of questions) {
      if (!isVisible(q, a, questions)) continue;
      const v = a[q.id];
      if (!answered(v)) continue;
      out[q.id] = v;
      const other = a[`${q.id}__other`];
      if (q.allowOther && asList(v).includes(OTHER) && typeof other === "string" && other.trim()) out[`${q.id}__other`] = other.trim();
    }
    return out;
  };

  /** Move on, or send on the last screen. `a` is passed when the answer was set in the same tap. */
  const next = async (a: Answers = answers, steps2: Step[] = steps) => {
    const cur = steps2[idx];
    if (!cur) return;
    const e: Record<string, string> =
      cur.kind === "contact"
        ? checkContact()
        : (() => {
            const m = checkQuestion(cur.q, a);
            return m ? { [cur.q.id]: m } : {};
          })();
    if (Object.keys(e).length) {
      advancing.current = false;
      setErrors(e);
      return;
    }
    if (idx < steps2.length - 1) return go(idx + 1, 1);
    if (preview || !onSubmit) {
      setPhase("done");
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const res = await onSubmit({
        answers: visibleAnswers(a),
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
        const target = steps2.findIndex((s) => (s.kind === "contact" ? Object.keys(map).some((k) => k.startsWith("contact.")) : !!map[s.q.id]));
        if (target >= 0 && target !== idx) go(target, -1);
        setErrors(map);
        setFormError(se.message);
      } else {
        setFormError(se.network ? "Pas de connexion. Réessaie : ta réponse ne sera pas comptée deux fois." : se.message || "Envoi impossible, réessaie.");
      }
    } finally {
      advancing.current = false;
      setSending(false);
    }
  };

  /** One-choice question: pick, XP, then the next screen by itself. */
  const pickSingle = (q: SurveyQuestion, value: string, el: HTMLElement) => {
    if (advancing.current) return;
    advancing.current = true;
    const a = { ...answers, [q.id]: value };
    setAnswer(q.id, value);
    gain(q.id, XP_ANSWER, el);
    // Steps may change with this answer (role): rebuild them like the memo does
    const steps2 = buildSteps(questions, a, settings.sections, withContact);
    later(() => void next(a, steps2), 650);
  };

  const toggle = (q: SurveyQuestion, v: string) => {
    const list = asList(answers[q.id]);
    setAnswer(q.id, list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  /** Main button on multi, text, grid and contact screens. */
  const validate = (el: HTMLElement) => {
    if (!step) return;
    if (step.kind === "contact") {
      if (!Object.keys(checkContact()).length && phone.trim()) gain("contact", XP_ANSWER * 2, el);
    } else {
      const v = answers[step.q.id];
      if (answered(v) && !checkQuestion(step.q, answers)) gain(step.q.id, XP_ANSWER + (Array.isArray(v) ? Math.max(0, v.length - 1) * XP_BONUS : 0), el);
    }
    void next();
  };

  const skip = () => {
    if (advancing.current) return;
    advancing.current = true;
    go(idx + 1, 1);
  };

  const reset = () => {
    setAnswers({});
    setName("");
    setPhone("");
    setConsent(false);
    setXp(0);
    setAwarded([]);
    startedAt.current = Date.now();
    setDir(1);
    setStepIdx(0);
    setPhase("steps");
  };

  const progress = phase === "done" ? 100 : (idx / Math.max(steps.length, 1)) * 100;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex flex-col overflow-hidden bg-[#070a13] text-[#e8ecf8] [color-scheme:dark]",
        "bg-[radial-gradient(circle_at_85%_-10%,rgba(139,92,246,.35),transparent_45%),radial-gradient(circle_at_-10%_110%,rgba(34,211,238,.18),transparent_45%)]",
        framed ? "min-h-full" : "min-h-dvh"
      )}
    >
      <header className="sticky top-0 z-10 space-y-2.5 bg-[#070a13]/85 px-[18px] pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className={cn(hud.className, "flex items-center gap-2.5")}>
          <span className="flex-1 truncate text-xs font-bold uppercase tracking-[0.14em] text-[#8a96b3]">{orgName}</span>
          {preview ? <span className="text-xs font-semibold text-[#8a96b3]">Aperçu</span> : null}
          <span
            key={xp}
            aria-label={`${xp} XP`}
            className="sg-bump rounded-md border border-amber-400/40 bg-[#0f1524] px-2.5 py-1 text-xs font-bold tabular-nums tracking-[0.1em] text-amber-400 [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)]"
          >
            {xp} XP
          </span>
          <span className="text-sm font-bold tabular-nums tracking-[0.08em]">
            {phase === "done" ? (
              <b className="text-cyan-400">GG</b>
            ) : (
              <>
                <b className="text-cyan-400">{two(idx + 1)}</b> / {two(steps.length)}
              </>
            )}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#141c30]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Progression">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_12px_#22d3ee] transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div ref={bodyRef} className="flex-1 px-[18px] pb-6 pt-4">
        {phase === "done" ? (
          <div className="ls-enter flex flex-col items-center gap-4 pt-4 text-center">
            <span className="sg-slam grid h-[110px] w-[110px] place-items-center bg-gradient-to-br from-violet-500 to-cyan-400 [clip-path:polygon(25%_4%,75%_4%,100%_50%,75%_96%,25%_96%,0_50%)]">
              <Check className="h-12 w-12 text-[#050816]" strokeWidth={3} />
            </span>
            <h2 className={cn(hud.className, "text-[30px] font-bold uppercase tracking-[0.08em]")}>Mission accomplie</h2>
            <div className={cn(hud.className, "flex gap-2.5")}>
              {[
                [xp, "XP"],
                ["100%", "Complété"],
              ].map(([v, l]) => (
                <div key={String(l)} className="rounded-xl border border-[#24314d] bg-[#0f1524] px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[#8a96b3]">
                  <b className="block text-[22px] tabular-nums tracking-normal text-[#e8ecf8]">{v}</b>
                  {l}
                </div>
              ))}
            </div>
            {successMessage ? (
              <div className="w-full space-y-1.5 rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-cyan-400/10 to-violet-500/5 p-4 text-left">
                <p className={cn(hud.className, "text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400")}>Message de l’équipe</p>
                <p className="text-[17px] font-bold leading-snug">{successMessage}</p>
              </div>
            ) : null}
            {preview ? <p className="text-xs text-[#8a96b3]">Aperçu : rien n’a été envoyé.</p> : null}
          </div>
        ) : step ? (
          <div key={idx} className={cn("space-y-4", dir > 0 ? "ls-in-right" : "ls-in-left")}>
            {idx === 0 && alreadyAnsweredAt ? (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-300">Tu as déjà répondu. Tu peux répondre à nouveau.</p>
            ) : null}
            {step.kind === "contact" ? (
              <ContactStep
                orgName={orgName}
                name={name}
                phone={phone}
                consent={consent}
                errors={errors}
                onName={(v) => {
                  setName(v);
                  setErrors((e) => ({ ...e, "contact.name": "" }));
                }}
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
                {step.firstOfSection && step.section.description && settings.sections[0]?.id !== step.section.id ? (
                  <p className="ls-enter rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200">{step.section.description}</p>
                ) : null}
                <QuestionField
                  q={step.q}
                  n={idx + 1}
                  value={answers[step.q.id]}
                  other={typeof answers[`${step.q.id}__other`] === "string" ? (answers[`${step.q.id}__other`] as string) : ""}
                  error={errors[step.q.id]}
                  onSingle={(v, el) => pickSingle(step.q, v, el)}
                  onToggle={(v) => toggle(step.q, v)}
                  onText={(v) => setAnswer(step.q.id, v)}
                  onOther={(v) => setAnswers((a) => ({ ...a, [`${step.q.id}__other`]: v }))}
                />
              </>
            )}
            {formError ? (
              <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
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

      <footer className="sticky bottom-0 flex gap-2.5 bg-[#070a13]/85 px-[18px] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur">
        {phase === "done" ? (
          doneActions ?? (
            <button type="button" onClick={reset} className={PRIMARY}>
              Recommencer
            </button>
          )
        ) : step ? (
          <>
            {idx > 0 ? (
              <button type="button" aria-label="Retour" onClick={() => go(idx - 1, -1)} className={cn(SECONDARY, "w-14 shrink-0")}>
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            {(step.kind === "contact" ? !contactRequired : !step.q.required) && !lastStep ? (
              <button type="button" onClick={skip} className={cn(SECONDARY, "shrink-0 px-4 text-sm text-[#8a96b3]")}>
                Passer
              </button>
            ) : null}
            {step.kind === "question" && step.q.type === "single" && !sending ? (
              <button type="button" disabled className={PRIMARY}>
                Choisis une réponse
              </button>
            ) : (
              <button type="button" onClick={(e: MouseEvent<HTMLButtonElement>) => validate(e.currentTarget)} disabled={sending} className={PRIMARY}>
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Envoi…
                  </>
                ) : lastStep ? (
                  "Envoyer"
                ) : (
                  "Valider"
                )}
              </button>
            )}
          </>
        ) : null}
      </footer>

      {fx.map((f) => (
        <span
          key={f.id}
          aria-hidden
          className={cn(hud.className, "sg-rise pointer-events-none absolute z-20 text-lg font-bold tracking-[0.1em] text-amber-400 [text-shadow:0_0_12px_rgba(251,191,36,.7)]")}
          style={{ left: f.x, top: f.y }}
        >
          {f.text}
        </span>
      ))}
    </div>
  );
}

const BTN = cn(
  hud.className,
  "flex h-[54px] items-center justify-center gap-2 rounded-[14px] text-base font-bold uppercase tracking-[0.14em] transition-[filter,transform,opacity] duration-150 active:scale-[0.98] disabled:cursor-default motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a13]"
);
const PRIMARY = cn(BTN, "flex-1 bg-gradient-to-r from-cyan-400 to-indigo-300 text-[#050816] shadow-[0_10px_30px_-10px_rgba(34,211,238,.7)] hover:brightness-110 disabled:opacity-35 disabled:shadow-none");
const SECONDARY = cn(BTN, "border border-[#24314d] bg-[#0f1524] tracking-normal text-[#e8ecf8] hover:bg-[#141c30]");

const OPTION =
  "flex w-full items-center gap-3.5 rounded-[14px] border border-[#24314d] bg-gradient-to-b from-[#141c30] to-[#0f1524] p-3.5 text-left text-base font-bold text-[#e8ecf8] transition-[border-color,box-shadow,transform] duration-150 hover:border-cyan-400/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transform-none";
const OPTION_ON = "border-cyan-400 shadow-[0_0_0_1px_#22d3ee,0_0_24px_-4px_rgba(34,211,238,.6)]";

function QuestionField({
  q,
  n,
  value,
  other,
  error,
  onSingle,
  onToggle,
  onText,
  onOther,
}: {
  q: SurveyQuestion;
  n: number;
  value: string | string[] | undefined;
  other: string;
  error?: string;
  onSingle: (v: string, el: HTMLElement) => void;
  onToggle: (v: string) => void;
  onText: (v: string) => void;
  onOther: (v: string) => void;
}) {
  const picked = asList(value);
  const labelId = `q-${q.id}`;
  const errId = `q-${q.id}-err`;
  const options = q.options ?? [];

  return (
    <fieldset className="space-y-4" aria-describedby={error ? errId : undefined}>
      <div className="space-y-1.5">
        <p className={cn(hud.className, "text-[13px] font-bold uppercase tracking-[0.2em] text-cyan-400")}>
          Question {two(n)}
          {q.type === "multi" ? <span className="ml-2 tracking-[0.12em] text-[#8a96b3]">· plusieurs choix</span> : null}
          {!q.required ? <span className="ml-2 tracking-[0.12em] text-[#8a96b3]">· optionnelle</span> : null}
        </p>
        <legend id={labelId} className="text-[26px] font-extrabold leading-tight tracking-tight [text-wrap:balance]">
          {q.label}
        </legend>
        {q.help ? <p className="text-sm font-medium text-[#8a96b3]">{q.help}</p> : null}
      </div>

      {q.type === "single" || q.type === "multi" ? (
        <div className="grid gap-2.5" role={q.type === "single" ? "radiogroup" : "group"} aria-labelledby={labelId}>
          {options.map((o, k) => {
            const on = picked.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role={q.type === "single" ? "radio" : "checkbox"}
                aria-checked={on}
                onClick={(e) => (q.type === "single" ? onSingle(o.value, e.currentTarget) : onToggle(o.value))}
                className={cn(OPTION, on && OPTION_ON)}
              >
                <span
                  aria-hidden
                  className={cn(
                    hud.className,
                    "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border text-sm font-bold transition-colors duration-150",
                    on ? "border-cyan-400 bg-cyan-400 text-[#04121a]" : "border-[#24314d] bg-[#070a13] text-[#8a96b3]"
                  )}
                >
                  {q.type === "multi" && on ? <Check className="h-4 w-4" strokeWidth={3} /> : KEYS[k] ?? "•"}
                </span>
                <span className="text-[22px] leading-none" aria-hidden>
                  {optionEmoji(o, k)}
                </span>
                <span className="min-w-0">{o.label}</span>
              </button>
            );
          })}
        </div>
      ) : q.type === "availability" ? (
        <div className="grid grid-cols-[40px_repeat(3,1fr)] items-center gap-1.5" role="group" aria-labelledby={labelId}>
          <span />
          {AVAILABILITY_TIMES.map((t) => (
            <span key={t.value} className="text-center text-lg">
              {TIME_EMOJI[t.value]}
              <small className={cn(hud.className, "block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a96b3]")}>{t.label}</small>
            </span>
          ))}
          {AVAILABILITY_DAYS.map((d) => (
            <AvailabilityRow key={d.value} day={d} picked={picked} onPick={onToggle} />
          ))}
        </div>
      ) : q.type === "long" ? (
        <textarea id={`in-${q.id}`} aria-labelledby={labelId} rows={4} maxLength={2000} placeholder="Écris ici…" value={typeof value === "string" ? value : ""} onChange={(e) => onText(e.target.value)} className={INPUT} />
      ) : (
        <input id={`in-${q.id}`} aria-labelledby={labelId} maxLength={200} placeholder="Écris ici…" value={typeof value === "string" ? value : ""} onChange={(e) => onText(e.target.value)} className={INPUT} />
      )}

      {q.allowOther && picked.includes(OTHER) ? (
        <input id={`in-${q.id}-other`} aria-label="Précise" maxLength={120} placeholder="Précise : ex. guitare, photo…" value={other} onChange={(e) => onOther(e.target.value)} className={cn(INPUT, "ls-enter")} />
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-sm font-semibold text-rose-400">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function AvailabilityRow({ day, picked, onPick }: { day: { value: string; label: string }; picked: string[]; onPick: (v: string) => void }) {
  return (
    <>
      <span className={cn(hud.className, "text-xs font-bold uppercase text-[#8a96b3]")}>{day.label}</span>
      {AVAILABILITY_TIMES.map((t) => {
        const k = `${day.value}:${t.value}`;
        const on = picked.includes(k);
        return (
          <button
            key={t.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={`${day.label} ${t.label}`}
            onClick={() => onPick(k)}
            className={cn(
              "h-10 rounded-lg border transition-[background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
              on ? "border-cyan-400 bg-cyan-400/80 shadow-[0_0_14px_-2px_rgba(34,211,238,.7)]" : "border-[#24314d] bg-[#0f1524]"
            )}
          />
        );
      })}
    </>
  );
}

const INPUT =
  "w-full rounded-xl border border-[#24314d] bg-[#0f1524] px-3.5 py-3 text-base font-semibold text-[#e8ecf8] outline-none transition-[border-color,box-shadow] placeholder:text-[#5b6680] focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,.18)]";
const FIELD_LABEL = cn(hud.className, "text-xs font-bold uppercase tracking-[0.14em] text-[#8a96b3]");

function ContactStep({
  orgName,
  name,
  phone,
  consent,
  errors,
  onName,
  onPhone,
  onConsent,
}: {
  orgName: string;
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
      <div className="space-y-1.5">
        <p className={cn(hud.className, "text-[13px] font-bold uppercase tracking-[0.2em] text-cyan-400")}>Étape finale</p>
        <h2 className="text-[26px] font-extrabold leading-tight">Tes coordonnées</h2>
      </div>
      <label className="block space-y-1.5" htmlFor="contact-name">
        <span className={FIELD_LABEL}>Nom et prénom</span>
        <input
          id="contact-name"
          autoComplete="name"
          maxLength={80}
          placeholder="Ex. Sami Ben Ali"
          value={name}
          onChange={(e) => onName(e.target.value)}
          aria-invalid={!!errors["contact.name"]}
          className={INPUT}
        />
      </label>
      {errors["contact.name"] ? <p role="alert" className="-mt-2 text-sm font-semibold text-rose-400">{errors["contact.name"]}</p> : null}
      <div className="space-y-1.5">
        <label htmlFor="contact-phone" className={FIELD_LABEL}>
          WhatsApp
        </label>
        <div className="flex gap-2">
          <span className="grid min-h-12 place-items-center rounded-xl border border-[#24314d] bg-[#0f1524] px-3 font-bold text-[#8a96b3]">+216</span>
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
        {errors["contact.phone"] ? <p role="alert" className="text-sm font-semibold text-rose-400">{errors["contact.phone"]}</p> : null}
      </div>
      <label htmlFor="contact-consent" className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#8a96b3]">
        <input id="contact-consent" type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="h-5 w-5 shrink-0 accent-cyan-400" />
        <span>OK pour que {orgName} m’écrive sur WhatsApp</span>
      </label>
      {errors["contact.consent"] ? <p role="alert" className="text-sm font-semibold text-rose-400">{errors["contact.consent"]}</p> : null}
    </>
  );
}
