"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TunisiaPhoneField,
  isTunisiaPhone,
} from "@/components/visitor/TunisiaPhoneField";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import type { Member } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Account login (téléphone + PIN) — for members who already upgraded. */
export function VisitorLoginDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [phone, setPhone] = useState<string | undefined>();
  const [loginPin, setLoginPin] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [mode, setMode] = useState<"pin" | "code">("pin");

  const finish = (member: Member, accessToken?: string) => {
    confirm(member, accessToken);
    onOpenChange(false);
    setLoginPin("");
    setShortCode("");
    // Accueil will route: abo → presence, else → forfait
    router.replace(href());
  };

  const pinLogin = useMutation({
    mutationFn: () =>
      mobileApi.pinLogin({ phone: phone || "", pin: loginPin, orgSlug: slug }),
    onSuccess: (res) => {
      toast.success(
        res.member.firstName
          ? `Bonjour ${res.member.firstName}`
          : "Connexion réussie"
      );
      finish(res.member, res.accessToken);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const codeLogin = useMutation({
    mutationFn: () =>
      mobileApi.consumeMagicLogin({
        shortCode,
        phone: phone || "",
        orgSlug: slug,
      }),
    onSuccess: (res) => {
      toast.success("Profil récupéré");
      finish(res.member, res.accessToken);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "pin" ? "Connexion" : "Code de récupération"}
          </DialogTitle>
        </DialogHeader>
        {mode === "pin" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Compte avec PIN (app installée) — téléphone + 4 chiffres.
            </p>
            <div>
              <Label>Téléphone</Label>
              <TunisiaPhoneField
                className="mt-1"
                value={phone}
                onChange={setPhone}
              />
            </div>
            <div>
              <Label>PIN</Label>
              <Input
                className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
                inputMode="numeric"
                maxLength={4}
                value={loginPin}
                onChange={(e) =>
                  setLoginPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
              />
            </div>
            <Button
              className="h-12 w-full rounded-full"
              disabled={
                !isTunisiaPhone(phone) ||
                !/^\d{4}$/.test(loginPin) ||
                pinLogin.isPending
              }
              onClick={() => pinLogin.mutate()}
            >
              Se connecter
            </Button>
            <p className="text-center text-xs text-slate-500">
              PIN oublié ?{" "}
              <button
                type="button"
                className="font-medium text-indigo-600"
                onClick={() => setMode("code")}
              >
                Code accueil
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              className="text-sm text-indigo-600"
              onClick={() => setMode("pin")}
            >
              ← Retour
            </button>
            <p className="text-sm text-slate-500">
              Code 6 chiffres donné par l&apos;accueil, avec votre téléphone.
            </p>
            <div>
              <Label>Téléphone</Label>
              <TunisiaPhoneField
                className="mt-1"
                value={phone}
                onChange={setPhone}
              />
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
                placeholder="000000"
              />
            </div>
            <Button
              className="h-12 w-full rounded-full"
              disabled={
                !isTunisiaPhone(phone) ||
                !/^\d{6}$/.test(shortCode) ||
                codeLogin.isPending
              }
              onClick={() => codeLogin.mutate()}
            >
              Récupérer mon profil
            </Button>
            <p className="text-center text-xs text-slate-500">
              Lien WhatsApp ?{" "}
              <Link
                href={href("/recover")}
                className="font-medium text-indigo-600"
                onClick={() => onOpenChange(false)}
              >
                Page lien magique
              </Link>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
