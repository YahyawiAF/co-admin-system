"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SEGMENT_LABEL } from "@/components/admin/OutreachCampaigns";
import { advisorApi, eventsApi, outreachApi, pricesApi, productsApi, promotionsApi } from "@/lib/api/resources";
import type {
  AdviceMetric,
  AdvisorCategory,
  CampaignSegment,
  InitiativeChannel,
  InitiativeObjective,
  LinkedKind,
  TargetKind,
} from "@/lib/types";
import { CATEGORY_UI, CHANNELS, CHANNEL_UI, METRICS, METRIC_UI, OBJECTIVES, OBJECTIVE_UI, WEEK, goalUnit, today } from "./advice-ui";

/** Channels where a tracked link makes sense (not the desk, not the app itself). */
const LINK_CHANNELS: InitiativeChannel[] = ["INSTAGRAM_POST", "INSTAGRAM_STORY", "WHATSAPP", "PARTNER"];

export type DoneDraft = {
  title: string;
  /** Hint shown in the "what I did" box (the advice's first step) */
  hint?: string;
  category: AdvisorCategory;
  metric?: AdviceMetric;
  targetPct?: number;
  target?: { kind: TargetKind; days: number[]; fromHour: number; toHour: number };
  segment?: CampaignSegment;
  sourceReportId?: string;
  recommendationTitle?: string;
  /** The advice's steps, to tick as they get done */
  steps?: string[];
};

const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const HOURS = Array.from({ length: 25 }, (_, h) => h);
/** Lists that can be measured (GROUP needs a group id: not offered here). */
const LISTS: CampaignSegment[] = ["UNPAID", "ABO_EXPIRING", "ABO_ENDED", "INACTIVE", "CONVERT", "TOP_UP", "RECENT_30"];

type Form = {
  title: string;
  did: string;
  startDate: string;
  cost: string;
  kind: TargetKind;
  days: number[];
  from: string;
  to: string;
  segment: CampaignSegment;
  linkedKind: LinkedKind | "";
  linkedId: string;
  metric: AdviceMetric;
  goal: string;
  category: AdvisorCategory;
  objective: InitiativeObjective | "";
  hypothesis: string;
  channels: InitiativeChannel[];
  steps: Array<{ text: string; done: boolean }>;
  newStep: string;
};

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-lg border p-3">
      <div className="flex items-baseline gap-2 text-sm font-medium">
        {n}. {title}
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </div>
      {children}
    </div>
  );
}

