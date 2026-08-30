"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Armchair, Check, DoorOpen, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { bookingRequestsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { BookingRequest } from "@/lib/types";

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function ReservationsAdminPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("PENDING");

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.bookingRequestsPending,
    queryFn: () => bookingRequestsApi.pending(),
    refetchInterval: 12_000,
  });
  const { data: approved = [] } = useQuery({
    queryKey: ["booking-requests", "APPROVED"],
    queryFn: () => bookingRequestsApi.list("APPROVED"),
  });
  const { data: rejected = [] } = useQuery({
    queryKey: ["booking-requests", "REJECTED"],
    queryFn: () => bookingRequestsApi.list("REJECTED"),
  });

  const rows = useMemo(() => {
    if (filter === "PENDING") return pending;
    if (filter === "APPROVED") return approved;
    if (filter === "REJECTED") return rejected;
    return [...pending, ...approved, ...rejected].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filter, pending, approved, rejected]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.bookingRequestsPending,
    });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.approve(id),
    onSuccess: () => {
      toast.success("Réservation acceptée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.reject(id),
    onSuccess: () => {
      toast.success("Réservation refusée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "PENDING", label: "En attente", count: pending.length },
    { id: "APPROVED", label: "Acceptées", count: approved.length },
    { id: "REJECTED", label: "Refusées", count: rejected.length },
    {
      id: "ALL",
      label: "Toutes",
      count: pending.length + approved.length + rejected.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Demandes de réservation
        </h1>
        <p className="text-sm text-muted-foreground">
          Salles, open spaces et places demandées depuis le mobile.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "En attente", value: pending.length },
          { label: "Acceptées", value: approved.length },
          { label: "Refusées", value: rejected.length },
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

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold">
              {c.count}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Créneau</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rows.length ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Aucune demande
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: BookingRequest) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">
                        {r.memberName}
                        {r.visitorNumber != null
                          ? ` #${r.visitorNumber}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.createdAt), "d MMM HH:mm", {
                          locale: fr,
                        })}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {r.kind === "ROOM" ? (
                          <DoorOpen className="h-3.5 w-3.5" />
                        ) : (
                          <Armchair className="h-3.5 w-3.5" />
                        )}
                        {r.kind === "ROOM"
                          ? r.spaceName || "Salle"
                          : `Place ${r.seatLabel}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.startAt), "EEE d MMM HH:mm", {
                        locale: fr,
                      })}{" "}
                      → {format(new Date(r.endAt), "HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {r.note || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "PENDING"
                            ? "secondary"
                            : r.status === "APPROVED"
                              ? "default"
                              : "outline"
                        }
                      >
                        {r.status === "PENDING"
                          ? "En attente"
                          : r.status === "APPROVED"
                            ? "Acceptée"
                            : "Refusée"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "PENDING" ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reject.isPending}
                            onClick={() => reject.mutate(r.id)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Refuser
                          </Button>
                          <Button
                            size="sm"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(r.id)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Accepter
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
