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
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { WifiCredentialsModal } from "@/components/visitor/WifiCredentialsModal";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import {
  QrWelcome,
  StartSessionCard,
} from "@/components/visitor/StartSessionCard";
import { EventsPreview } from "@/components/visitor/EventCard";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { spacesForPrice } from "@/lib/space-occupy";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";
import { clearQrEntry, hasRecentQrEntry } from "@/lib/visitorCache";
import { isStandalonePwa } from "@/lib/visitor-notify";

export default function MobileHomePage() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { onboarded, memberId, ready } = useVisitorSession();
  const [wifiOpen, setWifiOpen] = useState(false);
  const [isApp, setIsApp] = useState(true);
  const [showCheckoutPromo, setShowCheckoutPromo] = useState(false);
  const [fromQr, setFromQr] = useState(false);

  useEffect(() => {
    setIsApp(isStandalonePwa());
  }, []);

  useEffect(() => {
    setFromQr(hasRecentQrEntry(slug));
  }, [slug]);

  const {
    data: status,
    refetch,
    isPlaceholderData: statusIsPlaceholder,
  } = useMobileStatus();
  const qrAutoStartedRef = useRef(false);
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
  const { data: tarifs = [] } = useQuery({
    queryKey: ["mobile-tarifs", slug],
    queryFn: () => mobileApi.tarifs(slug),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!status?.session) return;
    setShowCheckoutPromo(false);
    clearQrEntry(slug);
    setFromQr(false);
  }, [status?.session, slug]);

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
    onSuccess: (res) => {
      if (res?.alreadyOpen) {
        toast.message("Votre session est déjà en cours");
      } else {
        toast.success("Présence enregistrée ✓");
      }
      refetch();
      router.push(href("/session"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** No subscription (or day credit used): the counter starts now, price follows tiers. */
  const startAuto = useMutation({
    mutationFn: () => mobileApi.startAutoSession(memberId!),
    onSuccess: (res) => {
      if (res?.alreadyOpen) {
        toast.message("Votre session est déjà en cours");
      } else {
        toast.success("Présence enregistrée ✓");
      }
      refetch();
      router.push(href("/session"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** One tap: abonnement → presence; otherwise the AUTO counter (tiers) starts now. */
  const startSession = () => {
    if (!memberId || scanIn.isPending || startAuto.isPending) return;
    if (status?.session || status?.pendingRequest) {
      toast.message("Votre session est déjà en cours");
      if (status.session) router.push(href("/session"));
      return;
    }
    if (status?.hasActiveSubscription) {
      const rem =
        status.dailyCreditRemainingHours ??
        (status.subscription as { dailyCreditRemainingHours?: number } | null)
          ?.dailyCreditRemainingHours;
      if (rem != null && rem <= 0) {
        startAuto.mutate();
        return;
      }
      scanIn.mutate();
      return;
    }
    // Server falls back to the subscription session when one is active
    startAuto.mutate();
  };

  /** First QR scan → the session starts immediately (no extra tap). */
  useEffect(() => {
    if (!fromQr || qrAutoStartedRef.current) return;
    if (!ready || !onboarded || !memberId) return;
    if (!status || statusIsPlaceholder) return;
    if (status.session || status.pendingRequest) return;
    qrAutoStartedRef.current = true;
    clearQrEntry(slug);
    startSession();
  });

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
  const scanError = scanIn.isError
    ? (scanIn.error as Error).message
    : startAuto.isError
      ? (startAuto.error as Error).message
      : null;
  const showInstallPromo =
    status?.member?.appInstallPromoEligible !== false &&
    !status?.member?.appInstallPromoClaimedAt &&
    layout?.facility?.appInstallPromoEligible !== false;

  const sessionPrice = session?.prices || session?.price || null;
  const allowedSpaceIds = useMemo(
    () =>
      sessionPrice && layout?.spaces
        ? spacesForPrice(layout.spaces, sessionPrice).map((s) => s.id)
        : undefined,
    [sessionPrice, layout?.spaces]
  );

  if (!ready) return <p className="text-slate-500">Chargement…</p>;
  if (!onboarded) return <WelcomeRegister />;

  const openWifi = () => setWifiOpen(true);

  const goChooseDay = (priceId?: string) => {
    router.push(
      href(
        priceId
          ? `/choose?mode=day&priceId=${encodeURIComponent(priceId)}`
          : "/choose?mode=day"
      )
    );
  };

  const goSubscription = () => {
    router.push(
      href(
        status?.hasActiveSubscription
          ? "/subscription"
          : "/choose?mode=subscription"
      )
    );
  };
  const idle = !session && !pending;
  const showQrWelcome = fromQr && idle;

  return (
    <div className="space-y-3">
      <WifiCredentialsModal
        seat={seat}
        fallback={wifiFallback}
        forceOpen={wifiOpen}
        onClose={() => setWifiOpen(false)}
      />

      {showQrWelcome ? (
        <QrWelcome
          facilityName={facilityName}
          receptionAway={!!layout?.facility?.receptionAway}
        />
      ) : null}

      {/* App install promo — once only; hidden after claim */}
      {showInstallPromo && !showQrWelcome ? (
        <AppInstallPromo
          globalPromo={layout?.facility?.appInstallGlobalPromo ?? null}
          promos={layout?.facility?.appInstallPromos ?? null}
          emphasize={showCheckoutPromo && !session}
          unlocked={
            !!status?.member?.appInstallPromoActive ||
            !!status?.member?.pwaInstalledAt
          }
        />
      ) : null}

      {/* Hero — compact greeting / post-pointage grace */}
      {session ? (
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
          onSwitchToSubscription={
            status?.hasActiveSubscription ? undefined : goSubscription
          }
          pendingSubscriptionName={
            pending?.type === "SUBSCRIPTION"
              ? pending.price?.name || "abonnement"
              : null
          }
          aboveTracking={<EventsPreview embedded />}
        />
      ) : showQrWelcome ? null : (
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

      {idle ? <EventsPreview /> : null}

      {idle ? (
        <StartSessionCard
          tarifs={tarifs}
          hasActiveSubscription={!!status?.hasActiveSubscription}
          subscriptionName={status?.subscription?.price?.name}
          subscriptionDaysRemaining={status?.subscription?.daysRemaining}
          subscriptionHoursRemaining={status?.subscription?.hoursRemaining}
          dailyRemainingHours={periodSub ? dailyRem : null}
          pending={scanIn.isPending || startAuto.isPending}
          error={scanError}
          canChooseForfait={canChooseForfait}
          onStart={startSession}
          onPickForfait={goChooseDay}
          onSubscription={goSubscription}
        />
      ) : null}

      {showQrWelcome && showInstallPromo ? (
        <AppInstallPromo
          globalPromo={layout?.facility?.appInstallGlobalPromo ?? null}
          promos={layout?.facility?.appInstallPromos ?? null}
          unlocked={
            !!status?.member?.appInstallPromoActive ||
            !!status?.member?.pwaInstalledAt
          }
        />
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

      {pending && !session ? <EventsPreview /> : null}

      {memberId ? (
        <PointsCard memberId={memberId} hideLocked={showInstallPromo && !isApp} />
      ) : null}
      <ProfileMissionEntry hideWhenComplete />

      {/* Secondary: contact + install (Café/Communauté live in the bottom nav) */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
        {isApp && !session ? (
          <>
            <Link
              href={href(
                status?.hasActiveSubscription ? "/subscription" : "/reserve"
              )}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {status?.hasActiveSubscription ? (
                <CreditCard className="h-3.5 w-3.5" />
              ) : (
                <CalendarDays className="h-3.5 w-3.5" />
              )}
              {status?.hasActiveSubscription ? "Mon abonnement" : "Autre jour"}
            </Link>
            <span className="text-slate-300">·</span>
          </>
        ) : null}
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
