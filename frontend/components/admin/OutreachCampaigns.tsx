"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  EyeOff,
  Footprints,
  HandCoins,
  List,
  Megaphone,
  MessageCircle,
  MessageSquareReply,
  MoreVertical,
  PartyPopper,
  Phone,
  PhoneMissed,
  Plane,
  Repeat,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { groupsApi, outreachApi } from "@/lib/api/resources";
import { channelLabel } from "@/lib/outreach-ui";
import type {
  AdvisorCategory,
  CampaignCandidate,
  CampaignGoal,
  CampaignInput,
  CampaignSegment,
  CampaignTarget,
  OutreachCampaign,
  OutreachCampaignDetail,
  OutreachChannel,
  OutreachOutcome,
} from "@/lib/types";

export const SEGMENT_LABEL: Record<CampaignSegment, string> = {
  ABO_EXPIRING: "Abonnement qui se termine",
  ABO_ENDED: "Abonnement non renouvelé",
  INACTIVE: "Habitués absents",
  TOP_UP: "Ont payé la moitié d'un abonnement",
  CONVERT: "Passes au rythme d'un abonnement",
  UNPAID: "Impayés",
  RECENT_30: "Venus ces 30 derniers jours",
  ALL: "Tous les membres (avec téléphone)",
  GROUP: "Un groupe de membres",
  MANUAL: "Choisis à la main",
};

const SEGMENT_SHORT: Record<CampaignSegment, string> = {
  ...SEGMENT_LABEL,
  ALL: "Tous",
  TOP_UP: "À compléter",
  CONVERT: "Passes → abonnement",
  RECENT_30: "Venus en 30 j",
};

const SEGMENT_ICON: Record<CampaignSegment, LucideIcon> = {
  ABO_EXPIRING: CalendarClock,
  ABO_ENDED: CalendarX,
  INACTIVE: UserMinus,
  TOP_UP: Calculator,
  CONVERT: Repeat,
  UNPAID: HandCoins,
  RECENT_30: Footprints,
  ALL: Users,
  GROUP: Users,
  MANUAL: UserRound,
};

/** Lists offered in the people picker, in this order. */
const PICK_LISTS: CampaignSegment[] = ["ALL", "CONVERT", "ABO_EXPIRING", "ABO_ENDED", "INACTIVE", "TOP_UP", "UNPAID", "RECENT_30"];

const GOALS: Array<{ id: CampaignGoal; label: string; icon: LucideIcon }> = [
  { id: "SUBSCRIPTION", label: "Il prend un abonnement", icon: BadgeCheck },
  { id: "VISIT", label: "Il revient", icon: DoorOpen },
  { id: "ANY", label: "Il revient ou achète", icon: ShoppingBag },
];

