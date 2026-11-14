"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/api/resources";
import type { HouseRule, HouseRulesFrequency, HouseRulesSettings as Settings } from "@/lib/types";
import { HouseRuleTiles, RuleIcon } from "@/components/visitor/HouseRules";
import { cn } from "@/lib/utils";

const ICONS = ["💧🥤🥛☕", "🥤", "🍔", "🔊", "📞", "🎧", "🧹", "👋", "🚭", "🐶", "📵", "💻", "🔌", "🪑", "🗑️", "🤫", "⏱️", "🙏", "📌"];

const FREQ: { value: HouseRulesFrequency; label: string; hint: string }[] = [
  { value: "ONCE", label: "Une seule fois", hint: "Revient seulement si vous modifiez les règles." },
  { value: "DAILY", label: "1× par jour", hint: "Au plus une fois par jour, au moment choisi." },
  { value: "ALWAYS", label: "À chaque fois", hint: "À chaque ouverture de l'app / chaque pointage." },
];

function RuleRow({
  rule,
  first,
  last,
  onChange,
  onMove,
  onDelete,
}: {
  rule: HouseRule;
  first: boolean;
  last: boolean;
  onChange: (r: HouseRule) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className={cn("rounded-xl border p-2.5 transition-opacity duration-200", !rule.active && "opacity-55")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl transition-colors hover:bg-slate-200"
          aria-label="Changer l'image"
        >
          <RuleIcon icon={rule.icon} size={20} />
        </button>
        <div className="flex shrink-0 overflow-hidden rounded-full border text-xs font-bold">
          {(["NO", "DO"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...rule, kind: k })}
              className={cn(
                "px-2.5 py-1.5 transition-colors duration-200",
                rule.kind === k
                  ? k === "NO"
                    ? "bg-rose-600 text-white"
                    : "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {k === "NO" ? "Interdit" : "À faire"}
            </button>
          ))}
        </div>
        <Input
          className="h-9 min-w-[10rem] flex-1"
          value={rule.text}
          maxLength={60}
          placeholder="2–3 mots, ex. : Place propre"
          onChange={(e) => onChange({ ...rule, text: e.target.value })}
        />
        <div className="flex items-center gap-1">
          <Switch
            checked={rule.active}
            onCheckedChange={(v) => onChange({ ...rule, active: v })}
            aria-label="Afficher cette règle"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={first} onClick={() => onMove(-1)} aria-label="Monter">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={last} onClick={() => onMove(1)} aria-label="Descendre">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={onDelete} aria-label="Supprimer">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {picking ? (
        <div className="mt-2 flex animate-in fade-in-0 slide-in-from-top-1 flex-wrap gap-1 duration-200">
          {ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => {
                onChange({ ...rule, icon: ic });
                setPicking(false);
              }}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg text-lg transition-colors hover:bg-slate-100",
                rule.icon === ic && "bg-indigo-100"
              )}
            >
              <RuleIcon icon={ic} size={18} />
            </button>
          ))}
          <Input
            className="h-9 w-20"
            placeholder="Autre"
            maxLength={16}
            onChange={(e) => e.target.value.trim() && onChange({ ...rule, icon: e.target.value.trim() })}
          />
        </div>
      ) : null}
    </div>
  );
}

