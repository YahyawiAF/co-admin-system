"use client";

import { useRef, useState } from "react";
import { QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQrCamera } from "@/lib/hooks/use-qr-camera";

function isOrgQr(text: string, slug: string): boolean {
  const t = text.trim();
  if (!t || !slug) return false;
  const lower = t.toLowerCase();
  const s = slug.toLowerCase();
  if (lower.includes(`/m/${s}`)) return true;
  try {
    const u = new URL(t);
    return u.pathname.toLowerCase().includes(`/m/${s}`);
  } catch {
    return false;
  }
}

type Props = {
  slug: string;
  pending?: boolean;
  disabled?: boolean;
  error?: string | null;
  hint?: string | null;
  onConfirmed: () => void;
  /** "tile": square action tile only — the parent renders hint / error */
  variant?: "card" | "tile";
};

export function ScanQrPresence({
  slug,
  pending,
  disabled,
  error,
  hint,
  onConfirmed,
  variant = "card",
}: Props) {
  const [open, setOpen] = useState(false);
  const lastBad = useRef<string | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  const { videoRef, canvasRef, camError, stop } = useQrCamera({
    active: open,
    fallbackError:
      "Caméra indisponible. Autorisez l’appareil photo, ou scannez le QR d’accueil depuis l’appareil photo.",
    onValue: (value) => {
      if (isOrgQr(value, slug)) {
        setOpen(false);
        onConfirmedRef.current();
        return true;
      }
      if (lastBad.current !== value) {
        lastBad.current = value;
        toast.error("QR non reconnu. Scannez le QR de l’accueil.");
      }
      return false;
    },
  });

  const openScanner = () => {
    lastBad.current = null;
    setOpen(true);
  };

  return (
    <div
      className={
        variant === "tile" ? "flex" : "rounded-2xl bg-white p-4 shadow-sm"
      }
    >
      {variant === "tile" ? (
        <button
          type="button"
          disabled={pending || disabled}
          onClick={openScanner}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-3 py-4 text-center text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <QrCode className="h-7 w-7" />
          </span>
          <span className="text-sm font-bold leading-tight">
            {pending ? "Enregistrement…" : "Je suis sur place"}
          </span>
          <span className="text-[11px] leading-tight text-white/80">
            Scanner le QR de l&apos;accueil
          </span>
        </button>
      ) : (
        <>
          {hint ? (
            <p className="mb-2 text-center text-sm text-slate-500">{hint}</p>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            className="h-12 w-full rounded-full"
            disabled={pending || disabled}
            onClick={openScanner}
          >
            <QrCode className="mr-2 h-5 w-5" />
            {pending ? "Enregistrement…" : "Scan QR code"}
          </Button>
        </>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-3 py-3 text-white">
            <p className="text-sm font-medium">Scannez le QR de l’accueil</p>
            <button
              type="button"
              className="rounded-full p-2"
              aria-label="Fermer"
              onClick={() => {
                stop();
                setOpen(false);
              }}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
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
              <div className="h-52 w-52 rounded-2xl border-2 border-white/90" />
            </div>
          </div>
          {camError ? (
            <p className="px-4 py-4 text-center text-sm text-white/90">
              {camError}
            </p>
          ) : (
            <p className="px-4 py-4 text-center text-sm text-white/80">
              Cadrez le QR affiché à l’accueil
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
