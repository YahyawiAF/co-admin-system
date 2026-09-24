"use client";

import { useEffect, useState } from "react";
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
  /** Prefill phone (e.g. from Welcome). */
  initialPhone?: string;
};

type Step = "phone" | "pin" | "code";

/**
 * Easy PWA/web login:
 * - Phone only → resume light profile (no PIN)
 * - If account has PIN → ask PIN
 * - Recovery code as fallback
 */
export function VisitorLoginDialog({
  open,
  onOpenChange,
  initialPhone,
}: Props) {
  const router = useRouter();
  const { slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [phone, setPhone] = useState<string | undefined>(initialPhone);
  const [loginPin, setLoginPin] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [greeting, setGreeting] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone(initialPhone);
    setLoginPin("");
    setShortCode("");
    setStep("phone");
    setGreeting(null);
  }, [open, initialPhone]);

  const finish = (member: Member, accessToken?: string) => {
    confirm(member, accessToken);
    onOpenChange(false);
    setLoginPin("");
    setShortCode("");
    setStep("phone");
    router.replace(href());
  };

  const lightLogin = useMutation({
    mutationFn: () =>
      mobileApi.login({ phone: phone || "", orgSlug: slug }),
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

  const continueWithPhone = async () => {
    if (!isTunisiaPhone(phone)) return;
    setLookingUp(true);
    try {
      const found = await mobileApi.lookupPhone(phone || "", slug);
      if (!found.exists) {
        toast.message("Nouveau numéro — inscrivez-vous sur Accueil (nom + téléphone)");
        onOpenChange(false);
        return;
      }
      setGreeting(found.firstName || null);
      if (found.hasPin) {
        setStep("pin");
        return;
      }
      lightLogin.mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLookingUp(false);
    }
  };

  const busy =
    lookingUp ||
    lightLogin.isPending ||
    pinLogin.isPending ||
    codeLogin.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "code"
              ? "Code de récupération"
              : step === "pin"
                ? "Votre PIN"
                : "Connexion"}
          </DialogTitle>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Entrez votre téléphone — pas besoin de PIN si vous n&apos;en avez
              pas encore créé.
            </p>
            <div>
              <Label>Téléphone</Label>
              <TunisiaPhoneField
                className="mt-1"
                value={phone}
                onChange={setPhone}
              />
            </div>
            <Button
              className="h-12 w-full rounded-full"
              disabled={!isTunisiaPhone(phone) || busy}
              onClick={() => void continueWithPhone()}
            >
              {busy ? "…" : "Continuer"}
            </Button>
            <p className="text-center text-xs text-slate-500">
              PIN oublié ?{" "}
              <button
                type="button"
                className="font-medium text-indigo-600"
                onClick={() => setStep("code")}
              >
                Code accueil
              </button>
            </p>
          </div>
        ) : null}

        {step === "pin" ? (
          <div className="space-y-3">
            <button
              type="button"
              className="text-sm text-indigo-600"
              onClick={() => {
                setStep("phone");
                setLoginPin("");
              }}
            >
              ← Retour
            </button>
            <p className="text-sm text-slate-500">
              {greeting
                ? `Bonjour ${greeting} — entrez votre PIN à 4 chiffres.`
                : "Compte sécurisé — PIN à 4 chiffres."}
            </p>
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
                autoFocus
              />
            </div>
            <Button
              className="h-12 w-full rounded-full"
              disabled={!/^\d{4}$/.test(loginPin) || pinLogin.isPending}
              onClick={() => pinLogin.mutate()}
            >
              Se connecter
            </Button>
            <p className="text-center text-xs text-slate-500">
              PIN oublié ?{" "}
              <button
                type="button"
                className="font-medium text-indigo-600"
                onClick={() => setStep("code")}
              >
                Code accueil
              </button>
            </p>
          </div>
        ) : null}

        {step === "code" ? (
          <div className="space-y-3">
            <button
              type="button"
              className="text-sm text-indigo-600"
              onClick={() => setStep("phone")}
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
