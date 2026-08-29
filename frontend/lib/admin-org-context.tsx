"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getAdminOrganizationId,
  setAdminOrganizationId,
} from "@/lib/admin-org";
import { organizationsApi } from "@/lib/api/resources";
import { Role, type Organization } from "@/lib/types";

type AdminOrgContextValue = {
  organizationId: string | null;
  organization: Organization | null;
  organizations: Organization[];
  setOrganizationId: (id: string | null) => void;
  isSuperAdmin: boolean;
  ready: boolean;
};

const AdminOrgContext = createContext<AdminOrgContextValue | null>(null);

export function AdminOrgProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [organizationId, setOrgIdState] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [ready, setReady] = useState(false);

  const isSuperAdmin =
    user?.role === Role.SUPER_ADMIN || user?.role === Role.ADMIN;

  const setOrganizationId = useCallback(
    (id: string | null) => {
      setOrgIdState(id);
      setAdminOrganizationId(id);
      void queryClient.invalidateQueries();
    },
    [queryClient]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setOrgIdState(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let list: Organization[] = [];
        if (isSuperAdmin) {
          list = await organizationsApi
            .listCrm()
            .catch(() => organizationsApi.list());
        } else if (user?.organizations?.length) {
          list = user.organizations.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            isActive: o.isActive,
          }));
        } else {
          list = await organizationsApi.list();
        }
        if (cancelled) return;
        setOrganizations(list);
        const stored = getAdminOrganizationId();
        const valid = stored && list.some((o) => o.id === stored);
        const next =
          (valid ? stored : null) ||
          user?.organizations?.[0]?.id ||
          list[0]?.id ||
          null;
        setOrgIdState(next);
        setAdminOrganizationId(next);
      } catch {
        if (!cancelled) setOrganizations([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSuperAdmin, user]);

  const organization = useMemo(
    () => organizations.find((o) => o.id === organizationId) || null,
    [organizations, organizationId]
  );

  const value = useMemo(
    () => ({
      organizationId,
      organization,
      organizations,
      setOrganizationId,
      isSuperAdmin,
      ready,
    }),
    [
      organizationId,
      organization,
      organizations,
      setOrganizationId,
      isSuperAdmin,
      ready,
    ]
  );

  return (
    <AdminOrgContext.Provider value={value}>{children}</AdminOrgContext.Provider>
  );
}

export function useAdminOrg() {
  const ctx = useContext(AdminOrgContext);
  if (!ctx) throw new Error("useAdminOrg must be used within AdminOrgProvider");
  return ctx;
}
