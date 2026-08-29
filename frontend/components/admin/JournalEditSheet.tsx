"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours, format, parseISO } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { journalApi, mobileApi, pricesApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Journal } from "@/lib/types";
import { isJournalPack } from "@/lib/journal-utils";

const schema = z.object({
  priceId: z.string().min(1),
  registredTime: z.string().min(1),
  leaveTime: z.string().nullable().optional(),
  isPayed: z.boolean(),
  payedAmount: z.coerce.number().min(0),
  isReservation: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

type Props = {
  journal: Journal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JournalEditSheet({ journal, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
  });
  const memberId = journal?.memberID || journal?.members?.id || journal?.member?.id;
  const { data: day } = useQuery({
    queryKey: ["visitor-day", memberId],
    queryFn: () => mobileApi.visitorDay(memberId!),
    enabled: open && !!memberId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priceId: "",
      registredTime: "",
      leaveTime: null,
      isPayed: false,
      payedAmount: 0,
      isReservation: false,
    },
  });

  useEffect(() => {
    if (!journal) return;
    form.reset({
      priceId: journal.priceId || journal.prices?.id || journal.price?.id || "",
      registredTime: toLocalInput(journal.registredTime),
      leaveTime: journal.leaveTime ? toLocalInput(journal.leaveTime) : null,
      isPayed: journal.isPayed,
      payedAmount: journal.payedAmount,
      isReservation: journal.isReservation,
    });
  }, [journal, form]);

  const leaveTime = form.watch("leaveTime");
  const priceId = form.watch("priceId");
  const registredTime = form.watch("registredTime");
  const isPayed = form.watch("isPayed");
  const isReservation = form.watch("isReservation");

  const selectedPrice = useMemo(
    () => prices.find((p) => p.id === priceId) || null,
    [prices, priceId]
  );

  /** Expected end from arrival + forfait duration (live). */
  const expectedLeaveLocal = useMemo(() => {
    if (!registredTime || !selectedPrice?.durationHours) return null;
    const start = new Date(registredTime);
    if (Number.isNaN(start.getTime())) return null;
    return toLocalInput(
      addHours(start, selectedPrice.durationHours).toISOString()
    );
  }, [registredTime, selectedPrice?.durationHours]);

  const update = useMutation({
    mutationFn: (values: FormValues) =>
      journalApi.update(journal!.id, {
        priceId: values.priceId,
        registredTime: new Date(values.registredTime).toISOString(),
        leaveTime: values.leaveTime
          ? new Date(values.leaveTime).toISOString()
          : null,
        isPayed: values.isPayed,
        payedAmount: values.payedAmount,
        isReservation: values.isReservation,
      }),
    onSuccess: () => {
      toast.success("Journal mis à jour");
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["visitor-day"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyExpectedLeave = () => {
    if (!expectedLeaveLocal) {
      toast.message("Choisissez un forfait avec durée pour calculer le départ");
      return;
    }
    form.setValue("leaveTime", expectedLeaveLocal, { shouldDirty: true });
    toast.message("Départ = fin prévue du forfait");
  };

  const payCoffee = useMutation({
    mutationFn: (isPayed: boolean) =>
      mobileApi.payMemberDayOrders(memberId!, isPayed),
    onSuccess: () => {
      toast.success("Café / boutique mis à jour");
      queryClient.invalidateQueries({ queryKey: ["visitor-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payOne = useMutation({
    mutationFn: (vars: { id: string; isPayed: boolean }) =>
      mobileApi.payOrder(vars.id, vars.isPayed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitor-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const journalPacks = prices.filter(
    (p) => (p.isActive !== false && isJournalPack(p)) || p.id === priceId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Modifier la visite</DialogTitle>
        </DialogHeader>
        {!journal ? null : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => update.mutate(v))}
          >
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <VisitorAvatar
                name={
                  journal.members?.firstName ||
                  journal.member?.firstName ||
                  journal.guestName ||
                  "Visiteur"
                }
                src={journal.members?.avatarUrl || journal.member?.avatarUrl}
                className="h-12 w-12"
              />
              <div>
                <p className="font-medium">
                  {journal.members?.firstName ||
                    journal.member?.firstName ||
                    journal.guestName ||
                    "Visiteur"}
                  {journal.members?.visitorNumber || journal.member?.visitorNumber
                    ? ` #${
                        journal.members?.visitorNumber ||
                        journal.member?.visitorNumber
                      }`
                    : ""}
                </p>
                <p className="text-muted-foreground">
                  {journal.members?.phone || journal.member?.phone || "—"}
                </p>
                {memberId ? (
                  <Button asChild variant="link" className="h-auto px-0 pt-1">
                    <Link href={`/abonnements?memberId=${memberId}`}>
                      <CreditCard className="mr-1 h-3.5 w-3.5" />
                      Voir / éditer l’abonnement
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Place</p>
                <p className="font-medium">
                  {day?.seat
                    ? [day.seat.spaceName, day.seat.tableName, day.seat.seatLabel]
                        .filter(Boolean)
                        .join(" · ")
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Forfait</p>
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>
                    {(day?.totals.pack ?? journal.payedAmount).toFixed(1)} DT
                  </span>
                  <Badge variant={journal.isPayed ? "default" : "secondary"}>
                    {journal.isPayed ? "Payé" : "Impayé"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Total jour</p>
                <p className="font-medium">
                  {(day?.totals.grand ?? journal.payedAmount).toFixed(1)} DT
                </p>
              </div>
            </div>

            {day?.subscription ? (
              <div className="rounded-lg border bg-sky-50/60 px-3 py-2 text-sm dark:bg-sky-950/20">
                <p className="font-medium">
                  {day.subscription.price?.name || "Abonnement"}
                </p>
                <p className="text-muted-foreground">
                  {day.subscription.daysRemaining != null
                    ? `${day.subscription.daysRemaining} j. restants`
                    : ""}
                  {day.subscription.hoursRemaining != null
                    ? ` · ${day.subscription.hoursRemaining}h restantes`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Café / boutique</p>
                {memberId && (day?.orders.length || 0) > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={payCoffee.isPending}
                    onClick={() =>
                      payCoffee.mutate((day?.totals.productsUnpaid || 0) > 0)
                    }
                  >
                    {(day?.totals.productsUnpaid || 0) > 0
                      ? "Marquer café payé"
                      : "Marquer café impayé"}
                  </Button>
                ) : null}
              </div>
              {!day?.orders.length ? (
                <p className="text-xs text-muted-foreground">
                  Aucun achat aujourd’hui
                </p>
              ) : (
                <div className="space-y-1.5">
                  {day.orders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {o.quantity}× {o.productName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {o.status === "PENDING"
                            ? "En attente"
                            : o.status === "CONFIRMED"
                              ? "Confirmé"
                              : o.status}
                        </Badge>
                        <span className="tabular-nums">
                          {o.amount.toFixed(2)} DT
                        </span>
                        <Switch
                          checked={o.isPayed}
                          onCheckedChange={(v) =>
                            payOne.mutate({ id: o.id, isPayed: v })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Produits {day.totals.products.toFixed(2)} DT
                    {day.totals.productsUnpaid > 0
                      ? ` · impayé ${day.totals.productsUnpaid.toFixed(2)} DT`
                      : " · café payé"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Forfait</Label>
              <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {journalPacks.slice(0, 12).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        form.setValue("priceId", p.id, { shouldDirty: true });
                        form.setValue("payedAmount", p.price, {
                          shouldDirty: true,
                        });
                        // If still present (no leave), refresh expected depart display only;
                        // user can apply it explicitly to leaveTime.
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                        priceId === p.id && "border-primary bg-primary/5"
                      )}
                    >
                      <span>
                        {p.name}
                        {p.durationHours ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({p.durationHours}h)
                          </span>
                        ) : null}
                      </span>
                      <span className="font-semibold">{p.price} DT</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="registredTime">Arrivée</Label>
                <Input
                  id="registredTime"
                  type="datetime-local"
                  {...form.register("registredTime")}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="leaveTime">Départ (réel)</Label>
                  {leaveTime ? (
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() =>
                        form.setValue("leaveTime", null, { shouldDirty: true })
                      }
                    >
                      Encore présent
                    </button>
                  ) : null}
                </div>
                <Input
                  id="leaveTime"
                  type="datetime-local"
                  value={leaveTime || ""}
                  onChange={(e) =>
                    form.setValue("leaveTime", e.target.value || null, {
                      shouldDirty: true,
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Vide = toujours présent. Remplir pour clôturer / corriger
                  l&apos;heure de sortie.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed bg-sky-50/50 px-3 py-2 text-sm dark:bg-sky-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Fin prévue (forfait)
                  </p>
                  <p className="font-semibold tabular-nums">
                    {expectedLeaveLocal
                      ? format(new Date(expectedLeaveLocal), "dd/MM/yyyy HH:mm")
                      : "— (forfait sans durée)"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!expectedLeaveLocal}
                  onClick={applyExpectedLeave}
                >
                  Appliquer au départ
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label>Payé</Label>
                <p className="text-xs text-muted-foreground">
                  Indépendant du check-out
                </p>
              </div>
              <Switch
                checked={isPayed}
                onCheckedChange={(v) =>
                  form.setValue("isPayed", v, { shouldDirty: true })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payedAmount">Montant (DT)</Label>
              <Input
                id="payedAmount"
                type="number"
                step="0.1"
                {...form.register("payedAmount")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label>Réservation</Label>
                <p className="text-xs text-muted-foreground">
                  Place réservée pour une date future
                </p>
              </div>
              <Switch
                checked={isReservation}
                onCheckedChange={(v) =>
                  form.setValue("isReservation", v, { shouldDirty: true })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
