"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import {
  TunisiaPhoneField,
  isTunisiaPhone,
} from "@/components/visitor/TunisiaPhoneField";

function RecoverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { href, slug } = useOrg();
  const { confirm, onboarded, ready } = useVisitorSession();
  const token = searchParams.get("token") || "";
  const [phone, setPhone] = useState<string | undefined>();

  useEffect(() => {
    if (ready && onboarded) router.replace(href());
  }, [ready, onboarded, router, href]);

  const consume = useMutation({
    mutationFn: (body: { token?: string; phone?: string }) =>
      mobileApi.consumeMagicLogin({
        ...body,
        orgSlug: slug,
      }),
    onSuccess: (res) => {
      confirm(res.member, res.accessToken);
      toast.success("Profil confirmé");
      router.replace(href());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!token) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Lien invalide</h1>
        <p className="mt-2 text-sm text-slate-500">
          Demandez un nouveau lien à l&apos;accueil, ou créez votre profil.
        </p>
        <Button
          className="mt-4 h-12 w-full rounded-full"
          onClick={() => router.replace(href())}
        >
          Retour à l&apos;accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Confirmer mon profil
      </p>
      <h1 className="mt-1 text-2xl font-bold">Votre numéro</h1>
      <p className="mt-2 text-sm text-slate-500">
        Entrez le même numéro que celui enregistré à l&apos;accueil. C&apos;est
        la seule étape.
      </p>
      <div className="mt-4 space-y-3">
        <TunisiaPhoneField className="mt-1" value={phone} onChange={setPhone} />
        <Button
          className="h-12 w-full rounded-full"
          disabled={!isTunisiaPhone(phone) || consume.isPending}
          onClick={() =>
            consume.mutate({ token, phone: phone || undefined })
          }
        >
          {consume.isPending ? "Vérification…" : "Confirmer et ouvrir"}
        </Button>
      </div>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <Suspense
      fallback={<p className="text-center text-slate-500">Chargement…</p>}
    >
      <RecoverInner />
    </Suspense>
  );
}
