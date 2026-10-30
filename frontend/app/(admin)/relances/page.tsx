"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, formatDistanceToNow, parse, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  BellRing,
  Calculator,
  CalendarClock,
  ChevronDown,
  Copy,
  HandCoins,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { outreachApi, pricesApi } from "@/lib/api/resources";
import { leaveDateFromPeriodStart } from "@/lib/subscription-utils";
import { CampaignsSection } from "@/components/admin/OutreachCampaigns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AwayReason,
  AbonnementOffer,
  OutreachChannel,
  OutreachItem,
  OutreachReason,
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
};

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  WHATSAPP: "WhatsApp",
  PUSH: "notification",
  CALL: "appel",
  SKIP: "ignoré",
};

const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;
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

function MessageDialog({
  item,
  onClose,
}: {
  item: OutreachItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  if (item && forId !== `${item.memberId}:${item.reason}:${item.message}`) {
    setForId(`${item.memberId}:${item.reason}:${item.message}`);
    setText(item.message);
  }
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["outreach"] });
    onClose();
  };
  const log = useMutation({
    mutationFn: (channel: OutreachChannel) =>
      outreachApi.log({
        memberId: item!.memberId,
        reason: item!.reason,
        channel,
        message: text,
      }),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const push = useMutation({
    mutationFn: () =>
      outreachApi.push({ memberId: item!.memberId, reason: item!.reason, message: text }),
    onSuccess: () => {
      toast.success("Notification envoyée");
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!item) return null;
  const openWhatsApp = () => {
    window.open(
      `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
    log.mutate("WHATSAPP");
  };
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Message copié");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message pour {item.name}</DialogTitle>
          <DialogDescription>
            Modifiez le texte si besoin, puis envoyez-le.
            {item.phone ? ` Téléphone : ${item.phone}.` : " Pas de numéro enregistré."}
          </DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {item.whatsapp ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!text.trim() || log.isPending}
              onClick={openWhatsApp}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Envoyer sur WhatsApp
            </Button>
          ) : null}
          {item.hasPush ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={!text.trim() || push.isPending}
              onClick={() => push.mutate()}
            >
              <BellRing className="mr-2 h-4 w-4" />
              Envoyer une notification dans l&apos;app
            </Button>
          ) : null}
          <div className="flex w-full gap-2">
            <Button variant="ghost" className="flex-1" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" />
              Copier
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={log.isPending}
              onClick={() => log.mutate("CALL")}
            >
              <Phone className="mr-2 h-4 w-4" />
              Contacté autrement
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const AWAY_LABEL: Record<AwayReason, string> = {
  STUDY_HOME: "Révise à la maison",
  PRICE: "Prix",
  DISTANCE: "Trop loin",
  NOISE: "Bruit",
  HOURS: "Horaires",
  OTHER: "Autre",
};
/** Reasons where asking "pourquoi ?" makes sense */
const ASK_WHY = new Set<OutreachReason>(["INACTIVE", "NEW_NOT_BACK", "ABO_ENDED", "RECALL"]);

/** 1 click: why the member stopped coming. Saved on the member; "révise" sets a recall date. */
function AwayReasonChips({ item }: { item: OutreachItem }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<{ reason: AwayReason | null; recallAt: string | null }>({
    reason: item.awayReason ?? null,
    recallAt: item.recallAt ?? null,
  });
  const save = useMutation({
    mutationFn: (reason: AwayReason | null) => outreachApi.awayReason({ memberId: item.memberId, reason }),
    onSuccess: (res) => {
      setSaved({ reason: res.awayReason, recallAt: res.recallAt });
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Pourquoi ?</span>
      {(Object.keys(AWAY_LABEL) as AwayReason[]).map((r) => {
        const on = saved.reason === r;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            disabled={save.isPending}
            onClick={() => save.mutate(on ? null : r)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-200",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            {AWAY_LABEL[r]}
          </button>
        );
      })}
      {saved.reason ? (
        <span className="animate-in fade-in-0 text-xs font-medium text-emerald-700 duration-300 motion-reduce:animate-none dark:text-emerald-400">
          {saved.recallAt
            ? `Noté · rappel le ${format(new Date(saved.recallAt), "d MMM", { locale: fr })}`
            : "Noté sur sa fiche"}
        </span>
      ) : null}
    </div>
  );
}

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

function OutreachRow({
  item,
  onMessage,
}: {
  item: OutreachItem;
  /** Optional custom text (e.g. top-up with the chosen start date) */
  onMessage: (text?: string) => void;
}) {
  const queryClient = useQueryClient();
  const ui = REASON_UI[item.reason];
  const Icon = ui.icon;
  const link = actionLink(item);
  const skip = useMutation({
    mutationFn: () =>
      outreachApi.log({ memberId: item.memberId, reason: item.reason, channel: "SKIP" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outreach"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", ui.tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ui.tone)}>
            {ui.label}
          </span>
          {item.owed > 0 && item.reason !== "UNPAID" ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
              doit {dt(item.owed)}
            </span>
          ) : null}
        </div>
        <div className="text-sm">{item.title}</div>
        {item.reason === "CONVERT" && item.offer ? <OfferCompare offer={item.offer} /> : null}
        {item.reason === "TOP_UP" && item.topUp ? (
          <TopUpCalculator item={item} topUp={item.topUp} onMessage={onMessage} />
        ) : null}
        <div className="text-xs text-muted-foreground">
          {[
            item.reason === "CONVERT" && item.offer ? null : item.detail,
            item.lastContact
              ? `contacté ${formatDistanceToNow(new Date(item.lastContact.at), { locale: fr, addSuffix: true })} (${CHANNEL_LABEL[item.lastContact.channel]})`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {ASK_WHY.has(item.reason) ? <AwayReasonChips item={item} /> : null}
      </div>
      <div className="flex items-center gap-1.5">
        {link ? (
          <Button asChild size="sm" variant="outline">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ) : null}
        <Button
          size="sm"
          className={item.whatsapp ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
          onClick={() => onMessage()}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          Contacter
        </Button>
        {!item.snoozed ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            title="Ignorer pour l'instant"
            disabled={skip.isPending}
            onClick={() => skip.mutate()}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

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
  const [messaging, setMessaging] = useState<OutreachItem | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["outreach"],
    queryFn: () => outreachApi.list(),
  });

  const counts = useMemo(() => {
    const c: Partial<Record<OutreachReason, number>> = {};
    for (const i of data?.todo ?? []) c[i.reason] = (c[i.reason] ?? 0) + 1;
    return c;
  }, [data]);
  const todo = (data?.todo ?? []).filter((i) => filter === "ALL" || i.reason === filter);
  const atStake = (data?.todo ?? []).reduce((a, i) => a + i.value, 0);
  const results = data?.results;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relances</h1>
        <p className="text-muted-foreground">
          Les clients à contacter aujourd&apos;hui. Un message au bon moment fait renouveler, revenir et payer.
        </p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">À contacter</div>
                <div className="text-2xl font-semibold tabular-nums">{data.todo.length}</div>
                <div className="text-xs text-muted-foreground">~{dt(atStake)} en jeu</div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Contactés (30 jours)</div>
                <div className="text-2xl font-semibold tabular-nums">{results?.contacted ?? 0}</div>
                <div className="text-xs text-muted-foreground">
                  {results?.contacted
                    ? `${results.won} ont renouvelé, payé ou sont revenus (${Math.round((results.won / results.contacted) * 100)} %)`
                    : "Commencez par la liste ci-dessous"}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Gagné grâce aux relances</div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-700">
                  {dt(results?.revenue ?? 0)}
                </div>
                <div className="text-xs text-muted-foreground">Dans les 14 jours après le message</div>
              </CardContent>
            </Card>
          </div>

          <AwayReasonsCard counts={data.awayReasons} />

          <CampaignsSection />

          <QuickCalculator />

          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              Tous · {data.todo.length}
            </FilterChip>
            {(Object.keys(REASON_UI) as OutreachReason[]).map((r) =>
              counts[r] ? (
                <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)}>
                  {REASON_UI[r].label} · {counts[r]}
                </FilterChip>
              ) : null,
            )}
          </div>

          <Card className="shadow-none">
            <CardContent className="px-4 py-1">
              {filter !== "ALL" ? (
                <p className="border-b py-2 text-xs text-muted-foreground">{REASON_UI[filter].why}</p>
              ) : null}
              {todo.length ? (
                <ul className="divide-y">
                  {todo.map((item) => (
                    <OutreachRow
                      key={`${item.memberId}:${item.reason}`}
                      item={item}
                      onMessage={(text) => setMessaging(text ? { ...item, message: text } : item)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Personne à relancer pour le moment. Revenez demain.
                </p>
              )}
            </CardContent>
          </Card>

          {data.contacted.length ? (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowDone((v) => !v)}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} />
                Déjà contactés récemment ({data.contacted.length})
              </button>
              {showDone ? (
                <Card className="mt-2 shadow-none">
                  <CardContent className="px-4 py-1">
                    <ul className="divide-y opacity-80">
                      {data.contacted.map((item) => (
                        <OutreachRow
                          key={`${item.memberId}:${item.reason}`}
                          item={item}
                          onMessage={(text) => setMessaging(text ? { ...item, message: text } : item)}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {!data.pushEnabled ? (
            <p className="text-xs text-muted-foreground">
              Les notifications dans l&apos;app sont désactivées sur le serveur (clés VAPID manquantes) : seuls WhatsApp et l&apos;appel sont proposés.
            </p>
          ) : null}
        </>
      )}

      <MessageDialog item={messaging} onClose={() => setMessaging(null)} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
