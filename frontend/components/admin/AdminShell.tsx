"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UsersRound,
  Tags,
  CreditCard,
  Building2,
  Package,
  Banknote,
  Calendar,
  Coffee,
  LogOut,
  Menu,
  Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminOrg } from "@/lib/admin-org-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VisitRequestBell } from "@/components/admin/VisitRequestBell";
import { ProductOrderBell } from "@/components/admin/ProductOrderBell";
import { StaffInboxBell } from "@/components/admin/StaffInboxBell";
import { SeatOccupancyBoard } from "@/components/admin/SeatOccupancyBoard";
import { useState, type ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: ClipboardList },
  { href: "/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/finance", label: "Finance", icon: Banknote },
  { href: "/members", label: "Members", icon: Users },
  { href: "/members?tab=groups", label: "Groupes", icon: UsersRound },
  { href: "/tarifs", label: "Tarifs", icon: Tags },
  { href: "/facility", label: "Facility / Map", icon: Building2 },
  { href: "/events", label: "Événements", icon: Calendar },
  { href: "/commandes", label: "Commandes", icon: Coffee },
  { href: "/products", label: "Products", icon: Package },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSuperAdmin } = useAdminOrg();
  const groupsTab = searchParams.get("tab") === "groups";
  const items = [
    ...NAV,
    ...(isSuperAdmin
      ? [
          {
            href: "/platform/organizations",
            label: "Organisations",
            icon: Globe2,
          },
        ]
      : []),
  ];
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const [path] = item.href.split("?");
        const isGroupsLink = item.href.includes("tab=groups");
        const onMembers =
          pathname === "/members" || pathname.startsWith("/members/");
        const active = isGroupsLink
          ? onMembers && groupsTab
          : item.href === "/members"
            ? onMembers && !groupsTab
            : pathname === path || pathname.startsWith(`${path}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { organization, organizations, organizationId, setOrganizationId } =
    useAdminOrg();
  const [open, setOpen] = useState(false);
  const brand = organization?.name || "Co-Admin";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <span className="truncate text-sm font-bold tracking-wide text-primary">
            {brand}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          {organizations.length > 1 ? (
            <select
              className="mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              value={organizationId || ""}
              onChange={(e) => setOrganizationId(e.target.value || null)}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <p className="truncate px-2 text-xs text-muted-foreground">
            {user?.fullname || user?.email}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start gap-2"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-4 font-bold text-primary">
                {brand}
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <SeatOccupancyBoard variant="icon" />
          <StaffInboxBell />
          <ProductOrderBell />
          <VisitRequestBell />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
