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
  type Price,
} from "@/lib/types";
import {
  BILLING_UNIT_LABEL,
  formatTarifPrice,
  PRICE_CATEGORY_LABEL,
  spaceCategoryOf,
  tarifSubtitle,
} from "@/lib/tarif-labels";

const schema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  category: z.nativeEnum(PriceCategory),
  billingUnit: z.nativeEnum(BillingUnit),
  durationHours: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().nullable().optional()
  ),
  periodDays: z.coerce.number().optional().nullable(),
  spaceId: z.string().optional(),
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
      billingUnit: BillingUnit.PACK,
      durationHours: 2,
      periodDays: 7,
      spaceId: "",
      reserveSeat: false,
      reserveSeatFromHour: null,
      reserveSeatToHour: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: price?.name || "",
      price: price?.price || 0,
      category: price?.category || PriceCategory.JOURNEE,
      billingUnit: price?.billingUnit || BillingUnit.PACK,
      durationHours:
        price?.billingUnit === BillingUnit.HOURLY &&
        price?.category !== PriceCategory.ABONNEMENT
          ? price?.durationHours ?? null
          : price?.durationHours ?? 2,
      periodDays: price?.periodDays ?? 7,
      spaceId: price?.spaceId || "",
      reserveSeat: !!price?.reserveSeat,
      reserveSeatFromHour: price?.reserveSeatFromHour ?? null,
      reserveSeatToHour: price?.reserveSeatToHour ?? null,
      isActive: price?.isActive !== false,
    });
  }, [open, price]);

  const billingUnit = form.watch("billingUnit");
  const category = form.watch("category");
  const reserveSeat = form.watch("reserveSeat");
  const isActive = form.watch("isActive");

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const type =
        v.category === PriceCategory.ABONNEMENT
          ? PriceType.abonnement
          : PriceType.journal;
      const body = {
        name: v.name,
        price: v.price,
        category: v.category,
        billingUnit: v.billingUnit,
        durationHours:
          v.category === PriceCategory.ABONNEMENT
            ? v.durationHours
            : v.billingUnit === BillingUnit.PERIOD
              ? null
              : v.billingUnit === BillingUnit.HOURLY && !v.durationHours
                ? null
                : v.durationHours,
        periodDays:
          v.billingUnit === BillingUnit.PERIOD ? v.periodDays : null,
        spaceId: v.spaceId || "",
        reserveSeat:
          v.category === PriceCategory.ABONNEMENT ? !!v.reserveSeat : false,
        reserveSeatFromHour:
          v.category === PriceCategory.ABONNEMENT && v.reserveSeat
            ? v.reserveSeatFromHour
            : null,
        reserveSeatToHour:
          v.category === PriceCategory.ABONNEMENT && v.reserveSeat
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{price ? "Modifier le tarif" : "Nouveau tarif"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={category}
                onValueChange={(v) =>
                  form.setValue("category", v as PriceCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PriceCategory).map((c) => (
                    <SelectItem key={c} value={c}>
                      {PRICE_CATEGORY_LABEL[c] || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {category === PriceCategory.ABONNEMENT ? (
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
              {billingUnit === BillingUnit.HOURLY &&
              category !== PriceCategory.ABONNEMENT
                ? "Prix / heure (DT)"
                : "Prix (DT)"}
            </Label>
            <Input type="number" step="0.1" {...form.register("price")} />
          </div>
          <div className="space-y-2">
            <Label>Espace lié (optionnel)</Label>
            <Select
              value={form.watch("spaceId") || "none"}
              onValueChange={(v) =>
                form.setValue("spaceId", v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {spaces
                  .filter(
                    (s) =>
                      category === PriceCategory.ABONNEMENT ||
                      spaceCategoryOf(s) === category
                  )
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ex. tarif horaire salle de réunion → cet espace sera réservé au
              check-in.
            </p>
          </div>
          {category === PriceCategory.ABONNEMENT ? (
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
          <DialogFooter>
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
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
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
      const key =
        p.category === PriceCategory.JOURNEE ||
        p.category === PriceCategory.SALLE ||
        p.category === PriceCategory.OPEN_SPACE ||
        p.category === PriceCategory.ABONNEMENT
          ? p.category
          : "OTHER";
      map[key].push(p);
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
              {p.spaceName ? (
                <Badge variant="outline">{p.spaceName}</Badge>
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
        <TabsList>
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