/** Same answers as Relances: label, icon, tint, default days before calling back (null = no call back). */
export const ANSWER_UI: Record<OutreachOutcome, { label: string; icon: LucideIcon; tone: string; days: number | null }> = {
  INTERESTED: { label: "Intéressé", icon: ThumbsUp, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", days: 3 },
  OTHER_OFFER: { label: "Veut une autre offre", icon: Repeat, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300", days: 2 },
  KEEP_TARIF: { label: "Garde le tarif", icon: Ticket, tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300", days: 30 },
  AWAY: { label: "Parti / en voyage", icon: Plane, tone: "bg-muted text-muted-foreground", days: 30 },
  NO_ANSWER: { label: "Pas de réponse", icon: PhoneMissed, tone: "bg-muted text-muted-foreground", days: 3 },
  NOT_INTERESTED: { label: "Pas intéressé", icon: ThumbsDown, tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300", days: null },
};
const ANSWERS = Object.keys(ANSWER_UI) as OutreachOutcome[];

type TargetStatus = "todo" | "waiting" | "noanswer" | "answered" | "won" | "skipped";
const STATUS_UI: Record<TargetStatus, { label: string; filter: string; pill: string; avatar: string }> = {
  todo: {
    label: "À contacter",
    filter: "À contacter",
    pill: "bg-card text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:text-indigo-300 dark:ring-indigo-800",
    avatar: "bg-card text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:text-indigo-300 dark:ring-indigo-800",
  },
  waiting: {
    label: "Attend sa réponse",
    filter: "Attend sa réponse",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    avatar: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  noanswer: { label: "Pas de réponse", filter: "Pas de réponse", pill: "bg-muted text-muted-foreground", avatar: "bg-muted text-muted-foreground" },
  answered: { label: "A répondu", filter: "A répondu", pill: "bg-violet-600 text-white", avatar: "bg-violet-600 text-white" },
  won: { label: "Gagné", filter: "Gagnés", pill: "bg-emerald-600 text-white", avatar: "bg-emerald-600 text-white" },
  skipped: { label: "Ignoré", filter: "Ignorés", pill: "bg-muted/60 text-muted-foreground/70", avatar: "bg-muted/60 text-muted-foreground/70" },
};
const STATUS_ORDER: TargetStatus[] = ["todo", "waiting", "noanswer", "answered", "won", "skipped"];

function targetStatus(t: CampaignTarget): TargetStatus {
  if (t.won) return "won";
  if (t.contactedAt) return t.outcome === "NO_ANSWER" ? "noanswer" : t.outcome ? "answered" : "waiting";
  return t.channel === "SKIP" ? "skipped" : "todo";
}

const SUBSCRIPTION_SEGMENTS: CampaignSegment[] = ["ABO_EXPIRING", "ABO_ENDED", "TOP_UP", "CONVERT"];
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const digits = (s: string) => s.replace(/\D/g, "");
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { locale: fr, addSuffix: true });
const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";
const DIALOG_CLASS =
  "flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30";

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/** Glass chip on the indigo banners. */
export function BannerChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[84px] rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
      <div className="text-[11px] font-medium text-indigo-100">{label}</div>
      <div className="text-lg font-extrabold tabular-nums leading-tight">{value}</div>
      {sub ? <div className="text-[11px] text-indigo-100">{sub}</div> : null}
    </div>
  );
}

/** Same pill as the check-in modal tabs: the count in its own chip. */
export function FilterPill({
  active,
  onClick,
  children,
  count,
  small,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  small?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 motion-reduce:transition-none",
        small ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-1.5 text-sm",
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
          : "bg-background text-muted-foreground hover:border-indigo-300 hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
      {count != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums transition-colors duration-200",
            active ? "bg-white/25 text-white" : "bg-muted text-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-xl bg-background pl-9" />
    </div>
  );
}

function StatusPill({ status, revenue }: { status: TargetStatus; revenue?: number }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-200", STATUS_UI[status].pill)}>
      {status === "won" && revenue ? `Gagné · ${dt(revenue)}` : STATUS_UI[status].label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// People picker: start from a list, tick / untick each person, or search anyone
// ---------------------------------------------------------------------------

type PickList = { segment: CampaignSegment; groupId: string | null };

function PeoplePicker({
  selected,
  onChange,
  list,
  onList,
  exclude,
  selectAllOnLoad,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  list: PickList;
  onList: (l: PickList) => void;
  /** Already in the campaign (Ajouter) */
  exclude?: Set<string>;
  /** Tick everyone of the list once it is loaded (campaign from an AI idea); the parent turns it off after */
  selectAllOnLoad?: boolean;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const known = useRef(new Map<string, CampaignCandidate>());
  // Names of people ticked from other lists (loaded earlier)
  for (const [, rows] of qc.getQueriesData<CampaignCandidate[]>({ queryKey: ["outreach-candidates"] })) {
    for (const p of rows ?? []) known.current.set(p.memberId, p);
  }
  const counts = useQuery({
    queryKey: ["outreach-segments", null],
    queryFn: () => outreachApi.segments(null),
  });
  const groups = useQuery({ queryKey: ["groups"], queryFn: groupsApi.list });
  const ready = list.segment !== "GROUP" || !!list.groupId;
  const people = useQuery({
    queryKey: ["outreach-candidates", list.segment, list.groupId],
    queryFn: () => outreachApi.candidates(list.segment, list.groupId),
    enabled: ready,
  });
  for (const p of people.data ?? []) known.current.set(p.memberId, p);

  useEffect(() => {
    if (!selectAllOnLoad || !people.data) return;
    onChange(new Set(people.data.filter((p) => !exclude?.has(p.memberId)).map((p) => p.memberId)));
    // Only when the list arrives (onChange / exclude change on every render)
  }, [selectAllOnLoad, people.data]);

  const pool = useMemo(() => {
    const base = onlySelected
      ? [...selected].map((id) => known.current.get(id) ?? { memberId: id, name: "…", phone: null, lastVisit: null })
      : (people.data ?? []).filter((p) => !exclude?.has(p.memberId));
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    const d = digits(needle);
    return base.filter((p) => p.name.toLowerCase().includes(needle) || (d.length >= 3 && digits(p.phone ?? "").includes(d)));
  }, [onlySelected, selected, people.data, exclude, q]);
  const paged = usePaged(pool, 10, `${list.segment}|${list.groupId}|${q}|${onlySelected}`);
  const allOn = pool.length > 0 && pool.every((p) => selected.has(p.memberId));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    for (const p of pool) {
      if (allOn) next.delete(p.memberId);
      else next.add(p.memberId);
    }
    onChange(next);
  };
  const pickList = (l: PickList) => {
    setOnlySelected(false);
    onList(l);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PICK_LISTS.map((s) => (
          <FilterPill
            key={s}
            small
            active={!onlySelected && list.segment === s}
            onClick={() => pickList({ segment: s, groupId: null })}
            count={counts.data?.[s]}
          >
            {SEGMENT_SHORT[s]}
          </FilterPill>
        ))}
        {(groups.data ?? []).length ? (
          <select
            aria-label="Un groupe de membres"
            value={list.segment === "GROUP" ? list.groupId ?? "" : ""}
            onChange={(e) => e.target.value && pickList({ segment: "GROUP", groupId: e.target.value })}
            className={cn(
              "h-[30px] rounded-full border px-2.5 text-[13px] font-semibold transition-colors duration-200",
              !onlySelected && list.segment === "GROUP"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "bg-background text-muted-foreground",
            )}
          >
            <option value="">Un groupe…</option>
            {(groups.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone…" />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          disabled={!pool.length}
          onClick={toggleAll}
        >
          {allOn ? "Tout décocher" : `Tout cocher (${pool.length})`}
        </Button>
        <button
          type="button"
          aria-pressed={onlySelected}
          onClick={() => setOnlySelected((v) => !v)}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors duration-200",
            onlySelected ? "border-indigo-600 bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:border-indigo-300",
          )}
        >
          Cochés
          <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", onlySelected ? "bg-white/25" : "bg-muted text-foreground")}>
            {selected.size}
          </span>
        </button>
      </div>

      {!ready ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Choisissez le groupe.</p>
      ) : people.isLoading && !onlySelected ? (
        <div className="grid gap-1 rounded-2xl bg-muted/40 p-1.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-1 rounded-2xl bg-muted/40 p-1.5 sm:grid-cols-2">
          {paged.pageItems.map((p, i) => {
            const on = selected.has(p.memberId);
            return (
              <li key={p.memberId} className={ENTER} style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(p.memberId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors duration-150",
                    on ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40" : "border-transparent bg-card hover:border-indigo-100 dark:hover:border-indigo-900",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150",
                      on ? "border-indigo-600 bg-indigo-600 text-white" : "border-muted-foreground/30 bg-background",
                    )}
                  >
                    {on ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors duration-150",
                      on ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.lastVisit ? `Venu ${ago(p.lastVisit)}` : "Jamais venu"}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!paged.pageItems.length ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground sm:col-span-2">
              {onlySelected ? "Personne n'est coché." : "Personne dans cette liste."}
            </li>
          ) : null}
        </ul>
      )}
      <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="rounded-xl border px-3 py-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// New campaign: who (picked one by one) → message → what counts as a success
// ---------------------------------------------------------------------------

export type CampaignDraft = Partial<CampaignInput> & { title: string; message: string };

const STEPS = ["Qui", "Message", "Résultat attendu"] as const;

export function CampaignDialog({
  draft,
  onClose,
  onCreated,
}: {
  draft: CampaignDraft | null;
  onClose: () => void;
  onCreated?: (c: OutreachCampaign) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CampaignInput | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [list, setList] = useState<PickList>({ segment: "ALL", groupId: null });
  /** Campaign from an AI idea: tick its whole list once, then leave the ticks to the user */
  const [autoSelect, setAutoSelect] = useState(false);
  useEffect(() => {
    if (!draft) return setForm(null);
    const segment = draft.segment ?? "ALL";
    setStep(0);
    setSelected(new Set());
    setAutoSelect(segment !== "ALL" && segment !== "MANUAL" && !!draft.segment);
    setList({ segment: segment === "MANUAL" ? "ALL" : segment, groupId: draft.memberGroupId ?? null });
    setForm({
      title: draft.title,
      message: draft.message || "Bonjour {prenom}, ",
      segment,
      memberGroupId: draft.memberGroupId ?? null,
      goal: draft.goal ?? (SUBSCRIPTION_SEGMENTS.includes(segment) ? "SUBSCRIPTION" : "ANY"),
      sourceReportId: draft.sourceReportId ?? null,
      recommendationTitle: draft.recommendationTitle ?? null,
      trackAsInitiative: draft.trackAsInitiative ?? true,
      category: draft.category as AdvisorCategory | undefined,
    });
  }, [draft]);

  /** The list the ticked people all come from (else "picked by hand"). */
  const segmentFor = (ids: Set<string>): { segment: CampaignSegment; groupId: string | null } => {
    const tries: PickList[] = [];
    if (draft?.segment && draft.segment !== "MANUAL") tries.push({ segment: draft.segment, groupId: draft.memberGroupId ?? null });
    if (list.segment !== "ALL") tries.push(list);
    for (const t of tries) {
      const rows = qc.getQueryData<CampaignCandidate[]>(["outreach-candidates", t.segment, t.groupId]);
      if (rows) {
        const inList = new Set(rows.map((r) => r.memberId));
        if ([...ids].every((id) => inList.has(id))) return t;
      }
    }
    return { segment: "MANUAL", groupId: null };
  };

  const create = useMutation({
    mutationFn: () => {
      const s = segmentFor(selected);
      return outreachApi.createCampaign({ ...form!, segment: s.segment, memberGroupId: s.groupId, memberIds: [...selected] });
    },
    onSuccess: (c) => {
      toast.success(`Campagne créée : ${c.progress.total} personne${c.progress.total > 1 ? "s" : ""} à contacter`);
      qc.invalidateQueries({ queryKey: ["outreach-campaigns"] });
      qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
      onClose();
      onCreated?.(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return null;
  const set = (patch: Partial<CampaignInput>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const preview = form.message.replace(/\{\s*pr[ée]nom\s*\}/gi, "Sarra");
  const stepOk = [selected.size > 0, !!form.title.trim() && !!form.message.trim(), true];
  const canGo = (i: number) => i <= step || stepOk.slice(0, i).every(Boolean);

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "h-[90vh] max-w-4xl sm:max-w-4xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <DialogHeader className="relative space-y-1 pr-10 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Relances · Campagne</p>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-white">
              <Megaphone className="h-6 w-6 shrink-0" />
              <span className="truncate">{form.title.trim() || "Nouvelle campagne"}</span>
            </DialogTitle>
            <DialogDescription className="text-[13px] text-indigo-100">
              Coche les personnes, écris le message, puis suis qui a répondu et qui a pris un abonnement.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-3 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                disabled={!canGo(i)}
                onClick={() => setStep(i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-200 disabled:opacity-60",
                  step === i ? "border-white bg-white text-indigo-700" : i < step ? "border-white/40 bg-white/20 text-white" : "border-white/30 text-indigo-100",
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", step === i ? "bg-indigo-600 text-white" : "bg-white/25")}>
                  {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div key={step} className={ENTER}>
            {step === 0 ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Pars d&apos;une liste, puis coche ou décoche chaque personne. « Tous » pour chercher n&apos;importe qui.
                </p>
                <PeoplePicker
                  selected={selected}
                  onChange={(next) => {
                    setSelected(next);
                    setAutoSelect(false);
                  }}
                  list={list}
                  onList={(l) => {
                    setList(l);
                    setAutoSelect(false);
                  }}
                  selectAllOnLoad={autoSelect}
                />
              </>
            ) : step === 1 ? (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Nom de la campagne</span>
                  <Input
                    value={form.title}
                    maxLength={200}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Ex. : Passer à l'abonnement : novembre"
                    className="h-11 rounded-xl"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    Message <span className="font-normal text-muted-foreground">({"{prenom}"} = son prénom)</span>
                  </span>
                  <Textarea rows={5} value={form.message} onChange={(e) => set({ message: e.target.value })} className="rounded-xl" />
                </label>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">Aperçu</div>
                  {preview}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {GOALS.map((g) => {
                    const on = form.goal === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ goal: g.id })}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left transition-all duration-200 motion-reduce:transition-none",
                          on ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40" : "border-transparent bg-muted/50 hover:bg-muted",
                        )}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", on ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground")}>
                          <g.icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold">{g.label}</span>
                          <span className="block text-xs text-muted-foreground">dans les 14 jours</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-600"
                    checked={!!form.trackAsInitiative}
                    onChange={(e) => set({ trackAsInitiative: e.target.checked })}
                  />
                  Suivre aussi l&apos;effet global (avant / après) dans « Mes initiatives »
                </label>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="font-semibold">{form.title.trim() || "Sans nom"}</div>
                  <div className="text-muted-foreground">
                    {selected.size} personne{selected.size > 1 ? "s" : ""} · {GOALS.find((g) => g.id === form.goal)?.label.toLowerCase()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <span className="text-sm text-muted-foreground">
            <b className="tabular-nums text-foreground">{selected.size}</b> personne{selected.size > 1 ? "s" : ""} cochée{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep((s) => s - 1)}>
                Retour
              </Button>
            ) : (
              <Button variant="outline" className="rounded-xl" onClick={onClose}>
                Annuler
              </Button>
            )}
            {step < 2 ? (
              <Button className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" disabled={!stepOk[step]} onClick={() => setStep((s) => s + 1)}>
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                disabled={!stepOk[0] || !stepOk[1] || create.isPending}
                onClick={() => create.mutate()}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Créer la campagne
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// One campaign: filters, list or one by one, answers, add / remove people
// ---------------------------------------------------------------------------

/** The member's answer: one tap saves it; the note and call-back day save when you leave the field. */
function AnswerPanel({
  target,
  pending,
  onSave,
}: {
  target: CampaignTarget;
  pending: boolean;
  onSave: (v: { outcome: OutreachOutcome; note: string | null; followUpAt: string | null }) => void;
}) {
  const [note, setNote] = useState(target.note ?? "");
  const [day, setDay] = useState(target.followUpAt ? ymd(new Date(target.followUpAt)) : "");
  useEffect(() => {
    setNote(target.note ?? "");
    setDay(target.followUpAt ? ymd(new Date(target.followUpAt)) : "");
  }, [target.memberId, target.note, target.followUpAt]);
  const save = (outcome: OutreachOutcome, patch?: { note?: string; day?: string }) => {
    const days = ANSWER_UI[outcome].days;
    const d = patch?.day ?? (day || (days != null ? ymd(addDays(new Date(), days)) : ""));
    onSave({ outcome, note: (patch?.note ?? note).trim() || null, followUpAt: days != null && d ? d : null });
  };
  const noCallBack = target.outcome ? ANSWER_UI[target.outcome].days == null : false;
  return (
    <div className="space-y-3 rounded-xl bg-card p-3 shadow-sm ring-1 ring-inset ring-indigo-100 dark:ring-indigo-900">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">Sa réponse</div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {ANSWERS.map((k) => {
          const a = ANSWER_UI[k];
          const on = target.outcome === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => save(k)}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-[13px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                on ? "border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm dark:bg-indigo-950/40 dark:text-indigo-200" : "border-transparent bg-muted/50 hover:bg-muted",
              )}
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", on ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground")}>
                <a.icon className="h-3.5 w-3.5" />
              </span>
              {a.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => target.outcome && note.trim() !== (target.note ?? "") && save(target.outcome, { note })}
          placeholder="Note (ex. : préfère le pack 10 passages)"
          className="h-10 rounded-xl"
        />
        <label
          className={cn(
            "flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground transition-opacity duration-200",
            noCallBack && "opacity-50",
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Rappeler le
          <input
            type="date"
            value={day}
            min={ymd(new Date())}
            disabled={noCallBack}
            onChange={(e) => {
              setDay(e.target.value);
              if (target.outcome) save(target.outcome, { day: e.target.value });
            }}
            className="bg-transparent text-sm text-foreground outline-none"
          />
        </label>
      </div>
      {!target.outcome ? <p className="text-xs text-muted-foreground">Un clic sur sa réponse l&apos;enregistre.</p> : null}
    </div>
  );
}

function rowLine(t: CampaignTarget) {
  const parts: ReactNode[] = [];
  if (t.lastContactAt && t.channel && t.channel !== "SKIP") parts.push(`${channelLabel(t.channel)} ${ago(t.lastContactAt)}`);
  if (t.followUpAt && !t.won) parts.push(`rappel ${format(new Date(t.followUpAt), "d MMM", { locale: fr })}`);
  if (t.note) parts.push(`« ${t.note} »`);
  if (t.withoutContact) parts.push("abonnement pris sans relance notée");
  return parts.length ? parts.join(" · ") : t.message;
}

const TILE =
  "flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-inset ring-border transition-colors duration-150 disabled:opacity-50";

function CampaignDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["outreach-campaign", id],
    queryFn: () => outreachApi.campaign(id!),
    enabled: !!id,
  });
  const [filter, setFilter] = useState<TargetStatus | "all">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "focus">("list");
  const [answering, setAnswering] = useState<string | null>(null);
  /** People acted on since the filter changed stay visible (they don't jump out of « À contacter »). */
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const initFor = useRef<string | null>(null);

  const c = detail.data;
  useEffect(() => {
    if (!id) {
      initFor.current = null;
      return;
    }
    if (!c || initFor.current === id) return;
    initFor.current = id;
    setFilter(c.targets.some((t) => targetStatus(t) === "todo") && c.status !== "DONE" ? "todo" : "all");
    setQ("");
    setView("list");
    setAnswering(null);
    setPinned(new Set());
    setFocusIdx(0);
  }, [id, c]);
  const resetView = () => {
    setPinned(new Set());
    setAnswering(null);
    setFocusIdx(0);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["outreach-campaign", id] });
    qc.invalidateQueries({ queryKey: ["outreach-campaigns"] });
  };
  const pin = (memberId: string) => setPinned((p) => new Set(p).add(memberId));
  const log = useMutation({
    mutationFn: (v: { memberId: string; channel: OutreachChannel; message?: string }) => outreachApi.logCampaign(id!, v),
    onSuccess: (_r, v) => {
      pin(v.memberId);
      if (v.channel !== "SKIP") setAnswering(v.memberId);
      if (v.channel === "PUSH") toast.success("Notification envoyée");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const answer = useMutation({
    mutationFn: (v: { memberId: string; outcome: OutreachOutcome; note: string | null; followUpAt: string | null }) =>
      outreachApi.answerCampaign(id!, v),
    onSuccess: (_r, v) => {
      pin(v.memberId);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const members = useMutation({
    mutationFn: (v: { add?: string[]; remove?: string[] }) => outreachApi.campaignMembers(id!, v),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const finish = useMutation({
    mutationFn: (status: "ACTIVE" | "DONE") => outreachApi.updateCampaign(id!, { status }),
    onSuccess: (_r, status) => {
      toast.success(status === "DONE" ? "Campagne terminée" : "Campagne rouverte");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const n: Record<TargetStatus, number> = { todo: 0, waiting: 0, noanswer: 0, answered: 0, won: 0, skipped: 0 };
    for (const t of c?.targets ?? []) n[targetStatus(t)] += 1;
    return n;
  }, [c]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (c?.targets ?? []).filter(
      (t) =>
        (filter === "all" || targetStatus(t) === filter || pinned.has(t.memberId)) &&
        (!needle || t.name.toLowerCase().includes(needle) || (t.phone ?? "").includes(needle)),
    );
  }, [c, filter, q, pinned]);
  const paged = usePaged(visible, 8, `${filter}|${q}|${view}`);

  const remove = (t: CampaignTarget) =>
    members.mutate(
      { remove: [t.memberId] },
      {
        onSuccess: () =>
          toast.success(`${t.name} retiré de la campagne`, {
            action: { label: "Annuler", onClick: () => members.mutate({ add: [t.memberId] }) },
          }),
      },
    );
  const whatsapp = (t: CampaignTarget) => {
    window.open(`https://wa.me/${t.whatsapp}?text=${encodeURIComponent(t.message)}`, "_blank", "noopener");
    log.mutate({ memberId: t.memberId, channel: "WHATSAPP", message: t.message });
  };
  const contactTiles = (t: CampaignTarget) => (
    <>
      {t.whatsapp ? (
        <button type="button" title="WhatsApp" aria-label="WhatsApp" disabled={log.isPending} onClick={() => whatsapp(t)} className={cn(TILE, "hover:bg-emerald-50 hover:text-emerald-600 hover:ring-emerald-200 dark:hover:bg-emerald-950/40")}>
          <MessageCircle className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-9 w-9" aria-hidden />
      )}
      {t.hasPush ? (
        <button
          type="button"
          title="Notification dans l'app"
          aria-label="Notification dans l'app"
          disabled={log.isPending}
          onClick={() => log.mutate({ memberId: t.memberId, channel: "PUSH", message: t.message })}
          className={cn(TILE, "hover:bg-indigo-50 hover:text-indigo-600 hover:ring-indigo-200 dark:hover:bg-indigo-950/40")}
        >
          <BellRing className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-9 w-9" aria-hidden />
      )}
      <button
        type="button"
        title="Appel ou sur place"
        aria-label="Appel ou sur place"
        disabled={log.isPending}
        onClick={() => log.mutate({ memberId: t.memberId, channel: "CALL" })}
        className={cn(TILE, "hover:bg-indigo-50 hover:text-indigo-600 hover:ring-indigo-200 dark:hover:bg-indigo-950/40")}
      >
        <Phone className="h-4 w-4" />
      </button>
    </>
  );
  const moreMenu = (t: CampaignTarget) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Plus pour ${t.name}`} className="flex h-9 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        {targetStatus(t) === "todo" ? (
          <DropdownMenuItem onClick={() => log.mutate({ memberId: t.memberId, channel: "SKIP" })}>
            <EyeOff className="mr-2 h-4 w-4" />
            Ignorer
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => remove(t)}>
          <UserX className="mr-2 h-4 w-4" />
          Retirer de la campagne
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const saveAnswer = (t: CampaignTarget) => (v: { outcome: OutreachOutcome; note: string | null; followUpAt: string | null }) =>
    answer.mutate(
      { memberId: t.memberId, ...v },
      {
        onSuccess: () => {
          toast.success(`${t.name.split(" ")[0]} : ${ANSWER_UI[v.outcome].label}`);
          if (view === "list" && v.outcome !== t.outcome) setAnswering(null);
        },
      },
    );

  const focusList = visible;
  const ft = focusList[Math.min(focusIdx, Math.max(0, focusList.length - 1))];

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "h-[92vh] max-w-5xl sm:max-w-5xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <DialogHeader className="relative space-y-1 pr-10 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
              {c ? `${SEGMENT_LABEL[c.segment] ?? c.segment} · ${format(new Date(c.createdAt), "d MMM", { locale: fr })}${c.status === "DONE" ? " · terminée" : ""}` : "Campagne"}
            </p>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-white">
              {c?.sourceReportId ? <Sparkles className="h-5 w-5 shrink-0" /> : <Megaphone className="h-5 w-5 shrink-0" />}
              <span className="truncate">{c?.title ?? "…"}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Les personnes de la campagne, leur réponse et le résultat.</DialogDescription>
          </DialogHeader>
          {c ? (
            <div className="relative mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              <BannerChip label="Dans la liste" value={String(c.progress.total)} />
              <BannerChip label="Contactés" value={String(c.progress.contacted)} />
              <BannerChip label="Ont répondu" value={String(c.progress.answered + c.progress.won)} />
              <BannerChip label="Gagnés" value={String(c.progress.won)} />
              <BannerChip label="Rapporté" value={dt(c.progress.revenue)} />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2.5 border-b bg-muted/30 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={(v) => { setQ(v); resetView(); }} placeholder="Chercher un nom…" />
            <div className="flex rounded-xl border bg-background p-1 text-sm">
              {([
                ["list", "Liste", List],
                ["focus", "Un par un", UserRound],
              ] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={view === k}
                  onClick={() => {
                    setView(k);
                    resetView();
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-colors duration-200",
                    view === k ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-xl font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              disabled={!c}
              onClick={() => setAdding(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Ajouter
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill small active={filter === "all"} count={c?.targets.length} onClick={() => { setFilter("all"); resetView(); }}>
              Tous
            </FilterPill>
            {STATUS_ORDER.map((s) =>
              counts[s] || filter === s ? (
                <FilterPill key={s} small active={filter === s} count={counts[s]} onClick={() => { setFilter(s); resetView(); }}>
                  {STATUS_UI[s].filter}
                </FilterPill>
              ) : null,
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!c ? (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : view === "list" ? (
            visible.length ? (
              <>
                <div className="hidden grid-cols-[40px_minmax(0,1fr)_150px_172px] gap-3 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
                  <span />
                  <span>Personne</span>
                  <span>Statut</span>
                  <span className="text-right">Contacter · réponse</span>
                </div>
                <ul className="space-y-1.5 rounded-2xl bg-muted/40 p-1.5">
                  {paged.pageItems.map((t, i) => {
                    const st = targetStatus(t);
                    const open = answering === t.memberId;
                    return (
                      <li
                        key={t.memberId}
                        className={cn(
                          "rounded-xl border-2 transition-colors duration-200",
                          ENTER,
                          open ? "border-indigo-600 bg-indigo-50/70 shadow-sm dark:bg-indigo-950/30" : "border-transparent bg-card hover:border-indigo-100 dark:hover:border-indigo-900",
                        )}
                        style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
                      >
                        <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 md:grid-cols-[40px_minmax(0,1fr)_150px_172px]">
                          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-colors duration-200", STATUS_UI[st].avatar)}>
                            {initials(t.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold">{t.name}</span>
                              <span className="md:hidden">
                                <StatusPill status={st} revenue={t.revenue} />
                              </span>
                            </div>
                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              {t.outcome && !t.won && st === "answered" ? (
                                <span className={cn("shrink-0 rounded-full px-2 py-px text-[11px] font-semibold", ANSWER_UI[t.outcome].tone)}>{ANSWER_UI[t.outcome].label}</span>
                              ) : null}
                              <span className="truncate">{rowLine(t)}</span>
                            </div>
                          </div>
                          <div className="hidden md:block">
                            <StatusPill status={st} revenue={t.revenue} />
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            {t.won ? (
                              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <BadgeCheck className="h-4 w-4" />
                                {t.withoutContact ? "Renouvelé" : "Gagné"}
                              </span>
                            ) : (
                              <>
                                {contactTiles(t)}
                                <button
                                  type="button"
                                  aria-expanded={open}
                                  title="Sa réponse"
                                  aria-label={`Réponse de ${t.name}`}
                                  onClick={() => setAnswering(open ? null : t.memberId)}
                                  className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150",
                                    open ? "bg-indigo-600 text-white" : "bg-indigo-600/10 text-indigo-700 hover:bg-indigo-600 hover:text-white dark:text-indigo-300",
                                  )}
                                >
                                  <MessageSquareReply className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {moreMenu(t)}
                          </div>
                        </div>
                        <div className={cn("grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                          <div className="overflow-hidden">
                            {open ? (
                              <div className="px-3 pb-3">
                                <AnswerPanel target={t} pending={answer.isPending} onSave={saveAnswer(t)} />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={(p) => { paged.setPage(p); setAnswering(null); }} className="mt-3 rounded-xl border px-3 py-2" />
              </>
            ) : (
              <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Personne ici.</p>
            )
          ) : ft ? (
            <div key={ft.memberId} className={cn("mx-auto max-w-xl space-y-4", ENTER)}>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {Math.min(focusIdx, focusList.length - 1) + 1} / {focusList.length}
                </span>
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${((Math.min(focusIdx, focusList.length - 1) + 1) / focusList.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold", STATUS_UI[targetStatus(ft)].avatar)}>{initials(ft.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold">{ft.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusPill status={targetStatus(ft)} revenue={ft.revenue} />
                      {ft.phone ? <span>{ft.phone}</span> : null}
                    </div>
                  </div>
                  {moreMenu(ft)}
                </div>
                <div className="mt-3 rounded-xl bg-card px-3.5 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-border">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">Message</span>
                  {ft.message}
                </div>
                {ft.won ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck className="h-4 w-4" />
                    {ft.withoutContact ? "Il a renouvelé." : "Il a pris un abonnement après ton message."}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ft.whatsapp ? (
                      <Button className="h-11 rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700" disabled={log.isPending} onClick={() => whatsapp(ft)}>
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                        WhatsApp
                      </Button>
                    ) : null}
                    {ft.hasPush ? (
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl px-4 font-semibold"
                        disabled={log.isPending}
                        onClick={() => log.mutate({ memberId: ft.memberId, channel: "PUSH", message: ft.message })}
                      >
                        <BellRing className="mr-1.5 h-4 w-4" />
                        Notification
                      </Button>
                    ) : null}
                    <Button variant="outline" className="h-11 rounded-xl px-4 font-semibold" disabled={log.isPending} onClick={() => log.mutate({ memberId: ft.memberId, channel: "CALL" })}>
                      <Phone className="mr-1.5 h-4 w-4" />
                      Appel / sur place
                    </Button>
                  </div>
                )}
              </div>
              {!ft.won && (ft.contactedAt || answering === ft.memberId) ? (
                <AnswerPanel target={ft} pending={answer.isPending} onSave={saveAnswer(ft)} />
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="rounded-xl" disabled={focusIdx <= 0} onClick={() => { setFocusIdx((i) => i - 1); setAnswering(null); }}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Précédent
                </Button>
                {targetStatus(ft) === "todo" ? (
                  <button type="button" className="text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => log.mutate({ memberId: ft.memberId, channel: "SKIP" })}>
                    Ignorer
                  </button>
                ) : null}
                <Button
                  className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                  disabled={focusIdx >= focusList.length - 1}
                  onClick={() => { setFocusIdx((i) => i + 1); setAnswering(null); }}
                >
                  Suivant
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn("rounded-2xl border border-dashed px-4 py-12 text-center", ENTER)}>
              <PartyPopper className="mx-auto h-8 w-8 text-indigo-500" />
              <p className="mt-2 font-semibold">Personne dans ce filtre.</p>
              <p className="text-sm text-muted-foreground">Choisis « À contacter » ou « Attend sa réponse » pour continuer.</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">Gagné = revenu ou abonnement dans les 14 jours après le message.</span>
          {c ? (
            <Button variant="outline" className="rounded-xl" disabled={finish.isPending} onClick={() => finish.mutate(c.status === "DONE" ? "ACTIVE" : "DONE")}>
              {c.status === "DONE" ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
              {c.status === "DONE" ? "Rouvrir" : "Terminer la campagne"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
      {c ? (
        <AddPeopleDialog
          campaign={c}
          open={adding}
          onClose={() => setAdding(false)}
          onAdd={(ids) =>
            members.mutate(
              { add: ids },
              {
                onSuccess: (r) => {
                  toast.success(`${r.added} ajouté${r.added > 1 ? "s" : ""} à « ${c.title} »`);
                  setPinned(new Set(ids));
                  setAdding(false);
                },
              },
            )
          }
          pending={members.isPending}
        />
      ) : null}
    </Dialog>
  );
}

function AddPeopleDialog({
  campaign,
  open,
  onClose,
  onAdd,
  pending,
}: {
  campaign: OutreachCampaignDetail;
  open: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [list, setList] = useState<PickList>({ segment: "ALL", groupId: null });
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setList({ segment: "ALL", groupId: null });
    }
  }, [open]);
  const exclude = useMemo(() => new Set(campaign.memberIds), [campaign.memberIds]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[96vw] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Ajouter à « {campaign.title} »
          </DialogTitle>
          <DialogDescription>Ceux qui sont déjà dans la campagne ne sont pas proposés.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <PeoplePicker selected={selected} onChange={setSelected} list={list} onList={setList} exclude={exclude} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Annuler
          </Button>
          <Button className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" disabled={!selected.size || pending} onClick={() => onAdd([...selected])}>
            {selected.size ? `Ajouter ${selected.size}` : "Ajouter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Campagnes tab: filters, search, paginated cards
// ---------------------------------------------------------------------------

type CampaignFilter = "ACTIVE" | "DONE" | "ALL";

function CampaignCard({ c, onOpen, onDelete, index }: { c: OutreachCampaign; onOpen: () => void; onDelete: () => void; index: number }) {
  const p = c.progress;
  const todo = p.todo;
  const w = (n: number) => `${p.total ? (n / p.total) * 100 : 0}%`;
  const Icon = SEGMENT_ICON[c.segment] ?? Users;
  const active = c.status !== "DONE";
  return (
    <article
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:border-indigo-900",
        ENTER,
        !active && "opacity-75",
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold">
            {c.sourceReportId ? <Sparkles className="h-4 w-4 shrink-0 text-violet-600" /> : null}
            <span className="truncate">{c.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {SEGMENT_LABEL[c.segment] ?? c.segment} · {format(new Date(c.createdAt), "d MMM", { locale: fr })}
              {!active ? " · terminée" : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{dt(p.revenue)}</span>
          <button
            type="button"
            aria-label={`Supprimer ${c.title}`}
            onClick={onDelete}
            className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-muted hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" title="Gagnés · ont répondu · pas de réponse · attend">
        <span className="bg-emerald-500 transition-[width] duration-500" style={{ width: w(p.won) }} />
        <span className="bg-violet-500 transition-[width] duration-500" style={{ width: w(p.answered) }} />
        <span className="bg-slate-400 transition-[width] duration-500" style={{ width: w(p.noAnswer) }} />
        <span className="bg-indigo-300 transition-[width] duration-500" style={{ width: w(p.waiting) }} />
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-muted-foreground">
        <div>
          <div className="text-base font-bold tabular-nums text-foreground">
            {p.contacted}
            <span className="text-xs font-normal text-muted-foreground">/{p.total}</span>
          </div>
          contactés
        </div>
        <div>
          <div className="text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">{p.answered + p.won}</div>
          ont répondu
        </div>
        <div>
          <div className="text-base font-bold tabular-nums">{p.noAnswer}</div>
          sans réponse
        </div>
        <div>
          <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{p.won}</div>
          gagnés
        </div>
      </div>
      <Button
        onClick={onOpen}
        variant={todo && active ? "default" : "outline"}
        className={cn("mt-auto rounded-xl font-semibold", todo && active && "bg-indigo-600 text-white hover:bg-indigo-700")}
      >
        {todo && active ? `Continuer · ${todo} à contacter` : "Voir"}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </article>
  );
}

/** Relances → Campagnes: saved campaigns (AI ideas or yours) with their progress. */
export function CampaignsSection({
  draft,
  onDraft,
}: {
  /** New campaign being created (opened from the page banner) */
  draft: CampaignDraft | null;
  onDraft: (d: CampaignDraft | null) => void;
}) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CampaignFilter>("ACTIVE");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["outreach-campaigns"], queryFn: outreachApi.campaigns });
  const remove = useMutation({
    mutationFn: (id: string) => outreachApi.deleteCampaign(id),
    onSuccess: () => {
      toast.success("Campagne supprimée");
      qc.invalidateQueries({ queryKey: ["outreach-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const all = data ?? [];
  const counts = {
    ACTIVE: all.filter((c) => c.status !== "DONE").length,
    DONE: all.filter((c) => c.status === "DONE").length,
    ALL: all.length,
  };
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (c) =>
        (filter === "ALL" || (filter === "DONE") === (c.status === "DONE")) &&
        (!needle || c.title.toLowerCase().includes(needle)),
    );
  }, [data, filter, q]);
  const paged = usePaged(list, 6, `${filter}|${q}`);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={filter === "ACTIVE"} count={counts.ACTIVE} onClick={() => setFilter("ACTIVE")}>
          En cours
        </FilterPill>
        <FilterPill active={filter === "DONE"} count={counts.DONE} onClick={() => setFilter("DONE")}>
          Terminées
        </FilterPill>
        <FilterPill active={filter === "ALL"} count={counts.ALL} onClick={() => setFilter("ALL")}>
          Toutes
        </FilterPill>
        <div className="ml-auto w-full max-w-xs">
          <SearchBox value={q} onChange={setQ} placeholder="Chercher une campagne…" />
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : paged.pageItems.length ? (
        <div key={`${filter}|${paged.page}`} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paged.pageItems.map((c, i) => (
            <CampaignCard
              key={c.id}
              c={c}
              index={i}
              onOpen={() => setOpenId(c.id)}
              onDelete={() => confirm(`Supprimer « ${c.title} » ?`) && remove.mutate(c.id)}
            />
          ))}
        </div>
      ) : (
        <div className={cn("rounded-2xl border border-dashed px-4 py-10 text-center", ENTER)}>
          <Megaphone className="mx-auto h-8 w-8 text-indigo-500" />
          <p className="mt-2 font-semibold">{all.length ? "Aucune campagne ici." : "Aucune campagne pour le moment."}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            « Nouvelle campagne » en haut, ou le bouton « Relancer » d&apos;une idée du Conseiller IA.
          </p>
        </div>
      )}
      <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="rounded-xl border bg-card" />
      <CampaignDetailDialog id={openId} onClose={() => setOpenId(null)} />
      <CampaignDialog draft={draft} onClose={() => onDraft(null)} onCreated={(c) => setOpenId(c.id)} />
    </section>
  );
}
