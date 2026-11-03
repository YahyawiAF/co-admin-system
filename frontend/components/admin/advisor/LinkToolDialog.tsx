"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { advisorApi, eventsApi, outreachApi, pricesApi, productsApi, promotionsApi, surveysApi } from "@/lib/api/resources";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import type { ToolKind } from "@/lib/types";
import { TOOL_UI } from "./conseil-ui";

const KINDS: ToolKind[] = ["PROMOTION", "EVENT", "SURVEY", "CAMPAIGN", "PRICE", "PRODUCT"];

export type LinkTarget = { initiativeId: string; kind: ToolKind | null; step: number | null };

/** Ties an existing promo / event / survey / relance / tarif / product to a solution. */
export function LinkToolDialog({ target, onClose }: { target: LinkTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ToolKind>("PROMOTION");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!target) return;
    setKind(target.kind ?? "PROMOTION");
    setQ("");
  }, [target]);

  const open = !!target;
  const promos = useQuery({ queryKey: ["promotions"], queryFn: promotionsApi.list, enabled: open && kind === "PROMOTION" });
  const events = useQuery({ queryKey: ["admin-events"], queryFn: eventsApi.adminList, enabled: open && kind === "EVENT" });
  const surveys = useQuery({ queryKey: ["surveys"], queryFn: surveysApi.list, enabled: open && kind === "SURVEY" });
  const campaigns = useQuery({ queryKey: ["outreach-campaigns"], queryFn: outreachApi.campaigns, enabled: open && kind === "CAMPAIGN" });
  const prices = useQuery({ queryKey: ["prices"], queryFn: pricesApi.list, enabled: open && kind === "PRICE" });
  const products = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open && kind === "PRODUCT" });

  const items = useMemo(() => {
    const rows: Array<{ id: string; name: string; sub?: string }> =
      kind === "PROMOTION"
        ? (promos.data ?? []).map((p) => ({ id: p.id, name: p.title, sub: p.isActive ? "active" : "arrêtée" }))
        : kind === "EVENT"
          ? (events.data ?? []).map((e) => ({ id: e.id, name: e.title, sub: new Date(e.startAt).toLocaleDateString("fr-FR") }))
          : kind === "SURVEY"
            ? (surveys.data?.surveys ?? []).map((s) => ({ id: s.id, name: s.title, sub: s.status }))
            : kind === "CAMPAIGN"
              ? (campaigns.data ?? []).map((c) => ({ id: c.id, name: c.title, sub: new Date(c.createdAt).toLocaleDateString("fr-FR") }))
              : kind === "PRICE"
                ? (prices.data ?? []).map((p) => ({ id: p.id, name: p.name, sub: `${p.price} DT` }))
                : (products.data ?? []).map((p) => ({ id: p.id, name: p.name }));
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
  }, [kind, q, promos.data, events.data, surveys.data, campaigns.data, prices.data, products.data]);
  const loading = [promos, events, surveys, campaigns, prices, products].some((x) => x.isFetching);

  const link = useMutation({
    mutationFn: (id: string) => advisorApi.addTool(target!.initiativeId, { kind, targetId: id, stepIndex: target!.step }),
    onSuccess: () => {
      toast.success("Lié : ses ventes comptent maintenant pour la solution");
      qc.invalidateQueries({ queryKey: ["advisor"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-2xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Lier à la solution</p>
          <DialogTitle className="mt-1 text-xl font-extrabold text-white">Ce que la solution utilise</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-indigo-100">
            Chaque vente, inscription ou réponse de l&apos;élément lié comptera pour elle.
          </DialogDescription>
          {target?.kind == null ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const Icon = TOOL_UI[k].icon;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-200",
                      kind === k ? "border-white bg-white text-indigo-700" : "border-white/40 text-white hover:bg-white/15",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {TOOL_UI[k].label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 border-b bg-slate-50 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher…" className="h-10 bg-white pl-9" aria-label="Chercher" />
          </div>
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto px-6 py-3">
          {loading && !items.length ? (
            <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-slate-400" />
          ) : items.length ? (
            <ul className="space-y-1.5">
              {items.slice(0, 40).map((it) => (
                <li key={it.id} className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                  <button
                    type="button"
                    disabled={link.isPending}
                    onClick={() => link.mutate(it.id)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <span className="font-semibold">{it.name}</span>
                    {it.sub ? <span className="text-xs text-slate-500">{it.sub}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-500">Rien à lier pour le moment. Utilisez « Préparer » pour en créer un.</p>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
