"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { journalApi } from "@/lib/api/resources";
import { parseCheckInCode } from "@/lib/check-in-code";
import { useQrCamera } from "@/lib/hooks/use-qr-camera";
import type { Journal } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Check-in found from the visitor's session QR / code. */
  onFound: (journal: Journal) => void;
};

/** Scan the visitor's session QR (or type its code) to open that check-in. */
export function CheckInScanDialog({ open, onOpenChange, onFound }: Props) {
  const [typed, setTyped] = useState("");
  const [camera, setCamera] = useState(true);
  /** Last code sent — the camera keeps seeing the same QR, so don't re-query it. */
  const lastScan = useRef<string | null>(null);

  const lookup = useMutation({
    mutationFn: (code: string) => journalApi.byCheckInCode(code),
    onSuccess: (journal) => {
      if (journal.leaveTime) {
        toast.error("Cette session est déjà terminée.");
        return;
      }
      onOpenChange(false);
      onFound(journal);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Code introuvable");
    },
  });

  const submit = (raw: string) => {
    const code = parseCheckInCode(raw);
    if (!code) {
      toast.error("Code invalide (6 caractères).");
      return false;
    }
    if (lookup.isPending || lastScan.current === code) return false;
    lastScan.current = code;
    lookup.mutate(code);
    return true;
  };

  const { videoRef, canvasRef, camError } = useQrCamera({
    active: open && camera,
    fallbackError: "Caméra indisponible. Saisissez le code à la place.",
    onValue: (value) => {
      if (!parseCheckInCode(value)) return false;
      submit(value);
      return false;
    },
  });

  useEffect(() => {
    if (!open) return;
    setTyped("");
    lastScan.current = null;
    lookup.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner une session</DialogTitle>
          <DialogDescription>
            Scannez le QR affiché sur le téléphone du visiteur, ou saisissez son
            code, pour lui attribuer une place.
          </DialogDescription>
        </DialogHeader>

        {camera ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute h-px w-px opacity-0"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-2xl border-2 border-white/90" />
            </div>
            {lookup.isPending ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : null}
            {camError ? (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-center text-xs text-white">
                {camError}
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            lastScan.current = null;
            submit(typed);
          }}
        >
          <Input
            autoFocus={!camera}
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="Code (ex. ABC 123)"
            maxLength={12}
            className="font-mono uppercase tracking-widest"
          />
          <Button type="submit" disabled={lookup.isPending || !typed.trim()}>
            {lookup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Ouvrir"
            )}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setCamera((c) => !c)}
        >
          <ScanLine className="mr-2 h-4 w-4" />
          {camera ? "Désactiver la caméra" : "Activer la caméra"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
