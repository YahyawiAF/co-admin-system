"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  moneyCheckApi,
  type ExpenseCategory,
  type MoneyCheckMonth,
  type MoneyGapKind,
} from "@/lib/api/resources";
import { dt, invalidateMoney } from "@/lib/finance-queries";
import { InfoButton } from "./InfoModal";

export const MONEY_CHECK_KEY = ["money-check"] as const;

const day = (key: string) => format(new Date(`${key}T12:00:00`), "d MMM", { locale: fr });
const n0 = (n: number) => Math.round(n).toLocaleString("fr-FR");
const KINDS: { id: MoneyGapKind; label: string; tag: string }[] = [
  { id: "DEPENSE", label: "Dépense", tag: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200" },
  { id: "BANQUE", label: "Versé à la banque", tag: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
  { id: "RETRAIT", label: "Retrait du propriétaire", tag: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200" },
  { id: "PERTE", label: "Perte / inconnu", tag: "bg-muted text-muted-foreground" },
];
const kindOf = (k: MoneyGapKind) => KINDS.find((x) => x.id === k)!;
const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

/** How a month stands: running, everything explained, or money left without a record. */
function status(m: MoneyCheckMonth) {
  if (!m.checkable) return { text: "pas de clôture", cls: "bg-muted text-muted-foreground" };
  if (m.running) return { text: "en cours", cls: "bg-muted text-muted-foreground" };
  if (m.gap > 0.5) return { text: `${n0(m.gap)} DT non déclarés`, cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200" };
  return { text: "tout expliqué", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" };
}

/**
 * Finance › Argent › Contrôle du mois: revenu brut − argent gardé = argent sorti.
 * What has no record (expense, movement, explained line) is « non déclaré », and can be explained here.
 */
export function MoneyCheckTab({ onGoTab }: { onGoTab?: (tab: string) => void }) {
  const q = useQuery({ queryKey: MONEY_CHECK_KEY, queryFn: () => moneyCheckApi.months(6) });
  const months = q.data?.months ?? [];
  const [key, setKey] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const qc = useQueryClient();

  // Open on the newest finished month with something to explain, else the current one
  useEffect(() => {
    if (key || !months.length) return;
    setKey((months.find((m) => m.checkable && !m.running && m.gap > 0.5) ?? months[0]).key);
  }, [months, key]);

  const remove = useMutation({
    mutationFn: (id: string) => moneyCheckApi.removeLine(id),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success("Ligne retirée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-[520px]" />;
  if (q.isError || !months.length) return <p className="text-sm text-muted-foreground">Impossible de calculer le contrôle du mois.</p>;
  const m = months.find((x) => x.key === key) ?? months[0];
  const st = status(m);
  const name = m.label.split(" ")[0];
  const ofMonth = /^[aeiouyéèh]/i.test(name) ? `d’${name}` : `de ${name}`;
  const hasGap = m.checkable && m.gap > 0.5;

  const rows = [
    { label: "Dépenses payées en espèces", hint: m.expensesLate > 0.5 ? `dont ${n0(m.expensesLate)} déclarés après coup` : `${m.expensesCount} dépense${m.expensesCount > 1 ? "s" : ""}`, value: m.expenses, tab: "depenses" },
    { label: "Sorties notées", hint: m.notedOut.length ? m.notedOut.map((x) => x.label).slice(0, 2).join(" · ") : "caisse et coffre", value: m.noted, tab: "coffre" },
    { label: "Versé à la banque", hint: "", value: m.bank },
    { label: "Retraits du propriétaire", hint: "", value: m.withdrawals },
    { label: "Perte / inconnu", hint: "", value: m.losses },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Mois">
        {months.map((x) => {
          const s = status(x);
          const on = x.key === m.key;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setKey(x.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition-colors duration-200 motion-reduce:transition-none",
                on ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40",
              )}
            >
              <span className="font-bold capitalize">{format(new Date(`${x.key}-02T12:00:00`), "MMM yyyy", { locale: fr })}</span>
              <span className={cn(pill, s.cls)}>{s.text}</span>
            </button>
          );
        })}
      </div>

      <Card key={m.key} className="overflow-hidden shadow-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
        <header className="flex flex-wrap items-center gap-2.5 border-b px-5 py-3.5">
          <h2 className="text-[17px] font-bold">Où est passé l’argent {ofMonth} ?</h2>
          <span className={cn(pill, "text-xs", st.cls)}>{!m.checkable ? "pas de clôture" : m.running ? "en cours" : hasGap ? "à vérifier" : "tout expliqué"}</span>
          <span className="flex-1" />
          <InfoButton title="Comment c’est calculé">
            <div className="space-y-3 text-sm">
              <p>
                <b>Revenu brut</b> − <b>argent gardé</b> = <b>argent sorti</b>. L’argent gardé = coffre + caisse à la fin du mois − au début du mois.
              </p>
              <p>
                L’argent sorti doit avoir une trace : dépenses payées par la caisse ou le coffre, sorties notées (caisse ou coffre), et les lignes
                ajoutées ici (banque, retrait, perte). Ce qui reste sans trace = <b>non déclaré</b>.
              </p>
              <p>
                Une dépense déclarée ici est marquée « déclarée après coup » : l’argent est déjà parti, elle ne retire rien une 2ᵉ fois de la caisse
                ni du coffre.
              </p>
              <p>Argent apporté de dehors (mouvement « entrée » du coffre ou de la caisse) = autres entrées. « Correction après comptage » n’est pas une trace.</p>
            </div>
          </InfoButton>
        </header>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-stretch gap-2.5">
            <Term label="Revenu brut" value={m.brut} source="app · ventes et abonnements" sourceCls="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" />
            {m.otherIn > 0.5 ? (
              <>
                <Op>+</Op>
                <Term label="Autres entrées" value={m.otherIn} source="mouvements « entrée »" sourceCls="bg-muted text-muted-foreground" />
              </>
            ) : null}
            <Op>−</Op>
            <Term
              label="Argent gardé"
              value={m.kept}
              source={`coffre + caisse${m.lastCountDate ? ` · compté le ${day(m.lastCountDate)}` : ""}`}
              sourceCls="bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
              action={onGoTab ? { label: "Voir le coffre", onClick: () => onGoTab("coffre") } : undefined}
              hint={`${n0(m.keptStart)} → ${n0(m.keptEnd)}`}
            />
            <Op>=</Op>
            <Term label="Argent sorti" value={m.out} source="calcul" sourceCls="bg-muted text-muted-foreground" muted />
          </div>

          {m.unclosedDays.length ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {m.unclosedDays.length} jour{m.unclosedDays.length > 1 ? "s" : ""} pas clôturé{m.unclosedDays.length > 1 ? "s" : ""} (
                {m.unclosedDays.slice(0, 3).map(day).join(", ")}
                {m.unclosedDays.length > 3 ? "…" : ""}) : leur argent n’est pas encore compté, l’écart peut être faux.{" "}
                {onGoTab ? (
                  <button type="button" className="font-semibold underline underline-offset-2" onClick={() => onGoTab("caisse")}>
                    Clôturer
                  </button>
                ) : null}
              </span>
            </p>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Argent sorti, expliqué</p>
              {rows.map((r) => (
                <div key={r.label} className="flex min-h-[42px] items-center justify-between gap-3 border-b text-sm">
                  <span className="min-w-0">
                    {r.tab && onGoTab ? (
                      <button type="button" className="font-medium hover:underline" onClick={() => onGoTab(r.tab!)}>
                        {r.label}
                      </button>
                    ) : (
                      <span className="font-medium">{r.label}</span>
                    )}
                    {r.hint ? <span className="ml-1.5 truncate text-xs text-muted-foreground">{r.hint}</span> : null}
                  </span>
                  <b className="tabular-nums">{dt(r.value, 0)}</b>
                </div>
              ))}
              <div
                className={cn(
                  "mt-1.5 flex min-h-12 items-center justify-between rounded-xl px-3 transition-colors duration-300",
                  hasGap ? "bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                )}
              >
                <span className="font-bold">{m.gap < -0.5 ? "En plus (pas noté comme entrée)" : "Non déclaré"}</span>
                <b className="text-lg tabular-nums">{dt(Math.abs(m.gap), 0)}</b>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1.5 flex justify-between text-sm text-muted-foreground">
                  <span>Expliqué</span>
                  <b className="text-foreground">{m.explainedPct} %</b>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/50">
                  <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${m.explainedPct}%` }} />
                </div>
              </div>

              {!m.checkable ? (
                <p className="rounded-xl bg-muted p-4 text-sm">
                  Aucune clôture de caisse ce mois : sans comptage, impossible de savoir où est passé l’argent. Le contrôle commence au premier mois
                  clôturé.
                </p>
              ) : hasGap ? (
                <div className="space-y-2.5 rounded-xl border border-orange-200 bg-orange-50 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 dark:border-orange-900 dark:bg-orange-950/30">
                  <p className="text-[15px] text-orange-950 dark:text-orange-100">
                    <b>{dt(m.gap, 0)} {m.running ? "sortis pour l’instant" : "sont sortis"} sans explication.</b> Une dépense pas notée ? Un versement à la
                    banque ? Un retrait ?
                  </p>
                  {m.closingGaps.length ? (
                    <p className="text-sm text-orange-900/80 dark:text-orange-200/80">
                      {m.closingGaps.length} clôture{m.closingGaps.length > 1 ? "s" : ""} de caisse {m.closingGaps.length > 1 ? "ont" : "a"} un écart (
                      {dt(m.closingGaps.reduce((a, g) => a + g.amount, 0), 0)} au total).
                    </p>
                  ) : null}
                  <Button className="min-h-11 rounded-xl bg-orange-600 font-bold text-white hover:bg-orange-700" onClick={() => setExplain(true)}>
                    Expliquer les {dt(m.gap, 0)}
                  </Button>
                </div>
              ) : m.gap < -0.5 ? (
                <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
                  Il y a <b>{dt(-m.gap, 0)}</b> de plus que prévu : une vente ou un apport pas noté ?
                </p>
              ) : (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-[15px] text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                  <span>
                    <b>Tout est expliqué.</b> Chaque dinar sorti a sa trace.
                  </span>
                </p>
              )}

              {m.lines.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Expliqué ici</p>
                  {m.lines.map((l) => (
                    <div key={l.id} className="flex min-h-11 items-center gap-2.5 border-b text-sm last:border-b-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                      <span className={cn(pill, kindOf(l.kind).tag)}>{kindOf(l.kind).label}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {day(l.date)} · {l.fromSafe ? "coffre" : "caisse"}
                        {l.note ? ` · ${l.note}` : ""}
                      </span>
                      <b className="tabular-nums">{dt(l.amount, 0)}</b>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        aria-label="Retirer la ligne"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(l.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-none">
        <h2 className="mb-2 text-[15px] font-bold">Les chiffres de cette page</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1.5">Chiffre</th>
                <th>D’où il vient</th>
                <th>Pour le changer</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Revenu brut", "passes + café + abonnements encaissés ce mois", "caisse", "Caisse"],
                  ["Argent gardé", "coffre + caisse (gardée à la clôture), fin − début du mois", "coffre", "Coffre"],
                  ["Dépenses", "dépenses payées par la caisse ou le coffre ce mois", "depenses", "Dépenses"],
                  ["Sorties notées", "sorties de caisse et du coffre (hors « Correction »)", "coffre", "Coffre"],
                  ["Banque · retraits · perte", "lignes « Expliquer » de cette page", null, "Expliquer"],
                ] as const
              ).map(([a, b, tab, link]) => (
                <tr key={a} className="border-t">
                  <td className="py-2.5 font-medium">{a}</td>
                  <td className="text-muted-foreground">{b}</td>
                  <td>
                    {tab && onGoTab ? (
                      <button type="button" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300" onClick={() => onGoTab(tab)}>
                        {link}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">{link}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ExplainDialog month={explain ? m : null} onClose={() => setExplain(false)} />
    </div>
  );
}

function Op({ children }: { children: string }) {
  return <span className="self-center text-2xl font-semibold text-muted-foreground">{children}</span>;
}

function Term({
  label,
  value,
  source,
  sourceCls,
  hint,
  action,
  muted,
}: {
  label: string;
  value: number;
  source: string;
  sourceCls: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  muted?: boolean;
}) {
  return (
    <div className={cn("flex min-w-[170px] flex-1 flex-col items-start gap-1 rounded-xl border px-3.5 py-3", muted && "bg-muted/40")}>
      <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{dt(value, 0)}</span>
      <span className={cn(pill, sourceCls)}>{source}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {action ? (
        <button type="button" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

type Draft = {
  id: number;
  kind: MoneyGapKind;
  amount: number;
  date: string;
  note: string;
  category: ExpenseCategory;
  fromSafe: boolean;
  caisseSessionId?: string;
};

/** « Où sont partis les X DT ? »: lines until the rest is 0; what is left stays « à vérifier ». */
function ExplainDialog({ month, onClose }: { month: MoneyCheckMonth | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [lines, setLines] = useState<Draft[]>([]);
  const [kind, setKind] = useState<MoneyGapKind>("DEPENSE");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("AUTRE");
  const [fromSafe, setFromSafe] = useState(false);

  const bounds = useMemo(() => {
    if (!month) return { min: "", max: "" };
    const [y, mo] = month.key.split("-").map(Number);
    const last = format(new Date(y, mo, 0), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    return { min: `${month.key}-01`, max: last < today ? last : today };
  }, [month]);

  useEffect(() => {
    if (!month) return;
    setLines([]);
    setAmount("");
    setNote("");
    setDate(bounds.max);
  }, [month, bounds.max]);

  const save = useMutation({
    mutationFn: async () => {
      for (const l of lines) {
        await moneyCheckApi.addLine({
          month: month!.key,
          kind: l.kind,
          amount: l.amount,
          date: l.date,
          note: l.note || undefined,
          category: l.kind === "DEPENSE" ? l.category : undefined,
          fromSafe: l.fromSafe,
          caisseSessionId: l.caisseSessionId,
        });
      }
    },
    onSuccess: () => {
      invalidateMoney(qc);
      const total = lines.reduce((a, l) => a + l.amount, 0);
      const dep = lines.filter((l) => l.kind === "DEPENSE").reduce((a, l) => a + l.amount, 0);
      toast.success(
        dep > 0.5 ? `${dt(total, 0)} expliqués · ${dt(dep, 0)} ajoutés dans Dépenses (« déclarée après coup »)` : `${dt(total, 0)} expliqués`,
      );
      onClose();
    },
    onError: (e: Error) => {
      invalidateMoney(qc);
      toast.error(e.message);
    },
  });

  if (!month) return null;
  const used = new Set(lines.map((l) => l.caisseSessionId).filter(Boolean));
  const sugg = month.closingGaps.filter((g) => !used.has(g.sessionId));
  const remain = Math.max(0, Math.round((month.gap - lines.reduce((a, l) => a + l.amount, 0)) * 100) / 100);
  const pct = month.gap > 0 ? Math.round(((month.gap - remain) / month.gap) * 100) : 100;
  const push = (l: Omit<Draft, "id">) => {
    setLines((xs) => [...xs, { ...l, id: Date.now() + Math.random() }]);
    setAmount("");
    setNote("");
  };
  const add = (value: number) => {
    if (!(value > 0)) return toast.error("Montant invalide");
    if (!date || date < bounds.min || date > bounds.max) return toast.error("La date doit être dans le mois");
    push({ kind, amount: Math.round(value * 100) / 100, date, note: note.trim(), category, fromSafe });
  };
  const name = month.label.split(" ")[0];

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Où sont partis les {dt(month.gap, 0)} {/^[aeiouyéèh]/i.test(name) ? `d’${name}` : `de ${name}`} ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Reste à expliquer</span>
              <b className={cn("text-lg tabular-nums transition-colors duration-200", remain > 0.5 ? "text-orange-700 dark:text-orange-300" : "text-emerald-700 dark:text-emerald-300")}>
                {dt(remain, 0)}
              </b>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/50">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {sugg.length ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Écarts notés aux clôtures</p>
              <div className="space-y-1.5">
                {sugg.map((g) => (
                  <div
                    key={g.sessionId}
                    className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed px-3 py-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                  >
                    <b>{day(g.date)}</b>
                    <span className="min-w-0 flex-1 text-muted-foreground">
                      caisse −{dt(g.amount, 0)}
                      {g.note ? ` · « ${g.note} »` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-9 border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
                      onClick={() =>
                        push({ kind: "DEPENSE", amount: Math.min(g.amount, remain || g.amount), date: g.date, note: g.note ?? "", category: "AUTRE", fromSafe: false, caisseSessionId: g.sessionId })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> C’était une dépense
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border p-3.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
                    kind === k.id ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200" : "text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="gap-amount">Montant (DT)</Label>
                <Input id="gap-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gap-date">Date</Label>
                <Input id="gap-date" type="date" min={bounds.min} max={bounds.max} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              {kind === "DEPENSE" ? (
                <div className="space-y-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                  <Label htmlFor="gap-cat">Catégorie</Label>
                  <select
                    id="gap-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Sorti de</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={fromSafe === v}
                      onClick={() => setFromSafe(v)}
                      className={cn(
                        "h-10 rounded-md border text-sm font-medium transition-colors duration-200",
                        fromSafe === v ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                      )}
                    >
                      {v ? "Coffre" : "Caisse"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gap-note">{kind === "DEPENSE" ? "Quoi ?" : "Note"}</Label>
                <Input id="gap-note" value={note} placeholder={kind === "DEPENSE" ? "ex. lait + sucre" : "optionnel"} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-10" onClick={() => add(Number(amount))}>
                <Plus className="h-4 w-4" /> Ajouter la ligne
              </Button>
              <Button variant="outline" className="min-h-10" disabled={remain < 0.5} onClick={() => add(remain)}>
                Mettre le reste ({dt(remain, 0)})
              </Button>
            </div>
          </div>

          {lines.length ? (
            <div>
              {lines.map((l) => (
                <div key={l.id} className="flex min-h-11 items-center gap-2.5 border-b text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                  <span className={cn(pill, kindOf(l.kind).tag)}>{kindOf(l.kind).label}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {day(l.date)} · {l.fromSafe ? "coffre" : "caisse"}
                    {l.note ? ` · ${l.note}` : ""}
                  </span>
                  <b className="tabular-nums">{dt(l.amount, 0)}</b>
                  <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Retirer la ligne" onClick={() => setLines((xs) => xs.filter((x) => x.id !== l.id))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="flex-1 text-[13px] text-muted-foreground">
            {remain > 0.5 ? `Il restera ${dt(remain, 0)} « à vérifier » : vous pourrez revenir.` : "Tout est expliqué : le mois passe au vert."}
          </span>
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            Annuler
          </Button>
          <Button className="bg-emerald-600 font-bold text-white hover:bg-emerald-700" disabled={!lines.length || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
