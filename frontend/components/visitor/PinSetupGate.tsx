"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mobileApi } from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";

/** Blocks the visitor app until a PIN is set. */
export function PinSetupGate() {
  const { memberId, confirm } = useVisitorSession();
  const { data: status, refetch, isLoading } = useMobileStatus();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [skipped, setSkipped] = useState(false);

  const member = status?.member;
  const skipPin =
    skipped ||
    (typeof window !== "undefined" &&
      !!memberId &&
      sessionStorage.getItem(`visitor-skip-pin:${memberId}`) === "1");
  const needsPin = !!memberId && !!member && member.hasPin === false && !skipPin;

  const save = useMutation({
    mutationFn: () => mobileApi.setPin({ memberId: memberId!, pin }),
    onSuccess: (res) => {
      confirm(res.member, res.accessToken);
      toast.success("Code PIN enregistré");
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!memberId || isLoading) return null;
  if (!needsPin) return null;

  const pinOk = /^\d{4}$/.test(pin) && pin === pin2;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Reconnexion plus simple
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Configurez votre code PIN
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          4 chiffres pour vous reconnecter (téléphone + PIN). Vous pouvez
          aussi le faire plus tard.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Code PIN</Label>
            <Input
              autoFocus
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
            disabled={!pinOk || save.isPending}
            onClick={() => save.mutate()}
          >
            Enregistrer mon PIN
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full text-slate-500"
            onClick={() => {
              try {
                sessionStorage.setItem(`visitor-skip-pin:${memberId}`, "1");
              } catch {
                /* ignore */
              }
              setSkipped(true);
            }}
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}
