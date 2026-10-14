"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { BadgePercent, Coffee, Pencil, Plus, Tags, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { pricesApi, productsApi, promotionsApi } from "@/lib/api/resources";
import { PromoGoldenCard } from "@/components/visitor/PromoGoldenCard";
import type { Promotion, PromotionInput, PromotionTarget } from "@/lib/types";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;

type Form = {
  title: string;
  description: string;
  target: PromotionTarget;
  productId: string;
  priceId: string;
  valueKind: "PERCENT" | "FIXED_DT";
  value: string;
  startsAt: string;
  endsAt: string;
  daysOfWeek: number[];
  fromHour: string;
  toHour: string;
  audience: "ALL" | "IN_SESSION";
  maxUsesPerMember: string;
  maxUses: string;
  style: Promotion["style"];
};

const blank = (): Form => ({
  title: "",
  description: "",
  target: "PRODUCT",
  productId: "",
  priceId: "",
  valueKind: "PERCENT",
  value: "",
  startsAt: toLocalInput(new Date()),
  endsAt: "",
  daysOfWeek: [],
  fromHour: "",
  toHour: "",
  audience: "ALL",
  maxUsesPerMember: "1",
  maxUses: "",
  style: "GOLD",
});

const TEMPLATES: Array<{ label: string; icon: typeof Coffee; apply: (f: Form) => Form }> = [
  {
    label: "Café −50 % l’après-midi",
    icon: Coffee,
    apply: (f) => ({
      ...f,
      target: "PRODUCT",
      title: "Café à moitié prix",
      description: "Le coup de barre de l’après-midi ? Votre café à −50 %, commandez dans l’app.",
      valueKind: "PERCENT",
      value: "50",
      fromHour: "14",
      toHour: "17",
      audience: "IN_SESSION",
      maxUsesPerMember: "1",
      style: "GOLD",
    }),
  },
  {
    label: "Pass −10 %",
    icon: Ticket,
    apply: (f) => ({
      ...f,
      target: "PRICE",
      title: "−10 % sur votre pass",
      description: "Offre de la semaine, appliquée automatiquement.",
      valueKind: "PERCENT",
      value: "10",
      audience: "ALL",
      maxUsesPerMember: "1",
      style: "VIOLET",
    }),
  },
  {
    label: "Offre libre (accueil)",
    icon: Tags,
    apply: (f) => ({
      ...f,
      target: "OTHER",
      title: "Place avec lampe −10 %",
      description: "Montrez cette carte à l’accueil pour en profiter.",
      valueKind: "PERCENT",
      value: "10",
      style: "GREEN",
    }),
  },
];

function toInput(f: Form): PromotionInput {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    title: f.title,
    description: f.description || null,
    target: f.target,
    productId: f.target === "PRODUCT" ? f.productId || null : null,
    priceId: f.target === "PRICE" ? f.priceId || null : null,
    valueKind: f.valueKind,
    value: Number(f.value),
    startsAt: new Date(f.startsAt).toISOString(),
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    daysOfWeek: f.daysOfWeek,
    fromHour: num(f.fromHour),
    toHour: num(f.toHour),
    audience: f.audience,
    maxUsesPerMember: num(f.maxUsesPerMember),
    maxUses: num(f.maxUses),
    style: f.style,
  };
}

function fromPromo(p: Promotion): Form {
  return {
    title: p.title,
    description: p.description ?? "",
    target: p.target,
    productId: p.productId ?? "",
    priceId: p.priceId ?? "",
    valueKind: p.valueKind,
    value: String(p.value),
    startsAt: toLocalInput(new Date(p.startsAt)),
    endsAt: p.endsAt ? toLocalInput(new Date(p.endsAt)) : "",
    daysOfWeek: p.daysOfWeek,
    fromHour: p.fromHour != null ? String(p.fromHour) : "",
    toHour: p.toHour != null ? String(p.toHour) : "",
    audience: p.audience,
    maxUsesPerMember: p.maxUsesPerMember != null ? String(p.maxUsesPerMember) : "",
    maxUses: p.maxUses != null ? String(p.maxUses) : "",
    style: p.style,
  };
}

