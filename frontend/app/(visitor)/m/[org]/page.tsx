"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Coffee,
  CreditCard,
  HelpCircle,
  MessageSquare,
  Monitor,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mobileApi } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { WelcomeRegister } from "@/components/visitor/WelcomeRegister";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { ActiveSessionPanel } from "@/components/visitor/ActiveSessionPanel";
import { WifiCredentialsModal } from "@/components/visitor/WifiCredentialsModal";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { ScanQrPresence } from "@/components/visitor/ScanQrPresence";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";
import { consumeQrEntry } from "@/lib/visitorCache";

export default function MobileHomePage() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { onboarded, memberId, ready } = useVisitorSession();
  const [wifiOpen, setWifiOpen] = useState(false);
  const entryHandled = useRef(false);

  const { data: status, refetch, isSuccess: statusReady } = useMobileStatus();
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
      toast.success("Présence enregistrée ✓");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const scanInRef = useRef(scanIn.mutate);
  scanInRef.current = scanIn.mutate;

  const goForfait = () => {
    router.replace(href("/choose?mode=day"));
  };

  const afterScan = () => {
    if (!statusReady || !status) return;
    if (status.session || status.pendingRequest) {
      toast.message("Session déjà en cours");
      return;
    }
    if (status.hasActiveSubscription) {
      const rem =
        status.dailyCreditRemainingHours ??
        (status.subscription as { dailyCreditRemainingHours?: number } | null)
          ?.dailyCreditRemainingHours;
      if (rem != null && rem <= 0) {
        toast.message("Crédit du jour terminé — choisissez un forfait");
        goForfait();
        return;
      }
      scanInRef.current();
      return;
    }
    toast.message("Choisissez un forfait ou un abonnement");
    goForfait();
  };

  useEffect(() => {
    if (!onboarded || !memberId || !statusReady || !status || entryHandled.current) {
      return;
    }
    if (!consumeQrEntry(slug)) return;
    entryHandled.current = true;
    if (status.session || status.pendingRequest) return;
    if (status.hasActiveSubscription) {
      const rem =
        status.dailyCreditRemainingHours ??
        (status.subscription as { dailyCreditRemainingHours?: number } | null)
          ?.dailyCreditRemainingHours;
      if (rem != null && rem <= 0) {
        router.replace(href("/choose?mode=day"));
        return;
      }
      scanInRef.current();
      return;
    }
    router.replace(href("/choose?mode=day"));
  }, [onboarded, memberId, statusReady, status, slug, router, href]);

  if (!ready) return <p className="text-slate-500">Chargement…</p>;
  if (!onboarded) return <WelcomeRegister />;

  const pending = status?.pendingRequest;
  const session = status?.session;
  const seat = session?.seat || status?.seat || null;
  const member = status?.member;
  const subKind = (status?.subscription as { kind?: string } | null)?.kind;
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
  const greetingName = member?.firstName || displayName;
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
                <p className="text-lg font-bold">Bonjour {greetingName} 👋</p>
                <p className="text-xs text-white/80">{facilityName}</p>
                <p className="mt-0.5 text-[11px] text-white/70">
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

      {!session && !pending ? (
        <ScanQrPresence
          slug={slug}
          pending={scanIn.isPending || !statusReady}
          error={
            scanIn.isError ? (scanIn.error as Error).message : null
          }
          hint={
            status?.hasActiveSubscription
              ? periodSub && dailyRem != null && dailyRem <= 0
                ? "Crédit du jour terminé — un forfait sera proposé"
                : periodSub && dailyRem != null
                  ? `${Number(dailyRem).toFixed(1)} h restantes aujourd’hui`
                  : "Scannez le QR de l’accueil"
              : "Scannez le QR de l’accueil pour un forfait ou un abonnement"
          }
          onConfirmed={afterScan}
        />
      ) : null}

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
          asChild
        >
          <Link href={href("/staff")}>
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Accueil
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-11 flex-1 rounded-full border-primary/20 bg-sky-50 text-primary"
          asChild
        >
          <Link href={href("/reserve")}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Réserver
          </Link>
        </Button>
      </div>

      <div className="flex gap-2">
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
        <InstallAppButton className="flex-1" />
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
    </div>
  );
}
