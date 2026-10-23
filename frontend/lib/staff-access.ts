"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminOrg } from "@/lib/admin-org-context";
import { staffApi } from "@/lib/api/resources";
import {
  Role,
  type StaffDeleteMode,
  type StaffModule,
  type StaffPermissions,
} from "@/lib/types";

export const STAFF_MODULES: Array<{ key: StaffModule; label: string; href: string }> = [
  { key: "journal", label: "Journal", href: "/journal" },
  { key: "reservations", label: "Réservations", href: "/reservations" },
  { key: "impayes", label: "Impayés", href: "/impayes" },
  { key: "abonnements", label: "Abonnements", href: "/abonnements" },
];

export function emptyPermissions(): StaffPermissions {
  return {
    journal: { read: false, write: false, delete: "none" },
    reservations: { read: false, write: false, delete: "none" },
    impayes: { read: false, write: false, delete: "none" },
    abonnements: { read: false, write: false, delete: "none" },
  };
}

/** Which staff module an admin page belongs to (null = admin-only page). */
export function moduleForPath(pathname: string): StaffModule | null {
  const hit = STAFF_MODULES.find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`)
  );
  return hit?.key ?? null;
}

/**
 * What the logged-in user may do. Admins can do everything; STAFF users are
 * limited to the permissions the admin gave them for the current organization.
 */
export function useStaffAccess() {
  const { user } = useAuth();
  const { organizationId } = useAdminOrg();
  const isStaff = user?.role === Role.STAFF;

  const { data } = useQuery({
    queryKey: ["staff-me", user?.id],
    queryFn: () => staffApi.me(),
    enabled: isStaff,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const permissions = useMemo<StaffPermissions | null>(() => {
    if (!isStaff) return null;
    const live =
      data?.organizations.find((o) => o.organizationId === organizationId)?.permissions ??
      data?.organizations[0]?.permissions;
    const fromLogin =
      user?.organizations?.find((o) => o.id === organizationId)?.permissions ??
      user?.organizations?.[0]?.permissions;
    return live ?? fromLogin ?? emptyPermissions();
  }, [isStaff, data, organizationId, user]);

  const can = useCallback(
    (module: StaffModule, action: "read" | "write" | "delete" = "read") => {
      if (!isStaff) return true;
      const p = permissions?.[module];
      if (!p) return false;
      if (action === "read") return p.read;
      if (action === "write") return p.write;
      return p.delete !== "none";
    },
    [isStaff, permissions]
  );

  const deleteMode = useCallback(
    (module: StaffModule): StaffDeleteMode =>
      isStaff ? permissions?.[module]?.delete ?? "none" : "delete",
    [isStaff, permissions]
  );

  /** Can this user open the page at `pathname`? */
  const canOpen = useCallback(
    (pathname: string) => {
      if (!isStaff) return true;
      const mod = moduleForPath(pathname);
      return mod ? can(mod, "read") : false;
    },
    [isStaff, can]
  );

  const homePath = useMemo(() => {
    if (!isStaff) return "/dashboard";
    return STAFF_MODULES.find((m) => can(m.key, "read"))?.href ?? null;
  }, [isStaff, can]);

  return { isStaff, permissions, can, deleteMode, canOpen, homePath };
}