/** "I did it": what was done, who it aims at, compared to what, the sale tied to it, the goal. */
export function DonePanel({
  draft,
  onClose,
  onSaved,
}: {
  draft: DoneDraft | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Form | null>(null);
  useEffect(() => {
    if (!draft) return;
    const t = draft.target;
    const allDay = !t || t.fromHour === t.toHour;
    setF({
      title: draft.title,
      did: "",
      startDate: today(),
      cost: "",
      kind: t?.kind ?? (draft.segment ? "LIST" : "ALL"),
      days: t?.kind === "SLOT" ? t.days : [],
      from: allDay ? "" : String(t!.fromHour),
      to: allDay ? "" : String(t!.toHour),
      segment: draft.segment ?? "RECENT_30",
      linkedKind: "",
      linkedId: "",
      metric: draft.metric ?? "revenuePerDay",
      goal: draft.targetPct != null ? String(draft.targetPct) : "",
      category: draft.category,
      objective: "",
      hypothesis: "",
      channels: [],
      steps: (draft.steps ?? []).map((text) => ({ text, done: false })),
      newStep: "",
    });
  }, [draft]);
  const set = (patch: Partial<Form>) => setF((x) => (x ? { ...x, ...patch } : x));

  const open = !!draft;
  const counts = useQuery({ queryKey: ["outreach-segments", null], queryFn: () => outreachApi.segments(null), enabled: open });
  const prices = useQuery({ queryKey: ["prices"], queryFn: pricesApi.list, enabled: open && f?.linkedKind === "PRICE" });
  const products = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open && f?.linkedKind === "PRODUCT" });
  const promos = useQuery({ queryKey: ["promotions"], queryFn: promotionsApi.list, enabled: open && f?.linkedKind === "PROMOTION" });
  const events = useQuery({ queryKey: ["admin-events"], queryFn: eventsApi.adminList, enabled: open && f?.linkedKind === "EVENT" });
  const items: Array<{ id: string; name: string }> =
    f?.linkedKind === "PRICE"
      ? (prices.data ?? []).filter((p) => p.isActive !== false).map((p) => ({ id: p.id, name: `${p.name} · ${p.price} DT` }))
      : f?.linkedKind === "PRODUCT"
        ? (products.data ?? []).map((p) => ({ id: p.id, name: p.name }))
        : f?.linkedKind === "PROMOTION"
          ? (promos.data ?? []).map((p) => ({ id: p.id, name: p.title }))
          : f?.linkedKind === "EVENT"
            ? (events.data ?? [])
                .filter((e) => e.status !== "CANCELLED" && new Date(e.endAt) >= new Date())
                .map((e) => ({ id: e.id, name: `${e.title} · ${e.startAt.slice(8, 10)}/${e.startAt.slice(5, 7)}` }))
            : [];
  const linkChannels = f?.linkedKind === "EVENT" && f.linkedId ? f.channels.filter((c) => LINK_CHANNELS.includes(c)) : [];

  const save = useMutation({
    mutationFn: () => {
      const x = f!;
      const hours = x.from !== "" && x.to !== "";
      return advisorApi.createInitiative({
        title: x.title.trim(),
        description: x.did.trim() || undefined,
        category: x.category,
        startDate: x.startDate,
        cost: x.cost === "" ? null : Number(x.cost),
        metric: x.metric,
        targetPct: x.goal === "" ? null : Number(x.goal.replace(",", ".").replace(/[^\d.-]/g, "")),
        targetKind: x.kind,
        targetDays: x.kind === "SLOT" ? x.days : [],
        targetFromHour: x.kind === "SLOT" && hours ? Number(x.from) : null,
        targetToHour: x.kind === "SLOT" && hours ? Number(x.to) : null,
        targetSegment: x.kind === "LIST" ? x.segment : null,
        linkedKind: x.linkedKind && x.linkedId ? x.linkedKind : null,
        linkedId: x.linkedKind && x.linkedId ? x.linkedId : null,
        sourceReportId: draft?.sourceReportId,
        recommendationTitle: draft?.recommendationTitle,
        objective: x.objective || null,
        hypothesis: x.hypothesis.trim() || null,
        channels: x.channels,
        steps: x.steps.filter((s) => s.text.trim()),
      });
    },
    onSuccess: async (created) => {
      // One tracked link per channel, ready to copy from the action card
      for (const c of linkChannels) {
        await advisorApi.createLink(created.id, c).catch(() => null);
      }
      toast.success("Enregistré : la mesure commence aujourd'hui");
      qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
      onClose();
      onSaved?.(created.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fromAdvice = !!draft?.recommendationTitle;
  const slotInvalid = f?.kind === "SLOT" && !f.days.length && (f.from === "" || f.to === "");
  const hoursInvalid = f?.kind === "SLOT" && (f.from === "") !== (f.to === "");
  const comparison =
    f?.kind === "SLOT"
      ? f.from !== "" && f.to !== ""
        ? "Les autres heures des mêmes jours. Si tout monte pareil, ce n'est pas votre action."
        : "Les autres jours de la semaine. Si tout monte pareil, ce n'est pas votre action."
      : f?.kind === "LIST"
        ? "Les autres clients, que vous n'avez pas visés. S'ils reviennent autant, l'action n'a rien changé."
        : "Pas de comparaison : on compare tout l'espace avant / après. Moins fiable, la saison peut tromper.";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b px-5 pb-3 pt-5 text-left">
          <SheetDescription>{fromAdvice ? "Je l'ai fait" : "Suivre une action"}</SheetDescription>
          <SheetTitle className="pr-6 leading-snug">{fromAdvice ? f?.title : "Nouvelle action"}</SheetTitle>
        </SheetHeader>

        {f ? (
          <form
            id="done-form"
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            {!fromAdvice ? (
              <div className="space-y-1">
                <Label htmlFor="done-title">Nom</Label>
                <Input id="done-title" value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. : café à 1,5 DT le soir" />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="done-did">Ce que j&apos;ai fait</Label>
              <Textarea
                id="done-did"
                rows={2}
                value={f.did}
                maxLength={1000}
                onChange={(e) => set({ did: e.target.value })}
                placeholder={draft?.hint ? `Ex. : ${draft.hint}` : "Ex. : affiche au comptoir, prix 6 DT au lieu de 7"}
              />
              <p className="text-xs text-muted-foreground">Ce qui diffère de l&apos;idée : prix, heure, public.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="done-start">Depuis le</Label>
                <Input id="done-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="done-cost">Ça m&apos;a coûté (DT)</Label>
                <Input id="done-cost" type="number" min={0} inputMode="decimal" value={f.cost} onChange={(e) => set({ cost: e.target.value })} placeholder="0" />
              </div>
            </div>

            <Step n={1} title="Le but" hint="ce que l'action doit vendre">
              <div className="flex flex-wrap gap-1.5">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={f.objective === o}
                    onClick={() => set({ objective: f.objective === o ? "" : o })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm transition-colors duration-200",
                      f.objective === o ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {OBJECTIVE_UI[o]}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="done-why" className="text-xs text-muted-foreground">Pourquoi ça peut marcher (une ligne)</Label>
                <Input
                  id="done-why"
                  value={f.hypothesis}
                  maxLength={300}
                  onChange={(e) => set({ hypothesis: e.target.value })}
                  placeholder="Ex. : beaucoup d'étudiants jouent, rien de ce genre dans le quartier"
                />
              </div>
            </Step>

            <Step n={2} title="Les étapes prévues" hint="coche ce qui est fait">
              {f.steps.length ? (
                <ul className="space-y-1.5">
                  {f.steps.map((s, i) => (
                    <li key={i} className="advisor-in flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Fait : ${s.text}`}
                        checked={s.done}
                        onChange={() => set({ steps: f.steps.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className={cn("flex-1 transition-colors duration-200", s.done && "text-muted-foreground")}>{s.text}</span>
                      <button
                        type="button"
                        aria-label={`Retirer : ${s.text}`}
                        onClick={() => set({ steps: f.steps.filter((_, k) => k !== i) })}
                        className="rounded px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Input
                  aria-label="Nouvelle étape"
                  value={f.newStep}
                  maxLength={200}
                  onChange={(e) => set({ newStep: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && f.newStep.trim()) {
                      e.preventDefault();
                      set({ steps: [...f.steps, { text: f.newStep.trim(), done: false }], newStep: "" });
                    }
                  }}
                  placeholder="Ex. : mettre le lien d'inscription en story"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!f.newStep.trim()}
                  onClick={() => set({ steps: [...f.steps, { text: f.newStep.trim(), done: false }], newStep: "" })}
                >
                  Ajouter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Une étape pas faite = l&apos;action n&apos;est pas encore testée.</p>
            </Step>

            <Step n={3} title="Où tu en parles" hint="les canaux">
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((c) => {
                  const on = f.channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ channels: on ? f.channels.filter((x) => x !== c) : [...f.channels, c] })}
                      className={cn(
                        "h-9 rounded-full border px-3 text-sm transition-colors duration-200",
                        on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      )}
                    >
                      {CHANNEL_UI[c]}
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step n={4} title="Qui est visé" hint="on mesure seulement ça">
              <div className="inline-flex rounded-md bg-muted p-0.5 text-sm">
                {(
                  [
                    ["SLOT", "Un créneau"],
                    ["LIST", "Des clients"],
                    ["ALL", "Tout l'espace"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set({ kind: k })}
                    className={cn(
                      "rounded px-3 py-1 font-medium transition-[background-color,color,box-shadow] duration-200",
                      f.kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {f.kind === "SLOT" ? (
                <div className="advisor-in space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {WEEK.map((w) => {
                      const on = f.days.includes(w.d);
                      return (
                        <button
                          key={w.d}
                          type="button"
                          title={w.label}
                          aria-pressed={on}
                          onClick={() => set({ days: on ? f.days.filter((d) => d !== w.d) : [...f.days, w.d] })}
                          className={cn(
                            "h-8 w-9 rounded-md border text-xs font-semibold transition-colors duration-200",
                            on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                          )}
                        >
                          {w.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Aucun jour choisi = tous les jours.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="done-from" className="text-xs text-muted-foreground">De</Label>
                      <select id="done-from" className={select} value={f.from} onChange={(e) => set({ from: e.target.value })}>
                        <option value="">Toute la journée</option>
                        {HOURS.slice(0, 24).map((h) => (
                          <option key={h} value={h}>{h}h</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="done-to" className="text-xs text-muted-foreground">À</Label>
                      <select id="done-to" className={select} value={f.to} onChange={(e) => set({ to: e.target.value })}>
                        <option value="">—</option>
                        {HOURS.slice(1).map((h) => (
                          <option key={h} value={h}>{h === 24 ? "minuit" : `${h}h`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}
              {f.kind === "LIST" ? (
                <select aria-label="Liste de clients" className={cn(select, "advisor-in")} value={f.segment} onChange={(e) => set({ segment: e.target.value as CampaignSegment })}>
                  {LISTS.map((s) => (
                    <option key={s} value={s}>
                      {SEGMENT_LABEL[s]}
                      {counts.data ? ` (${counts.data[s] ?? 0})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
            </Step>

            <Step n={5} title="Comparé à" hint="pour écarter la saison">
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{comparison}</p>
            </Step>

            <Step n={6} title="Vente liée" hint="preuve directe">
              <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                <select
                  aria-label="Type de vente liée"
                  className={select}
                  value={f.linkedKind}
                  onChange={(e) => {
                    const kind = e.target.value as LinkedKind | "";
                    set({
                      linkedKind: kind,
                      linkedId: "",
                      ...(kind === "EVENT" && !f.objective ? { objective: "TICKETS" as const } : {}),
                    });
                  }}
                >
                  <option value="">Aucune</option>
                  <option value="EVENT">Un événement</option>
                  <option value="PRICE">Une offre</option>
                  <option value="PRODUCT">Un produit</option>
                  <option value="PROMOTION">Une promo</option>
                </select>
                <select
                  aria-label="Vente liée"
                  className={select}
                  value={f.linkedId}
                  disabled={!f.linkedKind}
                  onChange={(e) => set({ linkedId: e.target.value })}
                >
                  <option value="">{f.linkedKind ? "Choisir…" : "—"}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Chaque vente de cette offre, produit ou promo est comptée pour l&apos;action. Créez-la d&apos;abord dans Services, Products ou Promotions.
              </p>
              {linkChannels.length ? (
                <p className="advisor-in rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  Un lien suivi sera créé pour : {linkChannels.map((c) => CHANNEL_UI[c]).join(", ")}. Copie-les depuis la carte de l&apos;action.
                </p>
              ) : f.linkedKind === "EVENT" && f.linkedId ? (
                <p className="advisor-in text-xs text-muted-foreground">
                  Choisis un canal (Instagram, WhatsApp…) pour avoir un lien suivi.
                </p>
              ) : null}
            </Step>

            <Step n={7} title="Objectif" hint="verdict après 14 jours">
              <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                <div className="space-y-1">
                  <Label htmlFor="done-metric" className="text-xs text-muted-foreground">Chiffre à suivre</Label>
                  <select id="done-metric" className={select} value={f.metric} onChange={(e) => set({ metric: e.target.value as AdviceMetric })}>
                    {METRICS.map((m) => (
                      <option key={m} value={m}>{METRIC_UI[m].label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="done-goal" className="text-xs text-muted-foreground">
                    Objectif ({goalUnit(f.metric).trim()})
                  </Label>
                  <Input id="done-goal" inputMode="decimal" value={f.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="+15" />
                </div>
              </div>
              {!fromAdvice ? (
                <select aria-label="Type d'action" className={select} value={f.category} onChange={(e) => set({ category: e.target.value as AdvisorCategory })}>
                  {(Object.keys(CATEGORY_UI) as AdvisorCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_UI[c].label}</option>
                  ))}
                </select>
              ) : null}
            </Step>
          </form>
        ) : null}

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            type="submit"
            form="done-form"
            disabled={!f?.title.trim() || !f.startDate || slotInvalid || hoursInvalid || save.isPending}
          >
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
