"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { outreachApi } from "@/lib/api/resources";
import type { OutreachItem, OutreachOutcome } from "@/lib/types";

const ANSWERS: Array<{ outcome: OutreachOutcome; label: string }> = [
  { outcome: "INTERESTED", label: "Intéressé" },
  { outcome: "OTHER_OFFER", label: "Veut une autre offre" },
  { outcome: "AWAY", label: "Révise chez lui / absent" },
  { outcome: "NOT_INTERESTED", label: "Pas intéressé" },
];

/** Abonnement relances: the renewal can be done right away. */
const RENEW = new Set(["ABO_EXPIRING", "ABO_ENDED", "CONVERT", "TOP_UP"]);

/**
 * At check-in: the relance due for this member, answered in one tap and counted
 * as an in-person contact. Shown once per reason; "Plus tard" just hides it.
 */
export function RelanceReminder({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["outreach", "member", memberId],
    queryFn: () => outreachApi.forMember(memberId),
    staleTime: 60_000,
  });
  const [done, setDone] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const item: OutreachItem | undefined = data?.items[0];
  const save = useMutation({
    mutationFn: (outcome: OutreachOutcome) =>
      outreachApi.answer({
        memberId,
        reason: item!.reason,
        outcome,
        channel: "PERSON",
        followUpAt: outcome === "INTERESTED" ? new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) : null,
      }),
    onSuccess: (_r, outcome) => {
      setDone(`Noté en personne : ${ANSWERS.find((a) => a.outcome === outcome)?.label.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["outreach"] });
      void queryClient.invalidateQueries({ queryKey: ["outreach-suivi"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (hidden || (!item && !done)) return null;
  if (done) {
    return (
      <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 animate-in fade-in-0 duration-200 motion-reduce:animate-none dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" /> {done}
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-300 motion-reduce:animate-none dark:border-violet-800 dark:bg-violet-950/40">
      <div className="flex items-start gap-1.5 text-xs">
        <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
        <div className="min-w-0">
          <b className="text-violet-900 dark:text-violet-100">Relance à faire : </b>
          <span>{item!.title}</span>
          {item!.detail ? <span className="block text-muted-foreground">{item!.detail}</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {RENEW.has(item!.reason) ? (
          <Link
            href={`/abonnements?memberId=${memberId}`}
            className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Renouveler maintenant
          </Link>
        ) : null}
        {ANSWERS.map((a) => (
          <button
            key={a.outcome}
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(a.outcome)}
            className={cn(
              "rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:border-violet-500 hover:bg-violet-100 disabled:opacity-50 dark:hover:bg-violet-900/50",
            )}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
