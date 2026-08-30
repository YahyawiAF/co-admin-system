"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { MobileSeatMode } from "@/lib/types";

export function JournalReceptionToggles() {
  const queryClient = useQueryClient();
  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });
  const facility = facilities[0];
  const autoAccept = !!facility?.receptionAway;
  const visitorChoose = facility?.mobileSeatMode === "VISITOR_CHOOSE";

  const save = useMutation({
    mutationFn: (patch: {
      receptionAway?: boolean;
      mobileSeatMode?: MobileSeatMode;
    }) => facilityApi.update(facility!.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facility });
      queryClient.invalidateQueries({ queryKey: ["mobile-seat-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!facility) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm">
        <Pause className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Auto-accepter forfaits</span>
        <Switch
          checked={autoAccept}
          disabled={save.isPending}
          onCheckedChange={(on) => {
            save.mutate({
              receptionAway: on,
              mobileSeatMode: visitorChoose
                ? "VISITOR_CHOOSE"
                : on
                  ? "AUTO_ASSIGN"
                  : "ADMIN_ASSIGN",
            });
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
            save.mutate({
              mobileSeatMode: on
                ? "VISITOR_CHOOSE"
                : autoAccept
                  ? "AUTO_ASSIGN"
                  : "ADMIN_ASSIGN",
            });
          }}
        />
      </label>
    </div>
  );
}
