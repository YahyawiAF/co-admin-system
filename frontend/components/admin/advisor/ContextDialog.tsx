"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { AdvisorContextPanel } from "./AdvisorContextPanel";

function ContextCard({ value }: { value: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = useMutation({
    mutationFn: () => advisorApi.saveSettings({ businessContext: text }),
    onSuccess: () => {
      toast.success("Contexte enregistré");
      qc.invalidateQueries({ queryKey: ["advisor", "settings"] });
      qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="shadow-none" id="advisor-context">
      <CardContent className="space-y-2 p-4">
        <div>
          <div className="font-medium">Votre contexte</div>
          <p className="text-sm text-muted-foreground">
            Ce que l&apos;IA ne peut pas voir dans les chiffres : quartier, type de clients,
            concurrents et leurs prix, vos objectifs, ce que vous avez déjà essayé.
          </p>
        </div>
        <Textarea
          rows={4}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. : près de la fac, surtout des étudiants et des freelances. Un café à côté vend l'expresso 2,5 DT. Objectif : remplir les après-midis."
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending || text === value}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Without an API key: copy the exact prompt, paste it into claude.ai, paste the JSON back. */
/** « Mon contexte »: what the director can't see in the numbers (place, calendar, neighbours, audiences, questions). */
export function ContextDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings, enabled: open });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "h-[92vh] max-w-5xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Directeur</p>
          <DialogTitle className="relative mt-1 text-2xl font-extrabold text-white">Mon contexte</DialogTitle>
          <DialogDescription className="relative mt-1 text-[13px] text-indigo-100">
            Ce que le directeur ne voit pas dans les chiffres. Il le lit à chaque « Exporter pour Claude ».
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <AdvisorContextPanel />
          <ContextCard value={settings.data?.businessContext ?? ""} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
