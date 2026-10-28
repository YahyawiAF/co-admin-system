"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Coffee,
  Home,
  Users,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { orgHref } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { useMobileKeyboardOpen } from "@/lib/hooks/use-mobile-keyboard";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { isCommunityUnlocked } from "@/lib/community";
import { useApplyVisitorTheme } from "@/lib/visitor-theme";
import { MobileHeader } from "@/components/visitor/MobileHeader";
import { StaffMessageModal } from "@/components/visitor/StaffMessageModal";
import { VisitorAlerts } from "@/components/visitor/VisitorAlerts";
import { OfflineBanner } from "@/components/visitor/OfflineBanner";
import { CommunityNotePopup } from "@/components/visitor/CommunityNotePopup";
import { VisitorSpotlight, useUnseenEventCount } from "@/components/visitor/VisitorSpotlight";

/** Light visitor (name+phone, no PIN): no community */
const LIGHT_NAV = [
  { path: "", label: "Accueil", icon: Home },
  { path: "/events", label: "Événements", icon: CalendarDays },
  { path: "/cafe", label: "Café", icon: Coffee },
  { path: "/profile", label: "Profil", icon: UserRound },
];

/** Account + installed app: community unlocked */
const ACCOUNT_NAV = [
  { path: "", label: "Accueil", icon: Home },
  { path: "/events", label: "Événements", icon: CalendarDays },
  { path: "/community", label: "Communauté", icon: Users },
  { path: "/cafe", label: "Café", icon: Coffee },
  { path: "/profile", label: "Profil", icon: UserRound },
];

const GUEST_NAV = [
  { path: "", label: "Accueil", icon: Home },
  { path: "/profile", label: "Profil", icon: UserRound },
];

function isLightAllowed(rest: string) {
  return (
    rest === "" ||
    rest === "/" ||
    rest.startsWith("/entry") ||
    rest.startsWith("/profile") ||
    rest.startsWith("/recover") ||
    rest.startsWith("/join") ||
    rest.startsWith("/signup") ||
    rest.startsWith("/choose") ||
    rest.startsWith("/cafe") ||
    rest.startsWith("/events") ||
    rest.startsWith("/tarifs") ||
    rest.startsWith("/history") ||
    rest.startsWith("/subscription") ||
    rest.startsWith("/session") ||
    rest.startsWith("/reserve") ||
    rest.startsWith("/reservations") ||
    rest.startsWith("/staff") ||
    rest.startsWith("/l/")
  );
}

function isGuestAllowed(rest: string) {
  return (
    rest === "" ||
    // Tracked share links and the event they open (from Instagram, WhatsApp…)
    rest.startsWith("/l/") ||
    /^\/events\/[^/]+$/.test(rest) ||
    rest === "/" ||
    rest.startsWith("/entry") ||
    rest.startsWith("/profile") ||
    rest.startsWith("/recover") ||
    rest.startsWith("/join") ||
    rest.startsWith("/signup") ||
    rest === "/reserve" ||
    rest.startsWith("/tarifs")
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  const params = useParams<{ org: string }>();
  const orgSlug = params.org;
  const pathname = usePathname();
  const router = useRouter();
  const { ready, onboarded, memberId } = useVisitorSession();
  const { data: status, isFetched } = useMobileStatus({
    enabled: !!memberId && onboarded,
  });
  const [isApp, setIsApp] = useState(false);
  const hasAccount = !!status?.member?.hasPin;
  const communityUnlocked = isCommunityUnlocked(hasAccount, isApp);
  const keyboardOpen = useMobileKeyboardOpen();
  useApplyVisitorTheme(orgSlug);
  const nav = !onboarded
    ? GUEST_NAV
    : communityUnlocked
      ? ACCOUNT_NAV
      : LIGHT_NAV;
  const base = `/m/${orgSlug}`;
  const rest = pathname === base ? "" : pathname.slice(base.length);
  const immersiveChat =
    rest.startsWith("/staff") || rest.startsWith("/chat/");

  const accountOnly =
    rest.startsWith("/community") ||
    rest.startsWith("/chat/") ||
    rest.startsWith("/u/");
  const unseenEvents = useUnseenEventCount();
  /** Offer / new-event popup only on the calm screens (never mid sign-up or pass choice). */
  const showSpotlight =
    onboarded &&
    !keyboardOpen &&
    (rest === "" || rest === "/" || rest.startsWith("/session") || rest.startsWith("/cafe"));
  const showCommunityNudge =
    onboarded &&
    communityUnlocked &&
    !keyboardOpen &&
    (rest === "" || rest === "/" || rest.startsWith("/session"));

  useEffect(() => {
    setIsApp(isStandalonePwa());
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!onboarded) {
      if (!isGuestAllowed(rest)) router.replace(base);
      return;
    }
    // Wait for status before gating account-only routes
    if (memberId && !isFetched) return;
    // Community (and peer chat / profiles) only in the installed app
    if (accountOnly && !communityUnlocked) {
      router.replace(`${base}/profile?upgrade=1`);
      return;
    }
    if (!hasAccount && !isLightAllowed(rest)) {
      router.replace(base);
    }
  }, [
    ready,
    onboarded,
    hasAccount,
    communityUnlocked,
    accountOnly,
    rest,
    base,
    router,
    memberId,
    isFetched,
  ]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);

  return (
    <div
      className={cn(
        "mobile-shell mx-auto max-w-[480px] bg-[var(--v-bg,#f3f6fb)] text-slate-900 transition-colors duration-300",
        immersiveChat
          ? "h-dvh overflow-hidden"
          : keyboardOpen
            ? "min-h-dvh pb-4"
            : "min-h-dvh pb-24"
      )}
    >
      {immersiveChat ? (
        <div
          className={cn(
            "flex h-full min-h-0 flex-col",
            !keyboardOpen &&
              "pb-[calc(4.25rem+env(safe-area-inset-bottom))]"
          )}
        >
          <div className="min-h-0 flex-1">{children}</div>
          {onboarded && hasAccount ? <StaffMessageModal /> : null}
        </div>
      ) : (
        <div className="px-3 pb-3 pt-1.5">
          <MobileHeader />
          <OfflineBanner />
          {onboarded ? <VisitorAlerts /> : null}
          {children}
          {onboarded && hasAccount ? <StaffMessageModal /> : null}
        </div>
      )}
      {showSpotlight ? <VisitorSpotlight /> : null}
      {showCommunityNudge ? <CommunityNotePopup /> : null}
      <nav
        aria-hidden={keyboardOpen}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200",
          keyboardOpen && "pointer-events-none translate-y-full"
        )}
      >
        <div className="mx-auto flex max-w-[480px]">
          {nav.map((item) => {
            const href = orgHref(orgSlug, item.path);
            const active =
              item.path === ""
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(`${base}${item.path}`);
            const Icon = item.icon;
            return (
              <Link
                key={item.path || "home"}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                  active ? "text-indigo-600" : "text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200",
                    active && "bg-indigo-50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.path === "/events" && unseenEvents > 0 && !active ? (
                    <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                      {unseenEvents}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
