"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { mobileApi } from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import type { HouseRule, MemberHouseRules } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModalGateContext } from "@/lib/modal-gate";

/** Split an icon into its emojis (one rule can show several: 💧🥤🧴☕). */
function emojis(icon: string): string[] {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  const parts = Seg
    ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(icon), (p) => p.segment)
    : Array.from(icon);
  return parts.filter((p) => p.trim()).slice(0, 4);
}

/** The rule's picture: one emoji, or up to four in a 2×2 grid. `size` = font size of a single emoji. */
export function RuleIcon({ icon, size }: { icon: string; size: number }) {
  const list = emojis(icon);
  if (list.length <= 1) return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
  return (
    <span
      className="grid grid-cols-2 place-items-center"
      style={{ fontSize: size * 0.48, lineHeight: 1, gap: size * 0.08 }}
    >
      {list.map((e, i) => (
        <span key={i}>{e}</span>
      ))}
    </span>
  );
}

/** Picture tiles: red crossed-out = not allowed, green check = to do. */
export function HouseRuleTiles({ rules, animate = true }: { rules: HouseRule[]; animate?: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        {rules.map((r, i) => (
          <div
            key={r.id}
            aria-label={`${r.kind === "NO" ? "Interdit" : "À faire"} : ${r.text}`}
            style={animate ? { animationDelay: `${60 + i * 50}ms` } : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-2.5 pt-3 text-center text-[11.5px] font-extrabold leading-tight",
              animate && "v-rise",
              r.kind === "NO" ? "bg-rose-50 text-rose-900" : "bg-emerald-50 text-emerald-900"
            )}
          >
            <span
              aria-hidden
              className="relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm"
            >
              <RuleIcon icon={r.icon} size={30} />
              {r.kind === "NO" ? (
                <span className="absolute inset-0 rounded-full border-4 border-rose-600 [background:linear-gradient(135deg,transparent_calc(50%-2px),#e11d48_calc(50%-2px),#e11d48_calc(50%+2px),transparent_calc(50%+2px))]" />
              ) : (
                <span className="absolute -bottom-1 -right-1 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white bg-emerald-500 text-white">
                  <Check className="h-3 w-3" strokeWidth={4} />
                </span>
              )}
            </span>
            <span className="line-clamp-2">{r.text}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 text-[11px] font-extrabold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-full bg-rose-600" />
          Interdit
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          À faire
        </span>
      </div>
    </div>
  );
}

/** Time a rule stays on screen before « Suivant » unlocks: they have to look at it. */
const DWELL_MS = 1600;

/** One rule per screen, big picture + few words. Last slide: tick + « C'est compris ». */
function RuleSlides({
  rules,
  index,
  onIndex,
}: {
  rules: HouseRule[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const touchX = useRef<number | null>(null);
  return (
    <div
      className="overflow-hidden"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null) return;
        // Swipe back only: going forward waits for the button.
        if (e.changedTouches[0].clientX - start > 60 && index > 0) onIndex(index - 1);
      }}
    >
      <div
        className="flex transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {rules.map((r, i) => {
          const no = r.kind === "NO";
          const here = i === index;
          return (
            <div
              key={r.id}
              aria-hidden={!here}
              aria-label={`${no ? "Interdit" : "À faire"} : ${r.text}`}
              className={cn(
                "flex w-full shrink-0 flex-col items-center px-4 pb-2 pt-4 text-center transition-opacity duration-300",
                here ? "opacity-100" : "opacity-0"
              )}
            >
              <span
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-[0.14em]",
                  no ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                )}
              >
                {no ? "Interdit" : "À faire"}
              </span>
              <span
                aria-hidden
                className={cn(
                  "relative mt-5 grid h-48 w-48 place-items-center rounded-full",
                  no ? "bg-rose-50" : "bg-emerald-50",
                  here && "hr-pop"
                )}
              >
                <RuleIcon icon={r.icon} size={96} />
                {no ? (
                  <span className="absolute inset-0 rounded-full border-[10px] border-rose-600 [background:linear-gradient(135deg,transparent_calc(50%-5px),#e11d48_calc(50%-5px),#e11d48_calc(50%+5px),transparent_calc(50%+5px))]" />
                ) : (
                  <span className="absolute bottom-1 right-1 grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-md">
                    <Check className="h-7 w-7" strokeWidth={4} />
                  </span>
                )}
              </span>
              <p className="mt-6 text-[28px] font-black leading-tight text-slate-900">{r.text}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-label={`Règle ${index + 1} sur ${rules.length}`}>
        {rules.map((r, i) => (
          <span
            key={r.id}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-indigo-600" : i < index ? "w-2 bg-indigo-300" : "w-2 bg-slate-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}

type Moment = "signup" | "open" | "forfait";

const signupKey = (memberId: string) => `house-rules-signup:${memberId}`;
const openKey = (memberId: string) => `house-rules-open:${memberId}`;

/** Called right after a new member registers: the rules show next. */
export function markHouseRulesAfterSignup(memberId: string) {
  try {
    localStorage.setItem(signupKey(memberId), "1");
  } catch {
    /* private mode */
  }
}

function sameDay(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Does the member need to (re)read the rules, according to the admin's frequency? */
function needsReading(d: MemberHouseRules) {
  if (!d.rules.length) return false;
  const upToDate = d.acceptedVersion === d.version;
  if (!upToDate) return true;
  if (d.frequency === "DAILY") return !sameDay(d.acceptedAt);
  return d.frequency === "ALWAYS";
}

const COPY: Record<Moment, { title: string }> = {
  signup: { title: "Avant de vous installer" },
  open: { title: "Rappel du règlement" },
  forfait: { title: "Avant de pointer" },
};

type Ctx = {
  /** Before choosing a forfait: shows the rules if needed, then runs `then`. */
  beforeForfait: (then: () => void) => void;
  /** Rules on screen: other popups wait. */
  showing: boolean;
  /** The rules have been checked (loaded or failed): popups that come after may show. */
  settled: boolean;
};

const HouseRulesContext = createContext<Ctx>({
  beforeForfait: (then) => then(),
  showing: false,
  settled: true,
});

export function useHouseRules() {
  return useContext(HouseRulesContext);
}

export function HouseRulesProvider({ children }: { children: ReactNode }) {
  const { memberId, onboarded } = useVisitorSession();
  const qc = useQueryClient();
  const [moment, setMoment] = useState<Moment | null>(null);
  const [checked, setChecked] = useState(false);
  const [slide, setSlide] = useState(0);
  /** Slide whose dwell time is over (« Suivant » unlocked). */
  const [readUpTo, setReadUpTo] = useState(-1);
  const afterAccept = useRef<(() => void) | null>(null);

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["house-rules", memberId],
    queryFn: () => mobileApi.houseRules(memberId!),
    enabled: !!memberId && onboarded,
    staleTime: 5 * 60_000,
  });

  const open = useCallback((m: Moment) => {
    setChecked(false);
    setSlide(0);
    setReadUpTo(-1);
    setMoment(m);
  }, []);

  // After sign-up (always) or when the app opens (if the admin chose it).
  // Worked out during render so other popups wait from the very first frame.
  let autoMoment: Moment | null = null;
  if (data && memberId && data.rules.length) {
    let fromSignup = false;
    let openedThisVisit = false;
    try {
      fromSignup = localStorage.getItem(signupKey(memberId)) === "1";
      openedThisVisit = sessionStorage.getItem(openKey(memberId)) === "1";
    } catch {
      /* storage blocked */
    }
    if (fromSignup && data.acceptedVersion !== data.version) autoMoment = "signup";
    else if (data.onOpen && !openedThisVisit && needsReading(data)) autoMoment = "open";
  }
  useEffect(() => {
    if (autoMoment && !moment) open(autoMoment);
  }, [autoMoment, moment, open]);

  const accept = useMutation({
    mutationFn: () => mobileApi.acceptHouseRules(memberId!, data!.version),
    onSuccess: (res) => {
      qc.setQueryData<MemberHouseRules>(["house-rules", memberId], (d) =>
        d ? { ...d, acceptedAt: res.acceptedAt, acceptedVersion: res.acceptedVersion } : d
      );
      try {
        localStorage.removeItem(signupKey(memberId!));
        sessionStorage.setItem(openKey(memberId!), "1");
      } catch {
        /* ignore */
      }
      setMoment(null);
      const next = afterAccept.current;
      afterAccept.current = null;
      next?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const beforeForfait = useCallback(
    (then: () => void) => {
      if (!data || !data.beforeForfait || !needsReading(data)) {
        then();
        return;
      }
      // "Every time": don't ask twice in a row (just accepted when the app opened).
      if (
        data.frequency === "ALWAYS" &&
        data.acceptedVersion === data.version &&
        data.acceptedAt &&
        Date.now() - new Date(data.acceptedAt).getTime() < 5 * 60_000
      ) {
        then();
        return;
      }
      afterAccept.current = then;
      open("forfait");
    },
    [data, open]
  );

  const copy = COPY[moment ?? autoMoment ?? "signup"];
  const rules = data?.rules ?? [];
  const lastSlide = slide >= rules.length - 1;
  const slideRead = readUpTo >= slide;
  useEffect(() => {
    if (!moment || readUpTo >= slide) return;
    const t = setTimeout(() => setReadUpTo(slide), DWELL_MS);
    return () => clearTimeout(t);
  }, [moment, slide, readUpTo]);
  const showing = !!data && !!(moment || autoMoment);
  // Other popups wait while the rules load or are on screen.
  const blocked = showing || (isLoading && !!memberId && onboarded);

  return (
    <HouseRulesContext.Provider value={{ beforeForfait, showing, settled: isFetched }}>
      <ModalGateContext.Provider value={{ blocked }}>{children}</ModalGateContext.Provider>
      {/* The only way out is « J'ai lu » + « C'est compris ». */}
      <QuestSheet
        open={!!moment && !!data}
        onOpenChange={() => {}}
        dismissible={false}
        closable={false}
        ignoreGate
        tone="rose"
        eyebrow="Règlement de l'espace"
        title={copy.title}
        chip={{ label: "Règle", value: `${Math.min(slide + 1, rules.length)}/${rules.length}` }}
        footer={
          lastSlide ? (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              <label
                htmlFor="house-rules-accept"
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-1 py-1.5 text-[13px] font-bold text-slate-800 transition-opacity duration-200",
                  !slideRead && "pointer-events-none opacity-40"
                )}
              >
                <input
                  id="house-rules-accept"
                  type="checkbox"
                  className="h-5 w-5 accent-indigo-600"
                  disabled={!slideRead}
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                J&apos;ai lu et j&apos;accepte le règlement
              </label>
              <Button
                className="h-12 w-full rounded-full bg-indigo-600 text-sm font-extrabold transition-opacity duration-200 hover:bg-indigo-700"
                disabled={!checked || accept.isPending}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "…" : "C'est compris"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {slide > 0 ? (
                <Button
                  variant="outline"
                  className="h-12 w-12 shrink-0 rounded-full p-0"
                  aria-label="Règle précédente"
                  onClick={() => setSlide((i) => i - 1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <Button
                key={slide}
                className="relative h-12 flex-1 overflow-hidden rounded-full bg-indigo-600 text-sm font-extrabold hover:bg-indigo-700 disabled:opacity-100 disabled:bg-indigo-300"
                disabled={!slideRead}
                onClick={() => setSlide((i) => i + 1)}
              >
                {/* Fills while the rule must stay on screen. */}
                {!slideRead ? (
                  <span
                    aria-hidden
                    className="hr-fill absolute inset-y-0 left-0 bg-indigo-600"
                    style={{ animationDuration: `${DWELL_MS}ms` }}
                  />
                ) : null}
                <span className="relative inline-flex items-center gap-1">
                  Suivant <ChevronRight className="h-4 w-4" />
                </span>
              </Button>
            </div>
          )
        }
      >
        {data ? <RuleSlides rules={rules} index={slide} onIndex={setSlide} /> : null}
      </QuestSheet>
    </HouseRulesContext.Provider>
  );
}
