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

/** First visit: name + phone only. Returning visitors are routed by Accueil. */
export function WelcomeRegister() {
  const router = useRouter();
  const { slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();

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

  const submit = async () => {
    try {
      const found = await mobileApi.lookupPhone(phone || "", slug);
      if (found.exists && found.hasPin) {
        toast.message(
          found.firstName
            ? `Bonjour ${found.firstName} — Connexion en haut à droite`
            : "Compte existant — Connexion en haut à droite"
        );
        return;
      }
    } catch {
      /* register / reuse light profile */
    }
    register.mutate();
  };

  const valid = fullName.trim().length > 1 && isTunisiaPhone(phone);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <div>
          <Label>Nom complet</Label>
          <Input
            className="mt-1 h-11"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Prénom Nom"
            autoComplete="name"
            autoFocus
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
          className="h-12 w-full rounded-full"
          disabled={!valid || register.isPending}
          onClick={() => void submit()}
        >
          {register.isPending ? "…" : "Valider"}
        </Button>
      </div>
    </div>
  );
}
