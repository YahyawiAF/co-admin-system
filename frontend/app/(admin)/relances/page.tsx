"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, formatDistanceToNow, parse, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  BellRing,
  Calculator,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  HandCoins,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  History,
  Lightbulb,
  MessageSquareReply,
  Send,
  LayoutGrid,
  Megaphone,
  Plus,
  Undo2,
  UserMinus,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { outreachApi, pricesApi } from "@/lib/api/resources";
import { leaveDateFromPeriodStart } from "@/lib/subscription-utils";
import { ANSWER_UI, BannerChip, CampaignsSection, FilterPill, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import { PastRelanceDialog } from "@/components/admin/PastRelanceDialog";
import { AWAY_LABEL, AwayReasonChips } from "@/components/admin/AwayReasonChips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_UI, MANUAL_CHANNELS, channelLabel } from "@/lib/outreach-ui";
import type {
  AwayReason,
  AbonnementOffer,
  OutreachChannel,
  OutreachItem,
  OutreachOutcome,
  OutreachReason,
  OutreachResults,
  SuiviRow,
  TopUpOffer,
} from "@/lib/types";

const REASON_UI: Record<
  OutreachReason,
  { label: string; icon: typeof Sparkles; tone: string; why: string }
> = {
  ABO_EXPIRING: {
    label: "Fin d'abonnement",
    icon: CalendarClock,
    tone: "bg-amber-100 text-amber-800",
    why: "Relancé avant la fin, un abonné renouvelle bien plus souvent.",
  },
  ABO_ENDED: {
    label: "Pas renouvelé",
    icon: UserMinus,
    tone: "bg-rose-100 text-rose-700",
    why: "Plus on attend, plus il prend l'habitude de travailler ailleurs.",
  },
  UNPAID: {
    label: "Impayé",
    icon: HandCoins,
    tone: "bg-red-100 text-red-700",
    why: "L'argent déjà gagné : le plus rapide à récupérer.",
  },
  RECALL: {
    label: "À rappeler",
    icon: BellRing,
    tone: "bg-indigo-100 text-indigo-800",
    why: "Il avait dit pourquoi il ne venait plus : c'est le moment prévu pour le relancer (ex. révisions d'examens).",
  },
  NEW_NOT_BACK: {
    label: "Venu une fois",
    icon: UserPlus,
    tone: "bg-orange-100 text-orange-800",
    why: "Plus de la moitié des nouveaux ne reviennent pas. Un message dans les jours qui suivent la 1ʳᵉ visite les fait revenir.",
  },
  INACTIVE: {
    label: "Habitué absent",
    icon: UserX,
    tone: "bg-sky-100 text-sky-800",
    why: "Venait souvent, plus vu depuis un moment.",
  },
  TOP_UP: {
    label: "Compléter l'abonnement",
    icon: Calculator,
    tone: "bg-violet-100 text-violet-800",
    why: "Il a déjà payé au moins la moitié d'un abonnement en passes : proposez-lui de payer seulement le reste, ses passes sont déduits.",
  },
  CONVERT: {
    label: "À passer en abonnement",
    icon: Sparkles,
    tone: "bg-emerald-100 text-emerald-800",
    why: "Ses passes, ramenées sur un mois, coûtent presque autant (ou plus) qu'un abonnement : proposez-lui de passer abonné.",
  },
  REVIEW: {
    label: "Avis Google",
    icon: Star,
    tone: "bg-yellow-100 text-yellow-800",
    why: "Un client fidèle et content : chaque avis aide les nouveaux à vous trouver sur Google Maps.",
  },
  FOLLOW_UP: {
    label: "Rappel prévu",
    icon: CalendarCheck,
    tone: "bg-teal-100 text-teal-800",
    why: "Vous aviez promis de le recontacter à cette date.",
  },
};

/** Member's answer: label, colour, default days before calling back (null = closed), hint. */
const OUTCOME_UI: Record<
  OutreachOutcome,
  { label: string; tone: string; days: number | null; hint: string }
> = {
  INTERESTED: {
    label: "Intéressé",
    tone: "border-emerald-600 bg-emerald-50 text-emerald-800",
    days: 3,
    hint: "Clôturé tout seul s'il prend un abonnement.",
  },
  OTHER_OFFER: {
    label: "Veut une autre offre",
    tone: "border-violet-600 bg-violet-50 text-violet-800",
    days: 2,
    hint: "Préparez l'offre : il revient dans « À contacter » à la date.",
  },
  KEEP_TARIF: {
    label: "Garde le tarif",
    tone: "border-slate-600 bg-slate-100 text-slate-800",
    days: 30,
    hint: "On regarde s'il continue de venir au tarif.",
  },
  AWAY: {
    label: "Parti / en voyage",
    tone: "border-blue-600 bg-blue-50 text-blue-800",
    days: 30,
    hint: "Mettez sa date de retour.",
  },
  NO_ANSWER: {
    label: "Pas de réponse",
    tone: "border-amber-600 bg-amber-50 text-amber-800",
    days: 3,
    hint: "Il revient dans « À contacter » à la date.",
  },
  NOT_INTERESTED: {
    label: "Pas intéressé",
    tone: "border-red-600 bg-red-50 text-red-800",
    days: null,
    hint: "Clôturé directement (non converti).",
  },
};
const OUTCOMES = Object.keys(OUTCOME_UI) as OutreachOutcome[];


const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { locale: fr, addSuffix: true });
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const dayLabel = (d: Date) => format(d, "d MMM", { locale: fr });
const localDay = (s: string) => parse(s, "yyyy-MM-dd", new Date());

type StartChoice = "first" | "today";

/** Start and end of the abonnement for a top-up, plus the sentence added to the message. */
function topUpPeriod(t: { firstVisit: string; plan: { periodDays: number } }, choice: StartChoice) {
  const today = startOfDay(new Date());
  const start = choice === "first" ? localDay(t.firstVisit) : today;
  const end = leaveDateFromPeriodStart(start, t.plan.periodDays);
  const daysLeft = Math.max(0, differenceInCalendarDays(end, today) + 1);
  const sentence =
    choice === "first"
      ? ` Il compterait depuis votre première visite du ${dayLabel(start)}, jusqu'au ${dayLabel(end)}.`
      : ` Il commencerait aujourd'hui, valable jusqu'au ${dayLabel(end)}.`;
  return { start, end, daysLeft, sentence };
}

