"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mobileApi, organizationsApi } from "@/lib/api/resources";
import { visitorMobileUrl } from "@/components/admin/VisitorQrCard";

export function memberInviteUrl(orgSlug: string, token: string) {
  return `${visitorMobileUrl(orgSlug)}/join?token=${encodeURIComponent(token)}`;
}

export function memberInviteWhatsAppText(name: string, url: string) {
  const who = name.trim() || "bonjour";
  return [
    `Bonjour ${who},`,
    "",
    "Voici votre espace Collabora :",
    url,
    "",
    "Ouvrez le lien et confirmez votre numéro de téléphone.",
  ].join("\n");
}

export function waMeDigits(phone?: string | null) {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("216")) return d;
  if (d.length === 8) return `216${d}`;
  if (d.startsWith("0") && d.length === 9) return `216${d.slice(1)}`;
  return d;
}

type Issued = { token: string; expiresAt: string };

type Props = {
  memberId: string;
  memberName: string;
  phone?: string | null;
  autoIssue?: boolean;
  title?: string;
};

export function MemberInviteShare({
  memberId,
  memberName,
  phone,
  autoIssue = false,
  title = "Lien profil mobile",
}: Props) {
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });
  const orgSlug = organizations[0]?.slug || "collabora-hub";
  const [issued, setIssued] = useState<Issued | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    setIssued(null);
    autoStarted.current = false;
  }, [memberId]);

  const create = useMutation({
    mutationFn: () => mobileApi.createMemberLoginToken(memberId),
    onSuccess: (res) => {
      setIssued({
        token: res.token,
        expiresAt: String(res.expiresAt),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!autoIssue || !memberId || autoStarted.current) return;
    autoStarted.current = true;
    create.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIssue, memberId]);

  const magicUrl = useMemo(() => {
    if (!issued) return "";
    return memberInviteUrl(orgSlug, issued.token);
  }, [issued, orgSlug]);

  const qrSrc = useMemo(() => {
    if (!magicUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      magicUrl
    )}`;
  }, [magicUrl]);

  const waText = useMemo(
    () => (magicUrl ? memberInviteWhatsAppText(memberName, magicUrl) : ""),
    [magicUrl, memberName]
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const waHref = phone
    ? `https://wa.me/${waMeDigits(phone)}?text=${encodeURIComponent(waText)}`
    : "";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            Le visiteur ouvre le lien et confirme uniquement son numéro — pas
            de code.
          </p>
        </div>
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={create.isPending}
        onClick={() => create.mutate()}
      >
        {issued ? "Générer un nouveau lien" : "Générer le lien"}
      </Button>
      {issued ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="QR profil"
            className="mx-auto rounded-lg border bg-white p-2"
            width={160}
            height={160}
            src={qrSrc}
          />
          <p className="break-all font-mono text-[10px] text-muted-foreground">
            {magicUrl}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Valable jusqu’au{" "}
            {format(new Date(issued.expiresAt), "dd MMM HH:mm", {
              locale: fr,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(magicUrl, "Lien")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copier le lien
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(waText, "Message WhatsApp")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Message
            </Button>
            {waHref ? (
              <Button type="button" size="sm" asChild>
                <a href={waHref} target="_blank" rel="noreferrer">
                  Ouvrir WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
