"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { copyText } from "@/components/admin/advisor/advice-ui";
import { dt, managerApi, type MoneyIdea, type MoneyPlan, type MoneySourceKind, type MoneyView } from "@/lib/api/manager";
import { MONEY_KEY, QUESTIONS_KEY } from "./QuestionsTab";

const chip = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

const SOURCE: Record<MoneySourceKind, { label: string; cls: string }> = {
  APP: { label: "app", cls: "bg-muted text-muted-foreground" },
  APP_UNCONFIRMED: { label: "app · non confirmé", cls: "bg-muted text-muted-foreground" },
  ANSWER: { label: "votre réponse", cls: "bg-primary/10 text-primary" },
  DEFAULT: { label: "par défaut · à confirmer", cls: "bg-muted text-muted-foreground" },
  MISSING: { label: "manque", cls: "bg-rose-100 text-rose-700" },
  UNKNOWN: { label: "à vérifier", cls: "bg-amber-100 text-amber-800" },
  CALC: { label: "calcul", cls: "bg-emerald-100 text-emerald-700" },
};

function StatePill({ plan }: { plan: MoneyPlan }) {
  const [text, cls] =
    plan.state === "UNKNOWN"
      ? [`Inconnu · il manque ${plan.missing.length} réponse${plan.missing.length > 1 ? "s" : ""}`, "bg-rose-100 text-rose-700"]
      : plan.state === "PARTIAL"
        ? ["Presque · impôts à vérifier", "bg-amber-100 text-amber-800"]
        : ["Calculé", "bg-emerald-100 text-emerald-700"];
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300", cls)}>{text}</span>;
}

function Verdict({ plan, onAnswer }: { plan: MoneyPlan; onAnswer: () => void }) {
  const v = plan.verdict;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
      <p className="min-w-0 flex-1">
        {v.kind === "MISSING" ? (
          <>
            <b>Je ne peux pas encore répondre.</b> Il me manque : {plan.missing.join(", ")}.
          </>
        ) : v.kind === "NO" ? (
          <>
            <b>Ce mois, n&apos;investissez pas.</b> Il manque {dt(v.shortfall)} pour couvrir les factures et{" "}
            {plan.reserveMonths} mois de réserve.
          </>
        ) : v.kind === "SMALL_TEST" ? (
          <>
            <b>Vous pouvez investir jusqu&apos;à {dt(v.invest)}.</b> Mais l&apos;espace a encaissé {dt(v.income)} en{" "}
            {v.incomeLabel} pour {dt(v.costs)} de charges : commencez par un petit test qui ramène des clients.
          </>
        ) : (
          <>
            <b>Vous pouvez investir jusqu&apos;à {dt(v.invest)}.</b> Le reste couvre vos factures et {plan.reserveMonths}{" "}
            mois de réserve.
          </>
        )}
      </p>
      {v.kind === "MISSING" ? (
        <Button size="sm" onClick={onAnswer}>
          Répondre (1 min)
        </Button>
      ) : null}
    </div>
  );
}

