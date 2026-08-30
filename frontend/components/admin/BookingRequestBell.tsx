"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Check, X } from "lucide-react";
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
import { bookingRequestsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { BookingRequest } from "@/lib/types";

export function BookingRequestBell() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [current, setCurrent] = useState<BookingRequest | null>(null);

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.bookingRequestsPending,
    queryFn: () => bookingRequestsApi.pending(),
    refetchInterval: 12_000,
  });

  useEffect(() => {
    if (!socket) return;
    const onNew = (payload: BookingRequest) => {
      toast.message(
        payload.memberName
          ? `Réservation : ${payload.memberName}`
          : "Nouvelle réservation"
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookingRequestsPending,
      });
      setCurrent(payload);
    };
    const onDone = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookingRequestsPending,
      });
    };
    socket.on("booking_request", onNew);
    socket.on("booking_request_resolved", onDone);
    return () => {
      socket.off("booking_request", onNew);
      socket.off("booking_request_resolved", onDone);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (!pending.length) {
      setCurrent(null);
      return;
    }
    setCurrent((cur) =>
      cur && pending.some((p) => p.id === cur.id) ? cur : pending[0]
    );
  }, [pending]);

  const approve = useMutation({
    mutationFn: () => bookingRequestsApi.approve(current!.id),
    onSuccess: () => {
      toast.success("Réservation acceptée");
      setCurrent(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookingRequestsPending,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: () => bookingRequestsApi.reject(current!.id),
    onSuccess: () => {
      toast.success("Réservation refusée");
      setCurrent(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookingRequestsPending,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          if (pending[0]) setCurrent(pending[0]);
          else toast.message("Aucune réservation en attente");
        }}
      >
        <CalendarClock className="h-5 w-5" />
        {pending.length ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {pending.length}
          </Badge>
        ) : null}
      </Button>
      <Dialog open={!!current} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demande de réservation</DialogTitle>
          </DialogHeader>
          {current ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">
                {current.memberName}
                {current.visitorNumber ? ` #${current.visitorNumber}` : ""}
              </p>
              <p>
                {current.kind === "ROOM" ? "Salle" : "Place"}
                {current.spaceName ? ` · ${current.spaceName}` : ""}
                {current.seatLabel ? ` · ${current.seatLabel}` : ""}
              </p>
              <p>
                {format(new Date(current.startAt), "EEEE d MMM HH:mm", {
                  locale: fr,
                })}{" "}
                → {format(new Date(current.endAt), "HH:mm", { locale: fr })}
              </p>
              {current.note ? (
                <p className="text-muted-foreground">{current.note}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={reject.isPending}
              onClick={() => reject.mutate()}
            >
              <X className="mr-1 h-4 w-4" />
              Refuser
            </Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
              <Check className="mr-1 h-4 w-4" />
              Accepter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
