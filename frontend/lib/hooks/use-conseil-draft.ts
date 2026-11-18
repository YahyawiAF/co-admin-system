"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DIRECTOR_KEY, directorApi } from "@/lib/api/director";
import { decodeDraft, type ConseilDraftParam } from "@/components/admin/advisor/conseil-ui";
import type { ToolKind } from "@/lib/types";

/**
 * A feature page opened from a Directeur draft (« Préparer »): the brain's draft to pre-fill
 * the create form, and `linked(id)` to tie what was created to the priority and go back.
 */
export function useConseilDraft(kind: ToolKind) {
  const router = useRouter();
  const qc = useQueryClient();
  const [param, setParam] = useState<ConseilDraftParam | null>(null);

  useEffect(() => {
    const p = decodeDraft(new URLSearchParams(window.location.search).get("conseil"));
    if (p?.k === kind) setParam(p);
  }, [kind]);

  const back = useCallback(() => router.push("/directeur"), [router]);

  /** The owner saved the form: the new item counts for the solution from now on. */
  const linked = useCallback(
    async (targetId: string, opts: { stay?: boolean } = {}) => {
      const p = param;
      if (!p) return;
      setParam(null);
      // An old Conseil link (no priority) just fills the form: nothing to link any more
      if (!p.p) return;
      try {
        // What was created counts for the priority's watches from now on
        await directorApi.setLeg(p.p, p.l ?? 0, { targetId, status: "DONE" });
        qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
        toast.success("Fait : ses ventes comptent pour la priorité du Directeur", {
          action: opts.stay ? { label: "Directeur", onClick: back } : undefined,
        });
        if (!opts.stay) back();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [param, kind, qc, back],
  );

  /** Closed without saving: just forget the draft (stay on the page). */
  const dismiss = useCallback(() => {
    setParam(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("conseil");
    window.history.replaceState(null, "", url);
  }, []);

  return { draft: param?.d ?? null, active: !!param, linked, dismiss };
}
