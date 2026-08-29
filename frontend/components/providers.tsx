"use client";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { AdminOrgProvider } from "@/lib/admin-org-context";
import { AppQueryProvider } from "@/lib/query-client";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <AuthProvider>
        <AdminOrgProvider>
          <RealtimeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </RealtimeProvider>
        </AdminOrgProvider>
      </AuthProvider>
    </AppQueryProvider>
  );
}
