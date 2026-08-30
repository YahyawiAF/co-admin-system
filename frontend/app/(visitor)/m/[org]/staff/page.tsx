"use client";

import Link from "next/link";
import { ChevronLeft, Building2 } from "lucide-react";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { AdminStaffChat } from "@/components/visitor/AdminStaffChat";

export default function StaffChatPage() {
  const { href } = useOrg();
  const { memberId } = useVisitorSession();

  if (!memberId) {
    return (
      <p className="px-4 pt-8 text-sm text-slate-500">
        Connectez-vous pour écrire à l’accueil.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef4fb]">
      <header className="flex shrink-0 items-center gap-2 border-b bg-white px-2 py-2.5">
        <Link
          href={href()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
          aria-label="Accueil"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">Administration</p>
          <p className="text-xs text-emerald-600">Accueil · en ligne</p>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <AdminStaffChat memberId={memberId} fullScreen className="h-full" />
      </div>
    </div>
  );
}
