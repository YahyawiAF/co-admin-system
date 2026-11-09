"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  Download,
  MapPin,
  QrCode,
  Smartphone,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { levelProgress, usePlayer } from "@/lib/hooks/use-player";
import {
  EARN_POINTS_PER_DT,
  POINTS_PER_DT,
  POINT_AMOUNTS,
  PROFILE_MISSION_TOTAL,
  dtToPoints,
} from "@/lib/points-catalog";
import {
  androidBrowser,
  isIosDevice,
  isStandalonePwa,
  type AndroidBrowser,
} from "@/lib/visitor-notify";
import { installSummary, pickInstallSteps } from "@/components/visitor/installSteps";
import {
  InAppBrowserNotice,
  InstallStepVisual,
} from "@/components/visitor/InstallStepVisual";
import { useHouseRules } from "@/components/visitor/HouseRules";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";

/* ---------- storage ---------- */

const seenKey = (org: string, memberId: string) => `app-guide-seen:${org}:${memberId}`;

export function hasSeenGuide(org: string, memberId: string) {
  try {
    return localStorage.getItem(seenKey(org, memberId)) === "1";
  } catch {
    return true; // storage blocked: never force the guide
  }
}

function markGuideSeen(org: string, memberId: string) {
  try {
    localStorage.setItem(seenKey(org, memberId), "1");
  } catch {
    /* private mode */
  }
}

/* ---------- install prompt (captured early, used by the last card) ---------- */

type BeforeInstall = Event & { prompt: () => Promise<void> };

function isIosSafari() {
  return isIosDevice() && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(navigator.userAgent);
}

/* ---------- context ---------- */

export type GuideCard = "welcome" | "arrival" | "points" | "level" | "cafe" | "install";

type Ctx = {
  /** Open the guide, optionally on one card (e.g. "points" from the profile). */
  openGuide: (card?: GuideCard) => void;
  /** Guide on screen: other popups wait. */
  showing: boolean;
  /** The member has closed the guide at least once on this device. */
  seen: boolean;
};

const AppGuideContext = createContext<Ctx>({ openGuide: () => {}, showing: false, seen: true });

export function useAppGuide() {
  return useContext(AppGuideContext);
}

/**
 * « Premiers pas »: a full-screen guide shown once to each member on the home
 * page (after the space rules), and from the profile whenever they want.
 */
export function AppGuideProvider({ children }: { children: ReactNode }) {
  const { slug } = useOrg();
  const { memberId, onboarded } = useVisitorSession();
  const { showing: rulesShowing, settled: rulesSettled } = useHouseRules();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<GuideCard>("welcome");
  const [seen, setSeen] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);

  const home = pathname === `/m/${slug}` || pathname === `/m/${slug}/`;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (memberId) setSeen(hasSeenGuide(slug, memberId));
  }, [memberId, slug]);

  // First time on the home page, once the rules are read.
  useEffect(() => {
    if (!onboarded || !memberId || seen || open || !home) return;
    if (rulesShowing || !rulesSettled) return;
    const t = setTimeout(() => {
      setStart("welcome");
      setOpen(true);
    }, 500);
    return () => clearTimeout(t);
  }, [onboarded, memberId, seen, open, home, rulesShowing, rulesSettled]);

  const openGuide = useCallback((card: GuideCard = "welcome") => {
    setStart(card);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (memberId) {
      markGuideSeen(slug, memberId);
      setSeen(true);
    }
  }, [memberId, slug]);

  return (
    <AppGuideContext.Provider value={{ openGuide, showing: open, seen }}>
      {children}
      {open ? (
        <AppGuide
          start={start}
          memberId={memberId}
          deferred={deferred}
          onInstalled={() => setDeferred(null)}
          onClose={close}
        />
      ) : null}
    </AppGuideContext.Provider>
  );
}

/* ---------- the guide ---------- */

const LEAVE_MS = 220;

