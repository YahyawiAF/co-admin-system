"use client";

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

type WifiSource = {
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
};

type Props = {
  seat?: SeatAssignmentInfo | null;
  /** Fallback when no seat Wi‑Fi (e.g. Accueil before check-in) */
  fallback?: WifiSource | null;
  /** Opens only when the user taps the Wi‑Fi button — never automatically */
  forceOpen?: boolean;
  onClose?: () => void;
};

export function WifiCredentialsModal({
  seat,
  fallback,
  forceOpen,
  onClose,
}: Props) {
  const ssid = (seat?.wifiSsid || fallback?.wifiSsid || "").trim();
  const password = (seat?.wifiPassword || fallback?.wifiPassword || "").trim();
  const spaceName = seat?.spaceName || fallback?.spaceName || "";
  const hasWifi = !!(ssid || password);

  const dismiss = () => onClose?.();

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
    <Dialog open={!!forceOpen} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Wi‑Fi {spaceName ? `· ${spaceName}` : ""}
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
