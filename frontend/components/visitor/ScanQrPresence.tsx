"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type DetectorCtor = new (opts?: {
  formats?: string[];
}) => {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
};

function getDetector(): InstanceType<DetectorCtor> | null {
  const Ctor = (
    window as unknown as { BarcodeDetector?: DetectorCtor }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

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
};

export function ScanQrPresence({
  slug,
  pending,
  disabled,
  error,
  hint,
  onConfirmed,
}: Props) {
  const [open, setOpen] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const confirmed = useRef(false);
  const lastBad = useRef<string | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  const stopCamera = () => {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  };

  useEffect(() => {
    if (!open) return;
    stopRef.current = false;
    confirmed.current = false;
    setCamError(null);

    let cancelled = false;
    const start = async () => {
      const detector = getDetector();
      if (!detector) {
        setCamError(
          "Scan QR non supporté sur cet appareil. Mettez à jour le navigateur, ou scannez le QR d’accueil depuis l’appareil photo."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopRef.current || cancelled || confirmed.current) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes.find((c) => c.rawValue)?.rawValue;
              if (value) {
                if (isOrgQr(value, slug)) {
                  confirmed.current = true;
                  stopCamera();
                  setOpen(false);
                  onConfirmedRef.current();
                  return;
                }
                if (!lastBad.current || lastBad.current !== value) {
                  lastBad.current = value;
                  toast.error("QR non reconnu. Scannez le QR de l’accueil.");
                }
              }
            }
          } catch {
            /* keep scanning */
          }
          window.setTimeout(() => void tick(), 280);
        };
        void tick();
      } catch {
        setCamError("Caméra refusée. Autorisez l’appareil photo pour scanner.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, slug]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
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
        onClick={() => setOpen(true)}
      >
        <QrCode className="mr-2 h-5 w-5" />
        {pending ? "Enregistrement…" : "Scan QR code"}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-3 py-3 text-white">
            <p className="text-sm font-medium">Scannez le QR de l’accueil</p>
            <button
              type="button"
              className="rounded-full p-2"
              aria-label="Fermer"
              onClick={() => {
                stopCamera();
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
