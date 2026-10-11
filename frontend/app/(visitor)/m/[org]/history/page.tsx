"use client";

import { MemberHistory } from "@/components/visitor/MemberHistory";
import { useVisitorSession } from "@/lib/visitor-session";

export default function HistoryPage() {
  const { memberId, ready } = useVisitorSession();

  if (!ready) return <p className="text-slate-500">Chargement…</p>;
  if (!memberId) {
    return (
      <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        Aucune visite pour le moment.
      </p>
    );
  }
  return <MemberHistory memberId={memberId} showEmpty />;
}
