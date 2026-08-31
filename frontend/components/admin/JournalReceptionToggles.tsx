"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, MapPin, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { AwayArrival, MobileSeatMode } from "@/lib/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function JournalReceptionToggles() {
  const queryClient = useQueryClient();
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapRows, setRecapRows] = useState<AwayArrival[]>([]);
  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });
  const facility = facilities[0];
  const autoAccept = !!facility?.receptionAway;
  const visitorChoose = facility?.mobileSeatMode === "VISITOR_CHOOSE";
  const hasAwayWindow = !!facility?.receptionAwayStartedAt;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.facility });
    queryClient.invalidateQueries({ queryKey: ["mobile-seat-settings"] });
    queryClient.invalidateQueries({ queryKey: ["journal"] });
  };

  const save = useMutation({
    mutationFn: (patch: {
      receptionAway?: boolean;
      mobileSeatMode?: MobileSeatMode;
      receptionAwayStartedAt?: string | null;
    }) => facilityApi.update(facility!.id, patch),
    onError: (e: Error) => toast.error(e.message),
  });

  const openRecap = async () => {
    if (!facility) return;
    try {
      const data = await facilityApi.awayArrivals(facility.id);
      setRecapRows(data.arrivals || []);
      setRecapOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de charger");
    }
  };

  const dismissRecap = () => {
    if (!facility) return;
    save.mutate(
      { receptionAwayStartedAt: null },
      {
        onSuccess: () => {
          setRecapOpen(false);
          setRecapRows([]);
          invalidate();
          toast.success("Récapitulatif masqué");
        },
      }
    );
  };

  if (!facility) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {hasAwayWindow && !autoAccept ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => void openRecap()}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Arrivées pendant l’absence
        </Button>
      ) : null}
      <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm">
        <Pause className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Auto-accepter forfaits</span>
        <Switch
          checked={autoAccept}
          disabled={save.isPending}
          onCheckedChange={(on) => {
            save.mutate(
              {
                receptionAway: on,
                mobileSeatMode: visitorChoose
                  ? "VISITOR_CHOOSE"
                  : on
                    ? "AUTO_ASSIGN"
                    : "ADMIN_ASSIGN",
                receptionAwayStartedAt: on
                  ? new Date().toISOString()
                  : facility.receptionAwayStartedAt || null,
              },
              {
                onSuccess: async () => {
                  invalidate();
                  if (!on) await openRecap();
                  else toast.success("Auto-acceptation activée");
                },
              }
            );
          }}
        />
      </label>
      <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Visiteur choisit sa place</span>
        <Switch
          checked={visitorChoose}
          disabled={save.isPending}
          onCheckedChange={(on) => {
            save.mutate(
              {
                mobileSeatMode: on
                  ? "VISITOR_CHOOSE"
                  : autoAccept
                    ? "AUTO_ASSIGN"
                    : "ADMIN_ASSIGN",
              },
              { onSuccess: () => invalidate() }
            );
          }}
        />
      </label>

      <Dialog open={recapOpen} onOpenChange={setRecapOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arrivées pendant votre absence</DialogTitle>
            <DialogDescription>
              Visiteurs qui se sont pointés pendant l’auto-acceptation, avec
              leur place.
            </DialogDescription>
          </DialogHeader>
          {!recapRows.length ? (
            <p className="text-sm text-muted-foreground">
              Personne n’est arrivé pendant cette période.
            </p>
          ) : (
            <ul className="space-y-2">
              {recapRows.map((row) => (
                <li
                  key={`${row.journalId || row.memberId}-${row.arrivedAt}`}
                  className="rounded-xl border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {row.name}
                        {row.visitorNumber != null
                          ? ` · #${row.visitorNumber}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.forfait || "Forfait"}
                        {row.seatLabel
                          ? ` · Place ${row.seatLabel}`
                          : " · Place non assignée"}
                        {row.spaceName ? ` (${row.spaceName})` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {format(new Date(row.arrivedAt), "HH:mm", { locale: fr })}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setRecapOpen(false)}>
              Garder
            </Button>
            <Button onClick={dismissRecap} disabled={save.isPending}>
              J’ai vu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
