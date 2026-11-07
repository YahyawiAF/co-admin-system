"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { caisseApi } from "@/lib/api/resources";
import { dt, managerApi, type MoneyPlan } from "@/lib/api/manager";
import { InfoButton } from "./InfoModal";
import { MONEY_KEY, QUESTIONS_KEY } from "./MoneyQuestions";

type Line = MoneyPlan["lines"][number];
type EditKey = "bank" | "taxes" | "promised" | "payroll" | "reserve" | "safe";

const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

/** Where a number comes from, in the words of the page. */
function sourceOf(l: Line | undefined) {
  if (!l) return { text: "manque", cls: "bg-rose-100 text-rose-700", stale: false };
  const at = l.source.at ?? "";
  const stale = at.includes("à revoir");
  switch (l.source.kind) {
    case "APP":
      return { text: at ? `app · ${at}` : "app", cls: "bg-emerald-50 text-emerald-800", stale: false };
    case "APP_UNCONFIRMED":
      return { text: "app · non confirmé", cls: "bg-amber-100 text-amber-800", stale: true };
    case "ANSWER":
      return stale
        ? { text: `votre réponse · ${at}`, cls: "bg-amber-100 text-amber-800", stale: true }
        : { text: at ? `votre réponse · ${at}` : "votre réponse", cls: "bg-sky-100 text-sky-800", stale: false };
    case "DEFAULT":
      return { text: "par défaut · à confirmer", cls: "bg-amber-100 text-amber-800", stale: true };
    case "UNKNOWN":
      return { text: "à vérifier", cls: "bg-amber-100 text-amber-800", stale: true };
    case "CALC":
      return { text: "calcul", cls: "bg-muted text-muted-foreground", stale: false };
    default:
      return { text: "manque", cls: "bg-rose-100 text-rose-700", stale: true };
  }
}

const EDIT: Record<EditKey, { title: string; ask: string; note: string; unit?: string }> = {
  bank: { title: "Banque", ask: "Solde du compte aujourd’hui (DT)", note: "Regardez votre appli bancaire. On vous le redemande dans 7 jours." },
  taxes: { title: "Impôts / TVA", ask: "À mettre de côté pour les 3 prochains mois (DT)", note: "Ce que vous devrez payer bientôt." },
  promised: { title: "Déjà promis", ask: "Argent réservé à un achat ou une personne (DT)", note: "Ex. matériel commandé, avance promise. 0 si rien." },
  payroll: { title: "Salaires + CNSS", ask: "Par mois (DT)", note: "0 si personne n’est payé." },
  reserve: { title: "Réserve", ask: "Combien de mois de charges garder ?", note: "3 mois = 3 × les charges du mois.", unit: "mois" },
  safe: { title: "Corriger le coffre", ask: "Combien il y a dans le coffre, compté (DT)", note: "L’app ajoute un mouvement « correction » de l’écart. L’historique ne change pas." },
};