function PromotionDialog({
  editing,
  open,
  onClose,
}: {
  editing: Promotion | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(blank);
  useEffect(() => {
    if (open) setForm(editing ? fromPromo(editing) : blank());
  }, [open, editing]);
  const products = useQuery({ queryKey: ["products"], queryFn: productsApi.list, enabled: open });
  const prices = useQuery({ queryKey: ["prices"], queryFn: pricesApi.list, enabled: open });
  const save = useMutation({
    mutationFn: () =>
      editing ? promotionsApi.update(editing.id, toInput(form)) : promotionsApi.create(toInput(form)),
    onSuccess: () => {
      toast.success(editing ? "Offre mise à jour" : "Offre créée : elle apparaît dans l’app");
      qc.invalidateQueries({ queryKey: ["promotions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const product = products.data?.find((p) => p.id === form.productId);
  const price = prices.data?.find((p) => p.id === form.priceId);
  const base = form.target === "PRODUCT" ? product?.sellingPrice : form.target === "PRICE" ? price?.price : null;
  const value = Number(form.value) || 0;
  const after =
    base != null && value > 0
      ? Math.max(0, form.valueKind === "PERCENT" ? base * (1 - value / 100) : base - value)
      : null;
  const preview = {
    title: form.title || "Titre de l’offre",
    description: form.description || null,
    label: value > 0 ? (form.valueKind === "PERCENT" ? `−${value} %` : `−${value} DT`) : "−?",
    itemName: product?.name ?? price?.name ?? null,
    priceBefore: after != null ? base! : null,
    priceAfter: after,
    style: form.style,
    liveUntil: null,
    fromHour: form.fromHour ? Number(form.fromHour) : null,
    toHour: form.toHour ? Number(form.toHour) : null,
  };
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const valid =
    form.title.trim() &&
    value > 0 &&
    (form.target !== "PRODUCT" || form.productId) &&
    (form.target !== "PRICE" || form.priceId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l’offre" : "Nouvelle offre"}</DialogTitle>
          <DialogDescription>
            Elle s’affiche dans l’app en carte dorée. Café et pass : la remise s’applique toute seule
            à la commande. Offre libre : l’accueil l’applique.
          </DialogDescription>
        </DialogHeader>
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <Button key={t.label} size="sm" variant="outline" onClick={() => setForm((f) => t.apply(f))}>
                <t.icon className="mr-1.5 h-4 w-4" />
                {t.label}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Sur quoi ?</Label>
                <select
                  className={select}
                  value={form.target}
                  onChange={(e) => set({ target: e.target.value as PromotionTarget })}
                >
                  <option value="PRODUCT">Un produit du café</option>
                  <option value="PRICE">Un pass / tarif</option>
                  <option value="OTHER">Offre libre (appliquée par l’accueil)</option>
                </select>
              </div>
              {form.target === "PRODUCT" ? (
                <div className="space-y-1">
                  <Label>Produit</Label>
                  <select className={select} value={form.productId} onChange={(e) => set({ productId: e.target.value })}>
                    <option value="">Choisir…</option>
                    {(products.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {dt(p.sellingPrice)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : form.target === "PRICE" ? (
                <div className="space-y-1">
                  <Label>Pass / tarif</Label>
                  <select className={select} value={form.priceId} onChange={(e) => set({ priceId: e.target.value })}>
                    <option value="">Choisir…</option>
                    {(prices.data ?? [])
                      .filter((p) => p.isActive !== false)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {dt(p.price)}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Titre (gros, sur la carte)</Label>
              <Input value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Texte</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Remise</Label>
                <div className="flex gap-1">
                  <Input type="number" min={0} value={form.value} onChange={(e) => set({ value: e.target.value })} />
                  <select
                    className={cn(select, "w-20")}
                    value={form.valueKind}
                    onChange={(e) => set({ valueKind: e.target.value as Form["valueKind"] })}
                  >
                    <option value="PERCENT">%</option>
                    <option value="FIXED_DT">DT</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Début</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fin (optionnel)</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Jours (aucun = tous les jours)</Label>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((d, i) => {
                  const on = form.daysOfWeek.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        set({
                          daysOfWeek: on ? form.daysOfWeek.filter((x) => x !== i) : [...form.daysOfWeek, i],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>De (h)</Label>
                <Input type="number" min={0} max={24} placeholder="—" value={form.fromHour} onChange={(e) => set({ fromHour: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>À (h)</Label>
                <Input type="number" min={0} max={24} placeholder="—" value={form.toHour} onChange={(e) => set({ toHour: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Par client</Label>
                <Input type="number" min={0} placeholder="illimité" value={form.maxUsesPerMember} onChange={(e) => set({ maxUsesPerMember: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Au total</Label>
                <Input type="number" min={0} placeholder="illimité" value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Qui la voit ?</Label>
                <select className={select} value={form.audience} onChange={(e) => set({ audience: e.target.value as Form["audience"] })}>
                  <option value="ALL">Tous les membres</option>
                  <option value="IN_SESSION">Seulement ceux sur place</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Couleur</Label>
                <select className={select} value={form.style} onChange={(e) => set({ style: e.target.value as Form["style"] })}>
                  <option value="GOLD">Or</option>
                  <option value="VIOLET">Violet</option>
                  <option value="GREEN">Vert</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Aperçu dans l’app</Label>
            <PromoGoldenCard
              promo={preview}
              action={
                <span className="flex h-10 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {form.target === "OTHER" ? "Montrer à l’accueil" : "J’en profite"}
                </span>
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {editing ? "Enregistrer" : "Créer l’offre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function status(p: Promotion) {
  const now = Date.now();
  if (!p.isActive) return { label: "En pause", tone: "bg-muted text-muted-foreground" };
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return { label: "Terminée", tone: "bg-muted text-muted-foreground" };
  if (new Date(p.startsAt).getTime() > now) return { label: "Programmée", tone: "bg-sky-100 text-sky-800" };
  if (p.liveNow) return { label: "Visible maintenant", tone: "bg-emerald-600 text-white" };
  return { label: "Hors créneau", tone: "bg-amber-100 text-amber-800" };
}

function scheduleText(p: Promotion) {
  const parts = [
    `Dès le ${format(new Date(p.startsAt), "d MMM HH:mm", { locale: fr })}`,
    p.endsAt ? `jusqu’au ${format(new Date(p.endsAt), "d MMM HH:mm", { locale: fr })}` : "sans fin",
  ];
  if (p.daysOfWeek.length) parts.push(p.daysOfWeek.map((d) => DAYS[d]).join(", "));
  if (p.fromHour != null && p.toHour != null) parts.push(`${p.fromHour}h–${p.toHour}h`);
  if (p.maxUsesPerMember) parts.push(`${p.maxUsesPerMember}× par client`);
  if (p.audience === "IN_SESSION") parts.push("clients sur place");
  return parts.join(" · ");
}

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Promotion | null }>({
    open: false,
    editing: null,
  });
  const { data, isLoading } = useQuery({ queryKey: ["promotions"], queryFn: promotionsApi.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ["promotions"] });
  const toggle = useMutation({
    mutationFn: (p: Promotion) => promotionsApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => promotionsApi.remove(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const totals = useMemo(() => {
    const t = { uses: 0, revenue: 0, discount: 0 };
    for (const p of data ?? []) {
      t.uses += p.stats?.uses ?? 0;
      t.revenue += p.stats?.revenue ?? 0;
      t.discount += p.stats?.discount ?? 0;
    }
    return t;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BadgePercent className="h-6 w-6" />
            Promotions
          </h1>
          <p className="text-muted-foreground">
            Des offres en carte dorée dans l’app des membres : café à −50 % l’après-midi, pass à −10 %…
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, editing: null })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvelle offre
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Utilisations</div>
            <div className="text-2xl font-semibold tabular-nums">{totals.uses}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Encaissé avec les offres</div>
            <div className="text-2xl font-semibold tabular-nums text-emerald-700">{dt(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Remises données</div>
            <div className="text-2xl font-semibold tabular-nums">{dt(totals.discount)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((p) => {
            const st = status(p);
            return (
              <Card key={p.id} className="shadow-none">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", st.tone)}>{st.label}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.isActive}
                        disabled={toggle.isPending}
                        onCheckedChange={() => toggle.mutate(p)}
                        aria-label="Activer"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialog({ open: true, editing: p })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => confirm(`Supprimer « ${p.title} » ?`) && remove.mutate(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <PromoGoldenCard promo={p} compact />
                  <p className="text-xs text-muted-foreground">{scheduleText(p)}</p>
                  {p.stats ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                      {[
                        ["Vues", p.stats.views],
                        ["Clics", p.stats.clicks],
                        ["Utilisée", p.stats.uses],
                        ["Clients", p.stats.members],
                        ["Encaissé", dt(p.stats.revenue)],
                        ["Remise", dt(p.stats.discount)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md bg-muted/50 px-1 py-1.5">
                          <div className="font-semibold tabular-nums">{v}</div>
                          <div className="text-muted-foreground">{k}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune offre. Créez-en une avec un modèle : « Café −50 % l’après-midi » remplit vos heures
            creuses et fait vendre du café.
          </CardContent>
        </Card>
      )}

      <PromotionDialog
        open={dialog.open}
        editing={dialog.editing}
        onClose={() => setDialog({ open: false, editing: null })}
      />
    </div>
  );
}
