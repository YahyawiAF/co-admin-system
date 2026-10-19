"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ClipboardPaste,
  Coffee,
  Copy,
  HelpCircle,
  Loader2,
  Megaphone,
  Plus,
  Rocket,
  Send,
  Settings2,
  Sparkles,
  Tags,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import { AdvisorContextPanel } from "@/components/admin/advisor/AdvisorContextPanel";
import { CampaignDialog, SEGMENT_LABEL, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import { useRouter } from "next/navigation";
import type {
  AdvisorCategory,
  AdvisorRecommendation,
  AdvisorResult,
  BusinessInitiative,
} from "@/lib/types";

const CATEGORY_UI: Record<
  AdvisorCategory,
  { label: string; icon: typeof Sparkles; tone: string }
> = {
  NEW_REVENUE: { label: "Nouveau revenu", icon: Rocket, tone: "bg-emerald-100 text-emerald-800" },
  PROMO: { label: "Promo", icon: Megaphone, tone: "bg-violet-100 text-violet-800" },
  PRICING: { label: "Prix & formules", icon: Tags, tone: "bg-sky-100 text-sky-800" },
  CAFE: { label: "Café", icon: Coffee, tone: "bg-amber-100 text-amber-800" },
  RETENTION: { label: "Fidélisation", icon: UserCheck, tone: "bg-rose-100 text-rose-700" },
  OPERATIONS: { label: "Organisation", icon: Settings2, tone: "bg-slate-100 text-slate-700" },
};

const LEVEL: Record<"high" | "medium" | "low", string> = {
  high: "élevé",
  medium: "moyen",
  low: "faible",
};

const VERDICT_UI = {
  working: { label: "Ça marche", tone: "bg-emerald-600 text-white" },
  not_working: { label: "Pas d'effet", tone: "bg-rose-100 text-rose-700" },
  too_early: { label: "Trop tôt pour dire", tone: "bg-muted text-muted-foreground" },
} as const;

const PERIODS = [14, 30, 60, 90];
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;
const today = () => format(new Date(), "yyyy-MM-dd");

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ContextCard({ value }: { value: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = useMutation({
    mutationFn: () => advisorApi.saveSettings({ businessContext: text }),
    onSuccess: () => {
      toast.success("Contexte enregistré");
      qc.invalidateQueries({ queryKey: ["advisor", "settings"] });
      qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="shadow-none" id="advisor-context">
      <CardContent className="space-y-2 p-4">
        <div>
          <div className="font-medium">Votre contexte</div>
          <p className="text-sm text-muted-foreground">
            Ce que l&apos;IA ne peut pas voir dans les chiffres : quartier, type de clients,
            concurrents et leurs prix, vos objectifs, ce que vous avez déjà essayé.
          </p>
        </div>
        <Textarea
          rows={4}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. : près de la fac, surtout des étudiants et des freelances. Un café à côté vend l'expresso 2,5 DT. Objectif : remplir les après-midis."
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending || text === value}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function recommendationBlock(rec: AdvisorRecommendation) {
  const ui = CATEGORY_UI[rec.category] ?? CATEGORY_UI.OPERATIONS;
  const lines = [
    ui.label,
    `Priorité ${LEVEL[rec.priority]} · Effort ${LEVEL[rec.effort]}`,
    "",
    rec.title,
    "",
    `Pourquoi : ${rec.evidence}`,
  ];
  if (rec.actions.length) {
    lines.push("");
    rec.actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("", `Gain estimé : ${rec.expectedImpact}`, `À surveiller : ${rec.measure}`);
  const relance = rec.outreach && rec.outreach.segment !== "NONE" ? rec.outreach : null;
  if (relance) {
    const segment =
      SEGMENT_LABEL[relance.segment as keyof typeof SEGMENT_LABEL] ?? relance.segment;
    lines.push("", `Relance proposée · ${segment}`, relance.message);
  }
  return lines.join("\n");
}

function RecommendationCard({
  rec,
  onStart,
  onRelance,
}: {
  rec: AdvisorRecommendation;
  onStart: () => void;
  onRelance: () => void;
}) {
  const relance = rec.outreach && rec.outreach.segment !== "NONE" ? rec.outreach : null;
  const ui = CATEGORY_UI[rec.category] ?? CATEGORY_UI.OPERATIONS;
  const Icon = ui.icon;
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", ui.tone)}>
          <Icon className="h-3.5 w-3.5" />
          {ui.label}
        </span>
        <span className="text-muted-foreground">
          Priorité {LEVEL[rec.priority]} · Effort {LEVEL[rec.effort]}
        </span>
      </div>
      <div className="font-semibold">{rec.title}</div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Pourquoi : </span>
        {rec.evidence}
      </p>
      {rec.actions.length ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {rec.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      ) : null}
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
          <div className="text-xs font-medium uppercase tracking-wide opacity-70">Gain estimé</div>
          {rec.expectedImpact}
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            À surveiller
          </div>
          {rec.measure}
        </div>
      </div>
      {relance ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            Relance proposée · {SEGMENT_LABEL[relance.segment as keyof typeof SEGMENT_LABEL]}
          </div>
          <p className="mt-0.5 text-emerald-950">{relance.message}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => copyText(recommendationBlock(rec))}>
          <Copy className="mr-1.5 h-4 w-4" />
          Copier
        </Button>
        <Button size="sm" variant={relance ? "default" : "outline"} onClick={onRelance}>
          <Send className="mr-1.5 h-4 w-4" />
          {relance ? "Relancer les clients" : "Créer une relance"}
        </Button>
        <Button size="sm" variant={relance ? "outline" : "default"} onClick={onStart}>
          <Rocket className="mr-1.5 h-4 w-4" />
          Je le lance
        </Button>
      </div>
    </li>
  );
}

function Delta({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone = value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-muted-foreground";
  return (
    <span className={cn("font-semibold tabular-nums", tone)}>
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function InitiativeCard({
  item,
  review,
}: {
  item: BusinessInitiative;
  review?: AdvisorResult["initiativeReviews"][number];
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
  const stop = useMutation({
    mutationFn: () => advisorApi.updateInitiative(item.id, { endDate: today() }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => advisorApi.deleteInitiative(item.id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const ui = CATEGORY_UI[item.category] ?? CATEGORY_UI.OPERATIONS;
  const m = item.impact;
  const rows: Array<[string, (x: NonNullable<typeof m>["before"]) => string]> = [
    ["Revenu / jour", (x) => dt(x.revenuePerDay)],
    ["Visites / jour", (x) => String(x.visitsPerDay)],
    ["Café (total)", (x) => dt(x.revenueCafe)],
    ["Durée moyenne", (x) => (x.avgStayHours != null ? `${x.avgStayHours} h` : "—")],
    ["Nouveaux membres", (x) => String(x.newMembers)],
  ];
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{item.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs", ui.tone)}>{ui.label}</span>
            {item.endDate ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Arrêtée</span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Depuis le {format(new Date(item.startDate), "d MMMM yyyy", { locale: fr })}
            {item.endDate
              ? ` jusqu'au ${format(new Date(item.endDate), "d MMMM yyyy", { locale: fr })}`
              : ` · ${item.daysSinceStart} jours`}
          </div>
          {item.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <div className="flex gap-1">
          {!item.endDate ? (
            <Button size="sm" variant="outline" disabled={stop.isPending} onClick={() => stop.mutate()}>
              Arrêter
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            title="Supprimer"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Supprimer « ${item.title} » ?`)) remove.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {m ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Revenu / jour <Delta value={m.changePct.revenuePerDay} />
            </span>
            <span>
              Visites / jour <Delta value={m.changePct.visitsPerDay} />
            </span>
            <span>
              Café <Delta value={m.changePct.revenueCafe} />
            </span>
            <span className="rounded-md bg-muted/60 px-2 py-0.5">
              {m.extraRevenue >= 0 ? "+" : ""}
              {dt(m.extraRevenue)} sur {m.comparedDays} j
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-normal" />
                  <th className="py-1 pr-3 font-normal">
                    Avant ({m.comparedDays} j)
                  </th>
                  <th className="py-1 font-normal">Après</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map(([label, get]) => (
                  <tr key={label} className="border-t">
                    <td className="py-1 pr-3 text-muted-foreground">{label}</td>
                    <td className="py-1 pr-3">{get(m.before)}</td>
                    <td className="py-1 font-medium">{get(m.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Les mesures commencent à la date de début.</p>
      )}

      {review ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span
            className={cn(
              "mr-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              VERDICT_UI[review.verdict].tone,
            )}
          >
            {VERDICT_UI[review.verdict].label}
          </span>
          {review.detail}
        </div>
      ) : null}
    </li>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Non-HTTPS origins have no clipboard API: fall back to a hidden textarea
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
  toast.success("Copié dans le presse-papiers");
}

/** Without an API key: copy the exact prompt, paste it into claude.ai, paste the JSON back. */
function ManualCard({ days, onImported }: { days: number; onImported: (id: string) => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"chat" | "system" | "user" | "schema" | null>(null);
  const [answer, setAnswer] = useState("");
  const prompt = useQuery({
    queryKey: ["advisor", "prompt", days],
    queryFn: () => advisorApi.prompt(days),
    enabled: false,
  });
  const load = async () => (await prompt.refetch()).data;
  const importReport = useMutation({
    mutationFn: () => advisorApi.importReport(days, answer),
    onSuccess: (r) => {
      toast.success("Rapport enregistré");
      setAnswer("");
      qc.invalidateQueries({ queryKey: ["advisor", "reports"] });
      onImported(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const parts = prompt.data
    ? {
        chat: prompt.data.chat,
        system: prompt.data.system,
        user: prompt.data.user,
        schema: JSON.stringify(prompt.data.schema, null, 2),
      }
    : null;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="font-medium">Sans clé API : copier-coller dans Claude</div>
          <p className="text-sm text-muted-foreground">
            1. Copiez le prompt ({days} jours) — ce sont exactement les instructions et les chiffres
            envoyés à l&apos;API. 2. Collez-le sur claude.ai (modèle Opus, réflexion étendue
            activée). 3. Collez la réponse JSON ci-dessous pour l&apos;afficher ici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={prompt.isFetching}
            onClick={async () => {
              const d = await load();
              if (d) await copyText(d.chat);
            }}
          >
            {prompt.isFetching ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            Copier le prompt complet
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={prompt.isFetching}
            onClick={async () => {
              if (!parts) await load();
              setView(view ? null : "chat");
            }}
          >
            {view ? "Masquer" : "Voir les données"}
          </Button>
        </div>
        {view && parts ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["chat", "Tout (chat)"],
                  ["system", "Prompt système"],
                  ["user", "Données (message)"],
                  ["schema", "Schéma JSON"],
                ] as const
              ).map(([k, label]) => (
                <FilterChip key={k} active={view === k} onClick={() => setView(k)}>
                  {label}
                </FilterChip>
              ))}
              <Button size="sm" variant="ghost" onClick={() => copyText(parts[view])}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copier
              </Button>
              <span className="text-xs text-muted-foreground">
                {parts[view].length.toLocaleString("fr-FR")} caractères
              </span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 text-xs">
              {view === "user" ? JSON.stringify(prompt.data!.snapshot, null, 2) : parts[view]}
            </pre>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="advisor-answer">Réponse de Claude (JSON)</Label>
          <Textarea
            id="advisor-answer"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder='{"summary": "…", "highlights": […], "recommendations": […], …}'
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!answer.trim() || importReport.isPending}
              onClick={() => importReport.mutate()}
            >
              <ClipboardPaste className="mr-1.5 h-4 w-4" />
              Enregistrer la réponse
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type Draft = {
  title: string;
  description: string;
  category: AdvisorCategory;
  startDate: string;
  sourceReportId?: string;
};

function InitiativeDialog({
  draft,
  onClose,
}: {
  draft: Draft | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Draft | null>(draft);
  useEffect(() => setForm(draft), [draft]);
  const create = useMutation({
    mutationFn: (d: Draft) => advisorApi.createInitiative(d),
    onSuccess: () => {
      toast.success("Initiative ajoutée : son effet sera mesuré automatiquement");
      qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suivre une initiative</DialogTitle>
          <DialogDescription>
            Notez quand vous lancez un changement : l&apos;app compare les chiffres avant et après.
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ini-title">Nom</Label>
              <Input
                id="ini-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex. : vente de café"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ini-desc">Détails (optionnel)</Label>
              <Textarea
                id="ini-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ini-cat">Type</Label>
                <select
                  id="ini-cat"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as AdvisorCategory })
                  }
                >
                  {(Object.keys(CATEGORY_UI) as AdvisorCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_UI[c].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ini-start">Date de début</Label>
                <Input
                  id="ini-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!form?.title.trim() || !form.startDate || create.isPending}
            onClick={() =>
              form &&
              create.mutate({ ...form, description: form.description.trim() })
            }
          >
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportView({
  result,
  reportId,
  onStart,
  onRelance,
}: {
  result: AdvisorResult;
  reportId: string;
  onStart: (d: Draft) => void;
  onRelance: (d: CampaignDraft) => void;
}) {
  const [filter, setFilter] = useState<AdvisorCategory | "ALL">("ALL");
  const counts: Partial<Record<AdvisorCategory, number>> = {};
  for (const r of result.recommendations) counts[r.category] = (counts[r.category] ?? 0) + 1;
  const recs = result.recommendations.filter((r) => filter === "ALL" || r.category === filter);
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="space-y-3 p-4">
          <p className="leading-relaxed">{result.summary}</p>
          {result.highlights.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.highlights.map((h, i) => {
                const Icon =
                  h.trend === "up" ? ArrowUpRight : h.trend === "down" ? ArrowDownRight : ArrowRight;
                return (
                  <li key={i} className="flex gap-2 rounded-md border p-3 text-sm">
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        h.trend === "up"
                          ? "text-emerald-600"
                          : h.trend === "down"
                            ? "text-rose-600"
                            : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <div className="font-medium">{h.title}</div>
                      <div className="text-muted-foreground">{h.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          Toutes · {result.recommendations.length}
        </FilterChip>
        {(Object.keys(CATEGORY_UI) as AdvisorCategory[]).map((c) =>
          counts[c] ? (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {CATEGORY_UI[c].label} · {counts[c]}
            </FilterChip>
          ) : null,
        )}
      </div>

      <ul className="space-y-3">
        {recs.map((r, i) => (
          <RecommendationCard
            key={`${r.title}-${i}`}
            rec={r}
            onStart={() =>
              onStart({
                title: r.title,
                description: r.actions.join("\n"),
                category: r.category,
                startDate: today(),
                sourceReportId: reportId,
              })
            }
            onRelance={() =>
              onRelance({
                title: r.title,
                message: r.outreach?.message ?? "",
                segment:
                  r.outreach && r.outreach.segment !== "NONE" ? r.outreach.segment : undefined,
                sourceReportId: reportId,
                recommendationTitle: r.title,
                category: r.category,
                trackAsInitiative: true,
              })
            }
          />
        ))}
      </ul>

      {result.questions.length ? (
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 font-medium">
              <HelpCircle className="h-4 w-4" />
              Pour des conseils plus précis
            </div>
            <p className="text-sm text-muted-foreground">
              Répondez à ces questions dans « Votre contexte », puis relancez l&apos;analyse.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function ConseillerPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [relanceDraft, setRelanceDraft] = useState<CampaignDraft | null>(null);
  const router = useRouter();

  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings });
  const reports = useQuery({
    queryKey: ["advisor", "reports"],
    queryFn: advisorApi.reports,
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === "PENDING") ? 4000 : false,
  });
  const initiatives = useQuery({
    queryKey: ["advisor", "initiatives"],
    queryFn: advisorApi.initiatives,
  });

  const list = reports.data ?? [];
  const pending = list.find((r) => r.status === "PENDING");
  const latestDone = list.find((r) => r.status === "DONE");
  const latestFailed = list[0]?.status === "FAILED" ? list[0] : null;
  const shownId = selectedId ?? latestDone?.id ?? null;

  // A finished report brings new AI questions into the checklist
  useEffect(() => {
    if (!latestDone?.id) return;
    qc.invalidateQueries({ queryKey: ["advisor", "questions"] });
    qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
  }, [latestDone?.id, qc]);

  const report = useQuery({
    queryKey: ["advisor", "report", shownId],
    queryFn: () => advisorApi.report(shownId!),
    enabled: !!shownId,
    staleTime: Infinity,
  });

  const generate = useMutation({
    mutationFn: () => advisorApi.generate(days),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["advisor", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latestReviews = new Map(
    (report.data?.result?.initiativeReviews ?? []).map((r) => [r.initiativeId, r]),
  );
  const enabled = settings.data?.enabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6" />
          Conseiller IA
        </h1>
        <p className="text-muted-foreground">
          L&apos;IA lit vos chiffres (visites, abonnements, café, horaires) et propose des idées
          pour gagner plus : nouveaux revenus, promos, prix, fidélisation.
        </p>
      </div>

      {settings.data && !enabled ? (
        <Alert>
          <AlertTitle>Conseiller non configuré</AlertTitle>
          <AlertDescription>
            Ajoutez <code>ANTHROPIC_API_KEY=…</code> dans <code>backend/.env</code> puis redémarrez le
            backend. Vous pouvez déjà remplir votre contexte et suivre vos initiatives.
          </AlertDescription>
        </Alert>
      ) : null}

      <AdvisorContextPanel />

      <ContextCard value={settings.data?.businessContext ?? ""} />

      <Card className="shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <div className="font-medium">Analyse</div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Période :
              {PERIODS.map((p) => (
                <FilterChip key={p} active={days === p} onClick={() => setDays(p)}>
                  {p} jours
                </FilterChip>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Comparée à la période précédente. Un rapport est aussi généré chaque lundi à 7h.
            </div>
          </div>
          <Button
            disabled={!enabled || !!pending || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {pending || generate.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {pending ? "Analyse en cours…" : "Lancer l'analyse"}
          </Button>
        </CardContent>
      </Card>

      <ManualCard days={days} onImported={setSelectedId} />

      {pending ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>L&apos;IA analyse vos chiffres</AlertTitle>
          <AlertDescription>
            Cela prend en général une à deux minutes. Vous pouvez quitter la page, le rapport sera
            enregistré.
          </AlertDescription>
        </Alert>
      ) : null}
      {latestFailed && !pending ? (
        <Alert variant="destructive">
          <AlertTitle>La dernière analyse a échoué</AlertTitle>
          <AlertDescription>{latestFailed.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Recommandations</h2>
          {list.filter((r) => r.status === "DONE").length > 1 ? (
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={shownId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {list
                .filter((r) => r.status === "DONE")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {format(new Date(r.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                    {r.trigger === "WEEKLY" ? " (hebdo)" : r.trigger === "IMPORT" ? " (collé)" : ""}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
        {reports.isLoading || report.isLoading ? (
          <Skeleton className="h-64" />
        ) : report.data?.result ? (
          <>
            <div className="text-xs text-muted-foreground">
              Rapport du {format(new Date(report.data.createdAt), "d MMMM yyyy", { locale: fr })} (
              {formatDistanceToNow(new Date(report.data.createdAt), { locale: fr, addSuffix: true })}) ·
              période du {format(new Date(report.data.periodFrom), "d MMM", { locale: fr })} au{" "}
              {format(new Date(report.data.periodTo), "d MMM", { locale: fr })}
            </div>
            <ReportView
              result={report.data.result}
              reportId={report.data.id}
              onStart={setDraft}
              onRelance={setRelanceDraft}
            />
          </>
        ) : (
          <Card className="shadow-none">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aucun rapport pour l&apos;instant. Lancez une analyse pour obtenir vos premières
              recommandations.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Mes initiatives</h2>
            <p className="text-sm text-muted-foreground">
              Ce que vous avez changé (ex. : vendre du café), et ce que ça rapporte : chiffres avant
              / après sur la même durée.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({ title: "", description: "", category: "NEW_REVENUE", startDate: today() })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Ajouter
          </Button>
        </div>
        {initiatives.isLoading ? (
          <Skeleton className="h-32" />
        ) : initiatives.data?.length ? (
          <ul className="space-y-3">
            {initiatives.data.map((i) => (
              <InitiativeCard key={i.id} item={i} review={latestReviews.get(i.id)} />
            ))}
          </ul>
        ) : (
          <Card className="shadow-none">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aucune initiative suivie. Ajoutez par exemple le jour où vous avez commencé à vendre
              du café pour voir ce qu&apos;il rapporte.
            </CardContent>
          </Card>
        )}
      </section>

      <InitiativeDialog draft={draft} onClose={() => setDraft(null)} />
      <CampaignDialog
        draft={relanceDraft}
        onClose={() => setRelanceDraft(null)}
        onCreated={() => router.push("/relances")}
      />
    </div>
  );
}
