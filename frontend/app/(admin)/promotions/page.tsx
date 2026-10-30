"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, endOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { BadgePercent, Coffee, Gift, Pencil, Plus, Tags, Ticket, Trash2 } from "lucide-react";
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
import { PriceCategory, type Promotion, type PromotionInput, type PromotionTarget } from "@/lib/types";
import { promoCategoriesOf } from "@/lib/promo-price";
import { DealBadge, GiftBadge } from "@/components/visitor/quest/QuestOption";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;

const CATEGORY_LABEL: Record<PriceCategory, string> = {
  [PriceCategory.JOURNEE]: "Journée",
  [PriceCategory.OPEN_SPACE]: "Open space",
  [PriceCategory.SALLE]: "Salle de réunion",
  [PriceCategory.ABONNEMENT]: "Abonnement",
};

const KINDS: Array<{ target: PromotionTarget; title: string; hint: string }> = [
  { target: "PRICE", title: "Remise sur un pass", hint: "Ex. Journée −20 % aujourd’hui" },
  { target: "BUNDLE", title: "Cadeau avec un pass", hint: "Ex. 4h → café −50 %, le client choisit" },
  { target: "PRODUCT", title: "Un produit du café", hint: "Promo directe sur un produit" },
  { target: "OTHER", title: "Offre libre", hint: "Appliquée par l’accueil" },
];

const isTarifPromo = (t: PromotionTarget) => t === "PRICE" || t === "BUNDLE";

