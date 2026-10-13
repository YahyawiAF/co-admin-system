"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CircleAlert,
  Crosshair,
  HelpCircle,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { advisorApi, groupsApi } from "@/lib/api/resources";
import type {
  AdvisorFact,
  AdvisorFactKind,
  AdvisorMissingItem,
  AdvisorQuestion,
} from "@/lib/types";

type Tab = "location" | "calendar" | "audiences" | "questions";

const SECTION_TAB: Partial<Record<AdvisorMissingItem["section"], Tab>> = {
  location: "location",
  neighbors: "location",
  calendar: "calendar",
  audiences: "audiences",
  questions: "questions",
};

const NEIGHBOR_TAGS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  shop: "Magasin",
  dorm: "Foyer",
  university: "Faculté",
  school: "École",
  competitor: "Concurrent",
  office: "Bureaux",
  other: "Autre",
};

const DATED_KINDS: Partial<Record<AdvisorFactKind, string>> = {
  HOLIDAY: "Jour férié",
  PERIOD: "Période",
  LOCAL_EVENT: "Événement local",
};

const PERIOD_TAGS: Record<string, string> = {
  exams: "Examens / révisions",
  vacation: "Vacances",
  ramadan: "Ramadan",
  other: "Autre",
};

const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const today = () => format(new Date(), "yyyy-MM-dd");
const day = (d: string) => format(new Date(`${d}T00:00:00`), "EEE d MMM yyyy", { locale: fr });

function useRefresh() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
    for (const k of keys) qc.invalidateQueries({ queryKey: ["advisor", k] });
  };
}

function useFactMutations() {
  const refresh = useRefresh();
  const onError = (e: Error) => toast.error(e.message);
  return {
    create: useMutation({
      mutationFn: advisorApi.createFact,
      onSuccess: () => refresh("facts", "nearby"),
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof advisorApi.updateFact>[1]) =>
        advisorApi.updateFact(id, data),
      onSuccess: () => refresh("facts"),
      onError,
    }),
    remove: useMutation({
      mutationFn: advisorApi.deleteFact,
      onSuccess: () => refresh("facts", "nearby"),
      onError,
    }),
  };
}

// ---------------- checklist ----------------

function ConfirmDates({ item }: { item: Extract<AdvisorMissingItem["action"], { type: "confirm" }> }) {
  const { update } = useFactMutations();
  const [start, setStart] = useState(item.startDate);
  const [end, setEnd] = useState(item.endDate ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" className="h-8 w-40" value={start} onChange={(e) => setStart(e.target.value)} />
      {item.endDate ? (
        <Input type="date" className="h-8 w-40" value={end} onChange={(e) => setEnd(e.target.value)} />
      ) : null}
      <Button
        size="sm"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({
            id: item.factId,
            startDate: start,
            ...(item.endDate ? { endDate: end || null } : {}),
            confirmed: true,
          })
        }
      >
        <Check className="mr-1 h-4 w-4" />
        Confirmer
      </Button>
    </div>
  );
}

