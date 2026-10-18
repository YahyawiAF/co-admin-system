"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { mobileApi, type MobileSession } from "@/lib/api/resources";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { WelcomeRegister } from "@/components/visitor/WelcomeRegister";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { ActiveSessionPanel } from "@/components/visitor/ActiveSessionPanel";
import { AppInstallPromo } from "@/components/visitor/AppInstallPromo";
import {
  PointsCard,
} from "@/components/visitor/PointsCard";
import { ProfileMissionEntry } from "@/components/visitor/ProfileMissionEntry";
import { ReviewPromptCard } from "@/components/visitor/ReviewPromptCard";
import { EnergyBoostCard } from "@/components/visitor/EnergyBoostCard";
import { WifiCredentialsModal } from "@/components/visitor/WifiCredentialsModal";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import {
  QrWelcome,
  StartSessionCard,
} from "@/components/visitor/StartSessionCard";
import { EventsPreview } from "@/components/visitor/EventCard";
import { OffersStrip } from "@/components/visitor/VisitorSpotlight";
import { SubscriptionStatusCard } from "@/components/visitor/SubscriptionStatusCard";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { spacesForPrice } from "@/lib/space-occupy";
import { memberAppPromos } from "@/lib/promo-price";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";
import { clearQrEntry, markTarifPrompt } from "@/lib/visitorCache";
import {
  startFromQrEntry,
  wantsQrCheckin,
} from "@/lib/visitor-qr-checkin";
import { isStandalonePwa } from "@/lib/visitor-notify";

