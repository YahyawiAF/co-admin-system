"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
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
  loadPendingRegister,
  savePendingRegister,
} from "@/lib/visitorCache";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "welcome" | "signup" | "confirm" | "pin" | "login" | "code";

export function WelcomeRegister() {
  const { org, slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [mode, setMode] = useState<Mode>("welcome");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [draft, setDraft] = useState<{
    member: Member;
    accessToken?: string;
  } | null>(null);

  useEffect(() => {
    const pending = loadPendingRegister(slug);
    if (!pending) return;
    setFirstName(pending.firstName);
    setLastName(pending.lastName);
    setPhone(pending.phone);
    setDraft({
      member: pending.member as Member,
      accessToken: pending.accessToken,
    });
    setMode("confirm");
  }, [slug]);

  const finish = (member: Member, accessToken?: string) => {
    clearPendingRegister(slug);
    confirm(member, accessToken);
  };

  const register = useMutation({
    mutationFn: () =>
      mobileApi.quickRegister({
        orgSlug: slug,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone || "",
      }),
    onSuccess: (res) => {
      savePendingRegister(slug, {
        member: res.member,
        accessToken: res.accessToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone || "",
      });
      setDraft(res);
      setMode("confirm");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePin = useMutation({
    mutationFn: () =>
      mobileApi.setPin({ memberId: draft!.member.id, pin }),
    onSuccess: (res) => {
      toast.success("Code PIN enregistré");
      finish(res.member, res.accessToken);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pinLogin = useMutation({
    mutationFn: () =>
      mobileApi.pinLogin({ phone: phone || "", pin: loginPin }),
    onSuccess: (res) => finish(res.member, res.accessToken),
    onError: (e: Error) => toast.error(e.message),
  });

  const codeLogin = useMutation({
    mutationFn: () =>
      mobileApi.consumeMagicLogin({
        shortCode,
        phone: phone || "",
      }),
    onSuccess: (res) => {
      setDraft({ member: res.member, accessToken: res.accessToken });
      if (res.needsPin || !res.member.hasPin) {
        setMode("pin");
        return;
      }
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
          Connexion avec téléphone + PIN, ou créez un profil (PIN obligatoire).
        </p>
        <div className="mt-5 space-y-2">
          <Button
            className="h-12 w-full rounded-full"
            onClick={() => setMode("login")}
          >
            Connexion (téléphone + PIN)
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-full"
            onClick={() => setMode("signup")}
          >
            Nouveau visiteur
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-full text-slate-600"
            onClick={() => setMode("code")}
          >
            Code de récupération (6 chiffres)
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "confirm" && draft) {
    const name = [firstName, lastName].filter(Boolean).join(" ");
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Confirmation
        </p>
        <h1 className="mt-1 text-2xl font-bold">C&apos;est vous ?</h1>
        <p className="mt-3 text-lg font-semibold">{name}</p>
        <p className="text-sm text-slate-500">{phone}</p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-full"
            onClick={() => {
              clearPendingRegister(slug);
              setMode("signup");
            }}
          >
            Modifier
          </Button>
          <Button
            className="h-12 flex-1 rounded-full"
            onClick={() => {
              // PIN is always configured next (or finish if already set)
              if (draft.member.hasPin) {
                finish(draft.member, draft.accessToken);
              } else {
                setMode("pin");
              }
            }}
          >
            Continuer — créer mon PIN
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "pin" && draft) {
    const pinOk = /^\d{4}$/.test(pin) && pin === pin2;
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Sécurité
        </p>
        <h1 className="mt-1 text-2xl font-bold">Créez votre code PIN</h1>
        <p className="mt-2 text-sm text-slate-500">
          4 chiffres pour vous reconnecter sur cet appareil ou un autre, sans
          renvoyer vos infos.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Code PIN</Label>
            <Input
              className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
          </div>
          <div>
            <Label>Confirmer le PIN</Label>
            <Input
              className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) =>
                setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
            />
          </div>
          {pin2 && pin !== pin2 ? (
            <p className="text-sm text-rose-600">Les codes ne correspondent pas</p>
          ) : null}
          <Button
            className="h-12 w-full rounded-full"
            disabled={!pinOk || savePin.isPending}
            onClick={() => savePin.mutate()}
          >
            Enregistrer mon PIN
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
            PIN oublié ? Demandez un lien ou un code à l&apos;accueil, ou{" "}
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => setMode("code")}
            >
              entrez un code ici
            </button>
            .
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

  // signup
  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isTunisiaPhone(phone);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <button
        type="button"
        className="text-sm text-primary"
        onClick={() => setMode("welcome")}
      >
        ← Retour
      </button>
      <h1 className="mt-2 text-2xl font-bold">Nouveau profil</h1>
      <p className="mt-1 text-sm text-slate-500">
        Nom, prénom et téléphone tunisien.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Prénom</Label>
          <Input
            className="mt-1 h-11"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <Label>Nom</Label>
          <Input
            className="mt-1 h-11"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
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
          onClick={() => register.mutate()}
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
