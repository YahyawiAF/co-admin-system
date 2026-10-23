"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useStaffAccess } from "@/lib/staff-access";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isStaff, canOpen, homePath } = useStaffAccess();
  const blocked = isAuthenticated && isStaff && !canOpen(pathname);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Staff only reach the pages the admin opened for them.
  useEffect(() => {
    if (blocked && homePath) router.replace(homePath);
  }, [blocked, homePath, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AdminShell>
      {blocked ? (
        <div className="mx-auto mt-20 max-w-md text-center text-sm text-muted-foreground">
          {homePath
            ? "Redirection…"
            : "Aucun accès ne vous a encore été donné. Demandez à l’administrateur d’activer vos droits."}
        </div>
      ) : (
        children
      )}
    </AdminShell>
  );
}
