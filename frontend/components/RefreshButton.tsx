"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Refetch every query on screen (and mark the rest stale) without reloading the page. */
export function RefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await queryClient.invalidateQueries({ refetchType: "active" });
      toast.success("Actualisé", { duration: 1500 });
    } catch {
      toast.error("Actualisation impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("shrink-0", className)}
      onClick={() => void refresh()}
      disabled={busy}
      aria-label="Actualiser"
      title="Actualiser"
    >
      <RefreshCw className={cn("h-5 w-5", busy && "animate-spin")} />
    </Button>
  );
}
