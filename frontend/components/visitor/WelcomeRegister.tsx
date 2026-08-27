"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TunisiaPhoneField, isTunisiaPhone } from "@/components/visitor/TunisiaPhoneField";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import {
  clearPendingRegister,
  loadPendingRegister,
  savePendingRegister,
} from "@/lib/visitorCache";
import type { Member } from "@/lib/types";

export function WelcomeRegister() {
  const { org, slug } = useOrg();
  const { confirm } = useVisitorSession();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
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
    setStep("confirm");
  }, [slug]);

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
      setStep("confirm");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isTunisiaPhone(phone);

  if (step === "confirm" && draft) {
    const name = [firstName, lastName].filter(Boolean).join(" ");
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Confirmation
        </p>
        <h1 className="mt-1 text-2xl font-bold">C&apos;est vous ?</h1>
        <p className="mt-3 text-lg font-semibold">{name}</p>
        <p className="text-sm text-slate-500">{phone}</p>
        <p className="mt-3 text-sm text-slate-500">
          Votre profil visiteur est prêt. Confirmez pour ouvrir l&apos;espace.
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-full"
            onClick={() => {
              clearPendingRegister(slug);
              setStep("form");
            }}
          >
            Modifier
          </Button>
          <Button
            className="h-12 flex-1 rounded-full"
            onClick={() => {
              clearPendingRegister(slug);
              confirm(draft.member, draft.accessToken);
            }}
          >
            Confirmer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Bienvenue
      </p>
      <h1 className="mt-1 text-2xl font-bold">Chez {org.name}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Nom, prénom et téléphone tunisien suffisent pour commencer.
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <Label>Prénom *</Label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Téléphone *</Label>
          <TunisiaPhoneField value={phone} onChange={setPhone} />
          {phone && !isTunisiaPhone(phone) ? (
            <p className="text-xs text-red-600">Numéro tunisien invalide</p>
          ) : null}
        </div>
        {register.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {(register.error as Error).message}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button
          className="h-12 w-full rounded-full"
          disabled={!valid || register.isPending}
          onClick={() => register.mutate()}
        >
          {register.isPending ? "…" : "Continuer"}
        </Button>
      </div>
    </div>
  );
}
