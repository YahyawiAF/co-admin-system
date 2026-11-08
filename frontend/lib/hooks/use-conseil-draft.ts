"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { advisorApi } from "@/lib/api/resources";
import { decodeDraft, type ConseilDraftParam } from "@/components/admin/advisor/conseil-ui";
import type { ToolKind } from "@/lib/types";

/**
 * A feature page opened from Conseil IA (« Préparer »): the AI's draft to pre-fill the
 * create form, and `linked(id)` to tie what was created to the solution and go back.
 */
export function useConseilDraft(kind: ToolKind) {
  const router = useRouter();
  const qc = useQueryClient();
  const [param, setParam] = useState<ConseilDraftParam | null>(null);

  useEffect(() => {
    const p = decodeDraft(new URLSearchParams(window.location.search).get("conseil"));
    if (p?.k === kind) setParam(p);
  }, [kind]);

  const back = useCallback(
    (p: ConseilDraftParam | null) => router.push(p?.a ? `/conseiller?area=${p.a}` : "/conseiller"),
    [router],
  );

  /** The owner saved the form: the new item counts for the solution from now on. */
  const linked = useCallback(
    async (targetId: string, opts: { stay?: boolean } = {}) => {
      const p = param;
      if (!p) return;
      setParam(null);
      try {
        await advisorApi.addTool(p.i, { kind, targetId, stepIndex: p.s });
        qc.invalidateQueries({ queryKey: ["advisor"] });
        toast.success("Lié à la solution : ses ventes comptent maintenant pour elle", {
          action: opts.stay ? { label: "Conseil IA", onClick: () => back(p) } : undefined,
        });
        if (!opts.stay) back(p);
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
