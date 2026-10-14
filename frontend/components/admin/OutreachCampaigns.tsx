"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { BellRing, Check, MessageCircle, Phone, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { groupsApi, outreachApi } from "@/lib/api/resources";
import type {
  AdvisorCategory,
  CampaignGoal,
  CampaignInput,
  CampaignSegment,
  OutreachCampaign,
  OutreachChannel,
} from "@/lib/types";

export const SEGMENT_LABEL: Record<CampaignSegment, string> = {
  ABO_EXPIRING: "Abonnement qui se termine",
  ABO_ENDED: "Abonnement non renouvelé",
  INACTIVE: "Habitués absents",
  TOP_UP: "Ont payé la moitié d'un abonnement",
  CONVERT: "Passes au rythme d'un abonnement",
  UNPAID: "Impayés",
  RECENT_30: "Venus ces 30 derniers jours",
  ALL: "Tous les membres (avec téléphone)",
  GROUP: "Un groupe de membres",
};

const GOAL_LABEL: Record<CampaignGoal, string> = {
  VISIT: "Il revient",
  SUBSCRIPTION: "Il prend un abonnement",
  ANY: "Il revient ou achète",
};

const SUBSCRIPTION_SEGMENTS: CampaignSegment[] = ["ABO_EXPIRING", "ABO_ENDED", "TOP_UP", "CONVERT"];
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export type CampaignDraft = Partial<CampaignInput> & { title: string; message: string };

