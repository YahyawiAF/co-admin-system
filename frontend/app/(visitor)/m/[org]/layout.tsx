"use client";

import { type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { organizationsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { OrgProvider } from "@/lib/org";
import { VisitorSessionProvider } from "@/lib/visitor-session";
import { MobileShell } from "@/components/visitor/MobileShell";

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
    enabled: !!slug,
    retry: 1,
    staleTime: 60_000,
  });

  if (!slug) {
    return (
      <div className="mobile-shell mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-2 bg-[#f3f6fb] px-6 text-center">
        <p className="text-lg font-semibold">Lien invalide</p>
        <p className="text-sm text-slate-500">Organisation manquante dans l&apos;URL.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mobile-shell mx-auto flex min-h-dvh max-w-[480px] items-center justify-center bg-[#f3f6fb] text-slate-500">
        Chargement…
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="mobile-shell mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-2 bg-[#f3f6fb] px-6 text-center">
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
        <MobileShell>{children}</MobileShell>
      </VisitorSessionProvider>
    </OrgProvider>
  );
}