function Term({ label, value, line, onClick, plus }: { label: string; value: string; line?: Line; onClick?: () => void; plus?: boolean }) {
  const s = sourceOf(line);
  return (
    <>
      {plus ? <span className="self-center text-xl font-semibold text-muted-foreground">+</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "flex min-w-[140px] flex-col items-start gap-1 rounded-xl border bg-background px-3.5 py-3 text-left transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
          onClick && "hover:-translate-y-px hover:border-foreground hover:shadow-sm",
          s.stale && "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20",
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className={cn(pill, s.cls)}>{s.text}</span>
      </button>
    </>
  );
}

/**
 * Finance › Argent, the calculation as clickable sums: every number says
 * where it comes from (app, your answer, « à revoir »), and how to change it.
 */
export function ArgentPanel({ plan, onGoTab }: { plan: MoneyPlan; onGoTab?: (tab: string) => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditKey | null>(null);
  const [draft, setDraft] = useState("");
  const [moves, setMoves] = useState(false);
  const line = (k: string) => plan.lines.find((l) => l.key === k);
  const amt = (k: string) => line(k)?.amount ?? null;
  const show = (n: number | null) => (n == null ? "?" : dt(n));

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: EditKey; value: number }) => {
      if (key === "safe") {
        const diff = Math.round((value - (amt("safe") ?? 0)) * 100) / 100;
        if (Math.abs(diff) < 0.01) return null;
        await caisseApi.addCoffre({ type: diff > 0 ? "IN" : "OUT", amount: Math.abs(diff), label: "Correction après comptage" });
        return null;
      }
      return managerApi.answer(key, { value, label: key === "reserve" ? `${value} mois` : `${value} DT` });
    },
    onSuccess: (res) => {
      if (res) qc.setQueryData(QUESTIONS_KEY, res);
      qc.invalidateQueries({ queryKey: MONEY_KEY });
      qc.invalidateQueries({ queryKey: ["coffre"] });
      toast.success("Enregistré, la page est recalculée");
      setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (k: EditKey) => {
    const now = k === "reserve" ? plan.reserveMonths : k === "payroll" ? null : amt(k);
    setDraft(now == null ? "" : String(now));
    setEdit(k);
    setMoves(false);
  };

  // « Ce que ça change », computed here before saving
  const preview = useMemo(() => {
    if (!edit) return null;
    const v = Number(draft);
    if (draft === "" || !Number.isFinite(v)) return null;
    const liquid = plan.liquid ?? 0;
    const keep = plan.keep ?? 0;
    const costs = plan.monthlyCosts ?? 0;
    let l2 = liquid;
    let k2 = keep;
    if (edit === "bank" || edit === "safe") l2 = liquid - (amt(edit) ?? 0) + v;
    if (edit === "taxes" || edit === "promised") k2 = keep - (amt(edit) ?? 0) + v;
    if (edit === "reserve") k2 = keep + (v - plan.reserveMonths) * costs;
    return { liquid: l2, invest: Math.max(0, l2 - k2), keep: k2 };
  }, [edit, draft, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const stale = sourceOf(line("bank")).stale;
  const reserveAmount = amt("reserve");
  const vars: Array<{ label: string; value: string; line?: Line; how: string; act: string; go: () => void }> = [
    { label: "Caisse", value: show(amt("cash")), line: line("cash"), how: line("cash")?.detail || "ouverture + espèces du jour − dépenses de la caisse", act: "Voir la caisse", go: () => onGoTab?.("caisse") },
    { label: "Coffre", value: show(amt("safe")), line: line("safe"), how: "clôtures (compté − gardé) − dépenses payées du coffre", act: "Voir les mouvements", go: () => setMoves(true) },
    { label: "Banque", value: show(amt("bank")), line: line("bank"), how: "solde du compte, saisi par vous", act: "Modifier", go: () => open("bank") },
    { label: "Charges + salaires du mois", value: show(amt("bills")), line: line("bills"), how: "charges fixes de Dépenses + salaires", act: "Voir Dépenses", go: () => onGoTab?.("depenses") },
    { label: "Salaires + CNSS", value: "dans la ligne au-dessus", line: line("bills"), how: "par mois", act: "Modifier", go: () => open("payroll") },
    { label: "Impôts / TVA", value: show(amt("taxes")), line: line("taxes"), how: "à mettre de côté pour 3 mois", act: "Modifier", go: () => open("taxes") },
    { label: "Déjà promis", value: show(amt("promised")), line: line("promised"), how: "argent réservé", act: "Modifier", go: () => open("promised") },
    { label: "Réserve", value: `${plan.reserveMonths} mois`, line: line("reserve"), how: "mois de charges à garder", act: "Modifier", go: () => open("reserve") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span>Chaque chiffre dit d’où il vient :</span>
        <span className={cn(pill, "bg-emerald-50 text-emerald-800")}>app</span> calculé par l’app
        <span className={cn(pill, "bg-sky-100 text-sky-800")}>votre réponse</span> modifiable
        <span className={cn(pill, "bg-amber-100 text-amber-800")}>à revoir</span> trop ancien
      </div>

      <Card className="shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Argent disponible</h2>
            <InfoButton title="Comment l’argent est calculé">
              <p><b>Argent disponible</b> = caisse + coffre + banque.</p>
              <p><b>À garder</b> = charges du mois + salaires + impôts + déjà promis + réserve (mois × charges du mois).</p>
              <p><b>Libre pour investir</b> = disponible − à garder, jamais moins de 0.</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>Caisse</b> : ouverture + espèces encaissées − dépenses payées de la caisse.</li>
                <li><b>Coffre</b> : la somme de ses mouvements. Chaque clôture y met « compté − gardé », chaque dépense « payée depuis le coffre » en sort. « Corriger » ajoute un mouvement de l’écart.</li>
                <li><b>Banque, impôts, promis, salaires, réserve</b> : vos réponses. La banque passe « à revoir » après 7 jours.</li>
                <li>L’argent que les clients vous doivent n’est compté qu’une fois payé.</li>
              </ul>
            </InfoButton>
          </div>
          <div className="mt-3 flex flex-wrap items-stretch gap-3">
            <div className="flex min-w-[150px] flex-col justify-center">
              <div className="text-3xl font-bold tabular-nums">{show(plan.liquid)}</div>
              <div className="text-xs text-muted-foreground">aujourd’hui</div>
            </div>
            <span className="self-center text-xl font-semibold text-muted-foreground">=</span>
            <Term label="Caisse" value={show(amt("cash"))} line={line("cash")} onClick={() => onGoTab?.("caisse")} />
            <Term plus label="Coffre" value={show(amt("safe"))} line={line("safe")} onClick={() => setMoves(true)} />
            <Term plus label="Banque" value={show(amt("bank"))} line={line("bank")} onClick={() => open("bank")} />
          </div>
          {stale ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <span>
                {amt("bank") == null
                  ? "La banque n’est pas encore saisie : l’argent disponible ne peut pas être calculé."
                  : `La banque (${show(amt("bank"))}) vient d’une ancienne réponse. Si elle a changé, l’argent disponible est faux.`}
              </span>
              <Button size="sm" variant="outline" onClick={() => open("bank")}>{amt("bank") == null ? "Saisir la banque" : "Mettre à jour la banque"}</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold">À garder avant d’investir</h2>
            <div className="mt-3 flex flex-wrap items-stretch gap-3">
              <div className="flex min-w-[110px] flex-col justify-center text-2xl font-bold tabular-nums">{show(plan.keep)}</div>
              <span className="self-center text-xl font-semibold text-muted-foreground">=</span>
              <Term label="Charges + salaires" value={show(amt("bills"))} line={line("bills")} onClick={() => onGoTab?.("depenses")} />
              <Term plus label="Impôts" value={show(amt("taxes"))} line={line("taxes")} onClick={() => open("taxes")} />
              <Term plus label="Déjà promis" value={show(amt("promised"))} line={line("promised")} onClick={() => open("promised")} />
              <Term plus label={`Réserve ${plan.reserveMonths} mois`} value={show(reserveAmount)} line={line("reserve")} onClick={() => open("reserve")} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-foreground bg-foreground text-background shadow-none">
          <CardContent className="flex h-full flex-col justify-center gap-1 p-5">
            <div className="text-xs font-medium opacity-75">Libre pour investir</div>
            <div className="text-3xl font-bold tabular-nums">{show(plan.invest)}</div>
            <div className="text-sm opacity-75">
              {show(plan.liquid)} disponible − {show(plan.keep)} à garder
              {plan.verdict.kind === "NO" ? ` · il manque ${dt(plan.verdict.shortfall)}` : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-5">
          <h2 className="text-base font-semibold">Les chiffres de cette page</h2>
          <p className="mb-2 text-sm text-muted-foreground">Tout ce que la page utilise. Changez un chiffre et toute la page se recalcule.</p>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.8fr)_auto] gap-3 border-b px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Chiffre</span>
            <span>Valeur</span>
            <span>D’où il vient</span>
            <span />
          </div>
          {vars.map((v) => {
            const s = sourceOf(v.line);
            return (
              <div key={v.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b px-1 py-2.5 text-sm md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.8fr)_auto]">
                <span className="font-medium">{v.label}</span>
                <span className="text-right font-semibold tabular-nums md:text-left">{v.value}</span>
                <span className="col-span-2 flex flex-col gap-0.5 md:col-span-1">
                  <span className={cn(pill, "self-start", s.cls)}>{s.text}</span>
                  <span className="text-xs text-muted-foreground">{v.how}</span>
                </span>
                <span className="col-span-2 md:col-span-1 md:text-right">
                  <Button size="sm" variant="outline" onClick={v.go}>{v.act}</Button>
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit ? (edit === "safe" ? EDIT.safe.title : `Modifier : ${EDIT[edit].title}`) : ""}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{EDIT[edit].ask}</span>
                  <Input type="number" inputMode="decimal" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="h-14 text-2xl font-bold" />
                </label>
                <p className="text-sm text-muted-foreground">{EDIT[edit].note}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ce que ça change</span>
                <span>Disponible : <b className="tabular-nums">{preview ? dt(preview.liquid) : show(plan.liquid)}</b></span>
                <span>À garder : <b className="tabular-nums">{preview ? dt(preview.keep) : show(plan.keep)}</b></span>
                <span>Libre : <b className="tabular-nums">{preview ? dt(preview.invest) : show(plan.invest)}</b></span>
                <Button
                  className="mt-auto"
                  disabled={save.isPending || draft === "" || !Number.isFinite(Number(draft)) || Number(draft) < 0}
                  onClick={() => save.mutate({ key: edit, value: Number(draft) })}
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <CoffreMoves open={moves} onOpenChange={setMoves} onCorrect={() => open("safe")} />
    </div>
  );
}

const KIND: Record<string, string> = { CLOTURE: "clôture", DEPENSE: "dépense", CAISSE: "caisse", MANUEL: "à la main" };

/** Every coffre movement, newest first, with the balance after each one. */
function CoffreMoves({ open, onOpenChange, onCorrect }: { open: boolean; onOpenChange: (o: boolean) => void; onCorrect: () => void }) {
  const q = useQuery({ queryKey: ["coffre"], queryFn: () => caisseApi.coffre(), enabled: open });
  const rows = useMemo(() => {
    const list = [...(q.data?.entries ?? [])].sort((a, b) => (a.dateKey + a.createdAt).localeCompare(b.dateKey + b.createdAt));
    let run = 0;
    return list.map((e) => ({ ...e, run: (run += e.type === "IN" ? e.amount : -e.amount) })).reverse();
  }, [q.data]);
  const paged = usePaged(rows, 20);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mouvements du coffre</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{rows.length} mouvements · solde {q.data ? dt(q.data.balance) : "…"} · les plus récents d’abord</span>
          <Button size="sm" variant="outline" onClick={onCorrect}>Corriger le solde</Button>
        </div>
        {q.isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-sm">
            <div className="grid grid-cols-[70px_70px_90px_100px_minmax(0,1fr)] gap-2 border-b pb-2 text-[11px] font-semibold uppercase text-muted-foreground sm:grid-cols-[80px_80px_100px_110px_110px_minmax(0,1fr)]">
              <span>Date</span>
              <span>Sens</span>
              <span className="hidden sm:block">Sorte</span>
              <span>Montant</span>
              <span>Solde après</span>
              <span>Libellé</span>
            </div>
            {paged.pageItems.map((e) => (
              <div key={e.id} className="grid grid-cols-[70px_70px_90px_100px_minmax(0,1fr)] items-center gap-2 border-b py-2 tabular-nums animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:grid-cols-[80px_80px_100px_110px_110px_minmax(0,1fr)]">
                <span>{format(new Date(`${e.dateKey}T12:00:00`), "dd/MM", { locale: fr })}</span>
                <span className={cn(pill, "justify-self-start", e.type === "IN" ? "bg-emerald-50 text-emerald-800" : "bg-rose-100 text-rose-700")}>{e.type === "IN" ? "entre" : "sort"}</span>
                <span className="hidden text-muted-foreground sm:block">{KIND[e.kind] ?? e.kind}</span>
                <span className={cn("font-semibold", e.type === "IN" ? "text-emerald-700" : "text-rose-700")}>
                  {e.type === "IN" ? "+ " : "− "}
                  {dt(e.amount)}
                </span>
                <span>{dt(e.run)}</span>
                <span className="truncate">{e.label || "—"}</span>
              </div>
            ))}
            <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="px-0" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