function MissingChecklist({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const refresh = useRefresh();
  const missing = useQuery({ queryKey: ["advisor", "missing"], queryFn: advisorApi.missing });
  const seed = useMutation({
    mutationFn: advisorApi.seedHolidays,
    onSuccess: (r) => {
      toast.success(`${r.added} jours fériés et périodes ajoutés`);
      refresh("facts");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (missing.isLoading) return <Skeleton className="h-24" />;
  const data = missing.data;
  if (!data) return null;
  const pct = data.total ? Math.round((data.completed / data.total) * 100) : 100;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <CircleAlert className="h-4 w-4" />
            Infos manquantes pour l&apos;IA
          </div>
          <span className="text-sm text-muted-foreground">
            {data.completed}/{data.total} renseignées
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        {data.items.length ? (
          <ul className="divide-y rounded-md border">
            {data.items.map((item) => {
              const tab = SECTION_TAB[item.section];
              return (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                  {item.action?.type === "seed-holidays" ? (
                    <Button size="sm" disabled={seed.isPending} onClick={() => seed.mutate()}>
                      {seed.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Ajouter (2026–2028)
                    </Button>
                  ) : item.action?.type === "confirm" ? (
                    <ConfirmDates item={item.action} />
                  ) : item.action?.type === "link" ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={item.action.href}>Ouvrir</Link>
                    </Button>
                  ) : item.section === "context" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        document
                          .getElementById("advisor-context")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                    >
                      Compléter
                    </Button>
                  ) : tab ? (
                    <Button size="sm" variant="outline" onClick={() => onOpen(tab)}>
                      Compléter
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tout est renseigné. Pensez à ajouter les prochains examens et événements du quartier
            quand vous les connaissez.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- location & neighbours ----------------

function LocationTab({ facts }: { facts: AdvisorFact[] }) {
  const refresh = useRefresh();
  const { create, update, remove } = useFactMutations();
  const location = useQuery({ queryKey: ["advisor", "location"], queryFn: advisorApi.location });
  const [input, setInput] = useState("");
  const [radius, setRadius] = useState(700);
  const [search, setSearch] = useState(false);
  const [draft, setDraft] = useState({ title: "", tag: "restaurant", distanceM: "", detail: "" });
  const save = useMutation({
    mutationFn: advisorApi.setLocation,
    onSuccess: () => {
      toast.success("Position enregistrée");
      setInput("");
      refresh("location", "nearby");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const hasCoords = location.data?.latitude != null && location.data?.longitude != null;
  const nearby = useQuery({
    queryKey: ["advisor", "nearby", radius],
    queryFn: () => advisorApi.nearby(radius),
    enabled: search && hasCoords,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const neighbors = facts.filter((f) => f.kind === "NEIGHBOR");
  const locateMe = () => {
    if (!navigator.geolocation) return toast.error("Géolocalisation indisponible");
    navigator.geolocation.getCurrentPosition(
      (p) => save.mutate({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => toast.error("Position refusée par le navigateur"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Position de l&apos;espace</Label>
        <p className="text-xs text-muted-foreground">
          {hasCoords ? (
            <>
              {location.data!.latitude!.toFixed(5)}, {location.data!.longitude!.toFixed(5)} ·{" "}
              <a
                className="underline"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps?q=${location.data!.latitude},${location.data!.longitude}`}
              >
                vérifier sur Google Maps
              </a>
            </>
          ) : (
            "Non renseignée. Sur Google Maps : appui long sur votre espace → Partager → copier le lien."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-[240px] flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Lien Google Maps ou 36.7265, 10.2108"
          />
          <Button disabled={!input.trim() || save.isPending} onClick={() => save.mutate({ input })}>
            <MapPin className="mr-1 h-4 w-4" />
            Enregistrer
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={locateMe}>
            <Crosshair className="mr-1 h-4 w-4" />
            Ma position
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sert à la météo (Open-Meteo) et à la recherche des voisins (OpenStreetMap) : gratuits, sans
          clé. Seules les coordonnées de l&apos;espace sont envoyées.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Vos voisins ({neighbors.length})</Label>
          <div className="flex items-center gap-2">
            <select
              className={cn(select, "h-8 w-auto")}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            >
              {[300, 500, 700, 1000, 1500].map((r) => (
                <option key={r} value={r}>
                  {r} m
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasCoords || nearby.isFetching}
              onClick={() => (search ? nearby.refetch() : setSearch(true))}
            >
              {nearby.isFetching ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              Chercher autour
            </Button>
          </div>
        </div>
        {neighbors.length ? (
          <ul className="divide-y rounded-md border">
            {neighbors.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {NEIGHBOR_TAGS[n.tag ?? "other"] ?? n.tag}
                </span>
                <span className="font-medium">{n.title}</span>
                {n.distanceM != null ? (
                  <span className="text-xs text-muted-foreground">{n.distanceM} m</span>
                ) : null}
                <Input
                  className="h-8 min-w-[200px] flex-1"
                  defaultValue={n.detail ?? ""}
                  placeholder="Note : prix, clientèle, idée de partenariat…"
                  onBlur={(e) =>
                    e.target.value !== (n.detail ?? "") &&
                    update.mutate({ id: n.id, detail: e.target.value })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => remove.mutate(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {search && nearby.error ? (
          <p className="text-sm text-rose-700">{(nearby.error as Error).message}</p>
        ) : null}
        {search && nearby.data ? (
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="mb-1 text-xs text-muted-foreground">
              Trouvés sur OpenStreetMap ({nearby.data.length}). Ajoutez ceux qui comptent ; la carte
              peut être incomplète, ajoutez les autres à la main.
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {nearby.data.map((p) => (
                <li key={p.externalId} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.distanceM} m
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs">
                    {NEIGHBOR_TAGS[p.tag] ?? p.tag}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    {p.kind && p.tag === "shop" ? (
                      <span className="text-muted-foreground"> · {p.kind}</span>
                    ) : null}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={p.added || create.isPending}
                    onClick={() =>
                      create.mutate({
                        kind: "NEIGHBOR",
                        title: p.name,
                        tag: p.tag,
                        distanceM: p.distanceM,
                        detail: p.tag === "shop" && p.kind ? p.kind : null,
                        externalId: p.externalId,
                        source: "OSM",
                      })
                    }
                  >
                    {p.added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_140px_90px_1fr_auto]">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Nom (ex. : Restaurant Le Jasmin)"
          />
          <select
            className={select}
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
          >
            {Object.entries(NEIGHBOR_TAGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={0}
            value={draft.distanceM}
            onChange={(e) => setDraft({ ...draft, distanceM: e.target.value })}
            placeholder="m"
          />
          <Input
            value={draft.detail}
            onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
            placeholder="Note (optionnel)"
          />
          <Button
            disabled={!draft.title.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  kind: "NEIGHBOR",
                  title: draft.title,
                  tag: draft.tag,
                  distanceM: draft.distanceM ? Number(draft.distanceM) : null,
                  detail: draft.detail || null,
                },
                { onSuccess: () => setDraft({ ...draft, title: "", distanceM: "", detail: "" }) },
              )
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- calendar ----------------

function CalendarTab({ facts }: { facts: AdvisorFact[] }) {
  const { create, update, remove } = useFactMutations();
  const [showPast, setShowPast] = useState(false);
  const [draft, setDraft] = useState({
    kind: "PERIOD" as AdvisorFactKind,
    tag: "exams",
    title: "",
    startDate: today(),
    endDate: "",
    detail: "",
  });
  const cutoff = format(new Date(Date.now() - 30 * 86_400_000), "yyyy-MM-dd");
  const dated = facts
    .filter((f) => DATED_KINDS[f.kind] && f.startDate)
    .filter((f) => showPast || (f.endDate ?? f.startDate)! >= cutoff)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <select
              className={select}
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as AdvisorFactKind })}
            >
              {Object.entries(DATED_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {draft.kind === "PERIOD" ? (
            <div className="space-y-1">
              <Label>Période</Label>
              <select
                className={select}
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
              >
                {Object.entries(PERIOD_TAGS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1 sm:col-span-1">
            <Label>Nom</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={
                draft.kind === "LOCAL_EVENT"
                  ? "Ex. : marché hebdo, match, fête du quartier"
                  : draft.kind === "PERIOD"
                    ? "Ex. : examens fac de droit"
                    : "Ex. : pont"
              }
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Début</Label>
            <Input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Fin (optionnel)</Label>
            <Input
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Note (optionnel)</Label>
            <Input
              value={draft.detail}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              placeholder="Ex. : les étudiantes rentrent chez elles"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.title.trim() || !draft.startDate || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  kind: draft.kind,
                  tag: draft.kind === "PERIOD" ? draft.tag : null,
                  title: draft.title,
                  startDate: draft.startDate,
                  endDate: draft.endDate || null,
                  detail: draft.detail || null,
                },
                { onSuccess: () => setDraft({ ...draft, title: "", endDate: "", detail: "" }) },
              )
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Calendrier ({dated.length})</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Afficher le passé
        </label>
      </div>
      {dated.length ? (
        <ul className="divide-y rounded-md border">
          {dated.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="w-56 shrink-0 text-xs tabular-nums text-muted-foreground">
                {day(f.startDate!)}
                {f.endDate && f.endDate !== f.startDate ? ` → ${day(f.endDate)}` : ""}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {f.kind === "PERIOD" ? (PERIOD_TAGS[f.tag ?? "other"] ?? f.tag) : DATED_KINDS[f.kind]}
              </span>
              <span className="min-w-0 flex-1 font-medium">
                {f.title}
                {f.detail ? <span className="font-normal text-muted-foreground"> · {f.detail}</span> : null}
              </span>
              {!f.confirmed ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-300 text-amber-800"
                  title="Date estimée : confirmez-la quand elle est annoncée"
                  onClick={() => update.mutate({ id: f.id, confirmed: true })}
                >
                  Estimée · confirmer
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => remove.mutate(f.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Rien pour l&apos;instant.</p>
      )}
    </div>
  );
}

// ---------------- audiences ----------------

function AudiencesTab({ facts }: { facts: AdvisorFact[] }) {
  const { create, update, remove } = useFactMutations();
  const groups = useQuery({ queryKey: ["groups"], queryFn: groupsApi.list });
  const [draft, setDraft] = useState({ title: "", detail: "", memberGroupId: "" });
  const audiences = facts.filter((f) => f.kind === "AUDIENCE");
  const groupSelect = (value: string, onChange: (v: string) => void) => (
    <select className={select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pas de groupe (non mesuré)</option>
      {(groups.data ?? []).map((g) => (
        <option key={g.id} value={g.id}>
          Groupe : {g.name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Décrivez chaque type de client et ce qui le freine. Pour mesurer un public (visites, montant
        payé), mettez ses membres dans un groupe et choisissez-le ici.
      </p>
      <div className="space-y-2 rounded-md border p-3">
        <Input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Ex. : étudiantes du foyer de jeunes filles"
        />
        <Textarea
          rows={2}
          value={draft.detail}
          onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
          placeholder="Ex. : à 300 m, viennent peu, je pense que c'est trop cher pour elles ; rentrent avant 19h."
        />
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[220px] flex-1">
            {groupSelect(draft.memberGroupId, (v) => setDraft({ ...draft, memberGroupId: v }))}
          </div>
          <Button
            disabled={!draft.title.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  kind: "AUDIENCE",
                  title: draft.title,
                  detail: draft.detail || null,
                  memberGroupId: draft.memberGroupId || null,
                },
                { onSuccess: () => setDraft({ title: "", detail: "", memberGroupId: "" }) },
              )
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>
      {audiences.length ? (
        <ul className="space-y-2">
          {audiences.map((a) => (
            <li key={a.id} className="space-y-2 rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => remove.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                rows={2}
                defaultValue={a.detail ?? ""}
                onBlur={(e) =>
                  e.target.value !== (a.detail ?? "") &&
                  update.mutate({ id: a.id, detail: e.target.value })
                }
              />
              {groupSelect(a.memberGroupId ?? "", (v) =>
                update.mutate({ id: a.id, memberGroupId: v || null }),
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------- AI questions ----------------

function QuestionRow({ q }: { q: AdvisorQuestion }) {
  const refresh = useRefresh();
  const [answer, setAnswer] = useState(q.answer ?? "");
  useEffect(() => setAnswer(q.answer ?? ""), [q.answer]);
  const save = useMutation({
    mutationFn: (data: Parameters<typeof advisorApi.answerQuestion>[1]) =>
      advisorApi.answerQuestion(q.id, data),
    onSuccess: () => refresh("questions"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className={cn("space-y-2 rounded-md border p-3 text-sm", q.status !== "OPEN" && "opacity-70")}>
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 font-medium">{q.question}</span>
        {q.status === "ANSWERED" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Répondu</span>
        ) : q.status === "DISMISSED" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Ignorée</span>
        ) : null}
      </div>
      <Textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Votre réponse" />
      <div className="flex justify-end gap-2">
        {q.status === "OPEN" ? (
          <Button size="sm" variant="ghost" onClick={() => save.mutate({ status: "DISMISSED" })}>
            Ignorer
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={save.isPending || answer === (q.answer ?? "")}
          onClick={() => save.mutate({ answer })}
        >
          Enregistrer
        </Button>
      </div>
    </li>
  );
}

function QuestionsTab() {
  const questions = useQuery({ queryKey: ["advisor", "questions"], queryFn: advisorApi.questions });
  if (questions.isLoading) return <Skeleton className="h-24" />;
  const list = questions.data ?? [];
  return list.length ? (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Les questions posées par l&apos;IA dans ses rapports. Vos réponses sont envoyées avec la
        prochaine analyse, et elle ne les reposera pas.
      </p>
      <ul className="space-y-2">
        {list.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
      </ul>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Aucune question pour l&apos;instant : elles apparaissent ici après chaque analyse.
    </p>
  );
}

// ---------------- panel ----------------

export function AdvisorContextPanel() {
  const [tab, setTab] = useState<Tab>("location");
  const facts = useQuery({ queryKey: ["advisor", "facts"], queryFn: advisorApi.facts });
  const list = facts.data ?? [];
  const open = (t: Tab) => {
    setTab(t);
    document.getElementById("advisor-context-tabs")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="space-y-3">
      <MissingChecklist onOpen={open} />
      <Card className="shadow-none" id="advisor-context-tabs">
        <CardContent className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="location">
                <MapPin className="mr-1 h-4 w-4" />
                Carte &amp; voisins
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays className="mr-1 h-4 w-4" />
                Calendrier
              </TabsTrigger>
              <TabsTrigger value="audiences">
                <Users className="mr-1 h-4 w-4" />
                Clientèle
              </TabsTrigger>
              <TabsTrigger value="questions">
                <HelpCircle className="mr-1 h-4 w-4" />
                Questions IA
              </TabsTrigger>
            </TabsList>
            {facts.isLoading ? (
              <Skeleton className="mt-4 h-40" />
            ) : (
              <>
                <TabsContent value="location" className="mt-4">
                  <LocationTab facts={list} />
                </TabsContent>
                <TabsContent value="calendar" className="mt-4">
                  <CalendarTab facts={list} />
                </TabsContent>
                <TabsContent value="audiences" className="mt-4">
                  <AudiencesTab facts={list} />
                </TabsContent>
                <TabsContent value="questions" className="mt-4">
                  <QuestionsTab />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
