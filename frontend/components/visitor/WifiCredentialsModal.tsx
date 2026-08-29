"use client";

import { useEffect, useState } from "react";
import { Copy, Wifi } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SeatAssignmentInfo } from "@/lib/types";

type Props = {
  seat?: SeatAssignmentInfo | null;
  /** Show when visit just approved or user taps Wi‑Fi */
  forceOpen?: boolean;
  onClose?: () => void;
};

const seenKey = (spaceId: string) => `wifi-seen:${spaceId}`;

export function WifiCredentialsModal({ seat, forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);

  const ssid = seat?.wifiSsid?.trim() || "";
  const password = seat?.wifiPassword?.trim() || "";
  const spaceId = seat?.spaceId || "";
  const hasWifi = !!(ssid || password);

  useEffect(() => {
    if (!hasWifi || !spaceId) return;
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(seenKey(spaceId)) === "1") return;
    setOpen(true);
  }, [hasWifi, spaceId, forceOpen, ssid, password]);

  const dismiss = () => {
    if (spaceId) sessionStorage.setItem(seenKey(spaceId), "1");
    setOpen(false);
    onClose?.();
  };

  const copy = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Copie impossible");
    }
  };

  if (!hasWifi) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Wi‑Fi {seat?.spaceName ? `· ${seat.spaceName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {ssid ? (
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Nom du réseau
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="select-all font-mono text-base font-semibold">
                  {ssid}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void copy("Nom Wi‑Fi", ssid)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copier
                </Button>
              </div>
            </div>
          ) : null}
          {password ? (
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Mot de passe
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="select-all break-all font-mono text-base font-semibold">
                  {password}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void copy("Mot de passe", password)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copier
                </Button>
              </div>
            </div>
          ) : null}
          {seat?.seatLabel ? (
            <p className="text-xs text-slate-500">
              Votre place :{" "}
              {[seat.spaceName, seat.tableName, seat.seatLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button className="h-11 w-full" onClick={dismiss}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
