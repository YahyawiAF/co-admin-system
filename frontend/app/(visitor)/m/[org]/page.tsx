"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Coffee, CreditCard, HelpCircle, MessageSquare, Monitor, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mobileApi } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { WelcomeRegister } from "@/components/visitor/WelcomeRegister";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { ActiveSessionPanel } from "@/components/visitor/ActiveSessionPanel";
import { AdminStaffChat } from "@/components/visitor/AdminStaffChat";
import { WifiCredentialsModal } from "@/components/visitor/WifiCredentialsModal";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";

export default function MobileHomePage() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { onboarded, memberId, ready } = useVisitorSession();
  const [staffOpen, setStaffOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);

  const { data: status, refetch } = useMobileStatus();
  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: async () => {
      const data = await mobileApi.floorPlan(slug);
      writeLocalCache("floor-plan", data, slug);
      return data;
    },
    staleTime: 5 * 60_000,
    placeholderData: () => readLocalCache("floor-plan", slug) ?? undefined,
  });

  const cancel = useMutation({
    mutationFn: () =>
      mobileApi.cancelVisitRequest(status!.pendingRequest!.id, memberId!),
    onSuccess: () => {
      sessionStorage.removeItem("pendingVisitRequestId");
      refetch();
    },
  });

  const scanIn = useMutation({
    mutationFn: () => mobileApi.scanIn(memberId!),
    onSuccess: () => {
      refetch();
    },
  });

  if (!ready) return <p className="text-slate-500">Chargement…</p>;
  if (!onboarded) return <WelcomeRegister />;

  const pending = status?.pendingRequest;
  const session = status?.session;
  const seat = session?.seat || status?.seat || null;
  const member = status?.member;
  const subKind = (status?.subscription as { kind?: string } | null)?.kind;
  const hoursPool = subKind === "HOURS_POOL";
  const periodSub = subKind === "SEMI_DAY" || subKind === "FULL_DAY";
  const canChooseForfait = status?.canChooseForfait !== false;
  const dailyRem =
    status?.dailyCreditRemainingHours ??
    (status?.subscription as { dailyCreditRemainingHours?: number } | null)
      ?.dailyCreditRemainingHours;
  const displayName =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.firstName ||
    "Visiteur";
  const facilityName = layout?.facility?.name || org.name;

  const goChooseDay = () => {
    router.push(href("/choose?mode=day"));
  };

  const goSubscription = () => {
    if (status?.hasActiveSubscription) {
      router.push(href("/subscription"));
      return;
    }
    router.push(href("/choose?mode=subscription"));
  };

  return (
    <div className="space-y-4">
      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent className="max-w-[440px] rounded-2xl p-0 sm:max-w-[440px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Message à l’accueil</DialogTitle>
          </DialogHeader>
          {memberId ? (
            <AdminStaffChat
              memberId={memberId}
              compact
              className="shadow-none"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <WifiCredentialsModal
        seat={seat}
        forceOpen={wifiOpen}
        onClose={() => setWifiOpen(false)}
      />

      {session ? (
        <ActiveSessionPanel
          memberId={memberId!}
          session={session}
          seat={seat}
          seatSettings={status?.seatSettings}
          hasActiveSubscription={!!status?.hasActiveSubscription}
          subscriptionKind={subKind}
        />
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-slate-800 text-white shadow-md">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=60)",
            }}
          />
          <div className="relative p-4 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{facilityName}</p>
                <p className="text-xs text-white/80">
                  {status?.hasActiveSubscription
                    ? "Abonnement actif"
                    : pending
                      ? "Demande en attente"
                      : "Réservez un bureau ou un abonnement"}
                </p>
              </div>
              {member ? (
                <Link href={href("/profile")}>
                  <VisitorAvatar
                    name={displayName}
                    src={member.avatarUrl}
                    className="h-10 w-10 border-2 border-white"
                  />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {status?.hasActiveSubscription && !session ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Abonnement
            </p>
            <Link
              href={href("/subscription")}
              className="text-xs font-medium text-primary"
            >
              Détail ›
            </Link>
          </div>
          <p className="mt-2 text-lg font-bold">
            {status.subscription?.price?.name || "Abonnement actif"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {status.subscription?.daysRemaining != null
              ? `${status.subscription.daysRemaining} j. restants`
              : "En cours"}
            {status.subscription?.hoursRemaining != null
              ? ` · ${status.subscription.hoursRemaining}h`
              : ""}
            {status.subscription?.reservedSeatLabel
              ? ` · place ${status.subscription.reservedSeatLabel}`
              : ""}
          </p>
          <Button className="mt-3 h-11 w-full rounded-full" asChild>
            <Link href={href("/subscription")}>Mon abonnement</Link>
          </Button>
        </div>
      ) : null}

      {pending ? (
        <Alert>
          <AlertDescription>
            En attente
            {pending.price?.name ? ` : ${pending.price.name}` : ""}.
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Annuler
              </Button>
              <Button size="sm" asChild>
                <Link
                  href={href(
                    `/choose?mode=${
                      pending.type === "SUBSCRIPTION" ? "subscription" : "day"
                    }`
                  )}
                >
                  Voir
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {!session ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
            disabled={!canChooseForfait}
            onClick={goChooseDay}
          >
            <Monitor className="mr-1.5 h-4 w-4" />
            Forfait
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
            disabled={!!pending && pending.type === "SUBSCRIPTION"}
            onClick={goSubscription}
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Abonnement
          </Button>
        </div>
      ) : status?.hasActiveSubscription ? (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full"
          asChild
        >
          <Link href={href("/subscription")}>
            <CreditCard className="mr-1.5 h-4 w-4" />
            Mon abonnement
          </Link>
        </Button>
      ) : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
          onClick={() => setStaffOpen(true)}
        >
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Accueil
        </Button>
        {seat?.wifiSsid || seat?.wifiPassword ? (
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
            onClick={() => {
              if (seat?.spaceId) {
                sessionStorage.removeItem(`wifi-seen:${seat.spaceId}`);
              }
              setWifiOpen(true);
            }}
          >
            <Wifi className="mr-1.5 h-4 w-4" />
            Wi‑Fi
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
          asChild
        >
          <Link href={href("/cafe")}>
            <Coffee className="mr-1.5 h-4 w-4" />
            Café
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
          asChild
        >
          <Link href={href("/community")}>
            <HelpCircle className="mr-1.5 h-4 w-4" />
            Aide
          </Link>
        </Button>
      </div>

      {!session && !pending && hoursPool ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pointer
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Pointez pour entrer. L&apos;accueil vous attribue une place.
          </p>
          {scanIn.isError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>
                {(scanIn.error as Error).message}
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            className="mt-3 h-12 w-full rounded-full"
            disabled={scanIn.isPending}
            onClick={() => scanIn.mutate()}
          >
            Pointer (scan)
          </Button>
        </div>
      ) : !session && !pending && periodSub ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Présence abonnement
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Pointez pour démarrer votre crédit du jour
            {dailyRem != null
              ? ` (${Number(dailyRem).toFixed(1)} h restantes)`
              : ""}
            . Compteur + plan de place s&apos;affichent ensuite.
            {!canChooseForfait
              ? " Le forfait reste bloqué tant que ce crédit n’est pas terminé."
              : ""}
          </p>
          {scanIn.isError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>
                {(scanIn.error as Error).message}
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            className="mt-3 h-12 w-full rounded-full"
            disabled={scanIn.isPending || (dailyRem != null && dailyRem <= 0)}
            onClick={() => scanIn.mutate()}
          >
            Je suis présent
          </Button>
        </div>
      ) : null}
    </div>
  );
}
