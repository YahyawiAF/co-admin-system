"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AbonnementSeatMap } from "@/components/admin/AbonnementSeatMap";
import { visitRequestsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { VisitRequest } from "@/lib/types";

function memberLabel(req: VisitRequest) {
  const m = req.member;
  const name = [m?.firstName, m?.lastName].filter(Boolean).join(" ").trim();
  return name || m?.phone || "Visiteur";
}

function needsReservedSeat(req: VisitRequest) {
  return !!(req.price as { reserveSeat?: boolean } | undefined)?.reserveSeat;
}

/**
 * Pending mobile subscription requests — visible list on the Abonnements page
 * (not only in the notification bell).
 */
export function SubscriptionRequestsPanel() {
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<VisitRequest | null>(null);
  const [seatLabel, setSeatLabel] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const { data: pending = [], isLoading } = useQuery({
    queryKey: queryKeys.visitRequestsPending,
    queryFn: () => visitRequestsApi.pending(),
    refetchInterval: 15_000,
  });

  const subRequests = useMemo(
    () => pending.filter((r) => r.type === "SUBSCRIPTION"),
    [pending]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.visitRequestsPending,
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.abonnements });
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
  };

  const approve = useMutation({
    mutationFn: ({
      id,
      seatLabel: seat,
      spaceId: sid,
    }: {
      id: string;
      seatLabel?: string;
      spaceId?: string;
    }) =>
      visitRequestsApi.approve(id, {
        seatLabel: seat,
        spaceId: sid,
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.seatLabel
          ? `Abonnement confirmé · place ${vars.seatLabel}`
          : "Abonnement confirmé"
      );
      setAssigning(null);
      setSeatLabel(null);
      setSpaceId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => visitRequestsApi.reject(id),
    onSuccess: () => {
      toast.message("Demande refusée");
      setAssigning(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approve.isPending || reject.isPending;

  const onApproveClick = (req: VisitRequest) => {
    if (needsReservedSeat(req)) {
      setAssigning(req);
      setSeatLabel(req.seatLabel || null);
      setSpaceId(req.spaceId || null);
      return;
    }
    approve.mutate({ id: req.id });
  };

  if (isLoading) return null;
  if (!subRequests.length) return null;

  return (
    <>
      <Card className="border-violet-200 bg-violet-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Demandes d&apos;abonnement
            <Badge className="bg-violet-600 hover:bg-violet-600">
              {subRequests.length}
            </Badge>
          </CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Demandes mobiles en attente — validez ici (pas seulement dans la
            cloche).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Membre</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead>Demande</TableHead>
                <TableHead>Place</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subRequests.map((req) => {
                const needSeat = needsReservedSeat(req);
                return (
                  <TableRow key={req.id} className="bg-white/70">
                    <TableCell>
                      {req.member?.visitorNumber != null
                        ? `#${req.member.visitorNumber}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{memberLabel(req)}</div>
                      <div className="text-xs text-muted-foreground">
                        {req.member?.phone || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {req.price?.name || "Abonnement"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.price?.price != null
                          ? `${req.price.price} DT`
                          : ""}
                        {req.price?.billingUnit === "HOURLY" ? " · heures" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(req.createdAt), "dd MMM · HH:mm", {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      {needSeat ? (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <MapPin className="h-3 w-3" />
                          {req.seatLabel || "À attribuer"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sans bureau dédié
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onApproveClick(req)}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          {needSeat ? "Place & valider" : "Accepter"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={busy}
                          onClick={() => reject.mutate(req.id)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Refuser
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!assigning}
        onOpenChange={(o) => {
          if (!o) {
            setAssigning(null);
            setSeatLabel(null);
            setSpaceId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Attribuer une place — {assigning ? memberLabel(assigning) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {assigning?.price?.name || "Abonnement"}
            {assigning?.price?.price != null
              ? ` · ${assigning.price.price} DT`
              : ""}
            . Choisissez le bureau dédié puis validez.
          </p>
          <AbonnementSeatMap
            selectedLabel={seatLabel}
            selectedSpaceId={spaceId}
            onSelect={(label, sid) => {
              setSeatLabel(label);
              setSpaceId(sid || null);
            }}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={() => assigning && reject.mutate(assigning.id)}
            >
              Refuser
            </Button>
            <Button
              disabled={busy || !seatLabel}
              onClick={() =>
                assigning &&
                approve.mutate({
                  id: assigning.id,
                  seatLabel: seatLabel || undefined,
                  spaceId: spaceId || undefined,
                })
              }
            >
              Confirmer l&apos;abonnement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
