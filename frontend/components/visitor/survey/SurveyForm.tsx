"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Bangers } from "next/font/google";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { COMPANIONS, COMPANION_KINDS, Companion, type CompanionKind, type CompanionMood } from "./Companion";

const manga = Bangers({ weight: "400", subsets: ["latin"], display: "swap" });

type QStep = { kind: "question"; section: SurveySection; firstOfSection: boolean; q: SurveyQuestion };
type Step = QStep | { kind: "contact" };

export type SurveyDraftState = {
  answers: Answers;
  name: string;
  phone: string;
  consent: boolean;
  step: number;
  startedAt: number;
  pet?: string;
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

/* Game rules: XP is for fun only, it never reaches member points */
const XP_ANSWER = 10;
const XP_BONUS = 5;
const XP_MAX_STEP = 30;
const COMBO_MS = 4000;
const SLEEP_MS = 9000;
const EVOLVE_MS = 2600;
const STAGE_NAMES = ["Bébé", "Évolué", "Ultime"];
const CHEERS = ["Bon choix 😎", "Ooh, intéressant !", "Noté ✅", "J’adore 🤩", "Excellent !", "Tu me fais grandir 💪"];
const POKES = ["Hé ! Ça chatouille 😂", "Je suis prêt, on continue ?", "Encore une et je grandis 💪", "Arrête, je vais évoluer de rire 🤣"];
const ROLE_CHEER: Record<string, string> = { LEARN: "Un vrai explorateur 🧭", SHARE: "Un futur mentor 🦸", BOTH: "Le combo parfait 🔥" };
const BADGE: Record<string, [string, string]> = { LEARN: ["🧭", "Explorateur"], SHARE: ["🦸", "Mentor"], BOTH: ["🔥", "Super-héros"] };
const TIME_EMOJI: Record<string, string> = { morning: "🌅", afternoon: "☀️", evening: "🌙" };
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

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
  const startedAt = useRef(initialDraft?.startedAt ?? 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Game state
  // One companion for everyone: no choice screen, the survey opens on its first question
  const [pet] = useState<CompanionKind>(
    COMPANION_KINDS.includes(initialDraft?.pet as CompanionKind) ? (initialDraft!.pet as CompanionKind) : "kodi"
  );
  const [xp, setXp] = useState(initialDraft?.xp ?? 0);
  const [awarded, setAwarded] = useState<string[]>(initialDraft?.awarded ?? []);
  const [stage, setStage] = useState(0);
  const [mood, setMood] = useState<{ m: CompanionMood; text: string; anim: "jump" | "shake" | "sleep" | ""; n: number }>({ m: "idle", text: "", anim: "", n: 0 });
  const [fx, setFx] = useState<Fx[]>([]);
  const [combo, setCombo] = useState<{ n: number; id: number } | null>(null);
  const [evolving, setEvolving] = useState<{ from: number; to: number } | null>(null);
  const comboN = useRef(0);
  /** A screen is already moving on: ignore extra taps */
  const advancing = useRef(false);
  const shownAt = useRef(0);
  const fxId = useRef(0);
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const withContact = settings.contactMode !== "NONE" && !knownMember;
  const roleQ = questions.find((x) => x.tag === "role");
  // Before the role is chosen, count the steps as for its first choice so the total does not jump
  const steps = useMemo(() => {
    const assumed = roleQ && !asList(answers[roleQ.id]).length && roleQ.options?.[0] ? { ...answers, [roleQ.id]: roleQ.options[0].value } : answers;
    return buildSteps(questions, assumed, settings.sections, withContact);
  }, [questions, answers, settings.sections, withContact, roleQ]);
  const idx = Math.min(stepIdx, Math.max(steps.length - 1, 0));
  const step = steps[idx];

  // Evolution thresholds follow the survey's length, so short surveys evolve too
  const maxXp = steps.length * XP_ANSWER + (withContact ? XP_ANSWER : 0);
  const thresholds = useMemo(() => [0, Math.max(20, Math.round((maxXp * 0.35) / 5) * 5), Math.max(40, Math.round((maxXp * 0.75) / 5) * 5)], [maxXp]);
  const reached = thresholds.reduce((k, t, n) => (xp >= t ? n : k), 0);
  // Never goes back down when the total changes
  useEffect(() => setStage((s) => Math.max(s, reached)), [reached]);
  const names = COMPANIONS[pet].names;
  const petName = names[stage];

  useEffect(() => {
    if (phase !== "steps") return;
    onDraft?.({ answers, name, phone, consent, step: idx, startedAt: startedAt.current, pet, xp, awarded });
  }, [phase, answers, name, phone, consent, idx, onDraft, pet, xp, awarded]);

  // New screen: companion speaks the question's line; falls asleep when nobody answers
  const say = useCallback((m: CompanionMood, text: string, anim: "jump" | "shake" | "sleep" | "" = "jump") => {
    setMood((o) => ({ m, text, anim, n: o.n + 1 }));
  }, []);
  const lineOf = (s: Step | undefined) =>
    !s ? "" : s.kind === "contact" ? "Dernière étape 😎" : s.q.say || (idx === 0 ? "Salut ! On commence facile 😄" : pick(["À toi de jouer 🎮", "Celle-là est facile 😉", "Je t’écoute 👂", "On avance bien 🚀"]));
  useEffect(() => {
    advancing.current = false;
    if (phase !== "steps") return;
    shownAt.current = Date.now();
    say("idle", lineOf(step), "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);
  useEffect(() => {
    if (phase !== "steps" || mood.m === "sleep") return;
    const t = window.setTimeout(() => say("sleep", `zZz… ${petName} s’endort. Touche-le pour le réveiller !`, "sleep"), SLEEP_MS);
    return () => clearTimeout(t);
  }, [phase, mood.n, mood.m, petName, say]);

  const go = (to: number, d: 1 | -1) => {
    setDir(d);
    setErrors({});
    setFormError("");
    setStepIdx(to);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  // Opening the page starts the survey (a saved draft already started it)
  const started = useRef(!!initialDraft);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startedAt.current = Date.now();
    onStart?.();
  }, [onStart]);

  /** XP once per question; a quick answer chains a combo. Returns true when the companion evolves. */
  const gain = (key: string, pts: number, el?: HTMLElement | null) => {
    if (!pts || awarded.includes(key)) return false;
    comboN.current = Date.now() - shownAt.current < COMBO_MS ? comboN.current + 1 : 0;
    if (comboN.current >= 2) {
      pts += XP_BONUS;
      setCombo({ n: comboN.current, id: Date.now() });
    }
    pts = Math.min(pts, XP_MAX_STEP);
    const root = rootRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (root && r) {
      const f = { id: ++fxId.current, text: `+${pts} XP`, x: r.left + r.width / 2 - root.left, y: r.top - root.top };
      setFx((l) => [...l, f]);
      later(() => setFx((l) => l.filter((x) => x.id !== f.id)), 900);
    }
    const next = xp + pts;
    setXp(next);
    setAwarded((a) => [...a, key]);
    const to = thresholds.reduce((k, t, n) => (next >= t ? n : k), 0);
    if (to > stage) {
      setEvolving({ from: stage, to });
      later(() => setEvolving(null), EVOLVE_MS);
      return true;
    }
    return false;
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
    if (phone.trim() && digits.length !== 8) e["contact.phone"] = "Numéro tunisien attendu : 8 chiffres, ex. 22 123 456.";
    if (!phone.trim() && settings.contactMode === "REQUIRED") e["contact.phone"] = "Indique ton WhatsApp.";
    if (!name.trim() && settings.contactMode === "REQUIRED") e["contact.name"] = "Indique ton nom et prénom.";
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
    const e: Record<string, string> = cur.kind === "contact" ? checkContact() : (() => { const m = checkQuestion(cur.q, a); return m ? { [cur.q.id]: m } : {}; })();
    if (Object.keys(e).length) {
      advancing.current = false;
      setErrors(e);
      say("sad", "Oups, il manque une réponse 🙈", "shake");
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
      say("sad", "Aïe, ça n’est pas parti. On réessaie ?", "shake");
    } finally {
      advancing.current = false;
      setSending(false);
    }
  };

  /** One-choice question: pick, cheer, XP, then the next screen by itself. */
  const pickSingle = (q: SurveyQuestion, value: string, el: HTMLElement) => {
    if (advancing.current) return;
    advancing.current = true;
    const a = { ...answers, [q.id]: value };
    setAnswer(q.id, value);
    say(Math.random() < 0.3 ? "wow" : "happy", (q.tag === "role" && ROLE_CHEER[value]) || pick(CHEERS));
    const evolves = gain(q.id, XP_ANSWER, el);
    // Steps may change with this answer (role): rebuild them like the memo does
    const steps2 = buildSteps(questions, a, settings.sections, withContact);
    later(() => void next(a, steps2), evolves ? EVOLVE_MS : 800);
  };

  const toggle = (q: SurveyQuestion, v: string) => {
    const list = asList(answers[q.id]);
    const adding = !list.includes(v);
    setAnswer(q.id, adding ? [...list, v] : list.filter((x) => x !== v));
    if (adding) say(Math.random() < 0.3 ? "wow" : "happy", pick(CHEERS));
  };

  /** Valider on multi, text, grid and contact screens. */
  const validate = (el: HTMLElement) => {
    if (!step) return;
    let pts = 0;
    let key = "";
    if (step.kind === "contact") {
      key = "contact";
      if (phone.trim() && !Object.keys(checkContact()).length) pts = XP_ANSWER * 2;
    } else {
      key = step.q.id;
      const v = answers[step.q.id];
      if (answered(v) && !checkQuestion(step.q, answers)) pts = XP_ANSWER + (Array.isArray(v) ? Math.max(0, v.length - 1) * XP_BONUS : 0);
    }
    const evolves = pts ? gain(key, pts, el) : false;
    if (evolves) later(() => void next(), EVOLVE_MS);
    else void next();
  };

  const skip = () => {
    if (advancing.current) return;
    advancing.current = true;
    say("sad", "Ok… je ne juge pas 🥲", "shake");
    later(() => go(idx + 1, 1), 650);
  };

  const pokeCompanion = () => say("happy", pick(POKES));

  const reset = () => {
    setAnswers({});
    setName("");
    setPhone("");
    setConsent(false);
    setXp(0);
    setAwarded([]);
    setStage(0);
    comboN.current = 0;
    startedAt.current = Date.now();
    setDir(1);
    setStepIdx(0);
    setPhase("steps");
  };

  const showHud = phase === "steps";
  const nextAt = thresholds[stage + 1];
  const lastStep = idx === steps.length - 1;
  const role = roleQ ? asList(answers[roleQ.id])[0] : undefined;
  const badge = (role && BADGE[role]) || ["🏆", "Champion"];

  const companionBtn = (size: string) => (
    <button
      type="button"
      onClick={pokeCompanion}
      aria-label={`Toucher ${petName}`}
      className={cn("shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300", size)}
    >
      <span
        key={mood.n}
        className={cn(
          "block h-full w-full",
          mood.anim === "jump" ? "sg-cre-jump" : mood.anim === "shake" ? "sg-cre-shake" : mood.anim === "sleep" ? "sg-cre-sleep" : "sg-cre"
        )}
      >
        <Companion kind={pet} stage={stage} mood={mood.m} className="h-full w-full" />
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className={cn("relative flex flex-col overflow-hidden bg-white text-slate-900", framed ? "min-h-full" : "min-h-dvh")}>
      <header className="sticky top-0 z-10 space-y-2 border-b-2 border-slate-100 bg-white/95 px-4 pb-2.5 pt-[calc(0.85rem+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-xs font-black tracking-[0.08em] text-indigo-700">{orgName.toUpperCase()}</span>
          {showHud ? (
            <>
              <span key={xp} className={cn(PILL, "sg-bump bg-amber-400 tabular-nums")} aria-label={`${xp} XP`}>
                ⚡ {xp} XP
              </span>
              <span className={cn(PILL, "bg-indigo-600 text-white")}>Niv. {stage + 1}</span>
            </>
          ) : preview ? (
            <span className="text-xs font-semibold text-slate-500">Aperçu</span>
          ) : null}
        </div>
        {showHud ? (
          <>
            <div className="flex items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={idx + 1} aria-label={`Question ${idx + 1} sur ${steps.length}`}>
              {steps.map((_, n) => (
                <i
                  key={n}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-[background-color,transform] duration-300 motion-reduce:transition-none",
                    n < idx ? "bg-gradient-to-r from-indigo-600 to-violet-600" : n === idx ? "scale-y-150 bg-amber-400" : "bg-slate-200"
                  )}
                />
              ))}
              <span className="text-base leading-none" aria-hidden>🏁</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-indigo-50">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${nextAt !== undefined ? Math.min(100, ((xp - thresholds[stage]) / (nextAt - thresholds[stage])) * 100) : 100}%` }}
              />
            </div>
          </>
        ) : null}
      </header>

      <div ref={bodyRef} className="flex-1 px-4 pb-6 pt-3">
        {phase === "done" ? (
          <div className="ls-enter flex flex-col items-center gap-3 pt-2 text-center">
            <span className="sg-cre block h-36 w-36">
              <Companion kind={pet} stage={stage} mood="happy" className="h-full w-full" />
            </span>
            <p className={cn(manga.className, INK_CARD, "sg-slam bg-amber-400 px-4 py-1 text-xl tracking-[0.05em]")}>
              {badge[0]} Badge {badge[1]}
            </p>
            <h2 className="text-[26px] font-black leading-tight">
              Bravo{name.trim() ? ` ${name.trim()}` : ""} ! Mission réussie 🎉
            </h2>
            <p className="max-w-[34ch] text-[15px] font-semibold text-slate-600">{successMessage}</p>
            <div className="grid w-full grid-cols-3 gap-2 text-[11px] font-extrabold text-slate-500">
              {[
                [xp, "XP gagnés"],
                [stage + 1, STAGE_NAMES[stage]],
                [awarded.length, "réponses"],
              ].map(([v, l]) => (
                <div key={String(l)} className="rounded-2xl border-2 border-slate-900 py-2.5">
                  <b className="block text-2xl tabular-nums text-slate-900">{v}</b>
                  {l}
                </div>
              ))}
            </div>
            <p className="flex w-full items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-900 bg-amber-50 p-3 text-left text-[13px] font-extrabold">
              <span className="text-2xl">📣</span>Envoie le lien à un ami : il choisit son compagnon et vous comparez vos XP.
            </p>
            {preview ? <p className="text-xs text-slate-400">Aperçu : rien n’a été envoyé.</p> : null}
            <Confetti />
          </div>
        ) : step ? (
          <div key={idx} className={cn("space-y-4", dir > 0 ? "ls-in-right" : "ls-in-left")}>
            {idx === 0 && alreadyAnsweredAt ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">Tu as déjà répondu. Tu peux répondre à nouveau.</p>
            ) : null}
            <div className="flex items-center gap-2">
              {companionBtn("h-24 w-24")}
              <p
                key={mood.n}
                aria-live="polite"
                className="sg-pop relative min-w-0 flex-1 rounded-[18px] border-[2.5px] border-slate-900 bg-white px-3 py-2 text-sm font-extrabold leading-snug shadow-[3px_3px_0_#0f172a] before:absolute before:-left-[9px] before:top-5 before:h-3 before:w-3 before:rotate-45 before:border-b-[2.5px] before:border-l-[2.5px] before:border-slate-900 before:bg-white"
              >
                <b className="text-indigo-700">{petName} :</b> {mood.text}
              </p>
            </div>

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
                  <p className="ls-enter rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900">🎊 Nouveau niveau du sondage : {step.section.description}</p>
                ) : null}
                <QuestionField
                  q={step.q}
                  n={idx + 1}
                  total={steps.length}
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
              <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
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

      <footer className="sticky bottom-0 flex gap-2.5 border-t-2 border-slate-100 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
        {phase === "done" ? (
          doneActions ?? (
            <button type="button" onClick={reset} className={PRIMARY}>
              Recommencer 🔁
            </button>
          )
        ) : step ? (
          <>
            {idx > 0 ? (
              <button type="button" aria-label="Retour" onClick={() => go(idx - 1, -1)} className={cn(SECONDARY, "w-14 shrink-0")}>
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            {(step.kind === "contact" ? settings.contactMode !== "REQUIRED" : !step.q.required) && !lastStep ? (
              <button type="button" onClick={skip} className={cn(SECONDARY, "shrink-0 px-4 text-sm text-slate-500")}>
                Passer
              </button>
            ) : null}
            {step.kind === "question" && step.q.type === "single" && !sending ? (
              <button type="button" disabled className={PRIMARY}>
                Touche une réponse 👆
              </button>
            ) : (
              <button
                type="button"
                onClick={(e: MouseEvent<HTMLButtonElement>) => validate(e.currentTarget)}
                disabled={sending || !!evolving}
                className={PRIMARY}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Envoi…
                  </>
                ) : (
                  <>
                    {lastStep ? "Terminer 🏁" : "Valider"}
                    <XpChip step={step} answers={answers} phone={phone} />
                  </>
                )}
              </button>
            )}
          </>
        ) : null}
      </footer>

      {/* Floating +XP, combo and evolution, above everything */}
      {fx.map((f) => (
        <span
          key={f.id}
          aria-hidden
          className={cn(manga.className, "sg-rise pointer-events-none absolute z-20 text-[26px] tracking-[0.04em] text-amber-400 [-webkit-text-stroke:1.5px_#0f172a]")}
          style={{ left: f.x, top: f.y }}
        >
          {f.text}
        </span>
      ))}
      {combo ? (
        <span
          key={combo.id}
          aria-hidden
          onAnimationEnd={() => setCombo(null)}
          className={cn(manga.className, "sg-combo pointer-events-none absolute right-4 top-28 z-20 rounded-xl border-[2.5px] border-slate-900 bg-rose-600 px-3 text-3xl tracking-[0.04em] text-white shadow-[3px_3px_0_#0f172a]")}
        >
          COMBO x{combo.n} !
        </span>
      ) : null}
      {evolving ? (
        <div role="status" className="sg-evo absolute inset-0 z-30 grid place-content-center justify-items-center gap-3 bg-[radial-gradient(circle,#fff_0%,#c7d2fe_40%,#4f46e5_100%)] px-6">
          <span className="sg-flash block h-40 w-40">
            <EvolvingCompanion kind={pet} from={evolving.from} to={evolving.to} />
          </span>
          <p className={cn(manga.className, "sg-slam text-center text-4xl leading-none tracking-[0.05em] text-amber-400 [-webkit-text-stroke:2px_#0f172a] [animation-delay:1.1s]")}>
            QUOI ?! {names[evolving.from].toUpperCase()} ÉVOLUE !
            <span className="mt-1 block text-[22px] text-white [-webkit-text-stroke:1px_#0f172a]">Il devient {names[evolving.to]} ✨</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Old form during the flashes, new form after. */
function EvolvingCompanion({ kind, from, to }: { kind: CompanionKind; from: number; to: number }) {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(to), 1100);
    return () => clearTimeout(t);
  }, [to]);
  return <Companion kind={kind} stage={shown} mood={shown === from ? "wow" : "happy"} className="h-full w-full" />;
}

function XpChip({ step, answers, phone }: { step: Step; answers: Answers; phone: string }) {
  let pts = 0;
  if (step.kind === "contact") pts = phone.trim() ? XP_ANSWER * 2 : 0;
  else {
    const v = answers[step.q.id];
    if (answered(v)) pts = XP_ANSWER + (Array.isArray(v) ? Math.max(0, v.length - 1) * XP_BONUS : 0);
  }
  if (!pts) return null;
  return <span className="rounded-full border-2 border-slate-900 bg-amber-400 px-2 text-xs font-black text-slate-900">+{Math.min(pts, XP_MAX_STEP)}</span>;
}

const INK_CARD = "rounded-[18px] border-[2.5px] border-slate-900 shadow-[3px_3px_0_#0f172a]";
const PILL = "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[13px] font-black shadow-[2px_2px_0_#0f172a]";
const BTN =
  "flex h-14 items-center justify-center gap-2 rounded-[18px] border-[2.5px] border-slate-900 text-base font-black shadow-[3px_3px_0_#0f172a] transition-[transform,box-shadow,filter,opacity] duration-150 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#0f172a] disabled:cursor-default motion-reduce:transform-none";
const PRIMARY = cn(BTN, "flex-1 bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:brightness-110 disabled:opacity-50 disabled:grayscale");
const SECONDARY = cn(BTN, "bg-white text-slate-800 hover:bg-slate-50");

const OPTION = cn(
  INK_CARD,
  "relative flex items-center gap-3 bg-white p-3 text-left text-[15px] font-extrabold text-slate-900 transition-[transform,box-shadow,background-color,border-color,color] duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#0f172a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#0f172a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 motion-reduce:transform-none"
);
const OPTION_ON = "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-[3px_3px_0_#4f46e5] after:absolute after:right-2 after:top-2 after:grid after:h-[22px] after:w-[22px] after:place-items-center after:rounded-full after:bg-indigo-600 after:text-[13px] after:text-white after:content-['✓']";

function QuestionField({
  q,
  n,
  total,
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
  total: number;
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
  const [tapped, setTapped] = useState("");
  const options = q.options ?? [];
  // One column for long answers or few choices, two columns for short ones
  const oneCol = q.tag === "role" || options.length <= 3 || options.some((o) => o.label.length > 18);

  return (
    <fieldset className="space-y-3" aria-describedby={error ? errId : undefined}>
      <div className="space-y-1">
        <p className={cn(manga.className, "text-lg tracking-[0.06em] text-indigo-700")}>
          Question {n}
          <span className="ml-1.5 font-sans text-xs font-extrabold tracking-normal text-slate-500">
            sur {total}
            {!q.required ? " · optionnelle" : ""}
          </span>
        </p>
        <legend id={labelId} className="text-[23px] font-black leading-tight tracking-tight [text-wrap:balance]">
          {q.label}
        </legend>
        {q.help ? <p className="text-[13px] font-bold text-slate-500">{q.help}</p> : null}
      </div>

      {q.type === "single" || q.type === "multi" ? (
        <div className={cn("grid gap-2.5", oneCol ? "grid-cols-1" : "grid-cols-2")} role={q.type === "single" ? "radiogroup" : "group"} aria-labelledby={labelId}>
          {options.map((o, k) => {
            const on = picked.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role={q.type === "single" ? "radio" : "checkbox"}
                aria-checked={on}
                onClick={(e) => {
                  setTapped(o.value + Date.now());
                  if (q.type === "single") onSingle(o.value, e.currentTarget);
                  else onToggle(o.value);
                }}
                className={cn(OPTION, oneCol ? "min-h-16" : "min-h-[86px] flex-col items-start gap-1.5", on && OPTION_ON, tapped.startsWith(o.value) && "sg-wiggle")}
              >
                <span className={cn("text-[30px] leading-none transition-transform duration-200", on && "-rotate-6 scale-110")} aria-hidden>
                  {optionEmoji(o, k)}
                </span>
                <span className="min-w-0 pr-5">{o.label}</span>
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
              <small className="block text-[10px] font-extrabold text-slate-500">{t.label}</small>
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
        <p id={errId} role="alert" className="text-sm font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function AvailabilityRow({ day, picked, onPick }: { day: { value: string; label: string }; picked: string[]; onPick: (v: string) => void }) {
  return (
    <>
      <span className="text-xs font-black text-slate-500">{day.label}</span>
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
              "h-10 rounded-xl border-2 border-slate-900 transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 motion-reduce:transform-none",
              on ? "scale-105 bg-emerald-600" : "bg-white"
            )}
          />
        );
      })}
    </>
  );
}

/** Short confetti burst on the finish screen (skipped with reduced motion). */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const parent = c.parentElement?.closest(".relative") as HTMLElement | null;
    const r = (parent ?? c).getBoundingClientRect();
    c.width = r.width;
    c.height = r.height;
    const x = c.getContext("2d");
    if (!x) return;
    const cols = ["#4f46e5", "#7c3aed", "#fbbf24", "#059669", "#e11d48", "#0f172a"];
    const P = Array.from({ length: 140 }, () => ({
      x: r.width / 2,
      y: r.height * 0.3,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 3,
      s: 5 + Math.random() * 6,
      c: cols[Math.floor(Math.random() * cols.length)],
      a: Math.random() * 6,
      va: (Math.random() - 0.5) * 0.3,
    }));
    let t = 0;
    let raf = 0;
    const loop = () => {
      x.clearRect(0, 0, c.width, c.height);
      for (const p of P) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.a);
        x.fillStyle = p.c;
        x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        x.restore();
      }
      if (++t < 150) raf = requestAnimationFrame(loop);
      else x.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
}

