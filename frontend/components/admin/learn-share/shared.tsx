"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/components/admin/advisor/advice-ui";
import { cn } from "@/lib/utils";
import { qrImageUrl, STATUS_LABEL, TYPE_LABEL, type RespondentType, type SurveyStatus } from "@/lib/surveys";

export const STATUS_TONE: Record<SurveyStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CLOSED: "bg-rose-50 text-rose-700",
};

export function StatusPill({ status }: { status: SurveyStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200",
        STATUS_TONE[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const TYPE_TONE: Record<RespondentType, string> = {
  MEMBER: "bg-emerald-50 text-emerald-700",
  NEW_MEMBER: "bg-teal-50 text-teal-700",
  KNOWN: "bg-blue-50 text-blue-700",
  ANONYMOUS: "bg-slate-100 text-slate-500",
};

export function TypeBadge({ type }: { type: RespondentType }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", TYPE_TONE[type])}>
      {TYPE_LABEL[type]}
    </span>
  );
}

/** "instagram · story" in a fixed-width face, unknown source kept as is. */
export function SourceTag({ source, medium }: { source: string; medium: string | null }) {
  return (
    <span className="whitespace-nowrap font-mono text-xs">
      {source}
      {medium ? <span className="text-muted-foreground"> · {medium}</span> : null}
    </span>
  );
}

export async function copyWithToast(text: string, what = "Lien copié") {
  await copyText(text);
  toast.success(what);
}

export function CopyButton({ text, label = "Copier", size = "sm" }: { text: string; label?: string; size?: "sm" | "default" }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={async () => {
        await copyWithToast(text);
        setDone(true);
      }}
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {label}
    </Button>
  );
}

export function QrDialog({
  open,
  onClose,
  title,
  subtitle,
  url,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  url: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="mx-auto rounded-xl border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImageUrl(url, 240)} width={240} height={240} alt={`QR code vers ${url}`} />
        </div>
        <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{url}</p>
        <p className="text-xs text-muted-foreground">Affiche : imprimer en 10 cm minimum pour qu’il se scanne de loin.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={qrImageUrl(url, 1000)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              PNG haute définition
            </a>
          </Button>
          <CopyButton text={url} />
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small horizontal bar for counts (scaled to the row's max). */
export function Bar({ value, max, tone = "bg-primary", className }: { value: number; max: number; tone?: string; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("ls-bar h-full rounded-full", tone)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export const selectClass =
  "h-9 rounded-md border bg-background px-2 text-sm transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring";

/** Public registration page of a session (works without an account). */
export const sessionUrl = (orgSlug: string, eventId: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/m/${orgSlug}/events/${eventId}`;
