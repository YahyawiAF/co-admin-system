"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import {
  bookingApi,
  facilityApi,
  mobileApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { ProductOrder } from "@/lib/types";

export function ProductOrderBell() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [current, setCurrent] = useState<ProductOrder | null>(null);

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.productOrdersPending,
    queryFn: () => mobileApi.pendingOrders(),
    refetchInterval: 8_000,
  });
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
    enabled: !!current,
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
    enabled: !!current,
  });

  useEffect(() => {
    if (!socket) return;
    const onOrder = (payload: ProductOrder & { label?: string; type?: string }) => {
      if (payload?.type && payload.type !== "product_order") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.productOrdersPending,
        });
        return;
      }
      toast.message(
        payload?.memberName
          ? `${payload.memberName} commande ${payload.label || payload.productName || "un produit"}`
          : "Nouvelle commande café / boutique"
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.productOrdersPending,
      });
      setCurrent(payload);
    };
    socket.on("product_order", onOrder);
    return () => {
      socket.off("product_order", onOrder);
    };
  }, [socket, queryClient]);

  const confirm = useMutation({
    mutationFn: (id: string) => mobileApi.confirmOrder(id),
    onSuccess: () => {
      toast.success("Commande confirmée");
      queryClient.invalidateQueries({
        queryKey: queryKeys.productOrdersPending,
      });
      setCurrent(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (row: { id: string }) => mobileApi.rejectOrder(row.id),
    onSuccess: () => {
      toast.message("Commande refusée");
      queryClient.invalidateQueries({
        queryKey: queryKeys.productOrdersPending,
      });
      setCurrent(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const spaces = layout?.spaces || [];
  const seatLabel = current?.seat?.seatLabel || null;
  const activeSpace = useMemo(() => {
    if (!spaces.length) return null;
    if (!seatLabel) return spaces[0];
    return (
      spaces.find((sp) => {
        const all = [
          ...(sp.seats || []),
          ...(sp.tables || []).flatMap((t) => t.seats || []),
        ];
        return all.some((s) => s.label === seatLabel);
      }) || spaces[0]
    );
  }, [spaces, seatLabel]);

  const selectedSeatId = useMemo(() => {
    if (!seatLabel || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === seatLabel)?.id || null;
  }, [activeSpace, seatLabel]);

  const display = current
    ? pending.find((p) => p.id === current.id) || current
    : null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          if (pending[0]) setCurrent(pending[0]);
          else toast.message("Aucune commande en attente");
        }}
      >
        <Coffee className="h-5 w-5" />
        {pending.length > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {pending.length}
          </Badge>
        ) : null}
      </Button>

      <Dialog open={!!display} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commande café</DialogTitle>
          </DialogHeader>
          {display ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <VisitorAvatar
                  name={display.memberName}
                  src={display.avatarUrl}
                  className="h-14 w-14"
                />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {display.memberName || "Visiteur"}
                    {display.visitorNumber ? ` #${display.visitorNumber}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {display.phone || "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-amber-50/70 px-3 py-2 text-sm dark:bg-amber-950/20">
                <p className="font-medium">
                  {display.quantity}× {display.productName || display.label} ·{" "}
                  {(display.amount || 0).toFixed(2)} DT
                </p>
                <p className="text-muted-foreground">
                  Forfait : {display.forfaitName || "—"}
                </p>
                <p className="text-muted-foreground">
                  Place :{" "}
                  {display.seat
                    ? [display.seat.spaceName, display.seat.tableName, display.seat.seatLabel]
                        .filter(Boolean)
                        .join(" · ")
                    : "Non assignée"}
                </p>
              </div>

              {activeSpace ? (
                <div className="max-h-64 overflow-auto rounded-md border bg-muted/20 p-2">
                  <FloorPlanCanvas
                    space={activeSpace}
                    bookings={bookings}
                    editMode={false}
                    variant="picker"
                    selectedSeatId={selectedSeatId}
                  />
                </div>
              ) : null}

              {pending.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {pending.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={p.id === display.id ? "default" : "outline"}
                      onClick={() => setCurrent(p)}
                    >
                      {p.memberName || "Visiteur"}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={!display || cancel.isPending}
              onClick={() => display && cancel.mutate(display)}
            >
              <X className="mr-1 h-4 w-4" />
              Refuser
            </Button>
            <Button
              disabled={!display || confirm.isPending}
              onClick={() => display && confirm.mutate(display.id)}
            >
              <Check className="mr-1 h-4 w-4" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