type Form = {
  title: string;
  description: string;
  target: PromotionTarget;
  productId: string;
  priceId: string;
  /** PRICE / BUNDLE: one tarif or a whole category */
  priceScope: "one" | "category";
  priceCategory: PriceCategory | "";
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
  priceScope: "one",
  priceCategory: "",
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
    label: "Cadeau avec un pass",
    icon: Gift,
    apply: (f) => ({
      ...f,
      target: "BUNDLE",
      title: "Café −50 % avec votre pass",
      description: "1 café à moitié prix pendant votre visite.",
      valueKind: "PERCENT",
      value: "50",
      audience: "ALL",
      maxUsesPerMember: "",
      style: "GOLD",
    }),
  },
  {
    label: "Pass −20 % aujourd’hui",
    icon: BadgePercent,
    apply: (f) => ({
      ...f,
      target: "PRICE",
      title: "−20 % aujourd’hui",
      description: "Promo du jour, appliquée automatiquement.",
      valueKind: "PERCENT",
      value: "20",
      startsAt: toLocalInput(new Date()),
      endsAt: toLocalInput(endOfDay(new Date())),
      audience: "ALL",
      maxUsesPerMember: "",
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
    productId: f.target === "PRODUCT" || f.target === "BUNDLE" ? f.productId || null : null,
    priceId: isTarifPromo(f.target) && f.priceScope === "one" ? f.priceId || null : null,
    priceCategory:
      isTarifPromo(f.target) && f.priceScope === "category" ? f.priceCategory || null : null,
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
    priceScope: p.priceCategory && !p.priceId ? "category" : "one",
    priceCategory: p.priceCategory ?? "",
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
  const activePrices = (prices.data ?? []).filter((p) => p.isActive !== false);
  const byCategory = form.target === "PRICE" || form.target === "BUNDLE";
  const scopePrices =
    form.priceScope === "category" && form.priceCategory
      ? activePrices.filter((p) => promoCategoriesOf(p).includes(form.priceCategory as PriceCategory))
      : [];
  const price =
    form.priceScope === "one"
      ? activePrices.find((p) => p.id === form.priceId)
      : scopePrices[0];
  const base =
    form.target === "PRODUCT" || form.target === "BUNDLE"
      ? product?.sellingPrice
      : form.target === "PRICE"
        ? price?.price
        : null;
  const value = Number(form.value) || 0;
  const off = (n: number) =>
    Math.max(0, form.valueKind === "PERCENT" ? n * (1 - value / 100) : n - value);
  const after = base != null && value > 0 ? off(base) : null;
  const label = value > 0 ? (form.valueKind === "PERCENT" ? `−${value} %` : `−${value} DT`) : "−?";
  const scopeName =
    form.priceScope === "category"
      ? form.priceCategory
        ? `Tous les pass ${CATEGORY_LABEL[form.priceCategory as PriceCategory]}`
        : "Catégorie ?"
      : price?.name ?? "Pass ?";
  const preview = {
    title: form.title || "Titre de l’offre",
    description: form.description || null,
    label,
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
    (!(form.target === "PRODUCT" || form.target === "BUNDLE") || form.productId) &&
    (!byCategory || (form.priceScope === "one" ? form.priceId : form.priceCategory));
  const today = endOfDay(new Date());
  const week = endOfWeek(new Date(), { weekStartsOn: 1 });
  const quick = [
    { id: "today", label: "Aujourd’hui seulement", end: toLocalInput(today) },
    { id: "week", label: "Cette semaine", end: toLocalInput(week) },
  ];
  const categories = Object.values(PriceCategory).filter((c) =>
    activePrices.some((p) => promoCategoriesOf(p).includes(c))
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l’offre" : "Nouvelle offre"}</DialogTitle>
          <DialogDescription>
            Elle s’affiche dans l’app en carte dorée. Café et pass : la remise s’applique toute seule.
            Cadeau avec un pass : le client choisit Oui ou Non. Offre libre : l’accueil l’applique.
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
            <div className="space-y-1">
              <Label>Type de promo</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => {
                  const on = form.target === k.target;
                  return (
                    <button
                      key={k.target}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ target: k.target })}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none",
                        on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60"
                      )}
                    >
                      <div className="text-sm font-semibold">{k.title}</div>
                      <div className="text-xs text-muted-foreground">{k.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {byCategory ? (
              <div key="tarif" className="animate-in fade-in-0 slide-in-from-top-1 space-y-2 duration-200 motion-reduce:animate-none">
                <Label>{form.target === "BUNDLE" ? "Quel pass donne le cadeau ?" : "Sur quel pass ?"}</Label>
                <div className="inline-flex rounded-lg bg-muted p-1">
                  {(
                    [
                      ["one", "Un tarif"],
                      ["category", "Toute une catégorie"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={form.priceScope === id}
                      onClick={() => set({ priceScope: id })}
                      className={cn(
                        "h-8 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                        form.priceScope === id ? "bg-background shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {form.priceScope === "one" ? (
                    <div className="space-y-1">
                      <Label>Tarif</Label>
                      <select className={select} value={form.priceId} onChange={(e) => set({ priceId: e.target.value })}>
                        <option value="">Choisir…</option>
                        {activePrices.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {dt(p.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>Catégorie</Label>
                      <select
                        className={select}
                        value={form.priceCategory}
                        onChange={(e) => set({ priceCategory: e.target.value as PriceCategory })}
                      >
                        <option value="">Choisir…</option>
                        {categories.map((c) => {
                          const n = activePrices.filter((p) => promoCategoriesOf(p).includes(c)).length;
                          return (
                            <option key={c} value={c}>
                              {CATEGORY_LABEL[c]} · {n} tarif{n > 1 ? "s" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  {form.target === "BUNDLE" ? (
                    <div className="space-y-1">
                      <Label>Produit offert</Label>
                      <select className={select} value={form.productId} onChange={(e) => set({ productId: e.target.value })}>
                        <option value="">Choisir…</option>
                        {(products.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {dt(p.sellingPrice)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : form.target === "PRODUCT" ? (
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
            ) : null}
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
                <Label>{form.target === "BUNDLE" ? "Remise sur le produit" : "Remise"}</Label>
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
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => {
                const on = form.endsAt === q.end;
                return (
                  <button
                    key={q.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ startsAt: toLocalInput(new Date()), endsAt: q.end })}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none",
                      on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    {q.label}
                  </button>
                );
              })}
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
            {byCategory ? (
              <div className="rounded-2xl bg-slate-50 p-3 pt-5">
                <div
                  key={form.target}
                  className={cn(
                    "v-rise relative flex items-center gap-3 rounded-[18px] px-3 py-2.5 ring-1",
                    form.target === "BUNDLE" ? "bg-amber-50 ring-amber-300" : "bg-rose-50 ring-rose-300"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-indigo-50 text-[11px] font-black text-indigo-700">
                    {price?.durationHours ? (price.durationHours >= 7 ? "Jour" : `${price.durationHours}h`) : "Pass"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{scopeName}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        form.target === "BUNDLE" ? "font-extrabold text-amber-700" : "text-slate-600"
                      )}
                    >
                      {form.target === "BUNDLE"
                        ? product
                          ? `+ ${product.name} ${label}${after != null ? ` · ${dt(after)} au lieu de ${dt(product.sellingPrice)}` : ""}`
                          : "+ produit offert ?"
                        : form.priceScope === "category" && scopePrices.length
                          ? `${scopePrices.length} tarifs : ${label}`
                          : "Promo"}
                    </span>
                  </span>
                  {price ? (
                    <span className="flex shrink-0 flex-col items-end text-sm font-black tabular-nums">
                      {form.target === "PRICE" && value > 0 ? (
                        <>
                          <span className="text-[11px] font-medium text-slate-500 line-through">{dt(price.price)}</span>
                          <span className="text-rose-700">{dt(off(price.price))}</span>
                        </>
                      ) : (
                        <span className="text-indigo-800">{dt(price.price)}</span>
                      )}
                    </span>
                  ) : null}
                  {form.target === "BUNDLE" ? (
                    <GiftBadge label={product ? `${product.name} ${label}`.slice(0, 16) : "Cadeau"} />
                  ) : (
                    <DealBadge
                      label={form.endsAt === toLocalInput(today) ? `${label} aujourd’hui` : label}
                    />
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {form.target === "BUNDLE"
                    ? "Le client touche le pass, voit le cadeau et répond Oui ou Non. Oui = un bon pour sa visite."
                    : "Prix barré dans l’app et à l’accueil. La remise s’applique dès que le pass est choisi."}
                </p>
              </div>
            ) : null}
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
                  {isTarifPromo(p.target) ? (
                    <p className="text-xs font-medium">
                      {p.target === "BUNDLE" ? "Avec " : "Sur "}
                      {p.priceName ??
                        (p.priceCategory ? `tous les pass ${CATEGORY_LABEL[p.priceCategory]}` : "—")}
                      {p.target === "BUNDLE" && p.itemName ? ` → ${p.itemName} ${p.label}` : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{scheduleText(p)}</p>
                  {p.stats && p.target === "BUNDLE" ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Proposé", p.stats.offered ?? 0],
                        ["Accepté", p.stats.accepted ?? 0],
                        [`${p.itemName ?? "Cadeau"} commandé`, p.stats.redeemed ?? 0],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md bg-muted/50 px-1 py-1.5">
                          <div className="font-semibold tabular-nums">{v}</div>
                          <div className="truncate text-muted-foreground">{k}</div>
                        </div>
                      ))}
                    </div>
                  ) : p.stats ? (
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