function Readers() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const { data, isLoading } = useQuery({
    queryKey: ["house-rules-readers", page, filter],
    queryFn: () => analyticsApi.houseRulesReaders({ page, filter }),
    placeholderData: (prev) => prev,
  });
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Qui a lu{data ? ` · ${data.read} / ${data.total}` : ""}
        </CardTitle>
        <div className="flex gap-1">
          {(
            [
              ["all", "Tous"],
              ["read", "Lu"],
              ["unread", "Pas encore"],
            ] as const
          ).map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant={filter === v ? "default" : "outline"}
              className="h-7 rounded-full text-xs"
              onClick={() => {
                setFilter(v);
                setPage(1);
              }}
            >
              {l}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading && !data ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {data?.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Personne pour l&apos;instant.</p>
        ) : null}
        {data?.items.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 border-b border-dashed py-1.5 text-sm last:border-0">
            <span className="min-w-0 truncate">
              {m.name}
              {m.phone ? <span className="ml-2 text-xs text-muted-foreground">{m.phone}</span> : null}
            </span>
            {m.upToDate && m.acceptedAt ? (
              <span className="shrink-0 text-xs font-bold text-emerald-700">
                Lu · {format(new Date(m.acceptedAt), "dd/MM HH:mm")}
              </span>
            ) : m.acceptedAt ? (
              <span className="shrink-0 text-xs font-bold text-amber-700">Ancienne version</span>
            ) : (
              <span className="shrink-0 text-xs font-bold text-amber-700">Pas encore</span>
            )}
          </div>
        ))}
        {data && data.pages > 1 ? (
          <div className="flex items-center justify-end gap-2 pt-2 text-xs">
            <Button size="sm" variant="outline" className="h-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="tabular-nums">
              {page} / {data.pages}
            </span>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function HouseRulesSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["house-rules-settings"], queryFn: () => analyticsApi.houseRules() });
  const [rules, setRules] = useState<HouseRule[]>([]);
  useEffect(() => {
    if (data) setRules(data.rules);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<Omit<Settings, "facilityId" | "version">>) =>
      analyticsApi.updateHouseRules(undefined, body),
    onSuccess: (res, body) => {
      const bumped = data && res.version !== data.version;
      qc.setQueryData(["house-rules-settings"], res);
      void qc.invalidateQueries({ queryKey: ["house-rules-readers"] });
      if (body.rules) {
        toast.success(bumped ? "Règlement enregistré · tout le monde le relira une fois" : "Règlement enregistré");
      } else {
        toast.success("Enregistré");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = !!data && JSON.stringify(rules) !== JSON.stringify(data.rules);
  const update = (i: number, r: HouseRule) => setRules((list) => list.map((x, j) => (j === i ? r : x)));
  const move = (i: number, dir: -1 | 1) =>
    setRules((list) => {
      const next = [...list];
      const [r] = next.splice(i, 1);
      next.splice(i + dir, 0, r);
      return next;
    });

  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  const shown = rules.filter((r) => r.active && r.text.trim());

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Les règles</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rules.length >= 20}
                onClick={() =>
                  setRules((l) => [...l, { id: `r${Date.now()}`, icon: "📌", text: "", kind: "DO", active: true }])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
              <Button
                size="sm"
                disabled={!dirty || save.isPending}
                onClick={() => save.mutate({ rules })}
              >
                Enregistrer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Une image + 2–3 mots. Rouge = interdit, vert = à faire. Modifier une règle visible = chaque visiteur la relit une fois.
            </p>
            {rules.map((r, i) => (
              <RuleRow
                key={r.id}
                rule={r}
                first={i === 0}
                last={i === rules.length - 1}
                onChange={(n) => update(i, n)}
                onMove={(d) => move(i, d)}
                onDelete={() => setRules((l) => l.filter((_, j) => j !== i))}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quand l&apos;afficher</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
              <div>
                <p className="text-sm font-semibold">Après l&apos;inscription</p>
                <p className="text-xs text-muted-foreground">Nom + numéro → règlement. Toujours.</p>
              </div>
              <Switch checked disabled aria-label="Toujours après l'inscription" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold">À l&apos;ouverture de l&apos;app</p>
                <p className="text-xs text-muted-foreground">Au premier écran, selon la fréquence.</p>
              </div>
              <Switch
                checked={data.onOpen}
                disabled={save.isPending}
                onCheckedChange={(v) => save.mutate({ onOpen: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold">Avant de choisir le forfait</p>
                <p className="text-xs text-muted-foreground">Juste après « Pointer mon arrivée ».</p>
              </div>
              <Switch
                checked={data.beforeForfait}
                disabled={save.isPending}
                onCheckedChange={(v) => save.mutate({ beforeForfait: v })}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Combien de fois</p>
              <div className="flex flex-wrap gap-1.5">
                {FREQ.map((f) => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={data.frequency === f.value ? "default" : "outline"}
                    className="rounded-full"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ frequency: f.value })}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {FREQ.find((f) => f.value === data.frequency)?.hint}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu visiteur</CardTitle>
          </CardHeader>
          <CardContent>
            {shown.length ? (
              <HouseRuleTiles rules={shown} animate={false} />
            ) : (
              <p className="text-sm text-muted-foreground">Aucune règle visible : le modal ne s&apos;affiche pas.</p>
            )}
          </CardContent>
        </Card>
        <Readers />
      </div>
    </div>
  );
}