/** Create a relance: list of clients (frozen now), message with {prenom}, what counts as a success. */
export function CampaignDialog({
  draft,
  onClose,
  onCreated,
}: {
  draft: CampaignDraft | null;
  onClose: () => void;
  onCreated?: (c: OutreachCampaign) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CampaignInput | null>(null);
  useEffect(() => {
    if (!draft) return setForm(null);
    const segment = draft.segment ?? "RECENT_30";
    setForm({
      title: draft.title,
      message: draft.message || "Bonjour {prenom}, ",
      segment,
      memberGroupId: draft.memberGroupId ?? null,
      goal: draft.goal ?? (SUBSCRIPTION_SEGMENTS.includes(segment) ? "SUBSCRIPTION" : "ANY"),
      sourceReportId: draft.sourceReportId ?? null,
      recommendationTitle: draft.recommendationTitle ?? null,
      trackAsInitiative: draft.trackAsInitiative ?? true,
      category: draft.category as AdvisorCategory | undefined,
    });
  }, [draft]);
  const groups = useQuery({ queryKey: ["groups"], queryFn: groupsApi.list, enabled: !!draft });
  const counts = useQuery({
    queryKey: ["outreach-segments", form?.segment === "GROUP" ? form.memberGroupId : null],
    queryFn: () => outreachApi.segments(form?.segment === "GROUP" ? form.memberGroupId : null),
    enabled: !!draft,
  });
  const create = useMutation({
    mutationFn: () => outreachApi.createCampaign(form!),
    onSuccess: (c) => {
      toast.success(`Relance enregistrée : ${c.progress.total} clients à contacter`);
      qc.invalidateQueries({ queryKey: ["outreach-campaigns"] });
      qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
      onClose();
      onCreated?.(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!form) return null;
  const set = (patch: Partial<CampaignInput>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const count = counts.data?.[form.segment];
  const preview = form.message.replace(/\{\s*pr[ée]nom\s*\}/gi, "Sarra");

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle relance</DialogTitle>
          <DialogDescription>
            La liste des clients est figée aujourd&apos;hui : vous suivez ensuite qui a été contacté et
            qui est revenu ou a acheté dans les 14 jours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={form.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Qui contacter ?</Label>
            <select className={select} value={form.segment} onChange={(e) => set({ segment: e.target.value as CampaignSegment })}>
              {(Object.keys(SEGMENT_LABEL) as CampaignSegment[]).map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                  {s !== "GROUP" && counts.data ? ` (${counts.data[s] ?? 0})` : ""}
                </option>
              ))}
            </select>
            {form.segment === "GROUP" ? (
              <select
                className={cn(select, "mt-1")}
                value={form.memberGroupId ?? ""}
                onChange={(e) => set({ memberGroupId: e.target.value || null })}
              >
                <option value="">Choisir le groupe…</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}
            <p className={cn("text-xs", count === 0 ? "text-rose-700" : "text-muted-foreground")}>
              {count == null ? "…" : count === 0 ? "Personne dans cette liste aujourd'hui." : `${count} client${count > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Message ({"{prenom}"} = prénom du client)</Label>
            <Textarea rows={5} value={form.message} onChange={(e) => set({ message: e.target.value })} />
            <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
              <span className="font-medium">Aperçu : </span>
              {preview}
            </p>
          </div>
          <div className="space-y-1">
            <Label>C&apos;est réussi si…</Label>
            <select className={select} value={form.goal} onChange={(e) => set({ goal: e.target.value as CampaignGoal })}>
              {(Object.keys(GOAL_LABEL) as CampaignGoal[]).map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.trackAsInitiative}
              onChange={(e) => set({ trackAsInitiative: e.target.checked })}
            />
            Suivre aussi l&apos;effet global (avant / après) dans « Mes initiatives »
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!form.title.trim() || !form.message.trim() || !count || create.isPending}
            onClick={() => create.mutate()}
          >
            <Send className="mr-1.5 h-4 w-4" />
            Enregistrer la relance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One campaign: everyone on the list, one tap to message, contacted / result per client. */
function CampaignDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["outreach-campaign", id],
    queryFn: () => outreachApi.campaign(id!),
    enabled: !!id,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["outreach-campaign", id] });
    qc.invalidateQueries({ queryKey: ["outreach-campaigns"] });
  };
  const log = useMutation({
    mutationFn: (v: { memberId: string; channel: OutreachChannel; message?: string }) =>
      outreachApi.logCampaign(id!, v),
    onSuccess: (_r, v) => {
      if (v.channel === "PUSH") toast.success("Notification envoyée");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const finish = useMutation({
    mutationFn: (status: "ACTIVE" | "DONE") => outreachApi.updateCampaign(id!, { status }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const c = detail.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c?.title ?? "Relance"}</DialogTitle>
          <DialogDescription>
            {c ? `${SEGMENT_LABEL[c.segment]} · ${c.progress.contacted}/${c.progress.total} contactés · ${c.progress.won} résultat${c.progress.won > 1 ? "s" : ""} · ${dt(c.progress.revenue)}` : "…"}
          </DialogDescription>
        </DialogHeader>
        {!c ? (
          <Skeleton className="h-48" />
        ) : (
          <ul className="divide-y rounded-md border">
            {c.targets.map((t) => (
              <li key={t.memberId} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{t.name}</span>
                    {t.won ? (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        Revenu{t.revenue > 0 ? ` · ${dt(t.revenue)}` : ""}
                      </span>
                    ) : t.contactedAt ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">
                        Contacté {formatDistanceToNow(new Date(t.contactedAt), { locale: fr, addSuffix: true })}
                      </span>
                    ) : t.channel === "SKIP" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">Ignoré</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">À contacter</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{t.message}</div>
                </div>
                <div className="flex items-center gap-1">
                  {t.whatsapp ? (
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        window.open(`https://wa.me/${t.whatsapp}?text=${encodeURIComponent(t.message)}`, "_blank", "noopener");
                        log.mutate({ memberId: t.memberId, channel: "WHATSAPP", message: t.message });
                      }}
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  ) : null}
                  {t.hasPush ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      title="Notification dans l'app"
                      disabled={log.isPending}
                      onClick={() => log.mutate({ memberId: t.memberId, channel: "PUSH", message: t.message })}
                    >
                      <BellRing className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Contacté autrement (appel, sur place)"
                    disabled={log.isPending}
                    onClick={() => log.mutate({ memberId: t.memberId, channel: "CALL" })}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                  {!t.contactedAt ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      title="Ignorer"
                      disabled={log.isPending}
                      onClick={() => log.mutate({ memberId: t.memberId, channel: "SKIP" })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          {c ? (
            <Button variant="outline" disabled={finish.isPending} onClick={() => finish.mutate(c.status === "DONE" ? "ACTIVE" : "DONE")}>
              <Check className="mr-1.5 h-4 w-4" />
              {c.status === "DONE" ? "Rouvrir" : "Terminer la relance"}
            </Button>
          ) : null}
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Relances page: saved campaigns (AI suggestions or manual) with their progress. */
export function CampaignsSection() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["outreach-campaigns"], queryFn: outreachApi.campaigns });
  const remove = useMutation({
    mutationFn: (id: string) => outreachApi.deleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const list = data ?? [];
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Campagnes</h2>
          <p className="text-sm text-muted-foreground">
            Les relances enregistrées (idées de l&apos;IA ou les vôtres) et ce qu&apos;elles rapportent.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft({ title: "", message: "" })}>
          Nouvelle relance
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const pct = c.progress.total ? Math.round((c.progress.contacted / c.progress.total) * 100) : 0;
            return (
              <Card key={c.id} className={cn("shadow-none", c.status === "DONE" && "opacity-70")}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium">
                        {c.sourceReportId ? <Sparkles className="h-4 w-4 shrink-0 text-violet-600" /> : null}
                        <span className="truncate">{c.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {SEGMENT_LABEL[c.segment]} · {format(new Date(c.createdAt), "d MMM", { locale: fr })}
                        {c.status === "DONE" ? " · terminée" : ""}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => confirm(`Supprimer « ${c.title} » ?`) && remove.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {c.progress.contacted}/{c.progress.total} contactés ·{" "}
                      <b className="text-emerald-700">
                        {c.progress.won} résultat{c.progress.won > 1 ? "s" : ""} · {dt(c.progress.revenue)}
                      </b>
                    </span>
                    <Button size="sm" onClick={() => setOpenId(c.id)}>
                      {c.progress.contacted < c.progress.total && c.status !== "DONE" ? "Continuer" : "Voir"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aucune campagne. Dans le Conseiller IA, le bouton « Relancer » d&apos;une idée en crée une avec
          la liste des clients et le message prêts.
        </p>
      )}
      <CampaignDetailDialog id={openId} onClose={() => setOpenId(null)} />
      <CampaignDialog draft={draft} onClose={() => setDraft(null)} onCreated={(c) => setOpenId(c.id)} />
    </section>
  );
}
