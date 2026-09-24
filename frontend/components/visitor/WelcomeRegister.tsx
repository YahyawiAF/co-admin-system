"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import type { Member } from "@/lib/types";

function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * First visit: name + phone.
 * Returning light member (no PIN): phone alone resumes session.
 * Returning with PIN: use Connexion (top right).
 */
export function WelcomeRegister() {
  const router = useRouter();
  const { slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [lookingUp, setLookingUp] = useState(false);

  const finish = (member: Member, accessToken?: string, isNew = false) => {
    confirm(member, accessToken);
    if (isNew) {
      markInstallNudgePending(slug, member.id);
      consumeQrEntry(slug);
    }
    router.replace(href("/choose?mode=day"));
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
      finish(res.member, res.accessToken, true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resume = useMutation({
    mutationFn: () =>
      mobileApi.login({ phone: phone || "", orgSlug: slug }),
    onSuccess: (res) => {
      toast.success(
        res.member.firstName
          ? `Bonjour ${res.member.firstName}`
          : "Bon retour"
      );
      finish(res.member, res.accessToken, false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = async () => {
    if (!isTunisiaPhone(phone)) return;
    setLookingUp(true);
    try {
      const found = await mobileApi.lookupPhone(phone || "", slug);
      if (found.exists && found.hasPin) {
        toast.message(
          found.firstName
            ? `Bonjour ${found.firstName} — Connexion (PIN) en haut à droite`
            : "Compte avec PIN — utilisez Connexion en haut à droite"
        );
        return;
      }
      if (found.exists && !found.hasPin) {
        resume.mutate();
        return;
      }
      if (fullName.trim().length < 2) {
        toast.message("Indiquez votre nom complet pour créer le profil");
        return;
      }
      register.mutate();
    } catch {
      if (fullName.trim().length < 2) {
        toast.message("Indiquez votre nom complet pour créer le profil");
        return;
      }
      register.mutate();
    } finally {
      setLookingUp(false);
    }
  };

  const busy = lookingUp || register.isPending || resume.isPending;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Déjà venu ? Le téléphone suffit. Nouveau ? Ajoutez aussi votre nom.
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
          <Label>Nom complet</Label>
          <Input
            className="mt-1 h-11"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Prénom Nom (si nouveau)"
            autoComplete="name"
          />
        </div>
        <Button
          className="h-12 w-full rounded-full"
          disabled={!isTunisiaPhone(phone) || busy}
          onClick={() => void submit()}
        >
          {busy ? "…" : "Continuer"}
        </Button>
      </div>
    </div>
  );
}