export default function MobileHomePage() {
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { onboarded, memberId, ready } = useVisitorSession();
  const [wifiOpen, setWifiOpen] = useState(false);
  const [isApp, setIsApp] = useState(true);
  const [showCheckoutPromo, setShowCheckoutPromo] = useState(false);
  /** localStorage and/or ?checkin=1 (iPhone Camera → Safari). */
  const [fromQr, setFromQr] = useState(() =>
    typeof window !== "undefined" ? wantsQrCheckin(slug) : false,
  );

  useEffect(() => {
    setIsApp(isStandalonePwa());
  }, []);

  useEffect(() => {
    setFromQr(wantsQrCheckin(slug));
  }, [slug, onboarded, memberId]);

  const {
    data: status,
    refetch,
    isPlaceholderData: statusIsPlaceholder,
  } = useMobileStatus();
  const qrAutoStartedRef = useRef(false);
  /** QR flag read before anything clears it: a scan while a session runs means "leaving?" */
  const qrAtLoadRef = useRef(
    typeof window !== "undefined" && wantsQrCheckin(slug)
  );
  const [leavePrompt, setLeavePrompt] = useState(false);
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
    if (!status?.session || statusIsPlaceholder) return;
    setShowCheckoutPromo(false);
  }, [status?.session, statusIsPlaceholder]);

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

  const goSession = useCallback(
    (res?: MobileSession | null) => {
      if (res?.resumed) toast.success("Session reprise ✓");
      else if (res?.alreadyOpen) {
        toast.message("Votre session est déjà en cours");
      } else if (res) {
        toast.success("Présence enregistrée ✓");
        if (res.pricingMode === "AUTO") markTarifPrompt(slug);
      }
      clearQrEntry(slug);
      setFromQr(false);
      void refetch();
      window.location.replace(href("/session"));
    },
    [slug, refetch, href],
  );

  /** Abonnement session when it covers today, otherwise the AUTO counter (tiers). */
  const startAuto = useMutation({
    mutationFn: () => mobileApi.startAutoSession(memberId!),
    networkMode: "always",
    onSuccess: (res) => goSession(res),
    onError: (e: Error) => {
      qrAutoStartedRef.current = false;
      toast.error(e.message);
    },
  });

  /** One tap: the server covers it with the abonnement when one applies, else AUTO. */
  const startSession = () => {
    if (!memberId || startAuto.isPending) return;
    if (status?.session || status?.pendingRequest) {
      toast.message("Votre session est déjà en cours");
      if (status.session) router.push(href("/session"));
      return;
    }
    startAuto.mutate();
  };

  /**
   * QR scan = pointage:
   * - idle → start AUTO (even right after signup; don't wait forever on placeholder)
   * - already in session → open /session (and leave prompt if scan was late)
   */
  useEffect(() => {
    const qr = fromQr || wantsQrCheckin(slug);
    if (!qr || qrAutoStartedRef.current) return;
    if (!ready || !onboarded || !memberId) return;
    if (startAuto.isPending) return;

    const liveSession =
      status?.session &&
      !statusIsPlaceholder &&
      !String(status.session.id || "").startsWith("optimistic");
    const pending = !!status?.pendingRequest && !statusIsPlaceholder;

    if (liveSession) {
      qrAutoStartedRef.current = true;
      clearQrEntry(slug);
      setFromQr(false);
      const startedAt = status!.session!.registredTime
        ? new Date(status!.session!.registredTime).getTime()
        : 0;
      if (startedAt && Date.now() - startedAt > 3 * 60_000) {
        setLeavePrompt(true);
      }
      window.location.replace(href("/session"));
      return;
    }

    if (pending) return;

    // Fresh idle status, or new member with no session on placeholder
    const canStart =
      (status && !statusIsPlaceholder && !status.session) ||
      (!status?.session && !status?.pendingRequest && !!memberId);

    if (!canStart) return;

    qrAutoStartedRef.current = true;
    setFromQr(false);
    void startFromQrEntry({ org: slug, memberId, force: true })
      .then((session) => {
        if (!session) {
          startAuto.mutate();
          return;
        }
        goSession(session);
      })
      .catch((e: Error) => {
        qrAutoStartedRef.current = false;
        setFromQr(wantsQrCheckin(slug));
        toast.error(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startAuto.isPending only
  }, [
    fromQr,
    ready,
    onboarded,
    memberId,
    status,
    statusIsPlaceholder,
    slug,
    startAuto.isPending,
    goSession,
    href,
  ]);

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
  const scanError = startAuto.isError
    ? (startAuto.error as Error).message
    : null;
  const appPromos = memberAppPromos(layout?.facility, status?.member);
  const showInstallPromo =
    appPromos.eligible ||
    (!!status?.member &&
      !status.member.pwaInstalledAt &&
      status.member.appInstallPromoEligible !== false);

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
  const renewSubscription = (priceId?: string) => {
    router.push(
      href(
        priceId
          ? `/choose?mode=subscription&priceId=${encodeURIComponent(priceId)}`
          : "/choose?mode=subscription"
      )
    );
  };
  const idle = !session && !pending;
  const showQrWelcome = fromQr && idle;
  const subscriptionCard = (alertsOnly: boolean) => (
    <SubscriptionStatusCard
      subscription={status?.subscription}
      lastSubscription={status?.lastSubscription}
      upcomingSubscription={status?.upcomingSubscription}
      alertsOnly={alertsOnly}
      onOpen={goSubscription}
      onRenew={renewSubscription}
    />
  );

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

      {/* App install promo — each promo once; hidden when all are used */}
      {showInstallPromo && !showQrWelcome && !session ? (
        <AppInstallPromo
          globalPromo={appPromos.globalPromo}
          promos={appPromos.promos}
          emphasize={showCheckoutPromo}
          unlocked={appPromos.active}
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
          onWifi={hasWifi ? openWifi : undefined}
          promptCheckout={leavePrompt}
          belowSession={
            <>
              <OffersStrip />
              <EventsPreview />
              {session.registredTime && memberId ? (
                <EnergyBoostCard memberId={memberId} since={String(session.registredTime)} />
              ) : null}
              {subscriptionCard(true)}
              {showInstallPromo ? (
                <AppInstallPromo
                  globalPromo={appPromos.globalPromo}
                  promos={appPromos.promos}
                  unlocked={appPromos.active}
                />
              ) : null}
            </>
          }
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

      {idle ? <OffersStrip /> : null}

      {idle || (pending && !session) ? subscriptionCard(false) : null}

      {idle ? <EventsPreview /> : null}

      {idle ? (
        <StartSessionCard
          tarifs={tarifs}
          hasActiveSubscription={!!status?.hasActiveSubscription}
          subscriptionName={status?.subscription?.price?.name}
          subscriptionDaysRemaining={status?.subscription?.daysRemaining}
          subscriptionHoursRemaining={status?.subscription?.hoursRemaining}
          dailyRemainingHours={periodSub ? dailyRem : null}
          pending={startAuto.isPending}
          error={scanError}
          canChooseForfait={canChooseForfait}
          onStart={startSession}
          onPickForfait={goChooseDay}
          onSubscription={goSubscription}
        />
      ) : null}

      {showQrWelcome && showInstallPromo ? (
        <AppInstallPromo
          globalPromo={appPromos.globalPromo}
          promos={appPromos.promos}
          unlocked={appPromos.active}
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

      {pending && !session ? <EventsPreview /> : null}

      {memberId && !session ? <ReviewPromptCard memberId={memberId} /> : null}
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
