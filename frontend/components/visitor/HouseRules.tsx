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
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { mobileApi } from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import type { HouseRule, MemberHouseRules } from "@/lib/types";
import { cn } from "@/lib/utils";

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
              className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-[30px] shadow-sm"
            >
              {r.icon}
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

const COPY: Record<Moment, { title: string; subtitle: string }> = {
  signup: { title: "Avant de vous installer", subtitle: "Pour que tout le monde travaille bien." },
  open: { title: "Rappel du règlement", subtitle: "Pour que tout le monde travaille bien." },
  forfait: { title: "Avant de pointer", subtitle: "Merci de respecter ces règles." },
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
  const afterAccept = useRef<(() => void) | null>(null);

  const { data, isFetched } = useQuery({
    queryKey: ["house-rules", memberId],
    queryFn: () => mobileApi.houseRules(memberId!),
    enabled: !!memberId && onboarded,
    staleTime: 5 * 60_000,
  });

  const open = useCallback((m: Moment) => {
    setChecked(false);
    setMoment(m);
  }, []);

  // After sign-up (always) or when the app opens (if the admin chose it).
  useEffect(() => {
    if (!data || !memberId || moment) return;
    let fromSignup = false;
    let openedThisVisit = false;
    try {
      fromSignup = localStorage.getItem(signupKey(memberId)) === "1";
      openedThisVisit = sessionStorage.getItem(openKey(memberId)) === "1";
    } catch {
      /* storage blocked */
    }
    if (!data.rules.length) return;
    if (fromSignup && data.acceptedVersion !== data.version) {
      open("signup");
      return;
    }
    if (fromSignup) {
      try {
        localStorage.removeItem(signupKey(memberId));
      } catch {
        /* ignore */
      }
    }
    if (data.onOpen && !openedThisVisit && needsReading(data)) open("open");
  }, [data, memberId, moment, open]);

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

  const copy = COPY[moment ?? "signup"];
  // Before a forfait the visitor may step back; after sign-up / on open they must read.
  const dismissible = moment === "forfait";

  return (
    <HouseRulesContext.Provider value={{ beforeForfait, showing: !!moment && !!data, settled: isFetched }}>
      {children}
      <QuestSheet
        open={!!moment && !!data}
        onOpenChange={(o) => {
          if (o || !dismissible) return;
          afterAccept.current = null;
          setMoment(null);
        }}
        dismissible={dismissible}
        tone="rose"
        eyebrow="Règlement de l'espace"
        title={copy.title}
        subtitle={copy.subtitle}
        chip={{ label: "Lecture", value: "10 s" }}
        footer={
          <div className="space-y-2">
            <label
              htmlFor="house-rules-accept"
              className="flex cursor-pointer items-center gap-2.5 px-1 py-1.5 text-[13px] font-bold text-slate-800"
            >
              <input
                id="house-rules-accept"
                type="checkbox"
                className="h-5 w-5 accent-indigo-600"
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
        }
      >
        {data ? <HouseRuleTiles rules={data.rules} /> : null}
      </QuestSheet>
    </HouseRulesContext.Provider>
  );
}
