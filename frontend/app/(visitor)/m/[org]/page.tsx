"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  CreditCard,
  MessageSquare,
  Monitor,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { mobileApi } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { WelcomeRegister } from "@/components/visitor/WelcomeRegister";
import { AnnouncementBanner } from "@/components/visitor/AnnouncementBanner";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { ActiveSessionPanel } from "@/components/visitor/ActiveSessionPanel";
import { AppInstallPromo } from "@/components/visitor/AppInstallPromo";
import {
  PointsCard,
} from "@/components/visitor/PointsCard";
import { ProfileMissionEntry } from "@/components/visitor/ProfileMissionEntry";
import {
  isWithinPointageGrace,
  PointageGraceWindow,
} from "@/components/visitor/PointageGraceWindow";
import { WifiCredentialsModal } from "@/components/visitor/WifiCredentialsModal";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { ScanQrPresence } from "@/components/visitor/ScanQrPresence";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { spacesForPrice } from "@/lib/space-occupy";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";
import { consumeQrEntry } from "@/lib/visitorCache";
import { isStandalonePwa } from "@/lib/visitor-notify";

export default function MobileHomePage() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { onboarded, memberId, ready } = useVisitorSession();
  const [wifiOpen, setWifiOpen] = useState(false);
  const [isApp, setIsApp] = useState(true);
  const [showCheckoutPromo, setShowCheckoutPromo] = useState(false);
  const [graceDismissed, setGraceDismissed] = useState(false);

  useEffect(() => {
    setIsApp(isStandalonePwa());
  }, []);

  const { data: status, refetch, isSuccess: statusReady } = useMobileStatus();
  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug, memberId],
    queryFn: async () => {
      const data = await mobileApi.floorPlan(slug, memberId ?? undefined);
      writeLocalCache("floor-plan", data, slug);
      return data;
    },
    staleTime: 5 * 60_000,
    placeholderData: () => readLocalCache("floor-plan", slug) ?? undefined,
  });

  useEffect(() => {
    if (status?.session) setShowCheckoutPromo(false);
  }, [status?.session]);

  useEffect(() => {
    setGraceDismissed(false);
  }, [status?.session?.id]);

  const cancel = useMutation({
    mutationFn: () => {
      const id = status?.pendingRequest?.id;
      if (!id || String(id).startsWith("optimistic")) {
        return Promise.resolve(null);
      }
      return mobileApi.cancelVisitRequest(id, memberId!);
    },
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
    if (!onboarded || !memberId || !statusReady || !status) return;

    const routedKey = `accueil_routed_${memberId}`;
    const fromQr = consumeQrEntry(slug);

    // Active session / pending — stay; remember we already landed here
    if (status.session || status.pendingRequest) {
      try {
        sessionStorage.setItem(routedKey, "1");
      } catch {
        /* ignore */
      }
      return;
    }

    // Returning to Accueil from Events/Café/etc. — do not force forfait again
    if (!fromQr) {
      try {
        if (sessionStorage.getItem(routedKey) === "1") return;
      } catch {
        /* ignore */
      }
    }

    try {
      sessionStorage.setItem(routedKey, "1");
    } catch {
      /* ignore */
    }

    // Active abonnement → mark presence directly
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

    // Known visitor without abo → forfait (first entry / QR only)
    router.replace(href("/choose?mode=day"));
  }, [onboarded, memberId, statusReady, status, slug, router, href]);

  const pending = status?.pendingRequest;
  const session = status?.session;
  const isOptimisticSession =
    !!(session as { _optimistic?: boolean } | null | undefined)?._optimistic ||
    String(session?.id || "").startsWith("optimistic");
  const showGrace =
    !!session &&
    !graceDismissed &&
    !isOptimisticSession &&
    isWithinPointageGrace(session.registredTime);
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

  const wifiFallback = useMemo(() => {
    if (seat?.wifiSsid || seat?.wifiPassword) {
      return {
        wifiSsid: seat.wifiSsid,
        wifiPassword: seat.wifiPassword,
        spaceId: seat.spaceId,
        spaceName: seat.spaceName,
      };
    }
    const spaces = layout?.spaces || [];
    const withWifi = spaces.find(
      (s: { wifiSsid?: string | null; wifiPassword?: string | null }) =>
        s.wifiSsid || s.wifiPassword
    ) as
      | {
          id: string;
          name?: string;
          wifiSsid?: string | null;
          wifiPassword?: string | null;
        }
      | undefined;
    if (!withWifi) return null;
    return {
      wifiSsid: withWifi.wifiSsid,
      wifiPassword: withWifi.wifiPassword,
      spaceId: withWifi.id,
      spaceName: withWifi.name || null,
    };
  }, [seat, layout?.spaces]);

  const hasWifi = !!(wifiFallback?.wifiSsid || wifiFallback?.wifiPassword);

  const sessionPrice = session?.prices || session?.price || null;
  const allowedSpaceIds = useMemo(
    () =>
      sessionPrice && layout?.spaces
        ? spacesForPrice(layout.spaces, sessionPrice).map((s) => s.id)
        : undefined,
    [sessionPrice, layout?.spaces]
  );

  const subDaysRemaining = status?.subscription?.daysRemaining;
  const subPeriodDays =
    (status?.subscription as { periodDays?: number | null } | null)?.periodDays ??
    null;
  const subProgress =
    subDaysRemaining != null && subPeriodDays && subPeriodDays > 0
      ? Math.min(100, Math.max(0, (subDaysRemaining / subPeriodDays) * 100))
      : subDaysRemaining != null
        ? Math.min(100, Math.max(0, subDaysRemaining * 5))
        : null;

  if (!ready) return <p className="text-slate-500">Chargement…</p>;
  if (!onboarded) return <WelcomeRegister />;

  // First land only: wait for status / auto-route. Returning from Events stays put.
  const alreadyRouted =
    typeof window !== "undefined" &&
    !!memberId &&
    (() => {
      try {
        return sessionStorage.getItem(`accueil_routed_${memberId}`) === "1";
      } catch {
        return false;
      }
    })();
  const routingAway =
    !alreadyRouted &&
    (!statusReady ||
      (!!status && !status.session && !status.pendingRequest));
  if (routingAway && !session && !pending) {
    return <p className="text-slate-500">Chargement…</p>;
  }

  const openWifi = () => {
    if (wifiFallback?.spaceId) {
      sessionStorage.removeItem(`wifi-seen:${wifiFallback.spaceId}`);
    }
    setWifiOpen(true);
  };

  const goChooseDay = () => {
    router.push(href("/choose?mode=day"));
  };

  const goSubscription = () => {
    if (status?.hasActiveSubscription) {
      router.push(href("/subscription"));
      return;
    }
    if (!status?.member?.hasPin) {
      toast.message("Créez un compte (app + PIN) pour souscrire un abonnement");
      router.push(href("/profile?upgrade=1"));
      return;
    }
    router.push(href("/choose?mode=subscription"));
  };

  return (
    <div className="space-y-3">
      <WifiCredentialsModal
        seat={seat}
        fallback={wifiFallback}
        forceOpen={wifiOpen}
        onClose={() => setWifiOpen(false)}
      />

      {memberId ? <PointsCard memberId={memberId} /> : null}
      <ProfileMissionEntry hideWhenComplete />

      {/* App install promo — once only; hidden after claim */}
      {(status?.member?.appInstallPromoEligible !== false &&
        !status?.member?.appInstallPromoClaimedAt &&
        layout?.facility?.appInstallPromoEligible !== false) ? (
        <AppInstallPromo
          globalPromo={layout?.facility?.appInstallGlobalPromo ?? null}
          promos={layout?.facility?.appInstallPromos ?? null}
          emphasize={showCheckoutPromo && !session}
          unlocked={
            !!status?.member?.appInstallPromoActive ||
            (!!status?.member?.pwaInstalledAt &&
              status?.member?.appInstallPromoEligible !== false)
          }
        />
      ) : null}

      {/* Hero — compact greeting / post-pointage grace */}
      {session && showGrace ? (
        <PointageGraceWindow
          sessionId={session.id}
          forfaitName={
            session.prices?.name || session.price?.name || "Forfait"
          }
          registredTime={session.registredTime}
          onExpired={() => setGraceDismissed(true)}
          onCancelled={() => {
            setGraceDismissed(true);
            void refetch();
          }}
          onChangeTarif={() => {
            setGraceDismissed(true);
            router.push(href("/choose?mode=day"));
          }}
        />
      ) : session ? (
        <ActiveSessionPanel
          memberId={memberId!}
          session={session}
          seat={seat}
          seatSettings={status?.seatSettings}
          hasActiveSubscription={!!status?.hasActiveSubscription}
          subscriptionKind={subKind}
          allowedSpaceIds={allowedSpaceIds}
          promos={
            status?.member?.appInstallPromoEligible === false ||
            status?.member?.appInstallPromoClaimedAt ||
            layout?.facility?.appInstallPromoEligible === false
              ? null
              : layout?.facility?.appInstallPromos ?? null
          }
          globalPromo={
            status?.member?.appInstallPromoEligible === false ||
            status?.member?.appInstallPromoClaimedAt ||
            layout?.facility?.appInstallPromoEligible === false
              ? null
              : layout?.facility?.appInstallGlobalPromo ?? null
          }
          onCheckoutSuccess={() => {
            if (!isStandalonePwa()) setShowCheckoutPromo(true);
          }}
        />
      ) : (
        <div className="relative h-28 overflow-hidden rounded-3xl bg-slate-800 text-white shadow-sm">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=60)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 to-slate-900/10" />
          <div className="relative flex h-full items-center justify-between px-4">
            <div>
              <p className="text-xs text-white/75">Bonjour,</p>
              <p className="text-lg font-bold leading-tight">
                {greetingName}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70">
                {facilityName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasWifi ? (
                <button
                  type="button"
                  onClick={openWifi}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
                  aria-label="Wi‑Fi"
                >
                  <Wifi className="h-4 w-4" />
                </button>
              ) : null}
              {member ? (
                <Link href={href("/profile")}>
                  <VisitorAvatar
                    name={displayName}
                    src={member.avatarUrl}
                    className="h-9 w-9 border-2 border-white/80"
                  />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Announcement slot */}
      <AnnouncementBanner />

      {/* Scan — main action (web pointage = check-in) */}
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
              : "Scannez le QR de l’accueil pour activer votre accès"
          }
          onConfirmed={afterScan}
        />
      ) : null}

      {/* Abonnement summary (idle) — app only */}
      {isApp && status?.hasActiveSubscription && !session ? (
        <div className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Abonnement
            </p>
            <Link
              href={href("/subscription")}
              className="text-xs font-medium text-indigo-600"
            >
              Détail ›
            </Link>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-base font-bold">
              {status.subscription?.price?.name || "Abonnement actif"}
            </p>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Jours restants
              </p>
              <p className="text-2xl font-bold tabular-nums text-indigo-600">
                {subDaysRemaining != null ? subDaysRemaining : "—"}
              </p>
            </div>
          </div>
          {subProgress != null ? (
            <div className="mt-3 space-y-1.5">
              <Progress value={subProgress} className="h-2" />
              <p className="text-[11px] text-slate-500">
                {status.subscription?.hoursRemaining != null
                  ? `${status.subscription.hoursRemaining}h restantes`
                  : "En cours"}
                {status.subscription?.reservedSeatLabel
                  ? ` · place ${status.subscription.reservedSeatLabel}`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Pending request */}
      {pending ? (
        <Alert className="rounded-3xl border-0 bg-white shadow-sm">
          <AlertDescription>
            En attente
            {pending.price?.name ? ` : ${pending.price.name}` : ""}.
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={
                  cancel.isPending ||
                  String(pending.id || "").startsWith("optimistic")
                }
                onClick={() => cancel.mutate()}
              >
                {String(pending.id || "").startsWith("optimistic")
                  ? "Envoi…"
                  : "Annuler"}
              </Button>
              <Button size="sm" className="rounded-full" asChild>
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

      {/* Main access card — full booking CTAs in the installed app only */}
      {isApp && !session ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Votre accès
          </p>
          <div className="mt-2.5 space-y-2">
            <Button
              className="h-12 w-full rounded-full bg-indigo-600 text-sm font-semibold shadow-sm hover:bg-indigo-700"
              disabled={!canChooseForfait}
              onClick={goChooseDay}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Réserver ma place maintenant
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-full border-indigo-200 text-indigo-700"
                disabled={!!pending && pending.type === "SUBSCRIPTION"}
                onClick={goSubscription}
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Abonnement
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full border-slate-200 text-slate-700"
                asChild
              >
                <Link href={href("/reserve")}>
                  <CalendarDays className="mr-1.5 h-4 w-4" />
                  Autre jour
                </Link>
              </Button>
            </div>
          </div>
          <p className="mt-2.5 text-center text-[11px] text-slate-400">
            Réservation pour aujourd&apos;hui : sur place ou par téléphone
          </p>
        </div>
      ) : isApp && status?.hasActiveSubscription ? (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
          asChild
        >
          <Link href={href("/subscription")}>
            <CreditCard className="mr-1.5 h-4 w-4" />
            Mon abonnement
          </Link>
        </Button>
      ) : null}

      {/* Wi-Fi during session */}
      {session && hasWifi ? (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
          onClick={openWifi}
        >
          <Wifi className="mr-1.5 h-4 w-4" />
          Wi‑Fi de l&apos;espace
        </Button>
      ) : null}

      {/* Secondary: contact + install (Café/Communauté live in the bottom nav) */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <Link
          href={href("/staff")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Contacter l&apos;accueil
        </Link>
        <span className="text-slate-300">·</span>
        <InstallAppButton variant="link" />
      </div>
    </div>
  );
}