function AppGuide({
  start,
  memberId,
  deferred,
  onInstalled,
  onClose,
}: {
  start: GuideCard;
  memberId: string | null;
  deferred: BeforeInstall | null;
  onInstalled: () => void;
  onClose: () => void;
}) {
  const { org } = useOrg();
  const { player } = usePlayer(memberId);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [env, setEnv] = useState<{
    standalone: boolean;
    ios: boolean;
    safari: boolean;
    browser: AndroidBrowser | null;
  }>({ standalone: false, ios: false, safari: true, browser: null });
  const [installStep, setInstallStep] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setEnv({
      standalone: isStandalonePwa(),
      ios: isIosDevice(),
      safari: isIosSafari(),
      browser: androidBrowser(),
    });
  }, []);

  const cards: GuideCard[] = ["welcome", "arrival", "points", "level", "cafe", "install"];
  const [idx, setIdx] = useState(() => Math.max(0, cards.indexOf(start)));
  const last = idx === cards.length - 1;
  const card = cards[idx]!;

  // No scrolling of the page behind; Escape closes.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(cards.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leave() {
    setLeaving(true);
    setTimeout(onClose, LEAVE_MS);
  }

  const steps = pickInstallSteps(env.ios, env.browser);
  const canNative = !!deferred && !env.ios;
  const iosOther = env.ios && !env.safari;

  async function primary() {
    if (!last) return setIdx((i) => i + 1);
    if (card === "install" && !env.standalone) {
      if (canNative) {
        await deferred!.prompt();
        onInstalled();
        return leave();
      }
      if (!iosOther && installStep < steps.length - 1) return setInstallStep((s) => s + 1);
    }
    leave();
  }

  const primaryLabel = !last
    ? "Suivant"
    : env.standalone
      ? "C’est parti"
      : canNative
        ? "Installer l’app"
        : iosOther
          ? "Plus tard"
          : installStep < steps.length - 1
            ? "Étape suivante"
            : "C’est fait";

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
    touchX.current = null;
    if (dx < -48) setIdx((i) => Math.min(cards.length - 1, i + 1));
    if (dx > 48) setIdx((i) => Math.max(0, i - 1));
  };

  if (!mounted) return null;

  const lp = levelProgress(player);
  const exampleDt = 7;

  const slides: Record<GuideCard, { eyebrow: string; title: string; text: ReactNode; hero: ReactNode }> = {
    welcome: {
      eyebrow: "Bienvenue",
      title: `${org.name} dans votre poche`,
      text: "L’essentiel en une minute. Vous pourrez revoir ce guide dans votre profil.",
      hero: (
        <div className="flex flex-col items-center gap-4 text-white">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo}
              alt=""
              className="h-20 w-20 rounded-[26px] bg-white object-contain p-2 shadow-xl"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-indigo-300 to-violet-600 text-3xl font-black shadow-xl">
              {org.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="flex flex-wrap justify-center gap-2 px-4 text-xs font-bold">
            <Chip icon={MapPin}>Arrivée</Chip>
            <Chip icon={Sparkles}>Points</Chip>
            <Chip icon={Coffee}>Café</Chip>
          </div>
        </div>
      ),
    },
    arrival: {
      eyebrow: "En arrivant",
      title: "Pointez en un tap",
      text: "Touchez « Pointer mon arrivée » sur l’accueil, ou scannez le QR à l’entrée. Le tarif se choisit tout seul.",
      hero: (
        <MiniCard>
          <Label>Mission du jour</Label>
          <p className="text-base font-extrabold text-slate-900">Arrivé ? Un tap.</p>
          <div className="relative flex h-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-extrabold text-white">
            Pointer mon arrivée
            <span
              aria-hidden
              className="absolute -bottom-2 right-6 h-8 w-8 rounded-full border-2 border-white bg-white/60 shadow-md motion-safe:animate-[guide-tap_1.6s_ease-in-out_infinite]"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <QrCode className="h-4 w-4" /> Ou scannez le QR à l’entrée
          </div>
        </MiniCard>
      ),
    },
    points: {
      eyebrow: "Vos points",
      title: "Gagnez des points, payez moins",
      text: (
        <>
          <strong className="text-slate-800">{POINTS_PER_DT.toLocaleString("fr-FR")} pts = 1 DT</strong> de
          réduction sur un prochain paiement. Exemple : une session à {exampleDt} DT rapporte{" "}
          {dtToPoints(exampleDt)} pts.
        </>
      ),
      hero: (
        <MiniCard>
          <Label>Comment gagner</Label>
          <EarnRow icon={Coffee} label="1 DT dépensé (session, café)" pts={EARN_POINTS_PER_DT} />
          <EarnRow icon={Smartphone} label="App installée" pts={POINT_AMOUNTS.INSTALL_PWA ?? 0} />
          <EarnRow icon={UserRound} label="Profil complet (infos + photo)" pts={PROFILE_MISSION_TOTAL} />
          {!env.standalone ? (
            <p className="rounded-xl bg-amber-50 px-2.5 py-2 text-[11.5px] font-semibold leading-snug text-amber-900">
              Les points comptent seulement dans l’app installée.
            </p>
          ) : null}
        </MiniCard>
      ),
    },
    level: {
      eyebrow: "Niveau et trophées",
      title: "Chaque visite vous fait monter",
      text: "Votre niveau grimpe avec vos sessions. Les trophées récompensent vos habitudes : café, régularité, profil…",
      hero: (
        <MiniCard>
          <div className="flex items-center gap-3">
            <span
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#7c3aed 0 ${lp.pct}%, #e2e8f0 0)` }}
            >
              <span className="absolute inset-1.5 rounded-full bg-white" />
              <Trophy className="relative h-6 w-6 text-indigo-700" />
            </span>
            <div className="min-w-0">
              <Label>Votre niveau</Label>
              <p className="truncate text-base font-extrabold text-slate-900">
                {levelName(player?.level?.name)}
              </p>
              {lp.label && player?.level?.next ? (
                <p className="text-xs font-semibold text-slate-500">{lp.label}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(player?.trophies ?? []).slice(0, 4).map((t) => (
              <span
                key={t.id}
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-bold",
                  t.unlocked ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"
                )}
              >
                {t.unlocked ? "🏆 " : ""}
                {t.name}
              </span>
            ))}
          </div>
        </MiniCard>
      ),
    },
    cafe: {
      eyebrow: "Sur place",
      title: "Café et événements",
      text: "Commandez depuis l’onglet Café, sans vous lever. Les ateliers et soirées sont dans Événements.",
      hero: (
        <div className="grid w-[86%] grid-cols-2 gap-2.5">
          <Tile icon={Coffee} title="Café" hint="Commande à votre place" />
          <Tile icon={CalendarDays} title="Événements" hint="Ateliers, soirées" />
        </div>
      ),
    },
    install: env.standalone
      ? {
          eyebrow: "C’est prêt",
          title: "Vous êtes prêt !",
          text: "L’app est déjà sur votre écran. Pointez votre arrivée pour gagner vos premiers points.",
          hero: (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white shadow-[0_0_0_10px_rgba(16,185,129,0.25)]">
              ✓
            </span>
          ),
        }
      : canNative
        ? {
            eyebrow: "Dernière étape",
            title: "Installez l’app en un tap",
            text: `Une icône sur votre écran, ouverte en un geste. +${POINT_AMOUNTS.INSTALL_PWA ?? 0} pts, et vos points sont comptés.`,
            hero: (
              <div className="flex flex-col items-center gap-3 text-white">
                <span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/95 text-indigo-700 shadow-xl">
                  <Download className="h-9 w-9" />
                </span>
                <span className="text-xs font-bold opacity-90">Pas de store, rien à chercher.</span>
              </div>
            ),
          }
        : {
            eyebrow: "Dernière étape",
            title: iosOther ? "Ouvrez la page dans Safari" : "Ajoutez l’app à l’écran d’accueil",
            text: iosOther
              ? "Sur iPhone, l’installation marche seulement dans Safari. Vous pourrez aussi le faire plus tard depuis l’accueil."
              : `${installSummary(env.ios, env.browser)} +${POINT_AMOUNTS.INSTALL_PWA ?? 0} pts une fois installée.`,
            hero: iosOther ? (
              <MiniCard>
                <p className="text-sm font-bold text-slate-800">
                  Copiez le lien de cette page, puis ouvrez-le dans <strong>Safari</strong>.
                </p>
              </MiniCard>
            ) : (
              <div className="w-[86%] overflow-hidden rounded-2xl bg-white shadow-xl">
                <InstallStepVisual step={steps[installStep]!} className="max-h-[200px]" />
                <p className="px-3 pb-2.5 pt-2 text-center text-[13px] font-bold text-slate-900">
                  {installStep + 1}. {steps[installStep]!.title}
                  <span className="block text-[11.5px] font-medium text-slate-500">
                    {steps[installStep]!.hint}
                  </span>
                </p>
              </div>
            ),
          },
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guide de l’app"
      className={cn(
        "fixed inset-0 z-[95] flex justify-center bg-slate-900/60 transition-opacity duration-200 motion-reduce:transition-none",
        leaving ? "opacity-0" : "animate-in fade-in duration-300 motion-reduce:animate-none"
      )}
    >
      <style>{`@keyframes guide-tap{0%,100%{transform:scale(1)}45%{transform:scale(.78)}}`}</style>
      <div
        className={cn(
          "relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-[var(--v-bg,#f3f6fb)] transition-transform duration-200 motion-reduce:transition-none",
          leaving ? "scale-[0.98]" : "animate-in zoom-in-95 duration-300 motion-reduce:animate-none"
        )}
      >
        <div className="relative flex items-center gap-2 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 gap-1">
            {cards.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`Carte ${i + 1}`}
                aria-current={i === idx ? "step" : undefined}
                onClick={() => setIdx(i)}
                className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200"
              >
                <span
                  className={cn(
                    "block h-full origin-left rounded-full bg-indigo-600 transition-transform duration-300 motion-reduce:transition-none",
                    i <= idx ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={leave}
            className={cn(
              "rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-extrabold text-slate-600 transition-[background-color,opacity] hover:bg-slate-900/10",
              last && "pointer-events-none opacity-0"
            )}
          >
            Passer
          </button>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full transition-transform duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${-idx * 100}%)` }}
          >
            {cards.map((c, i) => {
              const s = slides[c];
              const cur = i === idx;
              return (
                <section
                  key={c}
                  aria-hidden={!cur}
                  className="flex h-full w-full shrink-0 flex-col gap-4 overflow-y-auto px-4 pt-3"
                >
                  <div className="relative flex h-[min(46dvh,290px)] shrink-0 items-center justify-center overflow-hidden rounded-[26px] bg-gradient-to-br from-indigo-800 via-indigo-600 to-violet-600 shadow-[0_18px_40px_-22px_rgba(67,56,202,0.9)]">
                    <span aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
                    <span aria-hidden className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-white/[0.07]" />
                    <div
                      key={cur ? `on-${c}` : c}
                      className={cn(
                        "relative flex w-full items-center justify-center",
                        cur && "animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none"
                      )}
                    >
                      {s.hero}
                    </div>
                  </div>
                  <div
                    key={cur ? `t-${c}` : `x-${c}`}
                    className={cn(
                      "space-y-1.5 px-1",
                      cur && "animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
                    )}
                  >
                    <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-indigo-600">
                      {s.eyebrow}
                    </p>
                    <h2 className="text-balance text-[23px] font-extrabold leading-tight text-slate-900">
                      {s.title}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-slate-500">{s.text}</p>
                    {c === "install" && env.browser === "inapp" && !env.standalone ? (
                      <InAppBrowserNotice className="mt-2" />
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-[opacity,transform] duration-200",
              idx === 0 && "pointer-events-none scale-75 opacity-0"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-full text-[15px] font-extrabold"
            onClick={() => void primary()}
          >
            {canNative && last && !env.standalone ? <Download className="mr-1.5 h-4 w-4" /> : null}
            {primaryLabel}
          </Button>
        </div>
        {last && !env.standalone && !iosOther ? (
          <button
            type="button"
            onClick={leave}
            className="relative -mt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs font-semibold text-slate-500"
          >
            Plus tard
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/* ---------- small pieces ---------- */

/** "3" → "Niveau 3"; named levels stay as they are. */
function levelName(name: string | undefined) {
  if (!name) return "Niveau 1";
  return /^\d+$/.test(name) ? `Niveau ${name}` : name;
}

function Chip({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function MiniCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[86%] flex-col gap-2.5 rounded-[22px] bg-white p-3.5 shadow-[0_18px_34px_-16px_rgba(15,23,42,0.55)]">
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">{children}</p>
  );
}

function EarnRow({ icon: Icon, label, pts }: { icon: typeof MapPin; label: string; pts: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] font-bold text-slate-800">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold tabular-nums text-amber-900">
        +{pts.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

function Tile({ icon: Icon, title, hint }: { icon: typeof MapPin; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-white p-3 shadow-[0_18px_34px_-16px_rgba(15,23,42,0.55)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-extrabold text-slate-900">{title}</span>
      <span className="text-[11.5px] font-semibold leading-snug text-slate-500">{hint}</span>
    </div>
  );
}

/* ---------- profile menu ---------- */

/** Profile: open the guide or the points explanation whenever the member wants. */
export function GuideMenu({ className }: { className?: string }) {
  const { openGuide } = useAppGuide();
  const rows: { card: GuideCard; label: string; hint: string; icon: typeof MapPin }[] = [
    { card: "welcome", label: "Guide de l’app", hint: "Revoir les premiers pas", icon: Compass },
    { card: "points", label: "Les points", hint: "Comment les gagner et les utiliser", icon: Sparkles },
  ];
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-white shadow-sm", className)}>
      {rows.map((r) => (
        <button
          key={r.card}
          type="button"
          onClick={() => openGuide(r.card)}
          className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-colors duration-150 last:border-b-0 hover:bg-slate-50 active:bg-slate-100"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <r.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{r.label}</span>
            <span className="block text-xs text-slate-500">{r.hint}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      ))}
    </div>
  );
}

/* ---------- home checklist ---------- */

const stepsHiddenKey = (org: string, memberId: string) => `first-steps-hidden:${org}:${memberId}`;

/**
 * Home: what is left of the first steps (guide, app, first check-in).
 * Gone once everything is done, or when the member hides it.
 */
export function FirstStepsCard({ memberId }: { memberId: string }) {
  const { slug } = useOrg();
  const { openGuide, seen } = useAppGuide();
  const { player } = usePlayer(memberId);
  const [standalone, setStandalone] = useState(true);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setStandalone(isStandalonePwa());
    try {
      setHidden(localStorage.getItem(stepsHiddenKey(slug, memberId)) === "1");
    } catch {
      setHidden(false);
    }
  }, [slug, memberId]);

  if (!player) return null;
  const installed =
    standalone || !!player.trophies.find((t) => t.id === "install_pwa" && t.unlocked);
  const items = [
    { id: "guide", label: "Voir le guide de l’app", done: seen, reward: null as number | null },
    { id: "install", label: "Installer l’app", done: installed, reward: POINT_AMOUNTS.INSTALL_PWA ?? 0 },
    { id: "checkin", label: "Pointer ma première arrivée", done: player.stats.sessions > 0, reward: null },
  ];
  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(stepsHiddenKey(slug, memberId), "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-4 pb-3.5 pt-3 text-white">
        <span aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15" />
        <div className="relative flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-85">Mission</p>
            <p className="text-[17px] font-extrabold">Premiers pas</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/20 px-2 py-1 text-[11px] font-extrabold tabular-nums">
              {done}/{items.length}
            </span>
            <button
              type="button"
              onClick={hide}
              aria-label="Masquer"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm font-bold transition-colors hover:bg-white/25"
            >
              ×
            </button>
          </div>
        </div>
        <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/25">
          <span
            className="block h-full rounded-full bg-white transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      </div>
      {items.map((it) => (
        <div
          key={it.id}
          className="flex min-h-[52px] items-center gap-3 border-t border-slate-100 px-4 py-2 text-[13.5px] font-semibold"
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black text-white transition-colors duration-300",
              it.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
            )}
          >
            {it.done ? "✓" : ""}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 transition-colors duration-300",
              it.done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800"
            )}
          >
            {it.label}
          </span>
          {!it.done && it.reward ? (
            <span className="text-[11px] font-extrabold text-amber-700">+{it.reward}</span>
          ) : null}
          {!it.done && it.id === "guide" ? (
            <button
              type="button"
              onClick={() => openGuide()}
              className="h-8 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              Ouvrir
            </button>
          ) : null}
          {!it.done && it.id === "install" ? <InstallAppButton variant="pill" /> : null}
        </div>
      ))}
    </div>
  );
}
