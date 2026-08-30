"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mobileApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";

const TITLE_BY_SUFFIX: Record<string, string> = {
  "": "Accueil",
  "/session": "Session",
  "/cafe": "Café & boutique",
  "/cafe/commandes": "Mes commandes",
  "/history": "Historique",
  "/profile": "Profil",
  "/community": "Communauté",
  "/events": "Événements",
  "/tarifs": "Tarifs",
  "/subscription": "Abonnement",
  "/choose": "Forfaits",
  "/staff": "Accueil",
  "/reserve": "Réserver",
  "/reservations": "Mes réservations",
};

export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { org, slug, href } = useOrg();
  const { memberId, onboarded } = useVisitorSession();
  const base = `/m/${slug}`;
  const suffix = pathname === base || pathname === `${base}/` ? "" : pathname.slice(base.length);
  const inboxInterval = useVisibleInterval(45_000);

  const { data: status } = useMobileStatus();
  const { data: inbox = [] } = useQuery({
    queryKey: ["mobile-inbox", memberId],
    queryFn: async () => {
      const data = await mobileApi.inbox(memberId!);
      writeLocalCache("inbox", data, memberId);
      return data;
    },
    enabled: !!memberId && onboarded,
    staleTime: 30_000,
    refetchInterval: inboxInterval,
    placeholderData: () =>
      memberId ? readLocalCache("inbox", memberId) ?? undefined : undefined,
  });
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

  const title =
    suffix === "" && status?.session
      ? "Session"
      : TITLE_BY_SUFFIX[suffix] ||
        (suffix.startsWith("/events")
          ? "Événements"
          : suffix.startsWith("/community")
            ? "Communauté"
            : suffix.startsWith("/chat/")
              ? "Message"
              : suffix.startsWith("/u/")
                ? "Profil"
                : org.name);
  const facilityName = layout?.facility?.name || org.name;

  const notices = useMemo(() => {
    const items: { id: string; title: string; href: string }[] = [];
    if (status?.pendingRequest) {
      items.push({
        id: "pending",
        title: `Demande en attente : ${status.pendingRequest.price?.name || "forfait"}`,
        href: href("/choose"),
      });
    }
    if (status?.session && !status.session.isPayed) {
      items.push({
        id: "unpaid",
        title: "Session non payée",
        href: href(),
      });
    }
    if (
      status?.session &&
      !status.seat &&
      !(status.session as { seat?: unknown }).seat
    ) {
      items.push({
        id: "seat",
        title: "Place non assignée",
        href: href(),
      });
    }
    return items;
  }, [status, href]);

  const unread = inbox.filter((t) => t.unreadHint).length;
  const notifCount = notices.length + unread;

  return (
    <header className="sticky top-0 z-50 -mx-4 mb-3 border-b border-white/40 bg-white/90 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Link
          href={href()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm"
          aria-label="Accueil"
        >
          {(org.name || "C").trim().charAt(0).toUpperCase()}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {title}
          </p>
          <p className="truncate text-[11px] text-slate-500">{facilityName}</p>
        </div>
        {onboarded ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full bg-slate-50"
            onClick={() => router.push(href("/community"))}
            aria-label="Messages"
          >
            <MessageCircle className="h-5 w-5 text-primary" />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full bg-slate-50"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-primary" />
              {notifCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                  {notifCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notices.length === 0 && unread === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Rien de nouveau
              </p>
            ) : null}
            {notices.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => router.push(n.href)}>
                {n.title}
              </DropdownMenuItem>
            ))}
            {unread > 0 ? (
              <DropdownMenuItem onClick={() => router.push(href("/community"))}>
                {unread} nouveau{unread > 1 ? "x" : ""} message
                {unread > 1 ? "s" : ""}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function visitorInitials(name?: string | null) {
  const parts = (name || "V").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "V") + (parts[1]?.[0] || "")).toUpperCase();
}

export function VisitorAvatar({
  name,
  src,
  className,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "Profil"}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary",
        className
      )}
    >
      {visitorInitials(name)}
    </div>
  );
}
