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
  hasRecentQrEntry,
  loadPendingRegister,
  markInstallNudgePending,
} from "@/lib/visitorCache";
import { startFromQrEntry } from "@/lib/visitor-qr-checkin";
import type { Member } from "@/lib/types";
import { VisitorLoginDialog } from "@/components/visitor/VisitorLoginDialog";

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
 * Two short steps instead of one mixed form:
 * 1. phone → known light member resumes, PIN account opens the PIN login;
 * 2. only for a new number: the name, then the session starts.
 */
export function WelcomeRegister() {
  const router = useRouter();
  const { slug, href } = useOrg();
  const { confirm } = useVisitorSession();
  const [step, setStep] = useState<"phone" | "name">("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [lookingUp, setLookingUp] = useState(false);
  const [pinLogin, setPinLogin] = useState(false);

  const finish = async (
    member: Member,
    accessToken?: string,
    isNew = false,
  ) => {
    confirm(member, accessToken);
    if (isNew) markInstallNudgePending(slug, member.id);
    // QR scan = pointage: start AUTO session right after first login / signup
    if (hasRecentQrEntry(slug)) {
      try {
        const session = await startFromQrEntry({
          org: slug,
          memberId: member.id,
        });
        if (session?.resumed) toast.success("Session reprise ✓");
        else if (session?.alreadyOpen) {
          toast.message("Votre session est déjà en cours");
        } else toast.success("Présence enregistrée ✓");
        router.replace(href("/session"));
        return;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Pointage impossible — réessayez",
        );
      }
    }
    router.replace(href());
  };

  useEffect(() => {
    const pending = loadPendingRegister(slug);
    if (!pending) return;
    clearPendingRegister(slug);
    void finish(pending.member as Member, pending.accessToken, true);
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
      void finish(res.member, res.accessToken, true);
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
      void finish(res.member, res.accessToken, false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPhone = async () => {
    if (!isTunisiaPhone(phone)) return;
    setLookingUp(true);
    try {
      const found = await mobileApi.lookupPhone(phone || "", slug);
      if (found.exists && found.hasPin) {
        setPinLogin(true);
        return;
      }
      if (found.exists) {
        resume.mutate();
        return;
      }
      setStep("name");
    } catch {
      setStep("name");
    } finally {
      setLookingUp(false);
    }
  };

  const busy = lookingUp || register.isPending || resume.isPending;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      {step === "phone" ? (
        <div className="space-y-4">
          <div>
            <p className="text-lg font-bold text-slate-900">Bienvenue 👋</p>
            <p className="text-sm text-slate-500">
              Votre numéro suffit pour entrer. Déjà venu ? On vous reconnaît.
            </p>
          </div>
          <div>
            <Label>Téléphone</Label>
            <TunisiaPhoneField className="mt-1" value={phone} onChange={setPhone} />
          </div>
          <Button
            className="h-12 w-full rounded-full"
            disabled={!isTunisiaPhone(phone) || busy}
            onClick={() => void submitPhone()}
          >
            {busy ? "…" : "Continuer"}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim().length >= 2 && !busy) register.mutate();
          }}
        >
          <div>
            <p className="text-lg font-bold text-slate-900">Première visite !</p>
            <p className="text-sm text-slate-500">Comment vous appelez-vous ?</p>
          </div>
          <div>
            <Label>Prénom et nom</Label>
            <Input
              className="mt-1 h-11"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex. : Sarra Ben Ali"
              autoComplete="name"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-full"
            disabled={fullName.trim().length < 2 || busy}
          >
            {busy ? "…" : "Entrer"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs font-medium text-slate-500"
            onClick={() => setStep("phone")}
          >
            Changer de numéro
          </button>
        </form>
      )}
      <VisitorLoginDialog open={pinLogin} onOpenChange={setPinLogin} initialPhone={phone} startAtPin />
    </div>
  );
}
