"use client";

import { type ReactNode, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Coffee,
  Home,
  Users,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { organizationsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { OrgProvider, orgHref } from "@/lib/org";
import {
  VisitorSessionProvider,
  useVisitorSession,
} from "@/lib/visitor-session";
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

function Shell({ children }: { children: ReactNode }) {
  const params = useParams<{ org: string }>();
  const orgSlug = params.org;
  const pathname = usePathname();
  const router = useRouter();
  const { ready, onboarded } = useVisitorSession();
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
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#f3f6fb] pb-24 text-slate-900">
      <div className="px-4 pb-4 pt-2">
        <MobileHeader />
        {children}
        {onboarded ? <StaffMessageModal /> : null}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
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

export default function OrgMobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams<{ org: string }>();
  const slug = params.org;
  const { data: org, isLoading, isError } = useQuery({
    queryKey: queryKeys.organization(slug),
    queryFn: () => organizationsApi.bySlug(slug),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] items-center justify-center bg-[#f3f6fb] text-slate-500">
        Chargement…
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-2 bg-[#f3f6fb] px-6 text-center">
        <p className="text-lg font-semibold">Organisation introuvable</p>
        <p className="text-sm text-slate-500">
          Vérifiez le QR code ou l&apos;adresse.
        </p>
      </div>
    );
  }

  return (
    <OrgProvider org={org}>
      <VisitorSessionProvider orgSlug={org.slug}>
        <Shell>{children}</Shell>
      </VisitorSessionProvider>
    </OrgProvider>
  );
}
