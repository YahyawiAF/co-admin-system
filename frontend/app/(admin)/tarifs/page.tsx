"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { pricesApi, facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  BillingUnit,
  PriceCategory,
  PriceType,
  PromoValueKind,
  type AppInstallPromo,
  type Price,
} from "@/lib/types";
import {
  BILLING_UNIT_LABEL,
  formatTarifPrice,
  PRICE_CATEGORY_LABEL,
  priceCategoriesOf,
  priceMatchesSpace,
  tarifSubtitle,
} from "@/lib/tarif-labels";
import {
  defaultOccupyForCategory,
} from "@/lib/space-occupy";

const VISIT_PRICE_CATS = [
  PriceCategory.JOURNEE,
  PriceCategory.OPEN_SPACE,
  PriceCategory.SALLE,
] as const;

function togglePriceCategory(
  current: PriceCategory[],
  cat: PriceCategory
): PriceCategory[] {
  if (cat === PriceCategory.ABONNEMENT) {
    return [PriceCategory.ABONNEMENT];
  }
  const withoutAbo = current.filter((c) => c !== PriceCategory.ABONNEMENT);
  const on = withoutAbo.includes(cat);
  if (on) {
    const next = withoutAbo.filter((c) => c !== cat);
    return next.length ? next : withoutAbo;
  }
  return [...withoutAbo, cat];
}

const schema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  category: z.nativeEnum(PriceCategory),
  categories: z.array(z.nativeEnum(PriceCategory)).min(1),
  billingUnit: z.nativeEnum(BillingUnit),
  durationHours: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().nullable().optional()
  ),
  periodDays: z.coerce.number().optional().nullable(),
  spaceId: z.string().optional(),
  spaceIds: z.array(z.string()).optional(),
  occupySeat: z.boolean().optional(),
  occupyWhole: z.boolean().optional(),
  reserveSeat: z.boolean().optional(),
  reserveSeatFromHour: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().nullable().optional()
  ),
  reserveSeatToHour: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().nullable().optional()
  ),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