function PaidBar({ paid, price }: { paid: number; price: number }) {
  const pct = price > 0 ? Math.min(100, Math.round((paid / price) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span>
          Déjà payé <b className="tabular-nums">{dt(paid)}</b> ({pct} %)
        </span>
        <span>
          Reste <b className="tabular-nums text-violet-700">{dt(Math.max(0, price - paid))}</b>
        </span>
      </div>
    </div>
  );
}

/** Top-up row: what was paid, what's left, and when the abonnement would start (owner's choice). */
function TopUpCalculator({
  item,
  topUp,
  onMessage,
}: {
  item: OutreachItem;
  topUp: TopUpOffer;
  onMessage: (text: string) => void;
}) {
  const [choice, setChoice] = useState<StartChoice>("first");
  const options = (["first", "today"] as const).map((c) => ({ c, ...topUpPeriod(topUp, c) }));
  const current = options.find((o) => o.c === choice)!;
  const href = `/abonnements?new=1&memberId=${item.memberId}&priceId=${topUp.plan.id}&credit=${topUp.paid}&start=${format(current.start, "yyyy-MM-dd")}`;
  return (
    <div className="my-2 max-w-xl space-y-2 rounded-lg border bg-violet-50/40 p-3">
      <div className="text-xs text-muted-foreground">
        {topUp.plan.name} · {dt(topUp.plan.price)} · passes payés sur les {topUp.plan.periodDays} derniers jours
      </div>
      <PaidBar paid={topUp.paid} price={topUp.plan.price} />
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.c}
            type="button"
            onClick={() => setChoice(o.c)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-left text-xs transition",
              choice === o.c ? "border-violet-600 bg-white ring-1 ring-violet-600" : "bg-white/60 hover:bg-white",
            )}
          >
            <div className="font-semibold">
              {o.c === "first" ? `Depuis sa 1re visite (${dayLabel(o.start)})` : "À partir d'aujourd'hui"}
            </div>
            <div className="text-muted-foreground">
              Jusqu&apos;au {dayLabel(o.end)} · {o.daysLeft} jour{o.daysLeft > 1 ? "s" : ""} restants
            </div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Créer l&apos;abonnement ({dt(topUp.remaining)})</Link>
        </Button>
        <Button
          size="sm"
          className={item.whatsapp ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
          onClick={() => onMessage(item.message + current.sentence)}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          Proposer
        </Button>
      </div>
    </div>
  );
}

