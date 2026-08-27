"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { loadVisitorCache } from "@/lib/visitorCache";
import { useOrg } from "@/lib/org";

export default function SubscriptionPage() {
  const { href } = useOrg();
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    setMemberId(loadVisitorCache()?.memberId || sessionStorage.getItem("memberId"));
  }, []);

  const { data } = useQuery({
    queryKey: ["mobile-status", memberId],
    queryFn: () => mobileApi.status(memberId!),
    enabled: !!memberId,
    refetchInterval: 5000,
  });

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

  if (!sub) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="mb-4 mt-2 text-slate-500">Aucun abonnement actif.</p>
        <Button asChild>
          <Link href={href("/choose?mode=subscription")}>Choisir un abonnement</Link>
        </Button>
      </div>
    );
  }

  const daysLeft = sub.leaveDate
    ? differenceInCalendarDays(new Date(sub.leaveDate), new Date())
    : null;

  return (
    <div className="text-center">
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
            {[seat.spaceName, seat.tableName, seat.seatLabel]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      ) : null}
      <p className="mt-4 text-sm text-slate-500">
        {format(new Date(sub.registredDate), "dd/MM/yyyy")}
        {sub.leaveDate
          ? ` → ${format(new Date(sub.leaveDate), "dd/MM/yyyy")}`
          : ""}
      </p>
      <Button asChild className="mt-6 h-12 w-full">
        <Link href={href()}>
          {hasSession ? "Voir ma session à l’accueil" : "Pointer depuis l’accueil"}
        </Link>
      </Button>
    </div>
  );
}
