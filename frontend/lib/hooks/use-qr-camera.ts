"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function cameraErrorMessage(err: unknown, fallback: string): string {
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
  return fallback;
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

type Options = {
  /** Camera runs while true (the <video> must be mounted). */
  active: boolean;
  /** Return true to stop scanning (value accepted). */
  onValue: (value: string) => boolean;
  /** Shown when the camera fails for an unknown reason. */
  fallbackError?: string;
};

/** Live camera + QR decoding (BarcodeDetector, jsQR fallback). */
export function useQrCamera({
  active,
  onValue,
  fallbackError = "Caméra indisponible. Autorisez l’appareil photo.",
}: Options) {
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const onValueRef = useRef(onValue);
  onValueRef.current = onValue;
  const fallbackRef = useRef(fallbackError);
  fallbackRef.current = fallbackError;

  const stop = useCallback(() => {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    stopRef.current = false;
    setCamError(null);

    let cancelled = false;
    let timer = 0;
    const detector = getDetector();

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
          if (stopRef.current || cancelled) return;
          try {
            if (video.readyState >= 2) {
              let value: string | null = null;
              if (detector) {
                const codes = await detector.detect(video);
                value = codes.find((c) => c.rawValue)?.rawValue ?? null;
              }
              if (!value) value = decodeWithJsQr(video, canvas, jsQR);
              if (value && onValueRef.current(value)) {
                stop();
                return;
              }
            }
          } catch {
            /* keep scanning */
          }
          timer = window.setTimeout(() => void tick(), 180);
        };
        void tick();
      } catch (err) {
        if (!cancelled) setCamError(cameraErrorMessage(err, fallbackRef.current));
      }
    };

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, [active, stop]);

  return { videoRef, canvasRef, camError, stop };
}