function PriceFormDialog({
  price,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  price?: Price | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const open = controlledOpen ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const queryClient = useQueryClient();
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const spaces = layout?.spaces || [];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      price: 0,
      category: PriceCategory.JOURNEE,
      categories: [PriceCategory.JOURNEE],
      billingUnit: BillingUnit.PACK,
      durationHours: 2,
      periodDays: 7,
      spaceId: "",
      spaceIds: [],
      occupySeat: true,
      occupyWhole: false,
      reserveSeat: false,
      reserveSeatFromHour: null,
      reserveSeatToHour: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    const cats = priceCategoriesOf(price || {});
    const categories = cats.length
      ? cats
      : [price?.category || PriceCategory.JOURNEE];
    form.reset({
      name: price?.name || "",
      price: price?.price || 0,
      category: categories[0],
      categories,
      billingUnit: price?.billingUnit || BillingUnit.PACK,
      durationHours:
        price?.billingUnit === BillingUnit.HOURLY &&
        !categories.includes(PriceCategory.ABONNEMENT)
          ? price?.durationHours ?? null
          : price?.durationHours ?? 2,
      periodDays: price?.periodDays ?? 7,
      spaceId: price?.spaceId || "",
      spaceIds: price?.spaceIds?.length
        ? price.spaceIds
        : price?.spaceId
          ? [price.spaceId]
          : [],
      occupySeat:
        price?.occupySeat ??
        defaultOccupyForCategory(categories[0]).occupySeat,
      occupyWhole:
        price?.occupyWhole ??
        defaultOccupyForCategory(categories[0]).occupyWhole,
      reserveSeat: !!price?.reserveSeat,
      reserveSeatFromHour: price?.reserveSeatFromHour ?? null,
      reserveSeatToHour: price?.reserveSeatToHour ?? null,
      isActive: price?.isActive !== false,
    });
  }, [open, price]);

  const billingUnit = form.watch("billingUnit");
  const categories = form.watch("categories") || [];
  const category = categories[0] || form.watch("category");
  const isAbo = categories.includes(PriceCategory.ABONNEMENT);
  const reserveSeat = form.watch("reserveSeat");
  const occupySeat = form.watch("occupySeat");
  const occupyWhole = form.watch("occupyWhole");
  const spaceIds = form.watch("spaceIds") || [];
  const isActive = form.watch("isActive");

  const matchingSpaces = useMemo(
    () =>
      spaces.filter(
        (s) =>
          isAbo ||
          priceMatchesSpace({ category, categories }, s)
      ),
    [spaces, isAbo, category, categories]
  );

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const cats = v.categories?.length
        ? v.categories
        : [v.category || PriceCategory.JOURNEE];
      const primary = cats[0];
      const type =
        primary === PriceCategory.ABONNEMENT
          ? PriceType.abonnement
          : PriceType.journal;
      const body = {
        name: v.name,
        price: v.price,
        category: primary,
        categories: cats,
        billingUnit: v.billingUnit,
        durationHours:
          primary === PriceCategory.ABONNEMENT
            ? v.durationHours
            : v.billingUnit === BillingUnit.PERIOD
              ? null
              : v.billingUnit === BillingUnit.HOURLY && !v.durationHours
                ? null
                : v.durationHours,
        periodDays:
          v.billingUnit === BillingUnit.PERIOD ? v.periodDays : null,
        spaceId: (v.spaceIds && v.spaceIds[0]) || v.spaceId || "",
        spaceIds: v.spaceIds || [],
        occupySeat: v.occupySeat !== false,
        occupyWhole: !!v.occupyWhole,
        reserveSeat:
          primary === PriceCategory.ABONNEMENT ? !!v.reserveSeat : false,
        reserveSeatFromHour:
          primary === PriceCategory.ABONNEMENT && v.reserveSeat
            ? v.reserveSeatFromHour
            : null,
        reserveSeatToHour:
          primary === PriceCategory.ABONNEMENT && v.reserveSeat
            ? v.reserveSeatToHour
            : null,
        isActive: v.isActive !== false,
        type,
        timePeriod: { start: "0", end: String(v.durationHours || 0) },
      };
      if (price?.id) return pricesApi.update(price.id, body);
      return pricesApi.create(body);
    },
    onSuccess: () => {
      toast.success(price ? "Tarif mis à jour" : "Tarif créé");
      queryClient.invalidateQueries({ queryKey: queryKeys.prices });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>{price ? "Modifier le tarif" : "Nouveau tarif"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label>Catégories</Label>
            <p className="text-xs text-muted-foreground">
              Plusieurs catégories = visible pour les espaces qui en partagent
              au moins une. Abonnement est exclusif.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VISIT_PRICE_CATS.map((c) => {
                const on = categories.includes(c);
                return (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    className="h-8"
                    onClick={() => {
                      const next = togglePriceCategory(categories, c);
                      form.setValue("categories", next);
                      form.setValue("category", next[0]);
                      const occupy = defaultOccupyForCategory(next[0]);
                      form.setValue("occupySeat", occupy.occupySeat);
                      form.setValue("occupyWhole", occupy.occupyWhole);
                    }}
                  >
                    {PRICE_CATEGORY_LABEL[c]}
                  </Button>
                );
              })}
              <Button
                type="button"
                size="sm"
                variant={isAbo ? "default" : "outline"}
                className="h-8"
                onClick={() => {
                  form.setValue("categories", [PriceCategory.ABONNEMENT]);
                  form.setValue("category", PriceCategory.ABONNEMENT);
                }}
              >
                {PRICE_CATEGORY_LABEL.ABONNEMENT}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Facturation</Label>
            <Select
              value={billingUnit}
              onValueChange={(v) =>
                form.setValue("billingUnit", v as BillingUnit)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(BillingUnit).map((c) => (
                  <SelectItem key={c} value={c}>
                    {BILLING_UNIT_LABEL[c] || c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {billingUnit === BillingUnit.PERIOD ? (
            <div className="space-y-2">
              <Label>Jours (validité)</Label>
              <Input type="number" {...form.register("periodDays")} />
              <p className="text-xs text-muted-foreground">
                Ex. 30 = 1 mois. Pour une journée complète tous les jours du
                mois : catégorie Abonnement, facturation Période, 30 jours,
                durée 12 h.
              </p>
            </div>
          ) : null}
          {isAbo ? (
            <div className="space-y-2">
              <Label>
                {billingUnit === BillingUnit.HOURLY
                  ? "Quota d'heures (total)"
                  : "Crédit heures / jour (6 = demi-journée, 12 = journée)"}
              </Label>
              <Input
                type="number"
                step="0.5"
                placeholder="6 ou 12"
                {...form.register("durationHours")}
              />
            </div>
          ) : billingUnit === BillingUnit.HOURLY ? (
            <div className="space-y-2">
              <Label>Limite (heures) — optionnel</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="Vide = compteur ouvert"
                {...form.register("durationHours")}
              />
            </div>
          ) : billingUnit !== BillingUnit.PERIOD ? (
            <div className="space-y-2">
              <Label>Durée (heures)</Label>
              <Input
                type="number"
                step="0.5"
                {...form.register("durationHours")}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>
              {billingUnit === BillingUnit.HOURLY && !isAbo
                ? "Prix / heure (DT)"
                : "Prix (DT)"}
            </Label>
            <Input type="number" step="0.1" {...form.register("price")} />
          </div>
          {!isAbo ? (
            <div className="space-y-3 rounded-lg border px-3 py-3">
              <div>
                <Label>Comment ce forfait occupe l’espace</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Salle de réunion = souvent l’espace entier. Open space = une
                  place, ou tout l’espace.
                </p>
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Par place</span>
                <Switch
                  checked={occupySeat !== false}
                  onCheckedChange={(on) => {
                    form.setValue("occupySeat", on);
                    if (!on && !form.getValues("occupyWhole")) {
                      form.setValue("occupyWhole", true);
                    }
                  }}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Espace entier</span>
                <Switch
                  checked={!!occupyWhole}
                  onCheckedChange={(on) => {
                    form.setValue("occupyWhole", on);
                    if (!on && form.getValues("occupySeat") === false) {
                      form.setValue("occupySeat", true);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Visible dans ces espaces</Label>
            <p className="text-xs text-muted-foreground">
              Cochez les espaces où ce forfait peut être choisi. Aucun = tous
              les espaces qui partagent une catégorie. Un espace peut avoir
              plusieurs forfaits.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {matchingSpaces.map((s) => {
                  const checked = spaceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? spaceIds.filter((id) => id !== s.id)
                            : [...spaceIds, s.id];
                          form.setValue("spaceIds", next);
                          form.setValue("spaceId", next[0] || "");
                        }}
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              {!matchingSpaces.length ? (
                <p className="text-xs text-muted-foreground">
                  Aucun espace de cette catégorie. Créez-en dans Facility.
                </p>
              ) : null}
            </div>
          </div>
          {isAbo ? (
            <div className="space-y-3 rounded-lg border px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label>Privilège place dédiée</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Si activé : place réservée (à assigner à la création
                    d&apos;abonnement). Sinon : place assignée à chaque scan
                    comme un visiteur.
                  </p>
                </div>
                <Switch
                  checked={!!reserveSeat}
                  onCheckedChange={(v) => form.setValue("reserveSeat", v)}
                />
              </div>
              {reserveSeat ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Réservée de (heure)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      placeholder="Vide = toute la journée"
                      {...form.register("reserveSeatFromHour")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jusqu&apos;à (heure)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      placeholder="Ex. 9 pour 4h→9h"
                      {...form.register("reserveSeatToHour")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Ex. 4 et 9 = place bloquée de 4h à 9h. Laissez vide pour
                    toute la journée pendant l&apos;abonnement.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3">
            <div>
              <Label>Tarif actif</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Inactif = masqué du check-in, mobile et sélecteurs (reste
                éditable ici).
              </p>
            </div>
            <Switch
              checked={isActive !== false}
              onCheckedChange={(v) => form.setValue("isActive", v)}
            />
          </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TarifsPage() {
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<Price | null>(null);
  const [globalDraft, setGlobalDraft] = useState<{
    active: boolean;
    valueKind: PromoValueKind;
    value: string;
  }>({
    active: false,
    valueKind: PromoValueKind.FIXED_DT,
    value: "",
  });
  const [promoDraft, setPromoDraft] = useState<{
    priceId: string;
    valueKind: PromoValueKind;
    value: string;
  }>({
    priceId: "",
    valueKind: PromoValueKind.FIXED_DT,
    value: "",
  });
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
  });
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const facility = layout?.facility;

  useEffect(() => {
    if (!facility) return;
    setGlobalDraft({
      active: !!facility.appInstallGlobalPromoActive,
      valueKind:
        facility.appInstallGlobalPromoKind || PromoValueKind.FIXED_DT,
      value:
        facility.appInstallGlobalPromoValue != null &&
        facility.appInstallGlobalPromoValue > 0
          ? String(facility.appInstallGlobalPromoValue)
          : "",
    });
  }, [
    facility?.id,
    facility?.appInstallGlobalPromoActive,
    facility?.appInstallGlobalPromoKind,
    facility?.appInstallGlobalPromoValue,
  ]);

  const { data: promos = [] } = useQuery({
    queryKey: ["facility-promos", facility?.id],
    queryFn: () => facilityApi.listPromos(facility!.id),
    enabled: !!facility?.id,
  });

  const aboPrices = useMemo(
    () =>
      prices.filter(
        (p) =>
          priceCategoriesOf(p).includes(PriceCategory.ABONNEMENT) ||
          p.type === PriceType.abonnement
      ),
    [prices]
  );

  const saveGlobalPromo = useMutation({
    mutationFn: async () => {
      if (!facility?.id) throw new Error("Facility introuvable");
      const raw = globalDraft.value.trim();
      const value = raw === "" ? null : Number(raw);
      if (globalDraft.active) {
        if (value == null || !Number.isFinite(value) || value < 0) {
          throw new Error("Indiquez une valeur promo valide");
        }
        if (
          globalDraft.valueKind === PromoValueKind.PERCENT &&
          value > 100
        ) {
          throw new Error("Le pourcentage ne peut pas dépasser 100");
        }
      }
      return facilityApi.update(facility.id, {
        appInstallGlobalPromoActive: globalDraft.active,
        appInstallGlobalPromoKind: globalDraft.active
          ? globalDraft.valueKind
          : null,
        appInstallGlobalPromoValue: globalDraft.active ? value : null,
      });
    },
    onSuccess: () => {
      toast.success("Promo globale enregistrée");
      queryClient.invalidateQueries({ queryKey: ["facility-layout"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      if (!facility?.id) throw new Error("Facility introuvable");
      if (!promoDraft.priceId) throw new Error("Choisissez un tarif abonnement");
      const value = Number(promoDraft.value);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Valeur invalide");
      }
      if (
        promoDraft.valueKind === PromoValueKind.PERCENT &&
        value > 100
      ) {
        throw new Error("Le pourcentage ne peut pas dépasser 100");
      }
      return facilityApi.createPromo(facility.id, {
        priceId: promoDraft.priceId,
        valueKind: promoDraft.valueKind,
        value,
      });
    },
    onSuccess: () => {
      toast.success("Promo créée");
      setPromoDraft((d) => ({ ...d, value: "" }));
      queryClient.invalidateQueries({
        queryKey: ["facility-promos", facility?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePromo = useMutation({
    mutationFn: (p: AppInstallPromo) =>
      facilityApi.updatePromo(p.id, { isActive: !p.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["facility-promos", facility?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePromo = useMutation({
    mutationFn: (id: string) => facilityApi.deletePromo(id),
    onSuccess: () => {
      toast.success("Promo supprimée");
      queryClient.invalidateQueries({
        queryKey: ["facility-promos", facility?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byCat = useMemo(() => {
    const map: Record<string, Price[]> = {
      JOURNEE: [],
      SALLE: [],
      OPEN_SPACE: [],
      ABONNEMENT: [],
      OTHER: [],
    };
    for (const p of prices) {
      const cats = priceCategoriesOf(p);
      if (!cats.length) {
        map.OTHER.push(p);
        continue;
      }
      let placed = false;
      for (const c of cats) {
        if (map[c]) {
          map[c].push(p);
          placed = true;
        }
      }
      if (!placed) map.OTHER.push(p);
    }
    return map;
  }, [prices]);

  const seed = useMutation({
    mutationFn: () => pricesApi.seedCollaboraHub(),
    onSuccess: (res) => {
      toast.success(`${res.created} tarifs créés (${res.skipped} déjà présents)`);
      queryClient.invalidateQueries({ queryKey: queryKeys.prices });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => pricesApi.remove(id),
    onSuccess: () => {
      toast.success("Tarif supprimé");
      queryClient.invalidateQueries({ queryKey: queryKeys.prices });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatPromoValue = (p: AppInstallPromo) =>
    p.valueKind === PromoValueKind.PERCENT
      ? `${p.value} %`
      : `${p.value} DT`;

  const renderGrid = (list: Price[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Card
          key={p.id}
          className={p.isActive === false ? "opacity-60" : undefined}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{p.name}</CardTitle>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce tarif ?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate(p.id)}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatTarifPrice(p)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {priceCategoriesOf(p).map((c) => (
                <Badge key={c} variant="outline">
                  {PRICE_CATEGORY_LABEL[c] || c}
                </Badge>
              ))}
              <Badge variant={p.isActive === false ? "secondary" : "default"}>
                {p.isActive === false ? "Inactif" : "Actif"}
              </Badge>
              {p.billingUnit ? (
                <Badge variant="secondary">
                  {BILLING_UNIT_LABEL[p.billingUnit] || p.billingUnit}
                </Badge>
              ) : null}
              {tarifSubtitle(p) ? (
                <Badge variant="outline">{tarifSubtitle(p)}</Badge>
              ) : null}
              {p.spaceNames?.length
                ? p.spaceNames.map((n) => (
                    <Badge key={n} variant="outline">
                      {n}
                    </Badge>
                  ))
                : p.spaceName ? (
                    <Badge variant="outline">{p.spaceName}</Badge>
                  ) : null}
              {p.occupyWhole ? (
                <Badge variant="outline">Espace entier</Badge>
              ) : null}
              {p.occupySeat !== false &&
              !priceCategoriesOf(p).includes(PriceCategory.ABONNEMENT) ? (
                <Badge variant="outline">Par place</Badge>
              ) : null}
              {p.reserveSeat ? (
                <Badge variant="outline">Place dédiée</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
      {!list.length ? (
        <p className="text-sm text-muted-foreground">Aucun tarif</p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarifs</h1>
          <p className="text-muted-foreground">Catalogue Collabora Hub</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Seed Collabora Hub
          </Button>
          <PriceFormDialog trigger={<Button>+ Ajouter</Button>} />
        </div>
      </div>

      <Tabs defaultValue="JOURNEE">
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="JOURNEE">
            Bureau / journée
            {byCat.JOURNEE.length ? ` (${byCat.JOURNEE.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="SALLE">
            Salle de réunion
            {byCat.SALLE.length ? ` (${byCat.SALLE.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="OPEN_SPACE">
            Open space
            {byCat.OPEN_SPACE.length ? ` (${byCat.OPEN_SPACE.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ABONNEMENT">
            Abonnement
            {byCat.ABONNEMENT.length ? ` (${byCat.ABONNEMENT.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="PROMO">
            Promo app
            {promos.length || facility?.appInstallGlobalPromoActive
              ? ` (${promos.length + (facility?.appInstallGlobalPromoActive ? 1 : 0)})`
              : ""}
          </TabsTrigger>
          {byCat.OTHER.length ? (
            <TabsTrigger value="OTHER">
              Autres ({byCat.OTHER.length})
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="JOURNEE" className="mt-4">
          {renderGrid(byCat.JOURNEE)}
        </TabsContent>
        <TabsContent value="SALLE" className="mt-4">
          {renderGrid(byCat.SALLE)}
        </TabsContent>
        <TabsContent value="OPEN_SPACE" className="mt-4">
          {renderGrid(byCat.OPEN_SPACE)}
        </TabsContent>
        <TabsContent value="ABONNEMENT" className="mt-4">
          {renderGrid(byCat.ABONNEMENT)}
        </TabsContent>
        <TabsContent value="PROMO" className="mt-4">
          <div className="mx-0 max-w-3xl space-y-8">
            {/* 1 — Global one-time */}
            <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Promo globale — téléchargement app
                  </h2>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Offre unique affichée sur le web pour inciter à installer
                    l&apos;app. Chaque membre ne peut en profiter qu&apos;une
                    seule fois.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="global-promo-active" className="text-sm">
                    Activer
                  </Label>
                  <Switch
                    id="global-promo-active"
                    checked={globalDraft.active}
                    onCheckedChange={(v) =>
                      setGlobalDraft((d) => ({ ...d, active: v }))
                    }
                  />
                </div>
              </div>

              <div
                className={
                  globalDraft.active
                    ? "grid gap-4 sm:grid-cols-[140px_120px_1fr] sm:items-end"
                    : "pointer-events-none grid gap-4 opacity-50 sm:grid-cols-[140px_120px_1fr] sm:items-end"
                }
              >
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={globalDraft.valueKind}
                    onValueChange={(v) =>
                      setGlobalDraft((d) => ({
                        ...d,
                        valueKind: v as PromoValueKind,
                      }))
                    }
                    disabled={!globalDraft.active}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PromoValueKind.FIXED_DT}>
                        Montant (DT)
                      </SelectItem>
                      <SelectItem value={PromoValueKind.PERCENT}>
                        Pourcentage (%)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="global-promo-value">
                    {globalDraft.valueKind === PromoValueKind.PERCENT
                      ? "Valeur %"
                      : "Valeur DT"}
                  </Label>
                  <Input
                    id="global-promo-value"
                    type="number"
                    min={0}
                    max={
                      globalDraft.valueKind === PromoValueKind.PERCENT
                        ? 100
                        : undefined
                    }
                    step={1}
                    placeholder={
                      globalDraft.valueKind === PromoValueKind.PERCENT
                        ? "15"
                        : "10"
                    }
                    value={globalDraft.value}
                    disabled={!globalDraft.active}
                    onChange={(e) =>
                      setGlobalDraft((d) => ({ ...d, value: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant="secondary">Une seule fois</Badge>
                  <Button
                    type="button"
                    disabled={saveGlobalPromo.isPending || !facility?.id}
                    onClick={() => saveGlobalPromo.mutate()}
                  >
                    Enregistrer
                  </Button>
                </div>
              </div>
            </section>

            {/* 2 — Tarifs abonnement */}
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">
                  Promos liées aux abonnements
                </h2>
                <p className="text-sm text-muted-foreground">
                  Jusqu&apos;à 3 offres supplémentaires, chacune liée à un tarif
                  abonnement (% ou DT). Affichées sous la promo globale.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_140px_100px_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Tarif abonnement</Label>
                    <Select
                      value={promoDraft.priceId || undefined}
                      onValueChange={(v) =>
                        setPromoDraft((d) => ({ ...d, priceId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un abonnement…" />
                      </SelectTrigger>
                      <SelectContent>
                        {aboPrices.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {formatTarifPrice(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={promoDraft.valueKind}
                      onValueChange={(v) =>
                        setPromoDraft((d) => ({
                          ...d,
                          valueKind: v as PromoValueKind,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PromoValueKind.FIXED_DT}>
                          DT
                        </SelectItem>
                        <SelectItem value={PromoValueKind.PERCENT}>
                          %
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="abo-promo-value">Valeur</Label>
                    <Input
                      id="abo-promo-value"
                      type="number"
                      min={0}
                      max={
                        promoDraft.valueKind === PromoValueKind.PERCENT
                          ? 100
                          : undefined
                      }
                      step={1}
                      value={promoDraft.value}
                      onChange={(e) =>
                        setPromoDraft((d) => ({ ...d, value: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={
                      createPromo.isPending ||
                      !facility?.id ||
                      promos.length >= 3 ||
                      !aboPrices.length
                    }
                    onClick={() => createPromo.mutate()}
                  >
                    Ajouter
                  </Button>
                </div>
                {!aboPrices.length ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Créez d&apos;abord un tarif dans l&apos;onglet Abonnement.
                  </p>
                ) : null}
                {promos.length >= 3 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Maximum 3 promos abonnement atteint.
                  </p>
                ) : null}
              </div>

              {promos.length ? (
                <div className="overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Tarif</th>
                        <th className="px-4 py-2.5 font-medium">Promo</th>
                        <th className="px-4 py-2.5 font-medium">Statut</th>
                        <th className="px-4 py-2.5 font-medium text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {promos.map((p) => (
                        <tr
                          key={p.id}
                          className={
                            p.isActive === false ? "opacity-60" : undefined
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {p.priceName || "Abonnement"}
                            </div>
                            {p.priceAmount != null ? (
                              <div className="text-xs text-muted-foreground">
                                Tarif {p.priceAmount} DT
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-primary">
                              {formatPromoValue(p)}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.valueKind === PromoValueKind.PERCENT
                                ? "pourcentage"
                                : "montant"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={p.isActive !== false}
                                onCheckedChange={() => togglePromo.mutate(p)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {p.isActive === false ? "Off" : "On"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Supprimer cette promo ?
                                  </AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removePromo.mutate(p.id)}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune promo abonnement pour l&apos;instant.
                </p>
              )}
            </section>
          </div>
        </TabsContent>
        {byCat.OTHER.length ? (
          <TabsContent value="OTHER" className="mt-4">
            {renderGrid(byCat.OTHER)}
          </TabsContent>
        ) : null}
      </Tabs>

      <PriceFormDialog
        price={edit}
        open={!!edit}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
      />
    </div>
  );
}
