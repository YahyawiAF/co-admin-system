"use client";

import Link from "next/link";
import { format, differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/lib/org";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";
import { AccountUpgradeCard } from "@/components/visitor/AccountUpgradeCard";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";

export default function SubscriptionPage() {
  const { href } = useOrg();
  const { data } = useMobileStatus();

  const hasAccount = !!data?.member?.hasPin;

  const sub = data?.subscription as
    | (NonNullable<typeof data>["subscription"] & {
        price?: { name?: string; billingUnit?: string; durationHours?: number };
        kind?: string | null;
        daysRemaining?: number | null;
        hoursRemaining?: number | null;
        hoursUsed?: number | null;
        hoursQuota?: number | null;
        reservedSeatLabel?: string | null;
      })
    | null
    | undefined;

  const hasSession = !!data?.hasOpenSession;
  const seat = data?.seat;

  if (!hasAccount && !sub) {
    return (
      <div className="space-y-4">
        <MobileBackHome />
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <AccountUpgradeCard
          title="Compte requis"
          description="Pour souscrire un abonnement, créez un compte avec PIN dans l’app installée (même profil)."
        />
      </div>
    );
  }

  if (!sub) {
    return (
      <div>
        <MobileBackHome />
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="mb-4 mt-2 text-slate-500">Aucun abonnement actif.</p>
        <Button asChild>
          <Link href={href("/choose?mode=subscription")}>
            Choisir un abonnement
          </Link>
        </Button>
      </div>
    );
  }

  const daysLeft = sub.leaveDate
    ? differenceInCalendarDays(new Date(sub.leaveDate), new Date())
    : null;

  return (
    <div className="text-center">
      <div className="mb-2 text-left">
        <MobileBackHome />
      </div>
      <p className="text-xs uppercase text-slate-500">Abonnement actif</p>
      <h1 className="mt-1 text-2xl font-bold">
        {sub.price?.name || "Formule"}
      </h1>
      <div
        className={`my-8 text-6xl font-bold ${
          daysLeft !== null && daysLeft <= 3 ? "text-amber-600" : "text-primary"
        }`}
      >
        {daysLeft ?? "—"}
      </div>
      <p className="text-slate-500">jours restants</p>
      {sub.kind === "HOURS_POOL" || sub.hoursRemaining != null ? (
        <p className="mt-3 text-lg font-semibold">
          {(sub.hoursRemaining ?? 0).toFixed(1)} h restantes
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Place réservée
          {sub.reservedSeatLabel ? ` : ${sub.reservedSeatLabel}` : ""}. Pointez
          pour indiquer votre présence. Vous pouvez aussi prendre un forfait.
        </p>
      )}
      {hasSession && seat?.seatLabel ? (
        <p className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm">
          Place :{" "}
          <span className="font-semibold">
            {seat.seatLabel}
            {seat.spaceName ? ` · ${seat.spaceName}` : ""}
          </span>
        </p>
      ) : null}
      {sub.leaveDate ? (
        <p className="mt-6 text-xs text-slate-400">
          Jusqu&apos;au{" "}
          {format(new Date(sub.leaveDate), "d MMMM yyyy")}
        </p>
      ) : null}
    </div>
  );
}
