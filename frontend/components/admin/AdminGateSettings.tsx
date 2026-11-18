"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { organizationsApi, type AdminGate } from "@/lib/api/resources";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["admin-gate"];

function adminLink(key: string) {
  if (typeof window === "undefined") return `/${key}/admin`;
  return `${window.location.origin}/${key}/admin`;
}

/** Same as opening the link: this device keeps admin access (cookie set by the middleware). */
async function unlockThisDevice(key: string) {
  try {
    await fetch(`/${encodeURIComponent(key)}/admin`, {
      redirect: "manual",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    /* the link still works by hand */
  }
}

/** Espace › Profil & QR: hide admin behind a secret link, change the code, QR for phones. */
export function AdminGateSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => organizationsApi.adminGate(),
    retry: false,
  });
  const [draft, setDraft] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data?.key) setDraft(data.key);
  }, [data?.key]);

  const link = data?.key ? adminLink(data.key) : "";

  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { width: 320, margin: 1 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  const save = useMutation({
    mutationFn: (body: { enabled?: boolean; key?: string; regenerate?: boolean }) =>
      organizationsApi.updateAdminGate(body),
    onSuccess: async (next: AdminGate, body) => {
      await unlockThisDevice(next.key);
      qc.setQueryData(QUERY_KEY, next);
      if (body.regenerate || body.key) {
        toast.success("Nouveau code enregistré — les anciens liens ne marchent plus");
      } else {
        toast.success(next.enabled ? "Admin caché — cet appareil garde l’accès" : "Admin visible comme avant");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  if (error) return null; // staff: not their setting

  const dirty = !!data && draft.trim() !== data.key;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" aria-hidden />
          Accès admin secret
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <span>
                <span className="block font-medium">Cacher l’admin</span>
                <span className="block text-sm text-muted-foreground">
                  {data.enabled
                    ? "Seuls les téléphones et ordinateurs qui ont ouvert le lien voient l’admin."
                    : "L’admin s’ouvre sur ordinateur comme avant. Les téléphones ont besoin du lien."}
                </span>
              </span>
              <Switch
                checked={data.enabled}
                disabled={save.isPending}
                onCheckedChange={(v) => save.mutate({ enabled: v })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Votre lien</span>
                  <div className="flex gap-2">
                    <code className="flex-1 truncate rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                      {link}
                    </code>
                    <Button type="button" variant="outline" onClick={copy} aria-label="Copier le lien">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-gate-key" className="text-sm font-medium">
                    Code secret
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="admin-gate-key"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.replace(/\s/g, ""))}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      className={cn("transition-opacity duration-200", !dirty && "pointer-events-none opacity-0")}
                      disabled={!dirty || save.isPending}
                      onClick={() => save.mutate({ key: draft.trim() })}
                    >
                      Enregistrer
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">6 à 40 lettres ou chiffres.</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Créer un nouveau code ? Les appareils qui ont utilisé l’ancien lien perdent l’accès (sauf celui-ci)."
                      )
                    ) {
                      save.mutate({ regenerate: true });
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Changer le code
                </Button>
                <p className="text-sm text-muted-foreground">
                  Sur un téléphone : scannez le QR, connectez-vous, l’admin reste ouvert 1 an sur ce téléphone.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                {qr ? (
                  <img
                    key={qr}
                    src={qr}
                    alt="QR du lien admin secret"
                    className="h-44 w-44 rounded-lg border bg-white p-2 animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none"
                  />
                ) : (
                  <div className="h-44 w-44 rounded-lg border bg-slate-50" />
                )}
                {qr ? (
                  <Button asChild variant="ghost" size="sm">
                    <a href={qr} download="acces-admin.png">
                      <Download className="mr-2 h-4 w-4" aria-hidden />
                      Télécharger
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
