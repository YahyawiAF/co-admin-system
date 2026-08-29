"use client";

import { type ReactNode, useEffect } from "react";
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
import { useMobileKeyboardOpen } from "@/lib/hooks/use-mobile-keyboard";
import { MobileHeader } from "@/components/visitor/MobileHeader";
import { StaffMessageModal } from "@/components/visitor/StaffMessageModal";

const FULL_NAV = [
  { path: "", label: "Accueil", icon: Home },
  { path: "/events", label: "Événements", icon: CalendarDays },
  { path: "/community", label: "Communauté", icon: Users },
  { path: "/cafe", label: "Café", icon: Coffee },
  { path: "/profile", label: "Profil", icon: UserRound },
];

const GATED_NAV = [
  { path: "", label: "Accueil", icon: Home },
  { path: "/profile", label: "Profil", icon: UserRound },
];

export function MobileShell({ children }: { children: ReactNode }) {
  const params = useParams<{ org: string }>();
  const orgSlug = params.org;
  const pathname = usePathname();
  const router = useRouter();
  const { ready, onboarded } = useVisitorSession();
  const keyboardOpen = useMobileKeyboardOpen();
  const nav = onboarded ? FULL_NAV : GATED_NAV;
  const base = `/m/${orgSlug}`;
  const rest = pathname === base ? "" : pathname.slice(base.length);
  const allowed =
    rest === "" || rest === "/" || rest.startsWith("/profile");

  useEffect(() => {
    if (!ready || onboarded || allowed) return;
    router.replace(base);
  }, [ready, onboarded, allowed, base, router]);

  return (
    <div
      className={cn(
        "mobile-shell mx-auto max-w-[480px] bg-[#f3f6fb] text-slate-900",
        keyboardOpen ? "min-h-dvh pb-4" : "min-h-dvh pb-24"
      )}
    >
      <div className="px-4 pb-4 pt-2">
        <MobileHeader />
        {children}
        {onboarded ? <StaffMessageModal /> : null}
      </div>
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
                  active ? "text-primary" : "text-slate-400"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    active && "bg-primary/10"
                  )}
                >
                  <Icon className="h-5 w-5" />
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