/** Counter-side calculator: any client, any abonnement, any amount already paid. */
function QuickCalculator() {
  const [open, setOpen] = useState(false);
  const { data: prices = [] } = useQuery({ queryKey: ["prices"], queryFn: pricesApi.list, enabled: open });
  const plans = prices.filter(
    (p) => p.isActive !== false && p.type === "abonnement" && (p.periodDays ?? 0) > 0,
  );
  const [planId, setPlanId] = useState("");
  const [paid, setPaid] = useState("");
  const [start, setStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const paidN = Math.max(0, Number(paid) || 0);
  const end = plan ? leaveDateFromPeriodStart(localDay(start), plan.periodDays || 30) : null;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex items-center gap-2 font-medium">
            <Calculator className="h-4 w-4" />
            Calculateur : passes déjà payés → abonnement
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          plans.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>Abonnement</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={plan?.id ?? ""}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {dt(p.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Déjà payé en passes (DT)</Label>
                    <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Début</Label>
                    <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                </div>
              </div>
              {plan ? (
                <div className="space-y-2 rounded-lg border bg-violet-50/40 p-3">
                  <PaidBar paid={paidN} price={plan.price} />
                  <p className="text-sm">
                    Le client paie <b className="text-violet-700">{dt(Math.max(0, plan.price - paidN))}</b> et
                    devient abonné jusqu&apos;au <b>{end ? dayLabel(end) : "—"}</b>.
                  </p>
                  {paidN >= plan.price * 0.5 ? (
                    <p className="text-xs text-emerald-700">
                      Plus de la moitié est déjà payée : c&apos;est le bon moment pour proposer.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun abonnement actif dans les services.</p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function perPeriodLabel(days: number) {
  if (days === 7) return "par semaine";
  if (days === 14) return "toutes les 2 semaines";
  if (days >= 28 && days <= 31) return "par mois";
  return `sur ${days} jours`;
}

/** Passes at the current pace vs the abonnement price, and what it means for the client. */
function OfferCompare({ offer }: { offer: AbonnementOffer }) {
  const diff = offer.savings;
  const verdict =
    diff >= 1
      ? { text: `Économise ~${Math.round(diff)} DT`, tone: "bg-emerald-600 text-white" }
      : diff > -1
        ? { text: "Même prix", tone: "bg-emerald-100 text-emerald-800" }
        : { text: `+${Math.round(-diff)} DT pour venir tous les jours`, tone: "bg-amber-100 text-amber-800" };
  return (
    <div className="my-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded-md border bg-muted/40 px-2 py-1">
        Passes à ce rythme :{" "}
        <b className="tabular-nums">~{Math.round(offer.projectedSpend)} DT</b>{" "}
        {perPeriodLabel(offer.plan.periodDays)}
      </span>
      <span className="text-muted-foreground">vs</span>
      <span className="rounded-md border bg-muted/40 px-2 py-1">
        {offer.plan.name} : <b className="tabular-nums">{dt(offer.plan.price)}</b>
      </span>
      <span className={cn("rounded-full px-2 py-0.5 font-semibold", verdict.tone)}>
        {verdict.text}
      </span>
    </div>
  );
}

function actionLink(item: OutreachItem) {
  if (item.reason === "CONVERT" && item.offer) {
    return {
      label: "Créer l'abonnement",
      href: `/abonnements?new=1&memberId=${item.memberId}&priceId=${item.offer.plan.id}`,
    };
  }
  if (item.reason === "ABO_EXPIRING" || item.reason === "ABO_ENDED") {
    return { label: "Renouveler", href: `/abonnements?memberId=${item.memberId}` };
  }
  if (item.reason === "UNPAID") return { label: "Encaisser", href: "/impayes" };
  return null;
}

/** Reasons where asking "pourquoi ?" makes sense */
const ASK_WHY = new Set<OutreachReason>(["INACTIVE", "NEW_NOT_BACK", "ABO_ENDED", "RECALL"]);

/** Answers collected over 90 days. */
function AwayReasonsCard({ counts }: { counts?: Partial<Record<AwayReason, number>> }) {
  const rows = (Object.keys(AWAY_LABEL) as AwayReason[]).map((r) => [r, counts?.[r] ?? 0] as const);
  const total = rows.reduce((a, [, n]) => a + n, 0);
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Pourquoi ils ne viennent plus</p>
          <span className="text-xs text-muted-foreground">
            {total ? `${total} réponse${total > 1 ? "s" : ""} (90 jours)` : "Cliquez « Pourquoi ? » sur une relance"}
          </span>
        </div>
        {total ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {rows
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([r, n]) => (
                <div key={r} className="grid grid-cols-[130px_minmax(0,1fr)_28px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{AWAY_LABEL[r]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${(n / total) * 100}%` }}
                    />
                  </span>
                  <b className="text-right tabular-nums">{n}</b>
                </div>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** What happened since the contact: abonnement taken, visits at the tarif, nothing. */
function suiviSignal(r: SuiviRow) {
  if (r.since.abonnement) {
    return {
      // Any offer counts as a renewal; a different one is the owner's offer that worked
      text: r.since.abonnement.otherOffer && r.since.abonnement.previousName
        ? `Renouvelé avec une autre offre : ${r.since.abonnement.name} (avant : ${r.since.abonnement.previousName}) · ${dayLabel(new Date(r.since.abonnement.at))}`
        : `A pris ${r.since.abonnement.name} · ${dayLabel(new Date(r.since.abonnement.at))}`,
      tone: "font-semibold text-emerald-700",
    };
  }
  if (r.reason === "UNPAID" && r.closedResult === "WON" && r.closedAuto) {
    return { text: "A payé", tone: "font-semibold text-emerald-700" };
  }
  if (r.since.visits) {
    return {
      text: `Venu ${r.since.visits} fois depuis${r.since.spent ? ` au tarif (${dt(r.since.spent)})` : ""}`,
      tone: "font-medium text-amber-700",
    };
  }
  return { text: "Pas revenu depuis", tone: "text-muted-foreground" };
}

function suiviFollow(r: SuiviRow) {
  if (r.closedAt) {
    if (r.closedResult === "WON") return r.closedAuto ? "Clôturé tout seul : converti" : "Clôturé : converti";
    return "Clôturé : non converti";
  }
  if (r.due && r.followUpAt) {
    const late = differenceInCalendarDays(startOfDay(new Date()), new Date(r.followUpAt));
    return late > 0 ? `Rappel prévu le ${dayLabel(new Date(r.followUpAt))} (en retard)` : "Rappel aujourd'hui";
  }
  if (r.followUpAt) return `Rappel le ${dayLabel(new Date(r.followUpAt))}`;
  return r.outcome ? "Sans date de rappel" : "En attente de sa réponse";
}

// ---------------------------------------------------------------------------
// Member modal: why to contact, quick contact, their answer, every contact so far
// ---------------------------------------------------------------------------

/** Text for someone no longer in « À contacter » (follow-up). */
function followUpText(firstName: string, reason: OutreachReason) {
  const hi = firstName ? `Bonjour ${firstName}, ` : "Bonjour, ";
  if (reason === "UNPAID") return `${hi}petit rappel pour le reste à régler. Tu peux passer quand tu veux, merci !`;
  if (reason === "INACTIVE" || reason === "NEW_NOT_BACK" || reason === "RECALL") {
    return `${hi}on ne t'a pas vu depuis un moment. Ta place t'attend, à bientôt ?`;
  }
  return `${hi}je reviens vers toi suite à notre échange. Tu as pu y réfléchir ?`;
}

function ModalSection({ title, icon: Icon, aside, children }: { title: string; icon: typeof Phone; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const TILE_BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 disabled:opacity-50";

function MemberModal({
  memberId,
  item,
  row,
  onClose,
}: {
  memberId: string | null;
  /** In « À contacter » (snapshot kept once contacted, for the offer and the message) */
  item: OutreachItem | null;
  /** Already contacted (Suivi) */
  row: SuiviRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["outreach-history", memberId],
    queryFn: () => outreachApi.history(memberId!),
    enabled: !!memberId,
  });
  const h = history.data;
  const reason: OutreachReason = item?.reason ?? row?.reason ?? "FOLLOW_UP";
  const name = item?.name ?? row?.name ?? h?.name ?? "…";
  const firstName = item?.firstName ?? row?.firstName ?? h?.firstName ?? "";
  const whatsapp = item?.whatsapp ?? row?.whatsapp ?? h?.whatsapp ?? null;
  const phone = item?.phone ?? row?.phone ?? h?.phone ?? null;
  const hasPush = item?.hasPush ?? h?.hasPush ?? false;

  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<OutreachOutcome | null>(null);
  const [channel, setChannel] = useState<OutreachChannel>("PERSON");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
  if (memberId && openFor !== memberId) {
    setOpenFor(memberId);
    setText(item?.message ?? followUpText(firstName, reason));
    setOutcome(row?.outcome ?? null);
    setChannel("PERSON");
    setNote(row?.note ?? "");
    setDate(row?.followUpAt ? ymd(new Date(row.followUpAt)) : "");
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["outreach"] });
    queryClient.invalidateQueries({ queryKey: ["outreach-suivi"] });
    queryClient.invalidateQueries({ queryKey: ["outreach-history", memberId] });
  };
  const log = useMutation({
    mutationFn: (c: OutreachChannel) =>
      outreachApi.log({ memberId: memberId!, reason, channel: c, message: c === "WHATSAPP" ? text : undefined }),
    onSuccess: (_r, c) => {
      toast.success(`${name} : contacté (${channelLabel(c)}). Note sa réponse à droite.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const push = useMutation({
    mutationFn: () => outreachApi.push({ memberId: memberId!, reason, message: text }),
    onSuccess: () => {
      toast.success("Notification envoyée");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  /** The contact the answer fills: the one just made, else the open Suivi */
  const outreachId = h?.openContactId ?? (row && !row.closedAt ? row.id : undefined);
  const days = outcome ? OUTCOME_UI[outcome].days : null;
  const answer = useMutation({
    mutationFn: () =>
      outreachApi.answer({
        memberId: memberId!,
        reason,
        outreachId,
        outcome: outcome!,
        note: note.trim() || null,
        followUpAt: days === null ? null : date || null,
        channel: outreachId ? undefined : channel,
      }),
    onSuccess: () => {
      toast.success(
        days === null
          ? `${name} : clôturé (pas intéressé)`
          : date
            ? `${name} : ${OUTCOME_UI[outcome!].label}, rappel le ${dayLabel(localDay(date))}`
            : `${name} : ${OUTCOME_UI[outcome!].label}`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => outreachApi.reopen(id),
    onSuccess: () => {
      toast.success(`${name} : relance rouverte`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: (v: { id: string; result: "WON" | "LOST" }) => outreachApi.close(v.id, v.result),
    onSuccess: (_r, v) => {
      refresh();
      toast.success(v.result === "WON" ? `${name} : converti` : `${name} : non converti`, {
        action: { label: "Annuler", onClick: () => reopen.mutate(v.id) },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappSend = () => {
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    log.mutate("WHATSAPP");
  };
  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copié`);
    } catch {
      toast.error("Copie impossible");
    }
  };

  const ui = REASON_UI[reason];
  const link = item ? actionLink(item) : null;
  const contacts = (h?.contacts ?? []).filter((c) => c.channel !== "SKIP");
  const status = row?.closedAt
    ? row.closedResult === "WON"
      ? "Converti"
      : "Non converti"
    : row?.outcome
      ? OUTCOME_UI[row.outcome].label
      : row
        ? "Attend sa réponse"
        : "À contacter";
  const busy = log.isPending || push.isPending;

  return (
    <Dialog open={!!memberId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-5xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-4 pr-10">
            <DialogHeader className="min-w-0 space-y-1 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                Relance · {ui?.label ?? reason}
              </p>
              <DialogTitle className="flex items-center gap-2.5 text-2xl font-extrabold leading-tight text-white">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-base">
                  {name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="truncate">{name}</span>
              </DialogTitle>
              <DialogDescription className="text-[13px] text-indigo-100">
                {[
                  phone ?? "Pas de numéro",
                  h?.lastVisit ? `venu ${ago(h.lastVisit)}` : h ? "jamais venu" : null,
                  h?.abonnement ? `${h.abonnement.active ? "abonné" : "abonnement fini"} : ${h.abonnement.name}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <BannerChip label="Statut" value={status} />
              <BannerChip label="Contacts" value={h ? String(contacts.length) : "–"} />
              <BannerChip label="Sans réponse" value={h ? String(h.noAnswer) : "–"} />
              {item && item.value > 0 ? (
                <BannerChip label="En jeu" value={dt(item.value)} />
              ) : row?.followUpAt && !row.closedAt ? (
                <BannerChip label="Rappel" value={dayLabel(new Date(row.followUpAt))} />
              ) : (
                <BannerChip label="Visites 30 j" value={h ? String(h.visits30) : "–"} />
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div key={memberId ?? ""} className="grid items-start gap-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none lg:grid-cols-2">
            <div className="space-y-4">
              <ModalSection title="Pourquoi le contacter" icon={Lightbulb} aside={link ? (
                <Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : undefined}>
                {item ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ui.tone)}>{ui.label}</span>
                      {item.owed > 0 && item.reason !== "UNPAID" ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          doit {dt(item.owed)}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-semibold">{item.title}</p>
                    {item.reason === "CONVERT" && item.offer ? <OfferCompare offer={item.offer} /> : null}
                    {item.reason === "TOP_UP" && item.topUp ? (
                      <TopUpCalculator item={item} topUp={item.topUp} onMessage={(t) => setText(t)} />
                    ) : null}
                    {!(item.reason === "CONVERT" && item.offer) && item.detail ? (
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{ui.why}</p>
                    {ASK_WHY.has(item.reason) ? (
                      <AwayReasonChips memberId={item.memberId} awayReason={item.awayReason} recallAt={item.recallAt} />
                    ) : null}
                  </div>
                ) : row ? (
                  <div className="space-y-1 text-sm">
                    <p className={suiviSignal(row).tone}>{suiviSignal(row).text}</p>
                    <p className="text-xs text-muted-foreground">
                      Contacté {ago(row.contactedAt)} ({channelLabel(row.channel)}) · {suiviFollow(row)}
                    </p>
                  </div>
                ) : (
                  <Skeleton className="h-16 rounded-xl" />
                )}
              </ModalSection>

              <ModalSection title="Contacter" icon={Send}>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-xl bg-background" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={!whatsapp || !text.trim() || busy}
                    onClick={whatsappSend}
                    title={whatsapp ? undefined : "Pas de numéro WhatsApp"}
                    className={cn(TILE_BTN, "bg-indigo-600 text-white hover:bg-indigo-700")}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    disabled={!hasPush || !text.trim() || busy}
                    onClick={() => push.mutate()}
                    title={hasPush ? undefined : "Il n'a pas activé les notifications"}
                    className={cn(TILE_BTN, "border bg-background hover:border-indigo-300 hover:text-indigo-700")}
                  >
                    <BellRing className="h-4 w-4" />
                    Notification
                  </button>
                  <button type="button" onClick={() => copy(text, "Message")} className={cn(TILE_BTN, "border bg-background hover:border-indigo-300 hover:text-indigo-700")}>
                    <Copy className="h-4 w-4" />
                    Copier
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-2 ring-1 ring-inset ring-border">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Phone className="h-4 w-4" />
                  </span>
                  {phone ? (
                    <>
                      <a href={`tel:${phone}`} className="min-w-0 flex-1 select-all truncate text-base font-bold tabular-nums hover:text-indigo-700">
                        {phone}
                      </a>
                      <Button size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => copy(phone, "Numéro")} aria-label="Copier le numéro">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 rounded-lg font-semibold" disabled={busy} onClick={() => log.mutate("CALL")}>
                        J&apos;ai appelé
                      </Button>
                    </>
                  ) : (
                    <span className="flex-1 text-sm text-muted-foreground">Pas de numéro enregistré.</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Déjà contacté autrement ? Un clic :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MANUAL_CHANNELS.filter((c) => c !== "CALL" && (c !== "WHATSAPP" || !whatsapp)).map((c) => {
                      const Icon = CHANNEL_UI[c].icon;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={busy}
                          onClick={() => log.mutate(c)}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors duration-150 hover:border-indigo-300 hover:text-foreground disabled:opacity-50"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {CHANNEL_UI[c].button}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </ModalSection>
            </div>

            <div className="space-y-4">
              <ModalSection title="Sa réponse" icon={MessageSquareReply}>
                {row?.closedAt ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3 ring-1 ring-inset ring-border">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-semibold animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
                        row.closedResult === "WON" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.closedResult === "WON" ? (row.closedAuto ? "Converti (tout seul)" : "Converti") : "Non converti"}
                    </span>
                    {!row.closedAuto ? (
                      <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={reopen.isPending} onClick={() => reopen.mutate(row.id)}>
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        Annuler
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Abonnement ou paiement enregistré</span>
                    )}
                  </div>
                ) : (
                  <>
                    {h && !outreachId ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Pas encore contacté : comment tu l&apos;as joint ?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MANUAL_CHANNELS.map((c) => {
                            const Icon = CHANNEL_UI[c].icon;
                            return (
                              <button
                                key={c}
                                type="button"
                                aria-pressed={channel === c}
                                onClick={() => setChannel(c)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors duration-200",
                                  channel === c ? "border-indigo-600 bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:border-indigo-300",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {CHANNEL_UI[c].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {OUTCOMES.map((o) => {
                        const a = ANSWER_UI[o];
                        const on = outcome === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              setOutcome(o);
                              const d = OUTCOME_UI[o].days;
                              setDate(d === null ? "" : ymd(addDays(new Date(), d)));
                            }}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-[13px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                              on ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40" : "border-transparent bg-background hover:border-indigo-100",
                            )}
                          >
                            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", on ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground")}>
                              <a.icon className="h-3.5 w-3.5" />
                            </span>
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                    {outcome ? (
                      <p key={outcome} className="text-xs text-muted-foreground animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                        {OUTCOME_UI[outcome].hint}
                      </p>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex. : demande le tarif semaine)" className="h-10 rounded-xl bg-background" />
                      {days !== null ? (
                        <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          {outcome === "AWAY" ? "Retour le" : "Rappeler le"}
                          <input type="date" value={date} min={ymd(new Date())} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm text-foreground outline-none" />
                        </label>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                        disabled={!outcome || !h || answer.isPending}
                        onClick={() => answer.mutate()}
                      >
                        <Check className="mr-1.5 h-4 w-4" />
                        Enregistrer sa réponse
                      </Button>
                      {row ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            disabled={close.isPending}
                            onClick={() => close.mutate({ id: row.id, result: "WON" })}
                          >
                            Converti
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg" disabled={close.isPending} onClick={() => close.mutate({ id: row.id, result: "LOST" })}>
                            Non converti
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </ModalSection>

              <ModalSection
                title="Historique"
                icon={History}
                aside={h?.noAnswer ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Pas de réponse × {h.noAnswer}
                  </span>
                ) : undefined}
              >
                {!h ? (
                  <Skeleton className="h-24 rounded-xl" />
                ) : h.contacts.length ? (
                  <ol className="space-y-1.5">
                    {h.contacts.map((c, i) => {
                      const Icon = CHANNEL_UI[c.channel]?.icon ?? Phone;
                      const what = c.campaign ? `Campagne « ${c.campaign} »` : REASON_UI[c.reason as OutreachReason]?.label ?? c.reason;
                      return (
                        <li
                          key={c.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl bg-background p-2.5 ring-1 ring-inset ring-border animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none",
                            c.channel === "SKIP" && "opacity-60",
                          )}
                          style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                              <span className="text-sm font-semibold">
                                {c.channel === "SKIP" ? "Ignoré" : CHANNEL_UI[c.channel]?.label ?? c.channel}
                                <span className="font-normal text-muted-foreground"> · {what}</span>
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {format(new Date(c.at), "d MMM yyyy, HH:mm", { locale: fr })}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {c.outcome ? (
                                <span className={cn("rounded-full px-2 py-px font-semibold", ANSWER_UI[c.outcome].tone)}>{ANSWER_UI[c.outcome].label}</span>
                              ) : c.channel !== "SKIP" ? (
                                <span className="rounded-full bg-indigo-100 px-2 py-px font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                  Réponse pas notée
                                </span>
                              ) : null}
                              {c.closedResult === "WON" ? (
                                <span className="rounded-full bg-emerald-600 px-2 py-px font-semibold text-white">Converti{c.closedAuto ? " (auto)" : ""}</span>
                              ) : c.closedResult === "LOST" ? (
                                <span className="rounded-full bg-muted px-2 py-px font-semibold text-muted-foreground">Non converti</span>
                              ) : null}
                              {c.followUpAt ? <span className="text-muted-foreground">rappel {dayLabel(new Date(c.followUpAt))}</span> : null}
                              {c.note ? <span className="text-muted-foreground">« {c.note} »</span> : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Jamais contacté.</p>
                )}
              </ModalSection>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Board: À contacter → Contacté → A répondu → Résultat
// ---------------------------------------------------------------------------

/** Cards per page in each board column (columns are narrow). */
const PAGE = 10;
const itemKey = (i: { memberId: string; reason: string }) => `${i.memberId}:${i.reason}`;

/** Contacted → won, per way of contact (last 30 days). */
function ChannelsCard({ results }: { results?: OutreachResults }) {
  const rows = Object.entries(results?.byChannel ?? {})
    .filter(([, v]) => v && v.contacted > 0)
    .map(([k, v]) => ({ channel: k as OutreachChannel, ...v! }))
    .sort((a, b) => b.won / b.contacted - a.won / a.contacted || b.contacted - a.contacted);
  const max = Math.max(1, ...rows.map((r) => r.contacted));
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="text-sm font-semibold">Quel canal marche</div>
          <p className="text-xs text-muted-foreground">Contactés → gagnés en 14 jours, par façon de contacter (30 derniers jours).</p>
        </div>
        {rows.length ? (
          <div className="space-y-1.5">
            {rows.map((r) => {
              const Icon = CHANNEL_UI[r.channel]?.icon ?? Phone;
              return (
                <div key={r.channel} className="grid grid-cols-[130px_minmax(0,1fr)_96px] items-center gap-2 text-sm">
                  <span className="flex items-center gap-1.5 capitalize">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {channelLabel(r.channel)}
                  </span>
                  <span className="relative h-4 overflow-hidden rounded bg-muted">
                    <span className="absolute inset-y-0 left-0 rounded bg-primary/15" style={{ width: `${(r.contacted / max) * 100}%` }} />
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-emerald-500 transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${(r.won / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">
                    <b className="text-foreground">{Math.round((r.won / r.contacted) * 100)} %</b> · {r.won}/{r.contacted}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pas encore de contacts notés. Chaque contact compte, même en personne ou par un groupe WhatsApp.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Member shown in the modal (the « À contacter » card is kept once they move column). */
type Shown = { memberId: string; item: OutreachItem | null };

function BoardColumn({
  title,
  hint,
  count,
  action,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-36 min-w-0 flex-col gap-2 rounded-xl bg-muted/50 p-2.5" aria-label={title}>
      <header className="flex items-baseline justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {action ?? <span className="text-xs font-semibold text-muted-foreground">{count}</span>}
      </header>
      {children}
    </section>
  );
}

/** Compact pager under a board column: "11–20 sur 87" + previous / next. */
function ColumnPager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return null;
  const from = (page - 1) * PAGE + 1;
  const to = Math.min(total, page * PAGE);
  return (
    <div className="flex items-center justify-between gap-1 rounded-lg bg-background px-1.5 py-1 ring-1 ring-inset ring-border">
      <button
        type="button"
        aria-label="Page précédente"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
        {from}–{to} sur {total} · page {page}/{last}
      </span>
      <button
        type="button"
        aria-label="Page suivante"
        disabled={page >= last}
        onClick={() => onPage(page + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

type TodoSort = "value" | "name" | "contact";

const cardClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-reduce:transition-none";

function RelancesBoard({
  todo: reasonTodo,
  total,
  counts,
  filter,
  onFilter,
}: {
  /** À contacter, already filtered by reason */
  todo: OutreachItem[];
  /** Everyone to contact (all reasons) */
  total: number;
  counts: Partial<Record<OutreachReason, number>>;
  filter: OutreachReason | "ALL";
  onFilter: (f: OutreachReason | "ALL") => void;
}) {
  const queryClient = useQueryClient();
  const openQ = useQuery({
    queryKey: ["outreach-suivi", "OPEN", "board"],
    queryFn: () => outreachApi.suivi({ status: "OPEN", page: 1, perPage: 100 }),
  });
  const closedQ = useQuery({
    queryKey: ["outreach-suivi", "CLOSED", "board"],
    queryFn: () => outreachApi.suivi({ status: "CLOSED", page: 1, perPage: 100 }),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Shown | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TodoSort>("value");
  const [pages, setPages] = useState<Record<string, number>>({});
  const [pagesFor, setPagesFor] = useState(`${filter}|${q}|${sort}`);
  if (pagesFor !== `${filter}|${q}|${sort}`) {
    // A new filter, search or sort starts every column at page 1
    setPagesFor(`${filter}|${q}|${sort}`);
    setPages({});
  }
  /** This column's cards for its current page (page kept in range when the list shrinks). */
  const pageOf = <T,>(col: string, list: T[]) => {
    const last = Math.max(1, Math.ceil(list.length / PAGE));
    const page = Math.min(pages[col] ?? 1, last);
    return { page, items: list.slice((page - 1) * PAGE, page * PAGE), total: list.length };
  };
  const goPage = (col: string) => (p: number) => setPages((x) => ({ ...x, [col]: p }));

  const needle = q.trim().toLowerCase();
  const needleDigits = needle.replace(/\D/g, "");
  const matches = (name: string, phone: string | null, extra = "") =>
    !needle ||
    name.toLowerCase().includes(needle) ||
    extra.toLowerCase().includes(needle) ||
    (needleDigits.length >= 3 && (phone ?? "").replace(/\D/g, "").includes(needleDigits));
  const todo = useMemo(() => {
    const list = reasonTodo.filter((i) => matches(i.name, i.phone, i.title));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (sort === "contact") {
      // Never contacted first, then the longest ago
      const at = (i: OutreachItem) => (i.lastContact ? new Date(i.lastContact.at).getTime() : 0);
      return [...list].sort((a, b) => at(a) - at(b));
    }
    return list;
  }, [reasonTodo, needle, sort]);

  const open = (openQ.data?.rows ?? []).filter((r) => matches(r.name, r.phone));
  const contacted = open.filter((r) => !r.outcome);
  const answered = open.filter((r) => r.outcome);
  const since30 = Date.now() - 30 * 86_400_000;
  const closed = (closedQ.data?.rows ?? []).filter(
    (r) => r.closedAt && new Date(r.closedAt).getTime() >= since30 && matches(r.name, r.phone),
  );
  const won = closed.filter((r) => r.closedResult === "WON");
  const lost = closed.filter((r) => r.closedResult !== "WON");

  const logMany = useMutation({
    mutationFn: (channel: OutreachChannel) =>
      outreachApi.logMany({
        channel,
        items: todo.filter((i) => selected.has(itemKey(i))).map((i) => ({ memberId: i.memberId, reason: i.reason })),
      }),
    onSuccess: (r, channel) => {
      toast.success(`${r.count} contact${r.count > 1 ? "s" : ""} noté${r.count > 1 ? "s" : ""} : ${channelLabel(channel)}`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-suivi"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allTodo = todo.length > 0 && todo.every((i) => selected.has(itemKey(i)));

  // The modal follows the data: once the person moved column, it shows their new state
  const modalRow = shown
    ? open.find((r) => r.memberId === shown.memberId) ??
      (closedQ.data?.rows ?? []).find((r) => r.memberId === shown.memberId) ??
      null
    : null;
  const modalItem = shown
    ? todo.find((i) => (shown.item ? itemKey(i) === itemKey(shown.item) : i.memberId === shown.memberId)) ?? shown.item
    : null;
  /** WhatsApp straight from the card, then the modal opens to note the answer */
  const quickWhatsApp = useMutation({
    mutationFn: (item: OutreachItem) =>
      outreachApi.log({ memberId: item.memberId, reason: item.reason, channel: "WHATSAPP", message: item.message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-suivi"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suiviCard = (r: SuiviRow, i: number) => {
    const outcome = r.outcome ? OUTCOME_UI[r.outcome] : null;
    const Icon = CHANNEL_UI[r.channel as OutreachChannel]?.icon ?? Phone;
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => setShown({ memberId: r.memberId, item: null })}
        className={cn(cardClass, r.due && "border-teal-400")}
        style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{r.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{REASON_UI[r.reason]?.label ?? r.reason}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" />
          {channelLabel(r.channel)} · {ago(r.closedAt ?? r.contactedAt)}
        </div>
        {r.closedAt ? (
          <div className={cn("mt-1 text-xs font-medium", r.closedResult === "WON" ? "text-emerald-700" : "text-muted-foreground")}>
            {r.closedResult === "WON"
              ? `Gagné${r.since.spent ? ` · ${dt(r.since.spent)}` : r.since.abonnement ? ` · ${r.since.abonnement.name}` : ""}${r.closedAuto ? " (auto)" : ""}`
              : `Perdu${outcome ? ` · ${outcome.label}` : ""}`}
          </div>
        ) : outcome ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn("rounded-full border px-1.5 py-px font-medium", outcome.tone)}>{outcome.label}</span>
            {r.followUpAt ? (
              <span className={cn(r.due ? "font-medium text-teal-800" : "text-muted-foreground")}>
                {r.due ? "à rappeler aujourd'hui" : `rappel ${format(new Date(r.followUpAt), "d MMM", { locale: fr })}`}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="mt-1 text-xs font-medium text-primary">Sa réponse ?</div>
        )}
      </button>
    );
  };

  const todoPage = pageOf("todo", todo);
  const contactedPage = pageOf("contacted", contacted);
  const answeredPage = pageOf("answered", answered);
  const wonPage = pageOf("won", won);
  const lostPage = pageOf("lost", lost);

  return (
    <>
      <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Chercher un nom ou un téléphone…"
              className="h-10 rounded-xl bg-background pl-9"
            />
          </div>
          <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">À contacter :</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TodoSort)}
              className="bg-transparent font-semibold text-foreground outline-none"
            >
              <option value="value">le plus en jeu</option>
              <option value="contact">pas contacté depuis longtemps</option>
              <option value="name">nom A → Z</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill small active={filter === "ALL"} onClick={() => onFilter("ALL")} count={total}>
            Tous
          </FilterPill>
          {(Object.keys(REASON_UI) as OutreachReason[]).map((r) =>
            counts[r] ? (
              <FilterPill key={r} small active={filter === r} onClick={() => onFilter(r)} count={counts[r]}>
                {REASON_UI[r].label}
              </FilterPill>
            ) : null,
          )}
        </div>
        {filter !== "ALL" ? (
          <p key={filter} className="text-xs text-muted-foreground animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {REASON_UI[filter].why}
          </p>
        ) : null}
        {needle ? (
          <p className="text-xs text-muted-foreground">
            {todo.length + open.length + closed.length} résultat{todo.length + open.length + closed.length > 1 ? "s" : ""} pour « {q.trim()} »
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BoardColumn
          title="À contacter"
          hint="coche pour agir sur plusieurs"
          count={todo.length}
          action={
            todo.length ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => setSelected(allTodo ? new Set() : new Set(todo.map(itemKey)))}
              >
                {allTodo ? "Aucun" : `Tout cocher (${todo.length})`}
              </button>
            ) : undefined
          }
        >
          {todo.length ? (
            todoPage.items.map((item, i) => {
              const k = itemKey(item);
              const ui = REASON_UI[item.reason];
              return (
                <div
                  key={k}
                  className={cn(cardClass, "flex cursor-pointer items-start gap-2.5", selected.has(k) && "border-primary bg-primary/5")}
                  style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                  onClick={() => setShown({ memberId: item.memberId, item })}
                >
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${item.name}`}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    checked={selected.has(k)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(k)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{item.title}</div>
                    <span className={cn("mt-1 inline-block rounded-full px-1.5 py-px text-[10.5px] font-medium", ui.tone)}>{ui.label}</span>
                  </div>
                  {item.whatsapp ? (
                    <button
                      type="button"
                      title="Envoyer le message sur WhatsApp"
                      aria-label={`WhatsApp à ${item.name}`}
                      disabled={quickWhatsApp.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(item.message)}`, "_blank", "noopener");
                        quickWhatsApp.mutate(item);
                        setShown({ memberId: item.memberId, item });
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-inset ring-border transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-600 hover:ring-emerald-200 disabled:opacity-50 dark:hover:bg-emerald-950/40"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {needle ? "Personne ne correspond." : "Personne à contacter."}
            </p>
          )}
          <ColumnPager page={todoPage.page} total={todoPage.total} onPage={goPage("todo")} />
        </BoardColumn>

        <BoardColumn title="Contacté" hint="en attente de sa réponse" count={contacted.length}>
          {openQ.isLoading ? <Skeleton className="h-20" /> : contacted.length ? contactedPage.items.map(suiviCard) : (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">—</p>
          )}
          <ColumnPager page={contactedPage.page} total={contactedPage.total} onPage={goPage("contacted")} />
        </BoardColumn>

        <BoardColumn title="A répondu" hint="intéressé, à rappeler…" count={answered.length}>
          {openQ.isLoading ? <Skeleton className="h-20" /> : answered.length ? answeredPage.items.map(suiviCard) : (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">—</p>
          )}
          <ColumnPager page={answeredPage.page} total={answeredPage.total} onPage={goPage("answered")} />
        </BoardColumn>

        <BoardColumn title="Résultat" hint="30 derniers jours" count={closed.length}>
          <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Gagnés · {won.length}</h4>
          {wonPage.items.map(suiviCard)}
          <ColumnPager page={wonPage.page} total={wonPage.total} onPage={goPage("won")} />
          <h4 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Perdus · {lost.length}</h4>
          {lostPage.items.map(suiviCard)}
          <ColumnPager page={lostPage.page} total={lostPage.total} onPage={goPage("lost")} />
        </BoardColumn>
      </div>

      <div
        role="region"
        aria-label="Action groupée"
        className={cn(
          "fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-2xl bg-foreground px-3 py-2.5 text-background shadow-xl transition-[transform,opacity] duration-300 motion-reduce:transition-none",
          selected.size ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0",
        )}
      >
        <span className="px-1 text-sm font-semibold">
          {selected.size} sélectionné{selected.size > 1 ? "s" : ""} · contactés par :
        </span>
        {MANUAL_CHANNELS.map((c) => {
          const Icon = CHANNEL_UI[c].icon;
          return (
            <button
              key={c}
              type="button"
              disabled={logMany.isPending}
              onClick={() => logMany.mutate(c)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-background/25 px-2.5 py-1 text-sm transition-colors hover:bg-background/15 disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5" />
              {CHANNEL_UI[c].label}
            </button>
          );
        })}
        <button type="button" aria-label="Annuler la sélection" className="rounded-lg p-1.5 hover:bg-background/15" onClick={() => setSelected(new Set())}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <MemberModal memberId={shown?.memberId ?? null} item={modalItem} row={modalRow} onClose={() => setShown(null)} />
    </>
  );
}

type Tab = "board" | "campagnes";

export default function RelancesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <RelancesInner />
    </Suspense>
  );
}

function RelancesInner() {
  const searchParams = useSearchParams();
  const initialReason = searchParams.get("reason") as OutreachReason | null;
  const [filter, setFilter] = useState<OutreachReason | "ALL">(
    initialReason && initialReason in REASON_UI ? initialReason : "ALL",
  );
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "campagnes" ? "campagnes" : "board");
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["outreach"],
    queryFn: () => outreachApi.list(),
  });
  const suivi = useQuery({
    queryKey: ["outreach-suivi", "OPEN", 1],
    queryFn: () => outreachApi.suivi({ status: "OPEN", page: 1 }),
  });
  const campaigns = useQuery({ queryKey: ["outreach-campaigns"], queryFn: outreachApi.campaigns });
  const suiviCounts = suivi.data?.counts;

  const counts = useMemo(() => {
    const c: Partial<Record<OutreachReason, number>> = {};
    for (const i of data?.todo ?? []) c[i.reason] = (c[i.reason] ?? 0) + 1;
    return c;
  }, [data]);
  const todo = useMemo(
    () => (data?.todo ?? []).filter((i) => filter === "ALL" || i.reason === filter),
    [data, filter],
  );
  const atStake = (data?.todo ?? []).reduce((a, i) => a + i.value, 0);
  const results = data?.results;
  const activeCampaigns = (campaigns.data ?? []).filter((c) => c.status !== "DONE").length;

  return (
    <div className="space-y-5">
      {/* Hero — same banner as the check-in modal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 py-5 text-white shadow-sm">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/4 h-36 w-36 rounded-full bg-white/10" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
              {format(new Date(), "EEEE d MMMM", { locale: fr })}
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
              <Megaphone className="h-6 w-6" />
              Relances
            </h1>
            <p className="text-[13px] text-indigo-100">Qui contacter, ce qu&apos;ils ont répondu, ce que ça a rapporté.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setPastOpen(true)}
              className="h-11 rounded-2xl border border-white/40 bg-white/10 px-4 font-semibold text-white shadow-none transition-colors hover:bg-white/20"
            >
              <History className="mr-1.5 h-4 w-4" />
              Relance passée
            </Button>
            <Button
              onClick={() => {
                setTab("campagnes");
                setCampaignDraft({ title: "", message: "" });
              }}
              className="h-11 rounded-2xl bg-white px-5 font-bold text-indigo-700 shadow-md transition-colors hover:bg-indigo-50"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nouvelle campagne
            </Button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <BannerChip label="À contacter" value={data ? String(data.todo.length) : "–"} sub={`~${dt(atStake)} en jeu`} />
          <BannerChip
            label="En suivi"
            value={suiviCounts ? String(suiviCounts.OPEN) : "–"}
            sub={
              suiviCounts?.due
                ? `${suiviCounts.due} rappel${suiviCounts.due > 1 ? "s" : ""} à faire`
                : "en attente du résultat"
            }
          />
          <BannerChip
            label="Contactés (30 j)"
            value={String(results?.contacted ?? 0)}
            sub={
              results?.contacted
                ? `${results.won} ont renouvelé, payé ou sont revenus (${Math.round((results.won / results.contacted) * 100)} %)`
                : "rien encore"
            }
          />
          <BannerChip label="Gagné grâce aux relances" value={dt(results?.revenue ?? 0)} sub="dans les 14 jours après le message" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        <FilterPill active={tab === "board"} onClick={() => setTab("board")} icon={LayoutGrid} count={data?.todo.length}>
          Tableau
        </FilterPill>
        <FilterPill active={tab === "campagnes"} onClick={() => setTab("campagnes")} icon={Megaphone} count={activeCampaigns}>
          Campagnes
        </FilterPill>
      </div>

      <div key={tab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        {tab === "campagnes" ? (
          <CampaignsSection draft={campaignDraft} onDraft={setCampaignDraft} />
        ) : isLoading || !data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-5">
            <ChannelsCard results={results} />

            <RelancesBoard todo={todo} total={data.todo.length} counts={counts} filter={filter} onFilter={setFilter} />

            <AwayReasonsCard counts={data.awayReasons} />

            <QuickCalculator />

            {!data.pushEnabled ? (
              <p className="text-xs text-muted-foreground">
                Les notifications dans l&apos;app sont désactivées sur le serveur (clés VAPID manquantes) : seuls WhatsApp et l&apos;appel sont proposés.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <PastRelanceDialog open={pastOpen} onClose={() => setPastOpen(false)} />
    </div>
  );
}
