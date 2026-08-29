"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import type { Member } from "@/lib/types";
import {
  TunisiaPhoneField,
  isTunisiaPhone,
} from "@/components/visitor/TunisiaPhoneField";

function RecoverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { href } = useOrg();
  const { confirm } = useVisitorSession();
  const token = searchParams.get("token") || "";
  const [phone, setPhone] = useState<string | undefined>();
  const [shortCode, setShortCode] = useState(searchParams.get("code") || "");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [needPin, setNeedPin] = useState(false);

  const consume = useMutation({
    mutationFn: (body: {
      token?: string;
      shortCode?: string;
      phone?: string;
    }) => mobileApi.consumeMagicLogin(body),
    onSuccess: (res) => {
      setMember(res.member);
      setAccessToken(res.accessToken);
      if (res.needsPin || !res.member.hasPin) {
        setNeedPin(true);
        toast.success("Profil récupéré — créez un PIN");
        return;
      }
      confirm(res.member, res.accessToken);
      toast.success("Profil récupéré");
      router.replace(href());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!token) return;
    consume.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const savePin = useMutation({
    mutationFn: () =>
      mobileApi.setPin({ memberId: member!.id, pin }),
    onSuccess: (res) => {
      confirm(res.member, res.accessToken);
      toast.success("PIN enregistré");
      router.replace(href());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (needPin && member) {
    const pinOk = /^\d{4}$/.test(pin) && pin === pin2;
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Nouveau code PIN</h1>
        <p className="mt-2 text-sm text-slate-500">
          Pour vous reconnecter facilement dans l&apos;icône Collabora.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>PIN (4 chiffres)</Label>
            <Input
              className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>
          <div>
            <Label>Confirmer</Label>
            <Input
              className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) =>
                setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>
          <Button
            className="h-12 w-full rounded-full"
            disabled={!pinOk || savePin.isPending}
            onClick={() => savePin.mutate()}
          >
            Enregistrer et continuer
          </Button>
        </div>
      </div>
    );
  }

  if (token && consume.isPending) {
    return (
      <p className="rounded-3xl bg-white p-6 text-center text-slate-500 shadow-sm">
        Récupération du profil…
      </p>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold">Récupérer mon profil</h1>
      <p className="mt-2 text-sm text-slate-500">
        Collez le lien reçu (token) ou utilisez le code 6 chiffres + téléphone.
        Pour l&apos;icône Accueil, préférez le code saisi dans l&apos;app.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Téléphone</Label>
          <TunisiaPhoneField className="mt-1" value={phone} onChange={setPhone} />
        </div>
        <div>
          <Label>Code à 6 chiffres</Label>
          <Input
            className="mt-1 h-12 text-center text-2xl tracking-[0.35em]"
            inputMode="numeric"
            maxLength={6}
            value={shortCode}
            onChange={(e) =>
              setShortCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
        <Button
          className="h-12 w-full rounded-full"
          disabled={
            !isTunisiaPhone(phone) ||
            !/^\d{6}$/.test(shortCode) ||
            consume.isPending
          }
          onClick={() =>
            consume.mutate({ shortCode, phone: phone || undefined })
          }
        >
          Valider le code
        </Button>
        {accessToken ? (
          <Button
            variant="outline"
            className="h-11 w-full rounded-full"
            onClick={() => {
              if (member) confirm(member, accessToken);
              router.replace(href());
            }}
          >
            Continuer
          </Button>
        ) : null}
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
