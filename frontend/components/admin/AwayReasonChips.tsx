"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { outreachApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import type { AwayReason } from "@/lib/types";

export const AWAY_LABEL: Record<AwayReason, string> = {
  STUDY_HOME: "Révise à la maison",
  PRICE: "Prix",
  DISTANCE: "Trop loin",
  NOISE: "Bruit",
  HOURS: "Horaires",
  OTHER: "Autre",
};

/** 1 click: why the member stopped coming. Saved on the member; "révise" sets a recall date. */
export function AwayReasonChips({
  memberId,
  awayReason,
  recallAt,
}: {
  memberId: string;
  awayReason?: AwayReason | string | null;
  recallAt?: string | null;
}) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<{ reason: AwayReason | null; recallAt: string | null }>({
    reason: (awayReason as AwayReason) ?? null,
    recallAt: recallAt ?? null,
  });
  const save = useMutation({
    mutationFn: (reason: AwayReason | null) => outreachApi.awayReason({ memberId, reason }),
    onSuccess: (res) => {
      setSaved({ reason: res.awayReason, recallAt: res.recallAt });
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
      queryClient.invalidateQueries({ queryKey: ["newcomers-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Pourquoi ?</span>
      {(Object.keys(AWAY_LABEL) as AwayReason[]).map((r) => {
        const on = saved.reason === r;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            disabled={save.isPending}
            onClick={() => save.mutate(on ? null : r)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-200",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted"
            )}
          >
            {AWAY_LABEL[r]}
          </button>
        );
      })}
      {saved.reason ? (
        <span className="animate-in fade-in-0 text-xs font-medium text-emerald-700 duration-300 motion-reduce:animate-none dark:text-emerald-400">
          {saved.recallAt
            ? `Noté · rappel le ${format(new Date(saved.recallAt), "d MMM", { locale: fr })}`
            : "Noté sur sa fiche"}
        </span>
      ) : null}
    </div>
  );
}
