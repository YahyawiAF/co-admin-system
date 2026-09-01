"use client";

import { useMemo, useState } from "react";
import { Download, Copy, Check, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function visitorAppOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
}

export function visitorMobileUrl(orgSlug: string) {
  return `${visitorAppOrigin()}/m/${orgSlug}/entry`;
}

export function visitorQrImageUrl(orgSlug: string, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    visitorMobileUrl(orgSlug)
  )}`;
}

type Props = {
  orgSlug: string;
  orgName?: string | null;
  /** Larger card for dashboard / facility */
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function VisitorQrCard({
  orgSlug,
  orgName,
  size = "md",
  className,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const url = useMemo(() => visitorMobileUrl(orgSlug), [orgSlug]);
  const imgSize = size === "lg" ? 320 : size === "sm" ? 160 : 220;
  const qrSrc = useMemo(
    () => visitorQrImageUrl(orgSlug, imgSize),
    [orgSlug, imgSize]
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const downloadQr = async () => {
    setDownloading(true);
    try {
      const hiRes = visitorQrImageUrl(orgSlug, 800);
      const res = await fetch(hiRes);
      if (!res.ok) throw new Error("Téléchargement impossible");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `qr-visiteur-${orgSlug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("QR téléchargé");
    } catch (e) {
      toast.error((e as Error).message || "Téléchargement impossible");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <QrCode className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">QR visiteur</p>
        {orgName ? (
          <Badge variant="secondary" className="font-normal">
            {orgName}
          </Badge>
        ) : null}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`QR visiteur ${orgSlug}`}
        className="rounded-lg border bg-white p-2"
        width={imgSize}
        height={imgSize}
        src={qrSrc}
      />
      <p className="max-w-[16rem] break-all font-mono text-[11px] text-muted-foreground">
        {url}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={downloadQr}
          disabled={downloading || !orgSlug}
        >
          <Download className="mr-1.5 h-4 w-4" />
          {downloading ? "…" : "Télécharger"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copyUrl}
          disabled={!orgSlug}
        >
          {copied ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : (
            <Copy className="mr-1.5 h-4 w-4" />
          )}
          Copier le lien
        </Button>
      </div>
    </div>
  );
}
