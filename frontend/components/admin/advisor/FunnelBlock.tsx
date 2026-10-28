"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdminOrg } from "@/lib/admin-org-context";
import { advisorApi } from "@/lib/api/resources";
import type { BusinessInitiative, InitiativeChannel } from "@/lib/types";
import { CHANNEL_UI, DIAGNOSIS_UI, copyText, today } from "./advice-ui";

const LINK_CHANNELS: InitiativeChannel[] = ["INSTAGRAM_STORY", "INSTAGRAM_POST", "WHATSAPP", "PARTNER"];

const nf = (n: number) => n.toLocaleString("fr-FR");

/** "Pas encore testé / Blocage trouvé…": what we know, what is not proven, what to do now. */
export function DiagnosisBanner({ item }: { item: BusinessInitiative }) {
  const d = item.diagnosis;
  const ui = DIAGNOSIS_UI[d.status];
  return (
    // key: a new status mounts again, so the change is seen
    <div key={d.status} className={cn("advisor-in space-y-2.5 rounded-lg border p-3", ui.box)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", ui.badge)}>
          {ui.label}
        </span>
        <span className="text-sm font-semibold leading-snug">{d.title}</span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {d.known.length ? (
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">Ce qu&apos;on sait</div>
            {d.known.map((k) => (
              <div key={k} className="leading-snug">• {k}</div>
            ))}
          </div>
        ) : null}
        {d.unproven.length ? (
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">Pas encore prouvé</div>
            {d.unproven.map((u) => (
              <div key={u} className="leading-snug text-muted-foreground">• {u}</div>
            ))}
          </div>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-medium text-muted-foreground">À faire maintenant</div>
          <div className="font-semibold leading-snug">{d.next}</div>
        </div>
      </div>
    </div>
  );
}

/** Planned steps, ticked as they get done; an undone step means the action is not tested yet. */
export function StepsChecklist({ item }: { item: BusinessInitiative }) {
  const qc = useQueryClient();
  const [steps, setSteps] = useState(item.steps);
  const [text, setText] = useState("");
  useEffect(() => setSteps(item.steps), [item.steps]);
  const save = useMutation({
    mutationFn: (next: BusinessInitiative["steps"]) => advisorApi.updateInitiative(item.id, { steps: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] }),
    onError: (e: Error) => {
      setSteps(item.steps);
      toast.error(e.message);
    },
  });
  // Ticks show at once; the diagnosis follows when the server answers
  const commit = (next: BusinessInitiative["steps"]) => {
    setSteps(next);
    save.mutate(next);
  };
  const add = () => {
    const t = text.trim();
    if (!t) return;
    commit([...steps, { text: t, done: false }]);
    setText("");
  };
  const blocking = item.diagnosis.status === "NOT_TESTED" ? item.diagnosis.brokenStep : null;
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Étapes prévues</div>
        {steps.length ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done} sur {steps.length} faites
          </span>
        ) : null}
      </div>
      {steps.length ? (
        <ul className="space-y-1.5">
          {steps.map((s, i) => (
            <li
              key={`${i}-${s.text}`}
              className="advisor-in flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <button
                type="button"
                aria-pressed={s.done}
                aria-label={`${s.done ? "Décocher" : "Cocher"} : ${s.text}`}
                onClick={() =>
                  commit(steps.map((x, k) => (k === i ? { ...x, done: !x.done, doneAt: !x.done ? today() : null } : x)))
                }
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-[background-color,border-color,transform] duration-200 active:scale-90 motion-reduce:transition-none",
                  s.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 bg-background hover:border-slate-600",
                )}
              >
                {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm leading-snug transition-colors duration-200", s.done && "text-muted-foreground")}>
                  {s.text}
                </div>
                <div className="text-[11px] text-muted-foreground">{s.done ? (s.doneAt ? `fait le ${s.doneAt.slice(8, 10)}/${s.doneAt.slice(5, 7)}` : "fait") : "pas fait"}</div>
              </div>
              {!s.done && blocking === s.text ? (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                  bloque le test
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Retirer : ${s.text}`}
                onClick={() => commit(steps.filter((_, k) => k !== i))}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          aria-label="Ajouter une étape"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter une étape"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!text.trim() || save.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

/** Seen → opened → registered → paid → came, with the broken stage marked. */
export function FunnelBars({ item }: { item: BusinessInitiative }) {
  const stages = item.funnel ?? [];
  if (!stages.length) return null;
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  const d = item.diagnosis;
  const broken = d.status === "NOT_TESTED" || d.status === "BOTTLENECK" || d.status === "MISSING_DATA" ? d.stage : null;
  return (
    <div className="min-w-0 space-y-2">
      <div className="text-sm font-semibold">Entonnoir</div>
      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const isBroken = s.key === broken;
          const pct = s.value == null ? 0 : Math.max(s.value ? 2 : 0, Math.round((s.value / max) * 100));
          return (
            <div key={s.key} className={cn("rounded-lg border px-2.5 py-1.5 transition-colors duration-300", isBroken && "border-orange-300 bg-orange-50/60")}>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{s.label}</span>
                <span className="truncate text-[11px] text-muted-foreground">{s.source}</span>
                <span className="ml-auto text-sm font-bold tabular-nums">
                  {s.value != null ? nf(s.value) : s.pending ? "après l'événement" : "à saisir"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none",
                    isBroken ? "bg-orange-500" : s.value == null ? "bg-slate-300" : "bg-blue-600",
                  )}
                  style={{ width: `${pct}%`, transitionDelay: `${i * 40}ms` }}
                />
              </div>
              <div className="mt-0.5 flex text-[11px] text-muted-foreground">
                <span>{s.rate != null && i > 0 ? `${nf(s.rate)} % de l'étape d'avant` : ""}</span>
                {isBroken ? <span className="ml-auto font-semibold text-orange-800">← ça bloque ici</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The one figure the owner types: views from Instagram › Statistiques. */
export function ReachInput({ item }: { item: BusinessInitiative }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(item.reach != null ? String(item.reach) : "");
  useEffect(() => setValue(item.reach != null ? String(item.reach) : ""), [item.reach]);
  const save = useMutation({
    mutationFn: (reach: number | null) =>
      advisorApi.updateInitiative(item.id, { manualFunnel: reach == null ? [] : [{ date: today(), reach }] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!item.funnel?.some((s) => s.key === "seen") || item.linked?.kind !== "EVENT") return null;
  const n = Number(value);
  const changed = value !== (item.reach != null ? String(item.reach) : "");
  return (
    <form
      className="space-y-1.5 rounded-lg border p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(value === "" ? null : Math.round(n));
      }}
    >
      <label htmlFor={`reach-${item.id}`} className="text-sm font-medium">
        Vues Instagram <span className="font-normal text-muted-foreground">(Instagram › Statistiques)</span>
      </label>
      <div className="flex gap-2">
        <Input
          id={`reach-${item.id}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ex. 800"
          className="h-8 w-32 text-sm"
        />
        <Button type="submit" size="sm" disabled={!changed || (value !== "" && !(n >= 0)) || save.isPending}>
          Enregistrer
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Le seul chiffre à taper : le reste vient de l&apos;app.</p>
    </form>
  );
}

/** Tracked links per channel: copy, see opens, add one. */
export function ShareLinks({ item }: { item: BusinessInitiative }) {
  const qc = useQueryClient();
  const { organization } = useAdminOrg();
  const [copied, setCopied] = useState<string | null>(null);
  const done = (next: BusinessInitiative) => {
    qc.setQueryData<BusinessInitiative[]>(["advisor", "initiatives"], (list) => list?.map((x) => (x.id === next.id ? next : x)));
    qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
  };
  const create = useMutation({
    mutationFn: (c: InitiativeChannel) => advisorApi.createLink(item.id, c),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (linkId: string) => advisorApi.deleteLink(item.id, linkId),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  if (item.linked?.kind !== "EVENT") return null;
  const base = typeof window !== "undefined" && organization?.slug ? `${window.location.origin}/m/${organization.slug}/l/` : null;
  const missing = LINK_CHANNELS.filter((c) => !item.links.some((l) => l.channel === c));
  const copy = async (code: string) => {
    if (!base) return;
    await copyText(base + code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        Liens de partage suivis
      </div>
      {item.links.length ? (
        <ul className="space-y-1">
          {item.links.map((l) => (
            <li key={l.id} className="advisor-in flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="min-w-[7.5rem]">{CHANNEL_UI[l.channel]}</span>
              <code className="rounded border bg-background px-1.5 py-0.5 text-xs">…/l/{l.code}</code>
              <span className="text-xs font-semibold tabular-nums">
                {l.opens} ouverture{l.opens > 1 ? "s" : ""}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!base} onClick={() => copy(l.code)}>
                  {copied === l.code ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                  {copied === l.code ? "Copié" : "Copier"}
                </Button>
                <button
                  type="button"
                  aria-label={`Supprimer le lien ${CHANNEL_UI[l.channel]}`}
                  onClick={() => {
                    if (confirm("Supprimer ce lien ? Il ne marchera plus.")) remove.mutate(l.id);
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun lien : crée-en un et partage-le, sinon personne ne peut s&apos;inscrire depuis Instagram.</p>
      )}
      {missing.length ? (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((c) => (
            <Button key={c} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={create.isPending} onClick={() => create.mutate(c)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {CHANNEL_UI[c]}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">L&apos;app compte les ouvertures et marque les inscriptions venues du lien.</p>
    </div>
  );
}
