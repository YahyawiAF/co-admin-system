"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import type { ForecastSource, MonthForecast } from "@/lib/types";
import { dayValue } from "./ForecastSources";

const n0 = (n: number) => Math.round(n).toLocaleString("fr-FR");
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${n0(Math.abs(n))}`;
const dayOf = (key: string) => Number(key.slice(8, 10));
const dayLabel = (key: string) => format(new Date(`${key}T12:00:00`), "EEE d MMM", { locale: fr }).replace(/^./, (c) => c.toUpperCase());
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const WEEK_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
/** Tarifs and café follow the usual days (and the month's pace); abonnements and events are known amounts */
const followsDays = (s: ForecastSource) => s.kind === "tarif" || s.kind === "cafe";

/** Grid step on round numbers (1, 2, 2,5, 5 × 10ⁿ) giving about four lines up to `max`. */
const niceStep = (max: number) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max / 4));
  return ([1, 2, 2.5, 5, 10].find((k) => k * p >= max / 4) ?? 10) * p;
};
/** A path that slides to its new shape when the method switches (CSS `d`, Chromium). */
const morph = (d: string): CSSProperties => ({ d: `path("${d}")` }) as CSSProperties;
const MORPH = "transition-[d] duration-300 ease-out motion-reduce:transition-none";

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Range = { v: number; low: number; high: number };

/** The month in numbers: what is done, what is still expected (with its likely range), the charges. */
function useMonthEnd(f: MonthForecast, pace: boolean, b: { total: number; fixed: number; fixedRemaining: number; dailyProjected: number; dailyPerDay?: number } | null) {
  return useMemo(() => {
    const mult = pace ? (f.toDate?.pace.multiplier ?? 1) : 1;
    const list = f.sources.list;
    const lowK = f.expected.variable > 0 ? f.expected.variableLow / f.expected.variable : 1;
    const highK = f.expected.variable > 0 ? f.expected.variableHigh / f.expected.variable : 1;
    const days = f.sources.days.map((d) => {
      const done = d.complete ? list.reduce((a, s) => a + dayValue(d, s, mult), 0) : 0;
      const next = d.complete ? 0 : list.reduce((a, s) => a + dayValue(d, s, mult), 0);
      const part = (k: number) => (d.complete ? 0 : list.reduce((a, s) => a + (followsDays(s) ? (d.expected[s.key] ?? 0) * mult * k : (d.expected[s.key] ?? 0)), 0));
      const variable = d.complete ? 0 : list.filter(followsDays).reduce((a, s) => a + (d.expected[s.key] ?? 0) * mult, 0);
      const prev = list.reduce((a, s) => a + (d.previous[s.key] ?? 0), 0);
      return { key: d.key, weekday: d.weekday, complete: d.complete, done, next, low: part(lowK), high: part(highK), variable, prev };
    });
    const todayN = days.filter((d) => d.complete).length;
    const total = days.length;
    const sum = (k: "done" | "next" | "low" | "high") => days.reduce((a, d) => a + d[k], 0);
    const done = sum("done");
    const next: Range = { v: sum("next"), low: sum("low"), high: sum("high") };
    const end: Range = { v: done + next.v, low: done + next.low, high: done + next.high };

    // Charges: every charge of the month (paid or not) + daily purchases, the ones to come at the usual pace
    const left = total - todayN;
    const dailyFuture = b ? Math.min(b.dailyProjected, (b.dailyPerDay ?? 0) * left) : 0;
    const charges = b
      ? { paid: b.fixed - b.fixedRemaining + b.dailyProjected - dailyFuture, toPay: b.fixedRemaining + dailyFuture, total: b.total }
      : { paid: 0, toPay: 0, total: 0 };

    // First day the month's money passes the charges
    let cum = 0;
    let cover: string | null = null;
    for (const d of days) {
      cum += d.done + d.next;
      if (charges.total > 0 && cum >= charges.total) {
        cover = d.key;
        break;
      }
    }
    const openDaysLeft = days.filter((d) => !d.complete && d.variable > 0.5).length;
    const neededPerDay = openDaysLeft ? Math.max(0, charges.total - done - (next.v - days.reduce((a, d) => a + d.variable, 0))) / openDaysLeft : 0;
    const perOpenDay = openDaysLeft ? days.reduce((a, d) => a + d.variable, 0) / openDaysLeft : 0;

    // Usual day of each weekday: passes + café expected this month, days in a calendar period left out
    const periodDays = new Set(f.days.filter((d) => d.period).map((d) => d.key));
    const weekdays = WEEK_LABEL.map((_, w) => {
      const same = f.days.filter((d) => d.weekday === w && !periodDays.has(d.key));
      const v = same.length ? same.reduce((a, d) => a + d.expected, 0) / same.length : 0;
      return { v, open: v > 0.5 };
    });

    return {
      days,
      todayN,
      total,
      done,
      next,
      end,
      charges,
      profit: { done: done - charges.paid, end: { v: end.v - charges.total, low: end.low - charges.total, high: end.high - charges.total } },
      cover,
      coveredAlready: cover != null && dayOf(cover) <= todayN,
      openDaysLeft,
      neededPerDay,
      perOpenDay,
      weekdays,
    };
  }, [f, pace, b]);
}
type MonthEnd = ReturnType<typeof useMonthEnd>;

/** « Prévision de fin de mois »: three answers, the curve, the numbers that add up, the usual week. */
export function MonthEndCard({
  f,
  year,
  month,
  pace,
  onPace,
}: {
  f: MonthForecast;
  year: number;
  month: number;
  pace: boolean;
  onPace: (v: boolean) => void;
}) {
  const ov = useQuery({
    queryKey: ["performance", "overview", year, month],
    queryFn: () => analyticsApi.performanceOverview(year, month),
  });
  const b = ov.data?.breakEven ?? null;
  const m = useMonthEnd(f, pace, b?.hasCharges ? b : null);

  if (ov.isLoading) return <Skeleton className="h-[640px]" />;

  const closed = !f.period.isCurrent && !f.period.isFuture;
  const future = f.period.isFuture;
  const monthName = f.period.label.split(" ")[0] ?? "";
  const ofMonth = /^[aeiouyéèêàâîôûh]/i.test(monthName) ? `d’${monthName}` : `de ${monthName}`;
  const short = format(new Date(year, month - 1, 2), "MMM", { locale: fr });
  const approx = closed ? "" : "≈ ";
  const profit = m.profit.end;
  const loss = profit.v < 0;
  const hasCharges = m.charges.total > 0.5;
  const cover = m.cover ? dayOf(m.cover) : null;
  const missing = Math.max(0, m.charges.total - m.end.v);
  const t = f.toDate;
  const prevTotal = f.versusPrevious ? f.versusPrevious.previousTotal + f.events.previousMonth : null;
  const dayNow = closed ? m.total : Math.min(m.total, m.todayN + 1);

  const rows = [
    { label: "Revenus", sub: "passes, café, abonnements, événements", done: m.done, next: m.next.v, end: m.end.v, color: "text-emerald-700 dark:text-emerald-400", tint: true },
    { label: "− Charges", sub: "dépenses du mois + achats du quotidien", done: m.charges.paid, next: m.charges.toPay, end: m.charges.total, color: "text-rose-700 dark:text-rose-400", doneHint: "payées", nextHint: "à payer" },
  ];

  return (
    <Card className="overflow-hidden shadow-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <header className="flex min-h-[46px] flex-wrap items-center gap-2.5 border-b px-4 py-1.5">
        <LineChart className="h-[17px] w-[17px] text-muted-foreground" />
        <h2 className="text-[15px] font-semibold">{closed ? `Bilan ${ofMonth}` : `Prévision de fin ${ofMonth}`}</h2>
        <Chip>
          {closed
            ? "Mois terminé"
            : future
              ? "Mois à venir"
              : `Jour ${dayNow} sur ${m.total} · ${m.total - m.todayN} jour${m.total - m.todayN > 1 ? "s" : ""} à venir, aujourd’hui compris`}
        </Chip>
        {t ? (
          <Chip tone={t.gap >= 0 ? "green" : "amber"}>
            {closed ? (t.gap >= 0 ? "Au-dessus du prévu" : "En dessous du prévu") : t.gap >= 0 ? "En avance sur le prévu" : "En retard sur le prévu"} ·{" "}
            {signed(t.gap)} DT{t.gapPct != null ? ` (${signed(t.gapPct)} %)` : ""}
          </Chip>
        ) : null}
        {t && !closed ? (
          <div role="group" aria-label="Méthode" className="ml-auto flex overflow-hidden rounded-lg border">
            {(
              [
                [false, "Méthode actuelle"],
                [true, "+ rythme du mois"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={pace === v}
                onClick={() => onPace(v)}
                className={cn(
                  "h-[30px] px-3 text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
                  pace === v ? "bg-violet-700 text-white" : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* The three answers */}
      <div className="grid grid-cols-1 border-b sm:grid-cols-3">
        <Answer
          label={closed ? "Revenus du mois" : "Revenus prévus"}
          value={`${approx}${n0(m.end.v)}`}
          color="text-emerald-700 dark:text-emerald-400"
          hint={
            closed
              ? prevTotal != null
                ? `${signed(m.end.v - prevTotal)} DT vs ${f.period.previousLabel}`
                : undefined
              : `entre ${n0(m.end.low)} et ${n0(m.end.high)}${prevTotal != null ? ` · ${f.period.previousLabel} ${n0(prevTotal)}` : ""}`
          }
        />
        <Answer
          label="Charges du mois"
          value={n0(m.charges.total)}
          color={hasCharges ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}
          hint={hasCharges ? `${n0(m.charges.paid)} payées · ${n0(m.charges.toPay)} encore à payer` : undefined}
          action={
            !hasCharges ? (
              <Link href="/finance?tab=depenses" className="text-[12.5px] font-semibold text-indigo-600 underline-offset-2 hover:underline">
                Ajouter mes charges
              </Link>
            ) : null
          }
        />
        <Answer
          label={loss ? (closed ? "Perte du mois" : "Perte prévue") : closed ? "Bénéfice du mois" : "Bénéfice prévu"}
          value={`${approx}${signed(profit.v)}`}
          color={loss ? "text-rose-700 dark:text-rose-400" : Math.abs(profit.v) < 0.5 ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400"}
          hint={closed ? undefined : `entre ${signed(profit.low)} et ${signed(profit.high)}`}
          last
        />
      </div>

      {/* The curve */}
      <div className="px-4 pb-2 pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-muted-foreground">
          <Key className="border-emerald-500" label="Revenus (fait)" />
          {!closed ? <Key className="border-emerald-500" dashed label="Prévu" /> : null}
          {!closed ? <Key box className="bg-emerald-500/25" label="Fourchette probable" /> : null}
          {hasCharges ? <Key className="border-rose-600" dashed label="Charges du mois" /> : null}
          <Key className="border-muted-foreground/60" label={f.period.previousLabel.replace(/^./, (c) => c.toUpperCase())} />
          {hasCharges ? (
            <span className="ml-auto">
              {cover != null ? (
                <Chip tone="green" icon>
                  {m.coveredAlready ? `Charges couvertes depuis le ${cover} ${short}` : `Charges couvertes le ${cover} ${short}`}
                </Chip>
              ) : (
                <Chip tone="red">Charges pas couvertes ce mois · il manque {n0(missing)} DT</Chip>
              )}
            </span>
          ) : null}
        </div>
        <Curve m={m} closed={closed} charges={m.charges.total} short={short} prevName={f.period.previousLabel} />
      </div>

      {/* The numbers, written as a sum */}
      <div className="overflow-x-auto border-t">
        <div className="min-w-[560px] text-[13.5px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-2.5 border-b px-4 py-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            <span>Les chiffres</span>
            <span className="text-right">{m.todayN ? `Déjà fait · 1–${m.todayN} ${short}` : "Déjà fait"}</span>
            <span className="text-right">{closed ? "Reste à payer" : `Prévu · ${m.todayN + 1}–${m.total} ${short}`}</span>
            <span className="text-right">Fin du mois</span>
          </div>
          {rows.map((r) => (
            <div key={r.label} className={cn("grid min-h-[44px] grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] items-center gap-2.5 border-b px-4", r.tint && "bg-muted/30")}>
              <span className="min-w-0">
                <span className="font-semibold">{r.label}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{r.sub}</span>
              </span>
              <b className={cn("text-right tabular-nums", Math.abs(r.done) < 0.5 ? "text-muted-foreground" : r.color)}>
                {n0(r.done)}
                {r.doneHint ? <span className="ml-1 text-[12px] font-medium text-muted-foreground">{r.doneHint}</span> : null}
              </b>
              <b className="text-right font-semibold tabular-nums text-muted-foreground">
                {closed && r.next < 0.5 ? (
                  "—"
                ) : (
                  <>
                    + {n0(r.next)}
                    {r.nextHint ? <span className="ml-1 text-[12px] font-medium">{r.nextHint}</span> : null}
                  </>
                )}
              </b>
              <b className={cn("text-right tabular-nums", Math.abs(r.end) < 0.5 ? "text-muted-foreground" : r.color)}>{n0(r.end)}</b>
            </div>
          ))}
          <div
            className={cn(
              "grid min-h-[44px] grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] items-center gap-2.5 px-4 transition-colors duration-300",
              loss ? "bg-rose-50 dark:bg-rose-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
            )}
          >
            <span className="font-semibold">= Bénéfice</span>
            <b className={cn("text-right tabular-nums", m.profit.done < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
              {signed(m.profit.done)}
            </b>
            <span />
            <b className={cn("text-right text-[15px] tabular-nums", loss ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
              {approx}
              {signed(profit.v)}
            </b>
          </div>
        </div>
      </div>

      {/* Where the forecast comes from */}
      {!closed ? (
        <div className="grid gap-4 border-t px-4 py-3.5 md:grid-cols-2">
          <UsualWeek weekdays={m.weekdays} />
          <div className="flex flex-col text-[13.5px]">
            <Line label="Passes + café prévus par jour ouvert" value={`${n0(m.perOpenDay)} DT`} />
            {hasCharges ? <Line label="Il faut par jour pour couvrir les charges" value={`${n0(m.neededPerDay)} DT`} /> : null}
            <Line label="Jours ouverts qui restent" value={`${m.openDaysLeft} jour${m.openDaysLeft > 1 ? "s" : ""}`} />
            {future ? (
              <>
                <Line label={`Repère du ${format(new Date(`${f.checkpoints[0].key}T12:00:00`), "d MMM", { locale: fr })}`} value={`${n0(f.checkpoints[0].expectedCum)} DT`} />
                <Line label="Nouveaux visiteurs attendus" value={`${n0(f.expected.newVisitors)} · ${n0(f.expected.visitCount)} visites`} />
              </>
            ) : null}
            {hasCharges && m.openDaysLeft > 0 ? (
              <span className="mt-2">
                {m.neededPerDay < 0.5 ? (
                  <Chip tone="green" icon>
                    Les charges sont déjà couvertes
                  </Chip>
                ) : m.perOpenDay >= m.neededPerDay ? (
                  <Chip tone="green">Vous êtes au-dessus du rythme nécessaire</Chip>
                ) : (
                  <Chip tone="amber">Il manque {n0(m.neededPerDay - m.perOpenDay)} DT par jour</Chip>
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="border-t px-4 py-[9px] text-[12.5px] text-muted-foreground">
        {closed
          ? "Mois terminé : ce sont les vrais chiffres du mois. Charges = toutes les dépenses pour ce mois + les achats du quotidien."
          : "Comment on calcule : chaque jour qui reste = vos passes + café habituels du même jour de la semaine × l’effet du calendrier" +
            (pace && t ? " × le rythme du mois" : "") +
            "; abonnements le jour où ceux en cours finissent, événements le jour de l’événement. Le réel se remplit chaque soir. Charges = dépenses pour ce mois (payées ou non) + achats du quotidien au rythme des 4 dernières semaines."}
      </footer>
    </Card>
  );
}

function Chip({ children, tone = "muted", icon }: { children: React.ReactNode; tone?: "muted" | "green" | "amber" | "red"; icon?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors duration-300",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "green" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
        tone === "amber" && "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
        tone === "red" && "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
      )}
    >
      {icon ? <Check className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function Answer({ label, value, color, hint, action, last }: { label: string; value: string; color: string; hint?: string; action?: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("min-w-0 px-4 py-3.5", !last && "border-b sm:border-b-0 sm:border-r")}>
      <p className="truncate text-[12.5px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.01em] tabular-nums transition-colors duration-200", color)}>
        {value}
        <span className="ml-1 text-[13px] font-semibold tracking-normal text-muted-foreground">DT</span>
      </p>
      {hint ? <p className="truncate text-[12.5px] text-muted-foreground">{hint}</p> : null}
      {action}
    </div>
  );
}

function Key({ className, label, dashed, box }: { className: string; label: string; dashed?: boolean; box?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {box ? (
        <i className={cn("inline-block h-2.5 w-4 rounded-[2px]", className)} />
      ) : (
        <i className={cn("inline-block w-4 border-t-[3px]", dashed && "border-t-2 border-dashed", className)} />
      )}
      {label}
    </span>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[32px] items-center justify-between gap-3 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

/** Usual day of each weekday (Lun → Dim), the best one dark. */
function UsualWeek({ weekdays }: { weekdays: { v: number; open: boolean }[] }) {
  const mx = Math.max(1e-9, ...WEEK.map((w) => weekdays[w].v));
  const best = WEEK.reduce((b, w) => (weekdays[w].v > weekdays[b].v ? w : b), WEEK[0]);
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Votre semaine type · passes + café par jour</p>
      <div className="flex h-[104px] items-end gap-2">
        {WEEK.map((w) => {
          const { v, open } = weekdays[w];
          return (
            <div key={w} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${WEEK_LABEL[w]} · ${open ? `${n0(v)} DT` : "fermé"}`}>
              <span className={cn("text-[11.5px] font-bold tabular-nums", !open && "text-muted-foreground")}>{open ? n0(v) : "fermé"}</span>
              <span
                className={cn(
                  "w-full max-w-[34px] rounded-t-[4px] transition-[height,background-color] duration-300 motion-reduce:transition-none",
                  !open ? "bg-muted" : w === best ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-900",
                )}
                style={{ height: Math.max(4, (Math.max(0, v) / mx) * 62) }}
              />
              <span className="text-[11.5px] text-muted-foreground">{WEEK_LABEL[w]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Running total of the month: done (solid), expected (dashed) with its range, charges, last month. */
function Curve({ m, closed, charges, short, prevName }: { m: MonthEnd; closed: boolean; charges: number; short: string; prevName: string }) {
  const [ref, w] = useWidth(700);
  const [hov, setHov] = useState<number | null>(null);
  const h = 240;
  const n = m.days.length;
  const todayN = m.todayN;

  const s = useMemo(() => {
    // cum[i] = total at the end of day i (i = 1 … n), cum[0] = 0
    const doneCum = [0];
    const allCum = [0];
    const lowCum = [0];
    const highCum = [0];
    const prev = [0];
    m.days.forEach((d, i) => {
      doneCum.push(doneCum[i] + d.done);
      allCum.push(allCum[i] + d.done + d.next);
      lowCum.push(lowCum[i] + d.done + d.low);
      highCum.push(highCum[i] + d.done + d.high);
      prev.push(prev[i] + d.prev);
    });
    return { doneCum, allCum, lowCum, highCum, prev };
  }, [m.days]);

  const values = [...s.highCum, ...s.doneCum, ...s.prev, charges];
  const step = niceStep(Math.max(...values) * 1.04);
  const top = Math.max(step, Math.ceil((Math.max(...values) * 1.04) / step) * step);
  const pl = 52;
  const pr = 14;
  const pt = 14;
  const pb = 24;
  const iw = Math.max(80, w - pl - pr);
  const ih = h - pt - pb;
  const X = (i: number) => pl + (iw * i) / n;
  const Y = (v: number) => pt + ih - (v / (top || 1)) * ih;
  const pts = (p: [number, number][]) => p.map(([i, v], k) => `${k ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");

  const realPts: [number, number][] = Array.from({ length: todayN + 1 }, (_, i) => [i, s.doneCum[i]]);
  const ahead = (c: number[]): [number, number][] => Array.from({ length: n - todayN + 1 }, (_, k) => [todayN + k, c[todayN + k]]);
  const fc = closed || todayN >= n ? "" : pts(ahead(s.allCum));
  const band =
    closed || todayN >= n
      ? ""
      : `${pts(ahead(s.lowCum))} ${ahead(s.highCum)
          .reverse()
          .map(([i, v]) => `L${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
          .join(" ")} Z`;
  const prevPts = pts(s.prev.map((v, i) => [i, v]));
  const real = pts(realPts);
  const ticks = Array.from({ length: Math.round(top / step) }, (_, k) => (k + 1) * step);
  const xLabels = [1, 5, 10, 15, 20, 25, n];
  const cover = m.cover ? dayOf(m.cover) : null;
  const hd = hov != null ? m.days[hov - 1] : null;
  const Prev = prevName.replace(/^./, (c) => c.toUpperCase());

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHov(null)}>
      <svg width={w} height={h} role="img" aria-label={`Revenus cumulés du mois : fait, prévu, charges et ${prevName}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={pl + iw} y1={Y(t)} y2={Y(t)} className="stroke-border" />
            <text x={pl - 6} y={Y(t) + 4} textAnchor="end" fontSize={10.5} className="fill-muted-foreground">
              {n0(t)}
            </text>
          </g>
        ))}
        <line x1={pl} x2={pl + iw} y1={Y(0)} y2={Y(0)} className="stroke-border" />
        {band ? <path d={band} style={morph(band)} className={cn("fill-emerald-500/15", MORPH)} /> : null}
        <path d={prevPts} fill="none" strokeWidth={1.5} style={morph(prevPts)} className={cn("stroke-muted-foreground/50", MORPH)} />
        {charges > 0 ? <line x1={pl} x2={pl + iw} y1={Y(charges)} y2={Y(charges)} strokeWidth={2} strokeDasharray="6 5" className="stroke-rose-600" /> : null}
        {!closed && todayN > 0 && todayN < n ? (
          <line x1={X(todayN)} x2={X(todayN)} y1={pt} y2={pt + ih} strokeDasharray="2 3" className="stroke-foreground" />
        ) : null}
        {fc ? <path d={fc} fill="none" strokeWidth={2.5} strokeDasharray="7 5" style={morph(fc)} className={cn("stroke-emerald-500", MORPH)} /> : null}
        {todayN > 0 ? <path d={real} fill="none" strokeWidth={3} strokeLinejoin="round" style={morph(real)} className={cn("stroke-emerald-600", MORPH)} /> : null}
        {cover != null ? <circle cx={X(cover)} cy={Y(s.allCum[cover])} r={5} strokeWidth={3} className="fill-background stroke-rose-600" /> : null}
        {!closed && todayN > 0 && todayN < n ? (
          <text x={X(todayN)} y={pt - 3} textAnchor="middle" fontSize={10.5} fontWeight={700} className="fill-foreground">
            Aujourd’hui
          </text>
        ) : null}
        {xLabels.map((d) => (
          <text key={d} x={X(d - 0.5)} y={h - 6} textAnchor="middle" fontSize={10.5} className="fill-muted-foreground">
            {d}
          </text>
        ))}
        {hov != null ? <line x1={X(hov)} x2={X(hov)} y1={pt} y2={pt + ih} className="stroke-muted-foreground/40" /> : null}
        {hov != null ? <circle cx={X(hov)} cy={Y(hov <= todayN ? s.doneCum[hov] : s.allCum[hov])} r={4} className="fill-emerald-600" /> : null}
        {m.days.map((_, i) => (
          <rect key={i} x={X(i)} y={0} width={iw / n} height={h} fill="transparent" onMouseEnter={() => setHov(i + 1)} />
        ))}
      </svg>
      {hd && hov != null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[190px] rounded-lg border bg-popover px-3 py-2 text-[12.5px] shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
          style={{ left: Math.min(Math.max(0, X(hov) + 12), w - 196) }}
        >
          <b className="block">{dayLabel(hd.key)}</b>
          {hd.complete ? (
            <>
              <TipRow label="Fait ce jour" value={n0(hd.done)} />
              <TipRow label={`Total au ${hov}`} value={n0(s.doneCum[hov])} strong />
            </>
          ) : (
            <>
              <TipRow label="Prévu ce jour" value={n0(hd.next)} />
              <TipRow label={`Total au ${hov}`} value={n0(s.allCum[hov])} strong />
            </>
          )}
          <TipRow label={`${Prev} au ${hov}`} value={n0(s.prev[hov])} />
          {charges > 0 && hov === cover ? <span className="mt-0.5 block font-semibold text-rose-700 dark:text-rose-400">Charges couvertes ({short})</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function TipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex justify-between gap-2 text-muted-foreground">
      {label}
      <b className={cn("tabular-nums", strong && "text-foreground")}>{value}</b>
    </span>
  );
}
