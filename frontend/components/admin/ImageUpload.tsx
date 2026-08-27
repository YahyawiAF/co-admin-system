"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choisissez une image (JPG, PNG, WebP…)"));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("Image trop lourde (max 4 Mo)"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > MAX_EDGE || h > MAX_EDGE) {
          const ratio = Math.min(MAX_EDGE / w, MAX_EDGE / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Compression impossible"));
          return;
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Compression impossible"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire le fichier"));
    };
    img.src = url;
  });
}

type ImageUploadProps = {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

export function ImageUpload({
  label,
  value,
  onChange,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-16 w-24 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
            Aucune
          </div>
        )}
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                onChange(await readImageAsDataUrl(file));
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Upload impossible"
                );
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Choisir une image
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              Retirer
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
