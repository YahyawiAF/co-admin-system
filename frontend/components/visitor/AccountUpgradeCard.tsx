"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mobileApi } from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";

type Props = {
  /** Compact card for profile / subscription gates */
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Same-member upgrade: create account = set PIN.
 * PIN only in the installed PWA. Browser shows download CTA.
 */
export function AccountUpgradeCard({
  title = "Créer un compte",
  description = "Abonnement, communauté et points fidélité — dans l’app installée, avec un PIN.",
  className,
}: Props) {
  const queryClient = useQueryClient();
  const { memberId, confirm } = useVisitorSession();
  const { data: status, refetch } = useMobileStatus();
  const [isPwa, setIsPwa] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const member = status?.member;
  if (!memberId || member?.hasPin) return null;

  const save = useMutation({
    mutationFn: () => mobileApi.setPin({ memberId, pin }),
    onSuccess: (res) => {
      confirm(res.member, res.accessToken);
      toast.success("Compte créé — PIN enregistré");
      void refetch();
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pinOk = /^\d{4}$/.test(pin) && pin === pin2;

  if (!isPwa) {
    return (
      <div
        className={
          className ||
          "space-y-3 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm"
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
            <p className="mt-2 text-xs text-slate-400">
              Installez l’app pour définir votre PIN, accéder à la communauté et
              cumuler des points / cadeaux.
            </p>
          </div>
        </div>
        <InstallAppButton className="w-full" />
      </div>
    );
  }

  return (
    <div
      className={
        className ||
        "space-y-3 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm"
      }
    >
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
      <div className="space-y-2">
        <div>
          <Label>Code PIN (4 chiffres)</Label>
          <Input
            className="mt-1 h-12 text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="••••"
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
            placeholder="••••"
          />
        </div>
        {pin2 && pin !== pin2 ? (
          <p className="text-xs text-rose-600">Les codes ne correspondent pas</p>
        ) : null}
        <Button
          className="h-12 w-full rounded-full"
          disabled={!pinOk || save.isPending}
          onClick={() => save.mutate()}
        >
          Créer mon compte
        </Button>
      </div>
    </div>
  );
}
