"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { readImageAsDataUrl } from "@/components/admin/ImageUpload";

type Props = {
  label: string;
  hint?: string;
  values: string[];
  onChange: (urls: string[]) => void;
  className?: string;
};

export function GalleryUpload({
  label,
  hint,
  values,
  onChange,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label>{label}</Label>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {values.map((url, i) => (
          <div key={`${i}-${url.slice(0, 24)}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-16 w-24 rounded-md border object-cover"
            />
            <button
              type="button"
              aria-label="Retirer"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed bg-muted/40 text-[11px] text-muted-foreground"
          onClick={() => inputRef.current?.click()}
        >
          + Photo
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (!files.length) return;
          const next = [...values];
          for (const file of files) {
            try {
              next.push(await readImageAsDataUrl(file));
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Upload impossible"
              );
            }
          }
          onChange(next);
        }}
      />
    </div>
  );
}
