"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { Organization } from "@/lib/types";

type OrgContextValue = {
  org: Organization;
  slug: string;
  href: (path?: string) => string;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function orgHref(slug: string, path = "") {
  const suffix = !path ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/m/${slug}${suffix}`;
}

export function OrgProvider({
  org,
  children,
}: {
  org: Organization;
  children: ReactNode;
}) {
  const value: OrgContextValue = {
    org,
    slug: org.slug,
    href: (path = "") => orgHref(org.slug, path),
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used inside OrgProvider");
  }
  return ctx;
}
