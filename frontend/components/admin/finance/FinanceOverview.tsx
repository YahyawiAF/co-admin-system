"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Lightbulb,
  Settings2,
  Target,
  XOctagon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { analyticsApi, facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { WEEKDAY_LABELS, WEEKDAYS_MON_FIRST } from "@/lib/traffic-utils";
import { BreakEvenCard } from "./BreakEvenCard";
import { ChangeQuestions, ForecastBlock, LeverMapCard } from "./FinanceForecast";
import type {
  AbonnementMonth,
  InsightSeverity,
  PerformanceInsight,
  PerformanceOverview,
  PerformanceSettings,
} from "@/lib/types";

const dt = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "—"
    : `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} DT`;

const closeLabel = (h: number) => (h === 24 ? "minuit" : h > 24 ? `${h - 24}h (lendemain)` : `${h}h`);

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50/50",
  warn: "border-amber-200 bg-amber-50/50",
  bad: "border-rose-200 bg-rose-50/50",
  neutral: "",
};

function DeltaChip({
  value,
  unit = "%",
  inverse = false,
}: {
  value: number | null | undefined;
  unit?: "%" | "pts";
  inverse?: boolean;
}) {
  if (value == null) {
    return <span className="text-xs text-muted-foreground">pas de comparaison</span>;
  }
  const up = value > 0;
  const flat = Math.abs(value) < (unit === "pts" ? 0.5 : 1);
  // Past 300% the comparison period was near zero: the ratio is technically
  // correct but meaningless ("×1483.8"). Say "nouveau" instead of a number.
  const isNew = unit === "%" && value > 300;
  const good = flat ? null : inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const text = `${up ? "+" : ""}${Math.round(value * 10) / 10}${unit === "pts" ? " pts" : " %"}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        good == null && "bg-muted text-muted-foreground",
        good === true && "bg-emerald-100 text-emerald-700",
        good === false && "bg-rose-100 text-rose-700",
      )}
    >
      {!flat && !isNew ? <Icon className="h-3 w-3" /> : null}
      {flat ? "stable" : isNew ? "nouveau" : text}
    </span>
  );
}

function KpiCard({
  label,
  value,
  delta,
  tone = "neutral",
  sub,
  help,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  tone?: Tone;
  sub?: ReactNode;
  help: string;
}) {
  return (
    <Card className={cn("shadow-none", TONE[tone])}>
      <CardContent className="space-y-1.5 p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {delta}
        </div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
        <p className="text-[11px] leading-snug text-muted-foreground/80">{help}</p>
      </CardContent>
    </Card>
  );
}

const SEVERITY_UI: Record<
  InsightSeverity,
  { icon: typeof Info; label: string; className: string; iconClass: string }
> = {
  critical: {
    icon: XOctagon,
    label: "Urgent",
    className: "border-rose-200 bg-rose-50/60",
    iconClass: "text-rose-600",
  },
  warning: {
    icon: AlertTriangle,
    label: "À faire",
    className: "border-amber-200 bg-amber-50/60",
    iconClass: "text-amber-600",
  },
  opportunity: {
    icon: Lightbulb,
    label: "Opportunité",
    className: "border-indigo-200 bg-indigo-50/60",
    iconClass: "text-indigo-600",
  },
  info: {
    icon: Info,
    label: "À savoir",
    className: "border-slate-200 bg-slate-50/60",
    iconClass: "text-slate-500",
  },
  success: {
    icon: CheckCircle2,
    label: "Bien",
    className: "border-emerald-200 bg-emerald-50/60",
    iconClass: "text-emerald-600",
  },
};

function InsightCard({
  insight,
  onTarget,
}: {
  insight: PerformanceInsight;
  onTarget: () => void;
}) {
  const ui = SEVERITY_UI[insight.severity];
  const Icon = ui.icon;
  return (
    <div className={cn("rounded-xl border p-4", ui.className)}>
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ui.iconClass)} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className={cn("text-[10px] font-semibold uppercase tracking-wide", ui.iconClass)}>
              {ui.label}
            </div>
            <div className="font-semibold leading-snug">{insight.title}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">{insight.detail}</p>
          </div>
          {insight.items?.length ? (
            <ul className="divide-y rounded-lg border bg-background/70 text-sm">
              {insight.items.map((it, i) => {
                const body = (
                  <>
                    <span className="truncate font-medium">{it.label}</span>
                    {it.detail ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {it.detail}
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={`${it.label}-${i}`}>
                    {it.href ? (
                      <Link
                        href={it.href}
                        className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-muted/60"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {insight.cta ? (
            insight.cta.href ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background">
                <Link href={insight.cta.href}>
                  {insight.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : insight.cta.action === "target" ? (
              <Button size="sm" variant="outline" className="gap-1.5 bg-background" onClick={onTarget}>
                {insight.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings?: PerformanceSettings;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PerformanceSettings | null>(null);
  useEffect(() => {
    if (open && settings) setForm(settings);
  }, [open, settings]);

  const save = useMutation({
    mutationFn: (s: PerformanceSettings) =>
      analyticsApi.updatePerformanceSettings(s.facilityId, {
        openHour: s.openHour,
        closeHour: s.closeHour,
        alwaysOpen: s.alwaysOpen,
        regularVisitsPerWeek: s.regularVisitsPerWeek,
        inactiveAlertDays: s.inactiveAlertDays,
        googleReviewUrl: s.googleReviewUrl?.trim() || null,
        reviewAfterVisits: s.reviewAfterVisits,
        referralPoints: s.referralPoints,
      }),
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      void queryClient.invalidateQueries({ queryKey: ["performance"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réglages de l'analyse</DialogTitle>
          <DialogDescription>
            Servent à calculer le taux d'occupation, repérer les habitués, demander des avis et récompenser le parrainage.
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Ouvert 24h/24</div>
                <div className="text-xs text-muted-foreground">
                  Pour les périodes spéciales (examens…)
                </div>
              </div>
              <Switch
                checked={form.alwaysOpen}
                onCheckedChange={(v) => setForm({ ...form, alwaysOpen: v })}
              />
            </div>
            <div className={cn("grid grid-cols-2 gap-3", form.alwaysOpen && "opacity-50")}>
              <div className="space-y-1.5">
                <Label>Ouverture</Label>
                <Select
                  disabled={form.alwaysOpen}
                  value={String(form.openHour)}
                  onValueChange={(v) => {
                    const openHour = Number(v);
                    setForm({
                      ...form,
                      openHour,
                      closeHour: Math.max(form.closeHour, openHour + 1),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fermeture</Label>
                <Select
                  disabled={form.alwaysOpen}
                  value={String(form.closeHour)}
                  onValueChange={(v) => setForm({ ...form, closeHour: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 - form.openHour }, (_, i) => form.openHour + 1 + i).map(
                      (h) => (
                        <SelectItem key={h} value={String(h)}>
                          {closeLabel(h)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Les jours où des clients restent plus tard, l'analyse élargit
                automatiquement les heures d'ouverture.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Habitué = visites / semaine</Label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={form.regularVisitsPerWeek}
                  onChange={(e) =>
                    setForm({ ...form, regularVisitsPerWeek: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alerte absence (jours)</Label>
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={form.inactiveAlertDays}
                  onChange={(e) =>
                    setForm({ ...form, inactiveAlertDays: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label>Lien avis Google</Label>
                <Input
                  type="url"
                  placeholder="https://g.page/r/…/review"
                  value={form.googleReviewUrl ?? ""}
                  onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Google Business Profile → « Demander des avis ». Vide = pas de demande d&apos;avis.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Demander l&apos;avis après (visites)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.reviewAfterVisits}
                    onChange={(e) =>
                      setForm({ ...form, reviewAfterVisits: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Parrainage (points chacun)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    step={50}
                    value={form.referralPoints}
                    onChange={(e) =>
                      setForm({ ...form, referralPoints: Number(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.referralPoints / 100} DT · 0 = parrainage désactivé
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Skeleton className="h-40" />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!form || save.isPending} onClick={() => form && save.mutate(form)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetDialog({
  open,
  onOpenChange,
  data,
  facilityId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data?: PerformanceOverview;
  facilityId?: string;
}) {
  const queryClient = useQueryClient();
  const [revenue, setRevenue] = useState("");
  const [netRevenue, setNetRevenue] = useState("");
  const [occupancy, setOccupancy] = useState("");
  useEffect(() => {
    if (!open || !data) return;
    setRevenue(data.target ? String(data.target.revenue) : "");
    setNetRevenue(data.target?.net ? String(data.target.net.revenue) : "");
    setOccupancy(data.target?.occupancyPct != null ? String(data.target.occupancyPct) : "");
  }, [open, data]);

  const save = useMutation({
    mutationFn: (value: number | null) =>
      analyticsApi.setPerformanceTarget({
        facilityId,
        year: data!.period.year,
        month: data!.period.month,
        revenue: value,
        netRevenue: netRevenue.trim() !== "" && Number.isFinite(Number(netRevenue)) ? Number(netRevenue) : null,
        occupancyPct: occupancy ? Number(occupancy) : null,
      }),
    onSuccess: () => {
      toast.success("Objectif enregistré");
      void queryClient.invalidateQueries({ queryKey: ["performance"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  const monthName = data
    ? format(new Date(data.period.year, data.period.month - 1, 1), "MMMM yyyy", { locale: fr })
    : "";
  // Same weekdays 4 weeks earlier for passes + café, same date last month for abonnements
  const samePeriodBefore = data?.period.isCurrent ? data.comparable : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Objectif de {monthName}</DialogTitle>
          <DialogDescription>
            Il reste valable les mois suivants tant que vous ne le changez pas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Chiffre d'affaires visé (DT)</Label>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              placeholder="ex. 6000"
            />
            {data?.projected != null && data.period.isCurrent ? (
              <p className="text-xs text-muted-foreground">
                Au rythme actuel (jour de semaine par jour de semaine) vous finirez vers {dt(data.projected)}.
                {samePeriodBefore
                  ? ` Mêmes jours il y a 4 semaines : ${dt(samePeriodBefore.revenue)}.`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Bénéfice net visé (DT) — optionnel</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={netRevenue}
              onChange={(e) => setNetRevenue(e.target.value)}
              placeholder="ex. 2500"
            />
            <p className="text-xs text-muted-foreground">
              CA − dépenses.{data ? ` Dépenses prévues ce mois : ${dt(data.breakEven.total)}.` : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Taux d'occupation visé (%) — optionnel</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value)}
              placeholder="ex. 40"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {data?.target && !data.target.inherited ? (
            <Button variant="ghost" className="text-rose-600" onClick={() => save.mutate(null)}>
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={!data || !(Number(revenue) > 0) || save.isPending}
            onClick={() => save.mutate(Number(revenue))}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetCard({ data, onEdit }: { data: PerformanceOverview; onEdit: () => void }) {
  const t = data.target;
  const [basis, setBasis] = useState<"ca" | "net">("ca");
  if (!t) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-indigo-500" />
            <div>
              <div className="font-semibold">Pas encore d'objectif pour ce mois</div>
              <p className="text-sm text-muted-foreground">
                Fixez un CA à atteindre (et un bénéfice net si vous voulez) : la page vous dira chaque jour si vous
                êtes en avance ou en retard.
              </p>
            </div>
          </div>
          <Button onClick={onEdit}>Définir l'objectif</Button>
        </CardContent>
      </Card>
    );
  }
  const net = basis === "net" ? t.net : null;
  const showNet = basis === "net";
  const now = showNet ? (net?.now ?? data.current?.net ?? 0) : (data.current?.revenue ?? 0);
  const goal = showNet ? (net?.revenue ?? 0) : t.revenue;
  const expectedByNow = showNet ? (net?.expectedByNow ?? 0) : t.expectedByNow;
  const gap = showNet ? (net?.gap ?? 0) : t.gap;
  const projected = showNet ? (net?.projected ?? null) : data.projected;
  const remaining = showNet ? (net?.remaining ?? 0) : t.remaining;
  const neededPerDay = showNet ? (net?.neededPerDay ?? null) : t.neededPerDay;
  const pctOf = (v: number | null) => (v == null || !(goal > 0) ? 0 : Math.max(0, Math.min(100, (v / goal) * 100)));
  const reached = goal > 0 && now >= goal;
  const ahead = gap >= 0;
  const pct = (v: number | null) => (v == null || !(goal > 0) ? "—" : `${Math.round((v / goal) * 100)} %`);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Objectif du mois · {showNet ? "bénéfice net (CA − dépenses)" : "CA encaissé"}
              {t.inherited && t.fromMonth
                ? ` (repris de ${format(new Date(t.fromMonth.year, t.fromMonth.month - 1, 1), "MMMM", { locale: fr })})`
                : ""}
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {showNet && !net ? "—" : dt(now)}{" "}
              <span className="text-base font-normal text-muted-foreground">/ {showNet && !net ? "pas d'objectif net" : dt(goal)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="group" aria-label="Objectif sur">
              {(["ca", "net"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={basis === b}
                  onClick={() => setBasis(b)}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all duration-200",
                    basis === b ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b === "ca" ? "CA (encaissé)" : "Net (CA − dépenses)"}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={onEdit}>
              Modifier
            </Button>
          </div>
        </div>
        {showNet && !net ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            Pas encore d&apos;objectif de bénéfice net. Bénéfice ce mois : <b className="text-foreground">{dt(data.current?.net ?? 0)}</b>
            {data.projected != null ? ` · fin de mois probable ${dt(data.projected - data.breakEven.total)}` : ""}.{" "}
            <button type="button" className="font-medium text-indigo-600 underline" onClick={onEdit}>
              Fixer un objectif net
            </button>
          </p>
        ) : (
          <>
            <div className="relative pt-1.5">
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                {projected != null && data.period.isCurrent ? (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/25 transition-[width] duration-500 ease-out"
                    style={{ width: `${pctOf(projected)}%` }}
                  />
                ) : null}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out",
                    reached ? "bg-emerald-500" : ahead ? "bg-indigo-500" : "bg-amber-500",
                  )}
                  style={{ width: `${pctOf(Math.max(0, now))}%` }}
                />
              </div>
              {data.period.isCurrent && !reached ? (
                <div
                  className="absolute top-0 h-6 w-0.5 rounded bg-foreground/70 transition-[left] duration-500 ease-out"
                  style={{ left: `${pctOf(Math.max(0, expectedByNow))}%` }}
                  title="Où il faudrait être aujourd'hui"
                />
              ) : null}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Atteint</div>
                <div className="font-semibold">{pct(now)}</div>
              </div>
              {data.period.isCurrent ? (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Attendu à cette date{t.pacedByWeekday ? " (selon les jours de semaine)" : ""}
                    </div>
                    <div className="font-semibold">
                      {pct(expectedByNow)}{" "}
                      <span className={cn("text-xs font-medium", ahead ? "text-emerald-600" : "text-amber-600")}>
                        ({ahead ? "+" : ""}
                        {dt(gap)})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Projection fin de mois</div>
                    <div className="font-semibold">
                      {dt(projected)} <span className="text-xs font-medium text-muted-foreground">({pct(projected)})</span>
                    </div>
                    {!showNet && data.projectedPace != null && Math.abs(data.projectedPace - (data.projected ?? 0)) >= 20 ? (
                      <div className="text-xs text-muted-foreground">au rythme du mois : {dt(data.projectedPace)}</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{showNet ? "CA encore à faire" : "Il reste à faire"}</div>
                    <div className="font-semibold">
                      {dt(remaining)}{" "}
                      {neededPerDay != null ? (
                        <span className="text-xs font-medium text-muted-foreground">({dt(neededPerDay)} / jour)</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {showNet
                ? `Net = CA − dépenses (${dt(net?.expensesExpected ?? data.breakEven.total)} prévues ce mois). `
                : "CA = passes + café + abonnements + événements encaissés, sans retirer les dépenses. "}
              Barre pleine = encaissé, barre claire = projection, trait = où il faudrait être aujourd&apos;hui.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WeekdayPerformance({ data }: { data: PerformanceOverview }) {
  const rows = data.current?.weekdays ?? [];
  const max = Math.max(1, ...rows.map((r) => r.avgRevenue));
  if (!rows.some((r) => r.avgRevenue > 0 || r.avgVisits > 0)) return null;
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance par jour de la semaine</CardTitle>
        <p className="text-sm text-muted-foreground">
          Passes + café par jour ce mois-ci (les abonnements ne comptent pas pour un jour). Les jours
          faibles sont ceux où une offre ou un événement rapporte le plus.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {WEEKDAYS_MON_FIRST.map((wd) => {
          const r = rows.find((x) => x.weekday === wd);
          if (!r || !r.occurrences) return null;
          const best = data.bestWeekday === wd;
          const worst = data.worstWeekday === wd;
          return (
            <div key={wd} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
              <div className={cn("font-medium", best && "text-emerald-700", worst && "text-rose-700")}>
                {WEEKDAY_LABELS[wd]}
              </div>
              <div className="h-6 overflow-hidden rounded-md bg-muted">
                <div
                  className={cn(
                    "flex h-full items-center rounded-md px-2 text-xs font-medium text-white",
                    best ? "bg-emerald-500" : worst ? "bg-rose-400" : "bg-indigo-400",
                  )}
                  style={{ width: `${Math.max(4, (r.avgRevenue / max) * 100)}%` }}
                >
                  {r.avgRevenue >= max * 0.25 ? dt(r.avgRevenue) : ""}
                </div>
              </div>
              <div className="w-40 text-right text-xs text-muted-foreground tabular-nums">
                {r.avgRevenue < max * 0.25 ? `${dt(r.avgRevenue)} · ` : ""}
                {r.avgVisits} visites
                {r.occupancyPct != null ? ` · ${Math.round(r.occupancyPct)} %` : ""}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SplitLine({ label, value, delta }: { label: string; value: number; delta: number | null | undefined }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>
        {label} <b className="font-medium text-foreground tabular-nums">{dt(value)}</b>
      </span>
      <DeltaChip value={delta} />
    </span>
  );
}

function Compare({ now, before, unit = "" }: { now: number; before: number; unit?: string }) {
  const diff = Math.round((now - before) * 10) / 10;
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums transition-colors duration-300",
        diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-muted-foreground",
      )}
    >
      {diff > 0 ? "+" : diff < 0 ? "−" : "±"}
      {Math.abs(diff).toLocaleString("fr-FR")}
      {unit}
    </span>
  );
}

/** Abonnements as monthly totals: never judged by the day they are paid. */
function AbonnementsMonthCard({ a, isCurrent }: { a: AbonnementMonth; isCurrent: boolean }) {
  const r = a.renewedFromLastMonth;
  const ratePrev = r.previousRatePct;
  const pointLabel = isCurrent
    ? `au ${format(new Date(a.previousPoint), "d MMM", { locale: fr })}`
    : "le mois d'avant";
  return (
    <Card className="shadow-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Abonnements du mois</CardTitle>
        <p className="text-sm text-muted-foreground">
          En totaux du mois, jamais par jour. Un bon taux de renouvellement montre que les clients se sentent bien
          dans l'espace. Comparé {isCurrent ? "à la même date le mois dernier" : "au mois d'avant"}.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid content-start gap-1">
          <span className="text-xs font-medium text-muted-foreground">Abonnés actifs</span>
          <span className="flex items-baseline gap-2">
            <b className="text-2xl font-semibold tabular-nums">{a.active.now}</b>
            <Compare now={a.active.now} before={a.active.previous} />
          </span>
          <span className="text-xs text-muted-foreground">{a.active.previous} {pointLabel}</span>
        </div>
        <div className="grid content-start gap-1">
          <span className="text-xs font-medium text-muted-foreground">Renouvelés (finis le mois dernier)</span>
          <span className="flex items-baseline gap-2">
            <b className="text-2xl font-semibold tabular-nums">
              {r.renewed} / {r.ended}
            </b>
            {r.ratePct != null ? <span className="text-sm font-medium">{r.ratePct} %</span> : null}
          </span>
          <span className="text-xs text-muted-foreground">
            {ratePrev != null ? `${ratePrev} % le mois d'avant` : "pas de mois d'avant"}
            {r.otherOffer ? ` · ${r.otherOffer} avec une autre offre` : ""}
          </span>
        </div>
        <div className="grid content-start gap-1">
          <span className="text-xs font-medium text-muted-foreground">Nouveaux abonnés</span>
          <span className="flex items-baseline gap-2">
            <b className="text-2xl font-semibold tabular-nums">{a.newSubscribers.now}</b>
            <Compare now={a.newSubscribers.now} before={a.newSubscribers.previous} />
          </span>
          <span className="text-xs text-muted-foreground">
            {a.conversions.length
              ? `dont ${a.conversions.length} venu${a.conversions.length > 1 ? "s" : ""} d'abord en passes`
              : `${a.newSubscribers.previous} ${pointLabel}`}
          </span>
        </div>
        <div className="grid content-start gap-1">
          <span className="text-xs font-medium text-muted-foreground">Argent des abonnements</span>
          <span className="flex items-baseline gap-2">
            <b className="text-2xl font-semibold tabular-nums">{dt(a.money.paid)}</b>
            <Compare now={a.money.paid} before={a.money.paidPrevious} unit=" DT" />
          </span>
          <span className="text-xs text-muted-foreground">
            encaissé · {dt(a.money.earned)} gagné sur les jours couverts
          </span>
        </div>
        {isCurrent && (a.thisMonth.ended || a.thisMonth.stillToEnd) ? (
          <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
            Ce mois-ci : {a.thisMonth.renewed} renouvelé{a.thisMonth.renewed > 1 ? "s" : ""} sur {a.thisMonth.ended} fini
            {a.thisMonth.ended > 1 ? "s" : ""}, {a.thisMonth.stillToEnd} finissent encore d'ici la fin du mois.
          </p>
        ) : null}
        {r.notRenewed.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-sm sm:col-span-2 xl:col-span-4">
            <span className="text-muted-foreground">Pas renouvelés :</span>
            {r.notRenewed.slice(0, 8).map((m) => (
              <span key={`${m.memberId}-${m.endedOn}`} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {m.name} · {m.plan}
              </span>
            ))}
            {r.notRenewed.length > 8 ? (
              <span className="text-xs text-muted-foreground">+{r.notRenewed.length - 8}</span>
            ) : null}
            <Link
              href="/relances"
              className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              Relancer <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FinanceOverview({
  monthKey,
  onMonthChange,
}: {
  monthKey: string;
  onMonthChange: (key: string) => void;
}) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });
  const facilityId = facilities[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["performance", "overview", year, month, facilityId],
    queryFn: () => analyticsApi.performanceOverview(year, month, facilityId),
  });
  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ["performance", "insights", facilityId],
    queryFn: () => analyticsApi.performanceInsights(facilityId),
    refetchInterval: 5 * 60_000,
  });
  const insights = insightsData?.insights ?? [];

  const compareLabel = useMemo(() => {
    if (!data) return "";
    const from = new Date(data.period.comparedTo.from);
    const to = new Date(data.period.comparedTo.to);
    // A Sunday is compared with a Sunday: same weekdays 4 weeks earlier, or the
    // previous month replayed on this month's calendar
    return data.period.comparedTo.mode === "SAME_WEEKDAYS"
      ? `vs mêmes jours il y a 4 semaines (${format(from, "EEE d", { locale: fr })} – ${format(to, "EEE d MMM", { locale: fr })})`
      : `vs ${format(from, "MMMM", { locale: fr })} à calendrier égal`;
  }, [data]);

  const c = data?.current;
  const d = data?.deltas;
  const occTarget = data?.target?.occupancyPct ?? null;
  const occTone: Tone =
    c?.occupancyPct == null
      ? "neutral"
      : occTarget != null
        ? c.occupancyPct >= occTarget
          ? "good"
          : c.occupancyPct >= occTarget * 0.75
            ? "warn"
            : "bad"
        : c.occupancyPct >= 40
          ? "good"
          : c.occupancyPct >= 20
            ? "warn"
            : "bad";


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label>Mois</Label>
          <Input
            type="month"
            className="w-auto"
            value={monthKey}
            onChange={(e) => e.target.value && onMonthChange(e.target.value)}
          />
          {compareLabel ? (
            <span className="text-xs text-muted-foreground">
              Évolutions {compareLabel} · abonnements vs même date du mois dernier
            </span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Réglages
        </Button>
      </div>

      {data ? <TargetCard data={data} onEdit={() => setTargetOpen(true)} /> : <Skeleton className="h-40" />}
      <ForecastBlock year={year} month={month} facilityId={facilityId} abonnements={data?.abonnements ?? null} />
      {data?.period.isCurrent ? <ChangeQuestions /> : null}

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data.period.isFuture ? null : (
        <>
          <BreakEvenCard data={data} />

          {c ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Revenu brut (CA)"
                value={dt(c.revenue)}
                delta={<DeltaChip value={d?.revenue} />}
                sub={
                  <span className="mt-1 grid gap-1">
                    <SplitLine label="Passes" value={c.revenueJournal} delta={d?.passes} />
                    <SplitLine label="Café et produits" value={c.revenueProducts} delta={d?.products} />
                    <SplitLine label="Abonnements" value={c.revenueAbonnements} delta={d?.abonnements} />
                    {c.revenueEvents > 0 ? <SplitLine label="Événements" value={c.revenueEvents} delta={null} /> : null}
                    {d?.revenueRaw != null && Math.abs((d.revenueRaw ?? 0) - (d.revenue ?? 0)) >= 1 ? (
                      <span>
                        Sans tenir compte du calendrier : {d.revenueRaw > 0 ? "+" : ""}
                        {Math.round(d.revenueRaw)} %
                      </span>
                    ) : null}
                  </span>
                }
                help="Tout l'argent encaissé, avant les dépenses. Passes et café comparés aux mêmes jours de semaine, abonnements en total du mois."
              />
              <KpiCard
                label="Dépenses"
                value={dt(c.expenses)}
                sub="Charges saisies sur la période"
                help="Ce que vous avez dépensé (caisse, coffre ou autre). Voir l'onglet Dépenses pour le détail."
              />
              <KpiCard
                label="Bénéfice net"
                value={dt(c.net)}
                delta={<DeltaChip value={d?.net} />}
                tone={c.net < 0 ? "bad" : c.marginPct != null && c.marginPct < 30 ? "warn" : "neutral"}
                sub={`Brut − dépenses${c.marginPct != null ? ` · marge ${Math.round(c.marginPct)} %` : ""}`}
                help="Revenu brut moins les dépenses. Une marge sous 30 % est fragile."
              />
              <KpiCard
                label="Taux d'occupation"
                value={c.occupancyPct != null ? `${c.occupancyPct.toLocaleString("fr-FR")} %` : "—"}
                delta={<DeltaChip value={d?.occupancyPct} unit="pts" />}
                tone={occTone}
                sub={`${Math.round(c.seatHoursUsed)} h utilisées sur ${Math.round(c.capacityHours)} h disponibles (${data.seats} places)${
                  occTarget != null ? ` · objectif ${occTarget} %` : ""
                }`}
                help="Part des places occupées pendant les heures d'ouverture. C'est le chiffre qui montre si l'espace est assez rempli."
              />
              <KpiCard
                label="CA par place et par jour"
                value={dt(c.revenuePerSeatDay, 1)}
                delta={<DeltaChip value={d?.revenuePerSeatDay} />}
                sub={`${dt(c.revenuePerDay)} par jour en moyenne`}
                help="Ce que rapporte chaque place chaque jour. Il monte si vous remplissez mieux ou vendez plus cher."
              />
              <KpiCard
                label="Part abonnements"
                value={c.recurringSharePct != null ? `${Math.round(c.recurringSharePct)} %` : "—"}
                delta={<DeltaChip value={d?.recurringSharePct} unit="pts" />}
                tone={c.recurringSharePct == null ? "neutral" : c.recurringSharePct >= 40 ? "good" : c.recurringSharePct >= 20 ? "warn" : "neutral"}
                sub={`${dt(c.revenueAbonnements)} venant des abonnements`}
                help="Revenu prévisible d'un mois à l'autre. Plus il est haut, plus le mois est sûr."
              />
              <KpiCard
                label="Visites"
                value={String(c.visits)}
                delta={<DeltaChip value={d?.visits} />}
                sub={[
                  `${c.avgVisitsPerDay}/jour`,
                  `${c.uniqueVisitors} personnes`,
                  c.avgTicket != null ? `ticket moyen ${dt(c.avgTicket, 1)}` : null,
                  c.avgDurationMin != null
                    ? `reste ${c.avgDurationMin >= 60 ? `${Math.floor(c.avgDurationMin / 60)} h ${String(c.avgDurationMin % 60).padStart(2, "0")}` : `${c.avgDurationMin} min`}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                help="Nombre de passages. Combinez avec la durée : peu de visites mais longues remplissent aussi l'espace."
              />
            </div>
          ) : null}

          {data.abonnements ? <AbonnementsMonthCard a={data.abonnements} isCurrent={data.period.isCurrent} /> : null}
        </>
      )}

      <LeverMapCard />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ce que vous devriez faire</CardTitle>
          <p className="text-sm text-muted-foreground">
            Actions classées par priorité, calculées à partir de vos données du moment.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {insightsLoading ? (
            <Skeleton className="h-24" />
          ) : insights.length ? (
            insights.map((i) => (
              <InsightCard key={i.id} insight={i} onTarget={() => setTargetOpen(true)} />
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              Tout est en ordre, rien à traiter pour le moment.
            </div>
          )}
        </CardContent>
      </Card>

      {data && !data.period.isFuture ? <WeekdayPerformance data={data} /> : null}

      {data && data.period.isCurrent ? (
        <p className="text-xs text-muted-foreground">
          7 derniers jours (passes + café) : {dt(data.week.revenue)}
          {data.week.revenueDelta != null && data.week.revenueDelta <= 300
            ? ` (${data.week.revenueDelta > 0 ? "+" : ""}${Math.round(data.week.revenueDelta)} % vs semaine d'avant)`
            : ""}
          , {data.week.visits} visites
          {data.week.occupancyPct != null ? `, occupation ${data.week.occupancyPct} %` : ""}. Heures
          d'ouverture prises en compte :{" "}
          {data.settings.alwaysOpen
            ? "24h/24"
            : `${data.settings.openHour}h – ${closeLabel(data.settings.closeHour)}`}
          .
        </p>
      ) : null}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={data?.settings} />
      <TargetDialog
        open={targetOpen}
        onOpenChange={setTargetOpen}
        data={data}
        facilityId={facilityId}
      />
    </div>
  );
}
