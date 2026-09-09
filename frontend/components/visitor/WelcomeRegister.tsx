"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TunisiaPhoneField,
  isTunisiaPhone,
} from "@/components/visitor/TunisiaPhoneField";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import {
  clearPendingRegister,
  consumeQrEntry,
  loadPendingRegister,
  markInstallNudgePending,
} from "@/lib/visitorCache";
import { isStandalonePwa } from "@/lib/visitor-notify";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "welcome" | "signup" | "login" | "code";

function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function WelcomeRegister() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [mode, setMode] = useState<Mode>("welcome");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [loginPin, setLoginPin] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const finish = (
    member: Member,
    accessToken?: string,
    isNew = false
  ) => {
    confirm(member, accessToken);
    if (isNew) {
      markInstallNudgePending(slug, member.id);
      consumeQrEntry(slug);
      router.replace(href("/choose?mode=day"));
    }
  };

  useEffect(() => {
    const pending = loadPendingRegister(slug);
    if (!pending) return;
    clearPendingRegister(slug);
    finish(pending.member as Member, pending.accessToken, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const register = useMutation({
    mutationFn: () => {
      const { firstName, lastName } = splitFullName(fullName);
      return mobileApi.quickRegister({
        orgSlug: slug,
        firstName,
        lastName,
        phone: phone || "",
      });
    },
    onSuccess: (res) => {
      toast.success("Profil créé");
      finish(res.member, res.accessToken, true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const continueSignup = async () => {
    try {
      const found = await mobileApi.lookupPhone(phone || "", slug);
      // Old users with PIN: always offer PIN login (browser + PWA)
      if (found.exists && found.hasPin) {
        toast.message(
          found.firstName
            ? `Bonjour ${found.firstName}, reconnectez-vous`
            : "Ce numéro a déjà un compte"
        );
        setMode("login");
        return;
      }
    } catch {
      /* continue to register */
    }
    register.mutate();
  };

  const pinLogin = useMutation({
    mutationFn: () =>
      mobileApi.pinLogin({ phone: phone || "", pin: loginPin, orgSlug: slug }),
    onSuccess: (res) => {
      toast.success(
        res.member.firstName
          ? `Bonjour ${res.member.firstName} 👋`
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

  if (mode === "welcome") {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Bienvenue
        </p>
        <h1 className="mt-1 text-2xl font-bold">Chez {org.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {isPwa
            ? "Créez votre profil, puis un PIN pour vous reconnecter."
            : "Nom complet + téléphone, puis choisissez votre place. Votre profil reste sur cet appareil."}
        </p>
        <div className="mt-5 space-y-2">
          <Button
            className="h-12 w-full rounded-full"
            onClick={() => setMode("signup")}
          >
            Continuer
          </Button>
          <p className="pt-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            Déjà un PIN ?
          </p>
          <Button
            variant="outline"
            className="h-12 w-full rounded-full"
            onClick={() => setMode("login")}
          >
            Connexion (téléphone + PIN)
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => setMode("welcome")}
        >
          ← Retour
        </button>
        <h1 className="mt-2 text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-slate-500">Téléphone + PIN à 4 chiffres</p>
        <div className="mt-4 space-y-3">
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
            Première visite ?{" "}
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => setMode("signup")}
            >
              Créer un profil
            </button>
            {" · "}
            PIN oublié ?{" "}
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => setMode("code")}
            >
              Code accueil
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (mode === "code") {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => setMode("welcome")}
        >
          ← Retour
        </button>
        <h1 className="mt-2 text-2xl font-bold">Code de récupération</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ouvrez l&apos;icône Collabora, puis saisissez le code 6 chiffres donné
          par l&apos;accueil (avec votre téléphone).
        </p>
        <div className="mt-4 space-y-3">
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
            Vous avez un lien WhatsApp ?{" "}
            <Link href={href("/recover")} className="font-medium text-primary">
              Ouvrir la page lien magique
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const valid = fullName.trim().length > 1 && isTunisiaPhone(phone);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <button
        type="button"
        className="text-sm text-primary"
        onClick={() => setMode("welcome")}
      >
        ← Retour
      </button>
      <h1 className="mt-2 text-2xl font-bold">Votre profil</h1>
      <p className="mt-1 text-sm text-slate-500">
        Nom complet et téléphone tunisien — ensuite choisissez votre place.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Nom complet</Label>
          <Input
            className="mt-1 h-11"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Prénom Nom"
            autoComplete="name"
          />
        </div>
        <div>
          <Label>Téléphone</Label>
          <TunisiaPhoneField
            className="mt-1"
            value={phone}
            onChange={setPhone}
          />
        </div>
        <Button
          className={cn("h-12 w-full rounded-full")}
          disabled={!valid || register.isPending}
          onClick={() => void continueSignup()}
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
