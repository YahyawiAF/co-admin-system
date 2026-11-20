"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Megaphone, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPager } from "@/components/ui/list-pager";
import { CampaignDialog, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import { FinanceNewcomers } from "@/components/admin/finance/FinanceNewcomers";
import { clientsApi } from "@/lib/api/resources";
import { channelLabel } from "@/lib/outreach-ui";
import { cn } from "@/lib/utils";
import type { ClientListRow, ClientRules, ClientSegment, ClientTodo } from "@/lib/types";
import { ClientDialog } from "./ClientDialog";
import { ClientGroupsRing } from "./ClientGroupsRing";
import { CAMPAIGN_TEMPLATE, SEGMENT_ORDER, SEGMENT_UI, nf } from "./clients-ui";

type Abo = "ACTIVE" | "EXPIRED" | "NONE";
type Filters = { segment: ClientSegment | null; abo: Abo | null; todo: ClientTodo | "ALL" | null };

const ABO_PILLS: Array<{ id: Abo | null; label: string }> = [
  { id: null, label: "Tous" },
  { id: "ACTIVE", label: "Abo actif" },
  { id: "EXPIRED", label: "Abo expiré" },
  { id: "NONE", label: "Sans abo" },
];

const TILE_HINT: Record<"ALL" | ClientSegment, string> = {
  ALL: "venus ces 30 jours",
  NEW: "Bienvenue ou petit rappel",
  OCCASIONAL: "Venus 1 à 3 fois",
  REGULAR: "Le cœur de l'espace",
  AT_RISK: "À contacter vite",
  INACTIVE: "Rien depuis 30 j +",
};

const shortDay = (d: string) => format(parseISO(d.length === 10 ? `${d}T12:00:00` : d), "d MMM", { locale: fr });
const ago = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`);

function pill(on: boolean) {
  return cn(
    "min-h-9 rounded-full border px-3 text-sm transition-colors duration-200 motion-reduce:transition-none",
    on ? "border-indigo-600 bg-indigo-600 text-white" : "bg-background hover:bg-muted",
  );
}

/** Finance › Clients: who comes, who drifts away, and who to contact today. */
export function FinanceClients() {
  const [filters, setFilters] = useState<Filters>({ segment: null, abo: null, todo: null });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ id: string; tab: "info" | "message" } | null>(null);
  const [campaign, setCampaign] = useState<CampaignDraft | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [filters, q]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["clients", "list", filters, q, page],
    queryFn: () =>
      clientsApi.list({
        segment: filters.segment ?? undefined,
        abo: filters.abo ?? undefined,
        todo: filters.todo ?? undefined,
        q: q || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const startCampaign = (s: ClientSegment) =>
    setCampaign({
      title: `${SEGMENT_UI[s].label} — ${format(new Date(), "d MMM", { locale: fr })}`,
      message: CAMPAIGN_TEMPLATE[s],
      segment: `CLIENT_${s}`,
      goal: "VISIT",
    });

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">Impossible de charger les clients : {(error as Error).message}</CardContent>
      </Card>
    );
  }

  const tiles: Array<{ key: "ALL" | ClientSegment; label: string; value: number; color: string }> = data
    ? [
        { key: "ALL", label: "Tous", value: data.counts.ALL, color: "#6366f1" },
        ...SEGMENT_ORDER.map((s) => ({ key: s, label: SEGMENT_UI[s].label, value: data.counts[s], color: SEGMENT_UI[s].color })),
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* À faire aujourd'hui */}
      {isLoading || !data ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : (
        <section className="rounded-2xl bg-indigo-900 p-5 text-white dark:bg-indigo-950">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold">
              {data.todoTotal ? `À faire aujourd'hui : ${nf(data.todoTotal)} client${data.todoTotal > 1 ? "s" : ""}` : "Rien d'urgent aujourd'hui"}
            </h3>
            {data.todoTotal ? (
              <button
                type="button"
                onClick={() => set({ todo: filters.todo === "ALL" ? null : "ALL", segment: null, abo: null })}
                className="text-sm text-indigo-200 underline-offset-2 hover:underline"
              >
                {filters.todo === "ALL" ? "Voir tout le monde" : "Voir la liste"}
              </button>
            ) : (
              <span className="text-sm text-indigo-200">Tous les clients à relancer ont déjà eu un message.</span>
            )}
          </div>
          {data.todo.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.todo.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={filters.todo === t.key}
                  onClick={() => set({ todo: filters.todo === t.key ? null : t.key, segment: null, abo: null })}
                  className={cn(
                    "min-h-11 rounded-xl border px-3.5 text-left text-sm transition-colors duration-200 motion-reduce:transition-none",
                    filters.todo === t.key ? "border-white bg-white text-indigo-900" : "border-white/25 bg-white/10 hover:bg-white/20",
                  )}
                >
                  <b className="tabular-nums">{nf(t.count)}</b> {t.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* Group tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {isLoading || !data
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : [
              ...tiles.map((t) => {
                const on = t.key === "ALL" ? !filters.segment && !filters.abo && !filters.todo : filters.segment === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilters({ segment: t.key === "ALL" ? null : t.key, abo: null, todo: null })}
                    className={cn(
                      "flex flex-col gap-1 rounded-2xl border-2 bg-card p-3.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                      on ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" : "border-border",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                      {t.label}
                    </span>
                    <span className="text-2xl font-bold tabular-nums">{nf(t.value)}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {t.key === "ALL" ? `${nf(data.recent30)} ${TILE_HINT.ALL}` : TILE_HINT[t.key]}
                    </span>
                  </button>
                );
              }),
              ...(
                [
                  ["ACTIVE", "Abos actifs", data.abos.ACTIVE, "Jusqu'à leur date de fin"],
                  ["EXPIRED", "Abos expirés", data.abos.EXPIRED, "Pas repris depuis"],
                ] as const
              ).map(([k, label, value, hint]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filters.abo === k}
                  onClick={() => setFilters({ segment: null, abo: filters.abo === k ? null : k, todo: null })}
                  className={cn(
                    "flex flex-col gap-1 rounded-2xl border-2 bg-card p-3.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    filters.abo === k ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" : "border-border",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="h-2 w-2 rounded-[2px] bg-violet-500" />
                    {label}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">{nf(value)}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
                </button>
              )),
            ]}
      </div>

      {data ? (
        <ClientGroupsRing
          counts={data.counts}
          selected={filters.segment}
          onPick={(s) => setFilters({ segment: s, abo: null, todo: null })}
        />
      ) : null}

      {/* List */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b p-3.5">
          <label className="relative min-w-0 flex-[1_1_220px]">
            <span className="sr-only">Chercher un client</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou téléphone"
              className="h-10 rounded-xl pl-9"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Abonnement">
            {ABO_PILLS.map((p) => (
              <button key={p.label} type="button" aria-pressed={filters.abo === p.id} onClick={() => set({ abo: p.id })} className={pill(filters.abo === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={!!filters.todo}
            onClick={() => set({ todo: filters.todo ? null : "ALL" })}
            className={pill(!!filters.todo)}
          >
            À contacter seulement
          </button>
          {filters.segment ? (
            <Button variant="outline" size="sm" className="ml-auto min-h-9 rounded-full" onClick={() => startCampaign(filters.segment!)}>
              <Megaphone className="mr-1.5 h-4 w-4" />
              Campagne pour ce groupe
            </Button>
          ) : null}
        </div>

        <div className={cn("overflow-x-auto transition-opacity duration-200", isFetching && !isLoading && "opacity-60")}>
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Groupe</th>
                <th className="px-3 py-2.5 font-semibold">Dernière visite</th>
                <th className="px-3 py-2.5 font-semibold">Visites 30 j</th>
                <th className="px-3 py-2.5 font-semibold">Abonnement</th>
                <th className="px-3 py-2.5 font-semibold">Dernier contact</th>
                <th className="px-4 py-2.5 font-semibold">Action suggérée</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !data
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))
                : data.rows.map((r, i) => (
                    <ClientRow
                      key={r.memberId}
                      row={r}
                      index={i}
                      onOpen={() => setOpen({ id: r.memberId, tab: "info" })}
                      onContact={() => setOpen({ id: r.memberId, tab: "message" })}
                    />
                  ))}
            </tbody>
          </table>
          {data && !data.rows.length ? (
            <div className="animate-in fade-in-0 px-4 py-10 text-center duration-300 motion-reduce:animate-none">
              <p className="font-semibold">Personne ici</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.counts.ALL
                  ? "Aucun client ne correspond. Essayez un autre groupe ou videz la recherche."
                  : "Aucune visite enregistrée pour l'instant : les groupes se remplissent avec les check-ins."}
              </p>
            </div>
          ) : null}
        </div>
        {data ? <ListPager page={data.page} lastPage={data.lastPage} total={data.total} onPage={setPage} /> : null}
      </Card>

      {/* Rules */}
      {data ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Comment les groupes sont calculés</p>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setRulesOpen(true)}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Modifier les règles
              </Button>
            </div>
            <ul className="mt-3 space-y-2">
              {SEGMENT_ORDER.map((s) => (
                <li key={s} className="flex flex-wrap items-center gap-2.5 text-sm">
                  <span className={cn("w-24 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold", SEGMENT_UI[s].badge)}>
                    {SEGMENT_UI[s].label}
                  </span>
                  <span className="text-muted-foreground">{data.describe[s]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              1 visite = 1 jour avec check-in. Le groupe dépend des visites, pas de l'abonnement. Au plus 1 message tous les{" "}
              {data.rules.messageGapDays} jours par client.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Former « Nouveaux » tab, kept as it was */}
      <section className="space-y-3 pt-2">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Nouveaux</h3>
          <p className="text-sm text-muted-foreground">Qui arrive, qui revient dans les 14 jours, et ce qui fait revenir.</p>
        </div>
        <FinanceNewcomers />
      </section>

      <ClientDialog
        memberId={open?.id ?? null}
        tab={open?.tab ?? "info"}
        onTab={(tab) => setOpen((o) => (o ? { ...o, tab } : o))}
        onClose={() => setOpen(null)}
      />
      <CampaignDialog
        draft={campaign}
        onClose={() => setCampaign(null)}
        onCreated={() => toast.success("Campagne créée : retrouvez-la dans Relances › Campagnes.")}
      />
      {data ? <RulesDialog open={rulesOpen} rules={data.rules} onClose={() => setRulesOpen(false)} /> : null}
    </div>
  );
}

function ClientRow({
  row: r,
  index,
  onOpen,
  onContact,
}: {
  row: ClientListRow;
  index: number;
  onOpen: () => void;
  onContact: () => void;
}) {
  const ui = SEGMENT_UI[r.segment];
  const contactDays = r.lastContact ? differenceInCalendarDays(new Date(), parseISO(r.lastContact.at)) : null;
  return (
    <tr
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
      className="cursor-pointer border-t transition-colors duration-150 animate-in fade-in-0 fill-mode-both hover:bg-muted/50 motion-reduce:animate-none"
    >
      <td className="px-4 py-3">
        <button type="button" onClick={onOpen} className="text-left font-semibold hover:underline">
          {r.name}
        </button>
        <div className="text-xs text-muted-foreground">{r.phone ?? "Pas de téléphone"}</div>
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", ui.badge)}>{ui.label}</span>
        <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">{r.why}</div>
      </td>
      <td className="px-3 py-3">
        {shortDay(r.lastVisit)}
        <div className="text-xs text-muted-foreground">{ago(r.daysSinceLast)}</div>
      </td>
      <td className="px-3 py-3 font-semibold tabular-nums">{r.visits30}</td>
      <td className="px-3 py-3">
        {r.abonnement ? (
          <>
            <span
              className={cn(
                "font-semibold",
                r.abonnement.status === "ACTIVE" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
              )}
            >
              {r.abonnement.status === "ACTIVE" ? "Actif" : "Expiré"}
            </span>
            <div className="text-xs text-muted-foreground">
              {r.abonnement.name}
              {r.abonnement.end ? `${r.abonnement.status === "ACTIVE" ? " · fin " : " · fini le "}${shortDay(r.abonnement.end)}` : ""}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Aucun</span>
        )}
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {r.lastContact ? (
          <>
            {shortDay(r.lastContact.at)}
            <div className="text-xs">
              {channelLabel(r.lastContact.channel)} · {ago(contactDays ?? 0)}
            </div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("text-[13px] font-semibold", r.blocked || !r.action ? "text-muted-foreground" : "")}>
            {r.blocked ?? r.action?.label ?? "Rien à faire"}
          </span>
          {r.action && !r.blocked ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onContact();
              }}
              className="min-h-9 shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700"
            >
              Contacter
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

const RULE_FIELDS: Array<{ key: keyof ClientRules; label: string; unit: string; min: number; max: number }> = [
  { key: "newDays", label: "Nouveau : 1ʳᵉ visite il y a moins de", unit: "jours", min: 1, max: 30 },
  { key: "regularVisits", label: "Régulier : visites en 30 jours, au moins", unit: "visites", min: 2, max: 30 },
  { key: "riskDays", label: "À risque : régulier absent depuis", unit: "jours", min: 3, max: 60 },
  { key: "inactiveDays", label: "Inactif : pas venu depuis", unit: "jours", min: 14, max: 180 },
  { key: "messageGapDays", label: "Au plus 1 message par client tous les", unit: "jours", min: 1, max: 60 },
];

function RulesDialog({ open, rules, onClose }: { open: boolean; rules: ClientRules; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<keyof ClientRules, string>>(() => toForm(rules));
  useEffect(() => {
    if (open) setForm(toForm(rules));
  }, [open, rules]);
  const save = useMutation({
    mutationFn: () => clientsApi.updateRules(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)])) as Partial<ClientRules>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Règles enregistrées");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Règles des groupes</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {RULE_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
              <span>{f.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={form[f.key]}
                  onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                  className="h-9 w-20 rounded-lg text-right"
                />
                <span className="w-14 text-muted-foreground">{f.unit}</span>
              </span>
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const toForm = (r: ClientRules) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) as Record<keyof ClientRules, string>;