function Tile({ label, value, sub, main, tone }: { label: string; value: string; sub: string; main?: boolean; tone?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3", main && "border-primary bg-primary/5")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-bold tabular-nums tracking-tight transition-colors duration-300", tone)}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Breakdown({ plan }: { plan: MoneyPlan }) {
  const max = Math.max(plan.liquid ?? 0, plan.keep ?? 0, 1);
  return (
    <div className="mt-2 flex flex-col">
      {plan.lines.map((l) => {
        const total = l.key === "invest";
        const color = total ? "bg-emerald-500" : l.sign > 0 ? "bg-primary" : l.key === "reserve" ? "bg-amber-500" : "bg-rose-500";
        const src = SOURCE[l.source.kind];
        return (
          <div
            key={l.key}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t py-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]",
              total && "border-t-2 border-foreground",
            )}
          >
            <div className="min-w-0">
              <div className={cn("text-sm", total ? "font-bold" : "font-medium")}>{l.label}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {l.detail ? <span>{l.detail}</span> : null}
                <span className={cn(chip, src.cls)}>
                  {src.label}
                  {l.source.at ? ` ${l.source.at}` : ""}
                </span>
              </div>
            </div>
            <div className="order-3 col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500 ease-out", color)}
                style={{ width: `${l.amount == null ? 0 : Math.min(100, (l.amount / max) * 100)}%` }}
              />
            </div>
            <div className={cn("text-right text-sm tabular-nums", total ? "font-bold" : "font-semibold")}>
              {l.amount == null ? "?" : `${l.sign < 0 && l.amount > 0 ? "− " : ""}${dt(l.amount)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthsChart({ view }: { view: MoneyView }) {
  const costs = view.plan.monthlyCosts ?? 0;
  const top = Math.max(...view.months.map((m) => m.income), costs, 1) * 1.15;
  const covered = view.months.filter((m) => !m.current && m.income >= costs).length;
  const full = view.months.filter((m) => !m.current).length;
  return (
    <>
      <div className="relative mt-3 h-36">
        <div className="absolute inset-x-0 bottom-6 top-5 flex items-end justify-around">
          {view.months.map((m) => (
            <div key={m.month} className="flex h-full w-1/3 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold tabular-nums">{dt(m.income)}</span>
              <div
                className={cn("w-10 rounded-t-md transition-[height] duration-500 ease-out", m.current ? "bg-primary/50" : "bg-primary")}
                style={{ height: `${(m.income / top) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {costs > 0 ? (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-rose-500 transition-[bottom] duration-500"
            style={{ bottom: `calc(1.5rem + (100% - 2.75rem) * ${costs / top})` }}
          >
            <span className="absolute -top-5 right-0 bg-card px-1 text-[11px] font-semibold text-rose-600">charges {dt(costs)}</span>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex justify-around">
          {view.months.map((m) => (
            <span key={m.month} className="w-1/3 text-center text-xs text-muted-foreground">
              {m.label}
              {m.current && m.asOfDay ? ` (au ${m.asOfDay})` : ""}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {!costs
          ? "Répondez sur les charges pour voir la ligne des charges."
          : covered === 0
            ? `Aucun mois terminé n'a couvert les charges (${dt(costs)}/mois).`
            : `${covered} mois sur ${full} ont couvert les charges (${dt(costs)}/mois).`}
      </p>
    </>
  );
}

const FIT: Record<MoneyIdea["fit"], { label: string; cls: string }> = {
  NOT_NOW: { label: "pas maintenant", cls: "bg-rose-100 text-rose-700" },
  WAITING: { label: "en attente du calcul", cls: "bg-muted text-muted-foreground" },
  IN_BUDGET: { label: "dans le budget", cls: "bg-emerald-100 text-emerald-700" },
  OVER_BUDGET: { label: "au-dessus du budget", cls: "bg-amber-100 text-amber-800" },
};

export function MoneyTab({ onAnswer, onStartTest }: { onAnswer: () => void; onStartTest: (idea: MoneyIdea) => void }) {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: MONEY_KEY, queryFn: managerApi.money });

  const reserve = useMutation({
    mutationFn: (months: number) => managerApi.answer("reserve", { value: months, label: `${months} mois` }),
    onSuccess: (res) => {
      qc.setQueryData(QUESTIONS_KEY, res);
      qc.invalidateQueries({ queryKey: MONEY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stage = useMutation({
    mutationFn: ({ key, stage }: { key: string; stage: "APPROVED" | "TICKET_READY" | "DEFERRED" }) =>
      managerApi.setFeatureStage(key, stage),
    onSuccess: async (res, { key, stage }) => {
      qc.setQueryData(MONEY_KEY, res);
      if (stage === "DEFERRED") toast.success("Reporté : la demande reviendra dans un mois");
      if (stage === "TICKET_READY") {
        const ticket = res.features.find((f) => f.key === key)?.ticket;
        if (ticket) {
          await copyText(ticket).then(
            () => toast.success("Ticket copié : collez-le dans Claude Code"),
            () => toast.error("Copie impossible"),
          );
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!data.data) return <p className="text-sm text-destructive">Calcul indisponible : {data.error?.message}</p>;
  const view = data.data;
  const { plan } = view;
  const unknown = plan.state === "UNKNOWN";

  return (
    <div className="advisor-in grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Combien garder, combien investir</h2>
              <StatePill plan={plan} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Argent disponible" value={plan.liquid == null ? "?" : dt(plan.liquid)} sub="caisse + coffre + banque" />
              <Tile label="À garder" value={plan.keep == null ? "?" : dt(plan.keep)} sub="factures + impôts + réserve" />
              <Tile
                main
                label="Vous pouvez investir"
                value={plan.invest == null ? "?" : dt(plan.invest)}
                sub={unknown ? "pas assez de données" : plan.state === "PARTIAL" ? "sans les impôts, à confirmer" : "après tout ce qu'il faut garder"}
                tone={plan.invest == null ? "text-muted-foreground" : plan.invest > 0 ? "text-emerald-700" : "text-rose-700"}
              />
            </div>
            <Verdict plan={plan} onAnswer={onAnswer} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold">Le calcul, ligne par ligne</h2>
            <p className="text-sm text-muted-foreground">Fait par l&apos;app, pas par l&apos;IA. Chaque chiffre dit d&apos;où il vient.</p>
            <Breakdown plan={plan} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Réserve de sécurité</span>
              <div className="flex items-center gap-2">
                {reserve.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                <div role="radiogroup" aria-label="Réserve de sécurité" className="inline-flex overflow-hidden rounded-lg border text-sm">
                  {[1, 2, 3].map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={plan.reserveMonths === m}
                      disabled={reserve.isPending}
                      onClick={() => reserve.mutate(m)}
                      className={cn(
                        "px-3 py-1.5 transition-colors duration-200 [&+&]:border-l",
                        plan.reserveMonths === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      )}
                    >
                      {m} mois
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold">Idées d&apos;investissement</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Tirées de vos 30 derniers jours. Coûts estimés : chaque idée a une version test moins chère.
            </p>
            {view.ideas.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {view.ideas.map((i) => (
                  <div key={i.key} className="flex flex-col gap-2 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{i.title}</div>
                      <span className={cn(chip, FIT[i.fit].cls)}>{FIT[i.fit].label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{i.why}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Coût</dt>
                      <dd className="tabular-nums">{dt(i.cost)}</dd>
                      <dt className="text-muted-foreground">Version test</dt>
                      <dd>{i.test}</dd>
                      <dt className="text-muted-foreground">Objectif</dt>
                      <dd>{i.goal}</dd>
                      <dt className="text-muted-foreground">On arrête si</dt>
                      <dd>{i.stop}</dd>
                    </dl>
                    {i.draft && i.fit !== "NOT_NOW" ? (
                      <Button variant="outline" size="sm" className="self-start" onClick={() => onStartTest(i)}>
                        Lancer le test
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Pas assez de passages ces 30 derniers jours pour proposer une idée chiffrée.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Encaissé par mois</div>
            <MonthsChart view={view} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pas compté comme de l&apos;argent</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Impayés</div>
                <div className="text-xs text-muted-foreground">
                  {view.unpaid.clients} client{view.unpaid.clients > 1 ? "s doivent" : " doit"} de l&apos;argent
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums">{dt(view.unpaid.total)}</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Compté seulement quand c&apos;est encaissé.</p>
          </CardContent>
        </Card>
        {view.features.map((f) => (
          <Card key={f.key} className="advisor-in border-dashed border-primary shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Le Conseiller demande un outil</div>
              <div className="font-semibold">{f.title}</div>
              <div className="flex flex-wrap gap-1.5">
                {(["SUGGESTED", "APPROVED", "TICKET_READY"] as const).map((s, i, all) => (
                  <span
                    key={s}
                    className={cn(
                      chip,
                      "font-medium transition-colors duration-300",
                      all.indexOf(f.stage) >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s === "SUGGESTED" ? "Suggéré" : s === "APPROVED" ? "Approuvé" : "Ticket prêt"}
                  </span>
                ))}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Problème</dt>
                <dd>{f.problem}</dd>
                <dt className="text-muted-foreground">Test</dt>
                <dd>{f.test}</dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                {f.stage === "SUGGESTED" ? (
                  <>
                    <Button size="sm" disabled={stage.isPending} onClick={() => stage.mutate({ key: f.key, stage: "APPROVED" })}>
                      Approuver
                    </Button>
                    <Button size="sm" variant="outline" disabled={stage.isPending} onClick={() => stage.mutate({ key: f.key, stage: "DEFERRED" })}>
                      Plus tard
                    </Button>
                  </>
                ) : f.stage === "APPROVED" ? (
                  <Button size="sm" disabled={stage.isPending} onClick={() => stage.mutate({ key: f.key, stage: "TICKET_READY" })}>
                    Créer le ticket pour Claude Code
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">Ticket prêt. Aucun code n&apos;est changé sans vous.</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        f.ticket &&
                        copyText(f.ticket).then(
                          () => toast.success("Ticket copié"),
                          () => toast.error("Copie impossible"),
                        )
                      }
                    >
                      Copier à nouveau
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
