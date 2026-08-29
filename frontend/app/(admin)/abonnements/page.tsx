"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, MapPin, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { abonnementsApi, membersApi, pricesApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  PriceCategory,
  type Abonnement,
  type PaginatedResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AbonnementSeatMap } from "@/components/admin/AbonnementSeatMap";
import { SeatOccupancyBoard } from "@/components/admin/SeatOccupancyBoard";
import { SubscriptionMemberPanel } from "@/components/admin/SubscriptionMemberPanel";
import {
  daysLeft,
  hoursLeft,
  isActiveSub,
  leaveDateFromPeriodStart,
  subKind,
} from "@/lib/subscription-utils";

const schema = z.object({
  memberID: z.string().min(1),
  priceId: z.string().min(1),
  registredDate: z.string().min(1),
  leaveDate: z.string().optional(),
  isPayed: z.boolean(),
  payedAmount: z.coerce.number().min(0),
  hoursUsed: z.coerce.number().min(0).optional(),
  reservedSeatLabel: z.string().optional(),
  reservedSeatSpaceId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function asList(
  data: Abonnement[] | PaginatedResponse<Abonnement> | undefined,
) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.data || [];
}

type AboQuickFilter =
  | "all"
  | "active"
  | "expired"
  | "expiring"
  | "unpaid"
  | "hours_low"
  | "hours_pool"
  | "semi_day"
  | "full_day";

export default function AbonnementsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
      <AbonnementsInner />
    </Suspense>
  );
}

function AbonnementsInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const focusMember = searchParams.get("memberId");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Abonnement | null>(null);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<AboQuickFilter>("active");
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [occupancyOpen, setOccupancyOpen] = useState(false);
  const [focusSeatLabel, setFocusSeatLabel] = useState<string | null>(null);
  const [focusSpaceId, setFocusSpaceId] = useState<string | null>(null);
  const [moving, setMoving] = useState<Abonnement | null>(null);
  const [moveSeat, setMoveSeat] = useState<string | null>(null);
  const [moveSpaceId, setMoveSpaceId] = useState<string | null>(null);
  const [ending, setEnding] = useState<Abonnement | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const { data: raw } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: () => abonnementsApi.list(),
  });
  const { data: members = [] } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
  });
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
  });

  const rows = asList(raw);
  const subPrices = useMemo(
    () =>
      prices.filter(
        (p) =>
          p.isActive !== false &&
          (p.category === PriceCategory.ABONNEMENT || p.type === "abonnement"),
      ),
    [prices],
  );

  const kpis = useMemo(() => {
    const active = rows.filter(isActiveSub).length;
    const expired = rows.filter((a) => !isActiveSub(a)).length;
    const expiring = rows.filter((a) => {
      const d = daysLeft(a);
      return isActiveSub(a) && d != null && d <= 7;
    }).length;
    const unpaid = rows.filter((a) => !a.isPayed).length;
    const hoursLow = rows.filter((a) => {
      const h = hoursLeft(a);
      return isActiveSub(a) && h != null && h > 0 && h <= 5;
    }).length;
    return { total: rows.length, active, expired, expiring, unpaid, hoursLow };
  }, [rows]);

  const quickChips: {
    id: AboQuickFilter;
    label: string;
    tone: string;
  }[] = [
    {
      id: "active",
      label: "Actifs",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800 data-[active=true]:bg-emerald-600 data-[active=true]:text-white",
    },
    {
      id: "expiring",
      label: "Expire ≤7j",
      tone: "border-amber-200 bg-amber-50 text-amber-800 data-[active=true]:bg-amber-600 data-[active=true]:text-white",
    },
    {
      id: "unpaid",
      label: "Impayés",
      tone: "border-red-200 bg-red-50 text-red-800 data-[active=true]:bg-red-600 data-[active=true]:text-white",
    },
    {
      id: "hours_low",
      label: "Heures faibles",
      tone: "border-violet-200 bg-violet-50 text-violet-800 data-[active=true]:bg-violet-600 data-[active=true]:text-white",
    },
    {
      id: "hours_pool",
      label: "Forfait heures",
      tone: "border-sky-200 bg-sky-50 text-sky-800 data-[active=true]:bg-sky-600 data-[active=true]:text-white",
    },
    {
      id: "semi_day",
      label: "Demi-journée",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-800 data-[active=true]:bg-indigo-600 data-[active=true]:text-white",
    },
    {
      id: "full_day",
      label: "Journée",
      tone: "border-blue-200 bg-blue-50 text-blue-800 data-[active=true]:bg-blue-600 data-[active=true]:text-white",
    },
    {
      id: "expired",
      label: "Expirés",
      tone: "border-slate-200 bg-slate-50 text-slate-700 data-[active=true]:bg-slate-700 data-[active=true]:text-white",
    },
  ];

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const name = (a.members?.firstName || "").toLowerCase();
        const phone = (a.members?.phone || "").toLowerCase();
        const formula = (a.price?.name || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || formula.includes(q);
      });
    }
    if (quickFilter === "active") list = list.filter(isActiveSub);
    else if (quickFilter === "expired")
      list = list.filter((a) => !isActiveSub(a));
    else if (quickFilter === "expiring") {
      list = list.filter((a) => {
        const d = daysLeft(a);
        return isActiveSub(a) && d != null && d <= 7;
      });
    } else if (quickFilter === "unpaid") list = list.filter((a) => !a.isPayed);
    else if (quickFilter === "hours_low") {
      list = list.filter((a) => {
        const h = hoursLeft(a);
        return isActiveSub(a) && h != null && h > 0 && h <= 5;
      });
    } else if (quickFilter === "hours_pool") {
      list = list.filter((a) => subKind(a) === "hours_pool");
    } else if (quickFilter === "semi_day") {
      list = list.filter((a) => subKind(a) === "semi_day");
    } else if (quickFilter === "full_day") {
      list = list.filter((a) => subKind(a) === "full_day");
    }
    return list;
  }, [rows, search, quickFilter]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      memberID: "",
      priceId: "",
      registredDate: format(new Date(), "yyyy-MM-dd"),
      leaveDate: "",
      isPayed: true,
      payedAmount: 0,
      hoursUsed: 0,
      reservedSeatLabel: "",
      reservedSeatSpaceId: "",
    },
  });

  const fillFromPrice = (priceId: string, startStr: string) => {
    const p = subPrices.find((x) => x.id === priceId);
    if (!p) return;
    form.setValue("payedAmount", p.price);
    const start = new Date(startStr || form.getValues("registredDate"));
    const leave = leaveDateFromPeriodStart(start, p.periodDays || 30);
    form.setValue("leaveDate", format(leave, "yyyy-MM-dd"));
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      memberID: focusMember || "",
      priceId: "",
      registredDate: format(new Date(), "yyyy-MM-dd"),
      leaveDate: "",
      isPayed: true,
      payedAmount: 0,
      hoursUsed: 0,
      reservedSeatLabel: "",
      reservedSeatSpaceId: "",
    });
    setOpen(true);
  };

  const openEdit = (a: Abonnement) => {
    setEditing(a);
    form.reset({
      memberID: a.memberID,
      priceId: a.priceId,
      registredDate: format(new Date(a.registredDate), "yyyy-MM-dd"),
      leaveDate: a.leaveDate ? format(new Date(a.leaveDate), "yyyy-MM-dd") : "",
      isPayed: a.isPayed,
      payedAmount: a.payedAmount,
      hoursUsed: a.hoursUsed || 0,
      reservedSeatLabel: a.reservedSeatLabel || "",
      reservedSeatSpaceId: a.reservedSeatSpaceId || "",
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!focusMember || !rows.length) return;
    setDetailMemberId(focusMember);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMember, rows.length]);

  const detailMember = useMemo(
    () => members.find((m) => m.id === detailMemberId) || null,
    [members, detailMemberId],
  );

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const price = subPrices.find((p) => p.id === v.priceId);
      if (price?.reserveSeat && !v.reservedSeatLabel?.trim()) {
        throw new Error("Choisissez une place dédiée pour ce tarif");
      }
      const start = new Date(v.registredDate);
      const leave = v.leaveDate
        ? new Date(v.leaveDate)
        : leaveDateFromPeriodStart(start, price?.periodDays || 30);
      const payload = {
        memberID: v.memberID,
        priceId: v.priceId,
        registredDate: start.toISOString(),
        leaveDate: leave.toISOString(),
        isPayed: v.isPayed,
        payedAmount: v.payedAmount || price?.price || 0,
        isReservation: false,
        hoursQuota:
          price?.billingUnit === "HOURLY" ? price.durationHours : null,
        hoursUsed: v.hoursUsed || 0,
        reservedSeatLabel: v.reservedSeatLabel?.trim() || null,
        reservedSeatSpaceId: v.reservedSeatSpaceId?.trim() || null,
      };
      return editing
        ? abonnementsApi.update(editing.id, payload)
        : abonnementsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Abonnement mis à jour" : "Abonnement créé");
      queryClient.invalidateQueries({ queryKey: queryKeys.abonnements });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateAbo = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.abonnements });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
  };

  const endNow = useMutation({
    mutationFn: (a: Abonnement) =>
      abonnementsApi.update(a.id, { leaveDate: new Date().toISOString() }),
    onSuccess: () => {
      toast.success("Abonnement terminé — place libérée");
      setEnding(null);
      invalidateAbo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearSeat = useMutation({
    mutationFn: (a: Abonnement) =>
      abonnementsApi.update(a.id, {
        reservedSeatLabel: "",
        reservedSeatSpaceId: "",
      }),
    onSuccess: () => {
      toast.success("Place libérée");
      invalidateAbo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveReserved = useMutation({
    mutationFn: () => {
      if (!moving) throw new Error("Aucun abonnement");
      return abonnementsApi.update(moving.id, {
        reservedSeatLabel: moveSeat || "",
        reservedSeatSpaceId: moveSpaceId || "",
      });
    },
    onSuccess: () => {
      toast.success(
        moveSeat ? `Place déplacée vers ${moveSeat}` : "Place libérée",
      );
      setMoving(null);
      setMoveSeat(null);
      invalidateAbo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAllSeats = useMutation({
    mutationFn: async () => {
      const targets = rows.filter((a) => isActiveSub(a) && a.reservedSeatLabel);
      for (const a of targets) {
        await abonnementsApi.update(a.id, {
          reservedSeatLabel: "",
          reservedSeatSpaceId: "",
        });
      }
      return targets.length;
    },
    onSuccess: (n) => {
      toast.success(
        n
          ? `${n} place${n > 1 ? "s" : ""} libérée${n > 1 ? "s" : ""}`
          : "Aucune place à libérer",
      );
      setClearingAll(false);
      invalidateAbo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedPrice = subPrices.find((p) => p.id === form.watch("priceId"));
  const isHoursPool = selectedPrice?.billingUnit === "HOURLY";
  const reservedSeatLabel = form.watch("reservedSeatLabel") || "";
  const showSeatPicker =
    !!selectedPrice?.reserveSeat ||
    !!reservedSeatLabel ||
    !!editing?.reservedSeatLabel;

  const hasReservedSeats = rows.some(
    (a) => isActiveSub(a) && a.reservedSeatLabel,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Abonnements</h1>
          <p className="text-muted-foreground">
            {filtered.length} affiché{filtered.length !== 1 ? "s" : ""} /{" "}
            {rows.length} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeatOccupancyBoard
            open={occupancyOpen}
            onOpenChange={(o) => {
              setOccupancyOpen(o);
              if (!o) {
                setFocusSeatLabel(null);
                setFocusSpaceId(null);
              }
            }}
            focusSeatLabel={focusSeatLabel}
            focusSpaceId={focusSpaceId}
          />
          <Button
            variant="outline"
            disabled={!hasReservedSeats}
            onClick={() => setClearingAll(true)}
          >
            Libérer toutes les places
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" onClick={openCreate}>
                + Nouvel abonnement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Modifier l’abonnement" : "Nouvel abonnement"}
                </DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit((v) => save.mutate(v))}
              >
                <div className="space-y-2">
                  <Label>Membre</Label>
                  <Select
                    value={form.watch("memberID")}
                    onValueChange={(v) => form.setValue("memberID", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(members) ? members : []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName || "Visiteur"} {m.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formule</Label>
                  <Select
                    value={form.watch("priceId")}
                    onValueChange={(v) => {
                      form.setValue("priceId", v);
                      fillFromPrice(v, form.getValues("registredDate"));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {subPrices.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.price} DT
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Début</Label>
                    <Input
                      type="date"
                      {...form.register("registredDate")}
                      onChange={(e) => {
                        form.setValue("registredDate", e.target.value);
                        if (form.getValues("priceId")) {
                          fillFromPrice(
                            form.getValues("priceId"),
                            e.target.value,
                          );
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin</Label>
                    <Input type="date" {...form.register("leaveDate")} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <Label>Payé</Label>
                  <Switch
                    checked={form.watch("isPayed")}
                    onCheckedChange={(v) => form.setValue("isPayed", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...form.register("payedAmount")}
                  />
                </div>
                {isHoursPool ? (
                  <div className="space-y-2">
                    <Label>
                      Heures utilisées / {selectedPrice?.durationHours || "?"} h
                    </Label>
                    <Input
                      type="number"
                      step="0.25"
                      {...form.register("hoursUsed")}
                    />
                  </div>
                ) : null}
                {showSeatPicker ? (
                  <div className="space-y-2">
                    <Label>
                      Place réservée
                      {selectedPrice?.reserveSeat ? " (obligatoire)" : ""}
                    </Label>
                    <AbonnementSeatMap
                      selectedLabel={reservedSeatLabel || null}
                      selectedSpaceId={form.watch("reservedSeatSpaceId") || null}
                      currentMemberId={form.watch("memberID") || null}
                      onSelect={(label, sid) => {
                        form.setValue("reservedSeatLabel", label || "");
                        form.setValue("reservedSeatSpaceId", sid || "");
                      }}
                    />
                  </div>
                ) : selectedPrice ? (
                  <p className="text-xs text-muted-foreground">
                    Ce tarif n’attribue pas de place dédiée. Activez l’option
                    dans Tarifs si besoin.
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending}>
                    {editing ? "Enregistrer" : "Créer"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "Total", value: String(kpis.total) },
          { label: "Actifs", value: String(kpis.active) },
          { label: "Expire ≤7j", value: String(kpis.expiring) },
          { label: "Impayés", value: String(kpis.unpaid) },
          { label: "Heures faibles", value: String(kpis.hoursLow) },
          { label: "Expirés", value: String(kpis.expired) },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Rechercher membre, téléphone, formule…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => {
            const active = quickFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                data-active={active}
                onClick={() => setQuickFilter(active ? "all" : chip.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  chip.tone,
                )}
              >
                {chip.label}
              </button>
            );
          })}
          {quickFilter !== "all" ? (
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className="text-xs text-muted-foreground underline"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Restant</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Payé</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filtered.length ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Aucun abonnement
                    {quickFilter !== "all" || search ? " pour ce filtre" : ""}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => {
                  const left = daysLeft(a);
                  const hLeft = hoursLeft(a);
                  const active = isActiveSub(a);
                  return (
                    <TableRow
                      key={a.id}
                      className={cn(
                        focusMember === a.memberID && "bg-primary/5",
                        !active && "text-muted-foreground opacity-70",
                      )}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-left hover:underline"
                          onClick={() => setDetailMemberId(a.memberID)}
                        >
                          {a.members?.firstName || a.memberID.slice(0, 8)}
                        </button>
                      </TableCell>
                      <TableCell>
                        {a.price?.name || a.priceId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {a.reservedSeatLabel ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            title="Voir sur le plan"
                            onClick={() => {
                              setFocusSeatLabel(a.reservedSeatLabel || null);
                              setOccupancyOpen(true);
                            }}
                          >
                            <MapPin className="h-3 w-3" />
                            {a.reservedSeatLabel}
                          </Button>
                        ) : isActiveSub(a) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => {
                              setMoving(a);
                              setMoveSeat(null);
                            }}
                          >
                            Assigner
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(a.registredDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        {a.leaveDate
                          ? format(new Date(a.leaveDate), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {left == null ? (
                          "—"
                        ) : (
                          <Badge
                            variant={left <= 3 ? "destructive" : "secondary"}
                          >
                            {left} j.
                          </Badge>
                        )}
                        {hLeft != null ? (
                          hLeft <= 0 ? (
                            <Badge variant="destructive" className="ml-1">
                              Heures épuisées
                            </Badge>
                          ) : (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {hLeft}h
                            </span>
                          )
                        ) : a.price?.durationHours === 6 ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            6h/j
                          </span>
                        ) : a.price?.durationHours &&
                          a.price.durationHours >= 12 ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            journée
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{a.payedAmount} DT</TableCell>
                      <TableCell>
                        <Badge variant={a.isPayed ? "default" : "secondary"}>
                          {a.isPayed ? "Payé" : "Non payé"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(a)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (a.reservedSeatLabel) {
                                  setFocusSeatLabel(a.reservedSeatLabel);
                                  setOccupancyOpen(true);
                                } else {
                                  setMoving(a);
                                  setMoveSeat(null);
                                }
                              }}
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              {a.reservedSeatLabel
                                ? "Voir sur le plan"
                                : "Assigner une place"}
                            </DropdownMenuItem>
                            {isActiveSub(a) && a.reservedSeatLabel ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setMoving(a);
                                  setMoveSeat(a.reservedSeatLabel || null);
                                }}
                              >
                                Déplacer la place
                              </DropdownMenuItem>
                            ) : null}
                            {a.reservedSeatLabel ? (
                              <DropdownMenuItem
                                onClick={() => clearSeat.mutate(a)}
                              >
                                Libérer la place
                              </DropdownMenuItem>
                            ) : null}
                            {isActiveSub(a) ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setEnding(a)}
                                >
                                  Terminer maintenant
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!moving}
        onOpenChange={(o) => {
          if (!o) {
            setMoving(null);
            setMoveSeat(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {moving?.reservedSeatLabel
                ? "Déplacer la place"
                : "Assigner une place"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {moving?.members?.firstName || "Membre"}
            {moving?.price?.name ? ` · ${moving.price.name}` : ""}
            {moving?.reservedSeatLabel
              ? ` · actuelle : ${moving.reservedSeatLabel}`
              : ""}
          </p>
          <AbonnementSeatMap
            selectedLabel={moveSeat}
            selectedSpaceId={moveSpaceId}
            currentMemberId={moving?.memberID || null}
            onSelect={(label, sid) => {
              setMoveSeat(label);
              setMoveSpaceId(sid || null);
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMoving(null);
                setMoveSeat(null);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={moveReserved.isPending}
              onClick={() => moveReserved.mutate()}
            >
              {moveSeat ? "Enregistrer" : "Libérer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!ending}
        onOpenChange={(o) => {
          if (!o) setEnding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminer cet abonnement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {ending?.members?.firstName || "Ce membre"} perd l’accès tout de
              suite. La place dédiée est libérée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => ending && endNow.mutate(ending)}>
              Terminer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearingAll} onOpenChange={setClearingAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Libérer toutes les places ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les abonnements restent actifs, mais plus aucune place n’est
              réservée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearAllSeats.mutate()}>
              Libérer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet
        open={!!detailMemberId}
        onOpenChange={(o) => {
          if (!o) setDetailMemberId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {detailMember?.firstName || "Membre"} — abonnements
            </SheetTitle>
          </SheetHeader>
          {detailMemberId ? (
            <div className="mt-4 space-y-4">
              <SubscriptionMemberPanel
                memberId={detailMemberId}
                memberName={detailMember?.firstName || "Membre"}
                abonnements={rows}
                onEdit={(a) => {
                  setDetailMemberId(null);
                  openEdit(a);
                }}
                onViewSeat={(label, spaceId) => {
                  setFocusSeatLabel(label);
                  setFocusSpaceId(spaceId || null);
                  setOccupancyOpen(true);
                }}
              />
              <Button
                className="w-full"
                onClick={() => {
                  setDetailMemberId(null);
                  setEditing(null);
                  form.reset({
                    memberID: detailMemberId,
                    priceId: "",
                    registredDate: format(new Date(), "yyyy-MM-dd"),
                    leaveDate: "",
                    isPayed: true,
                    payedAmount: 0,
                    hoursUsed: 0,
                    reservedSeatLabel: "",
                    reservedSeatSpaceId: "",
                  });
                  setOpen(true);
                }}
              >
                Nouvel abonnement
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
