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

async function getCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: true, audio: false },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("camera");
}

function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Caméra refusée. Autorisez l’appareil photo pour scanner.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Aucune caméra trouvée sur cet appareil.";
  }
  if (!window.isSecureContext) {
    return "Ouvrez l’app en HTTPS (Safari) pour scanner le QR.";
  }
  return "Caméra indisponible. Autorisez l’appareil photo, ou scannez le QR d’accueil depuis l’appareil photo.";
}

type JsQrDecode = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
) => { data: string } | null;

function decodeWithJsQr(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  decode: JsQrDecode
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const max = 640;
  const scale = Math.min(1, max / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const code = decode(image.data, image.width, image.height, {
    inversionAttempts: "attemptBoth",
  });
  return code?.data ?? null;
}

async function playVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;
  if (video.readyState < 1) {
    await new Promise<void>((resolve) => {
      const onMeta = () => {
        video.removeEventListener("loadedmetadata", onMeta);
        resolve();
      };
      video.addEventListener("loadedmetadata", onMeta);
    });
  }
  try {
    await video.play();
  } catch {
    await new Promise((r) => window.setTimeout(r, 80));
    await video.play();
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const openScanner = () => {
    stopRef.current = false;
    confirmed.current = false;
    lastBad.current = null;
    setCamError(null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    stopRef.current = false;

    let cancelled = false;
    let timer = 0;
    const detector = getDetector();

    const handleValue = (value: string) => {
      if (isOrgQr(value, slug)) {
        confirmed.current = true;
        stopCamera();
        setOpen(false);
        onConfirmedRef.current();
        return true;
      }
      if (lastBad.current !== value) {
        lastBad.current = value;
        toast.error("QR non reconnu. Scannez le QR de l’accueil.");
      }
      return false;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError(
          window.isSecureContext
            ? "Caméra indisponible sur cet appareil."
            : "Ouvrez l’app en HTTPS (Safari) pour scanner le QR."
        );
        return;
      }

      try {
        const stream = await getCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        let video = videoRef.current;
        for (let i = 0; i < 40 && !video && !cancelled; i++) {
          await new Promise((r) => window.setTimeout(r, 25));
          video = videoRef.current;
        }
        if (!video || cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await playVideo(video, stream);

        const jsQrMod = await import("jsqr");
        const jsQR = (jsQrMod.default ?? jsQrMod) as JsQrDecode;
        const canvas = canvasRef.current ?? document.createElement("canvas");
        const tick = async () => {
          if (stopRef.current || cancelled || confirmed.current) return;
          try {
            if (video.readyState >= 2) {
              let value: string | null = null;
              if (detector) {
                const codes = await detector.detect(video);
                value = codes.find((c) => c.rawValue)?.rawValue ?? null;
              }
              if (!value) value = decodeWithJsQr(video, canvas, jsQR);
              if (value && handleValue(value)) return;
            }
          } catch {
            /* keep scanning */
          }
          timer = window.setTimeout(() => void tick(), 180);
        };
        void tick();
      } catch (err) {
        if (!cancelled) setCamError(cameraErrorMessage(err));
      }
    };

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
        onClick={openScanner}
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