const INPUT =
  "w-full rounded-2xl border-[2.5px] border-slate-900 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition-shadow focus:shadow-[3px_3px_0_#4f46e5]";

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
      <h2 className="text-[26px] font-black leading-tight">Tes coordonnées 📱</h2>
      <label className="block space-y-1.5" htmlFor="contact-name">
        <span className="text-[15px] font-black">Nom et prénom</span>
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
      {errors["contact.name"] ? <p role="alert" className="text-sm font-bold text-rose-600">{errors["contact.name"]}</p> : null}
      <div className="space-y-1.5">
        <label htmlFor="contact-phone" className="text-[15px] font-black">
          WhatsApp
        </label>
        <div className="flex gap-2">
          <span className="grid min-h-12 place-items-center rounded-2xl border-[2.5px] border-slate-900 px-3 font-black text-slate-500">+216</span>
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
        {errors["contact.phone"] ? <p role="alert" className="text-sm font-bold text-rose-600">{errors["contact.phone"]}</p> : null}
      </div>
      <label htmlFor="contact-consent" className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-700">
        <input id="contact-consent" type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="h-6 w-6 shrink-0 accent-indigo-600" />
        <span>OK pour que {orgName} m’écrive sur WhatsApp</span>
      </label>
      {errors["contact.consent"] ? <p role="alert" className="text-sm font-bold text-rose-600">{errors["contact.consent"]}</p> : null}
    </>
  );
}
