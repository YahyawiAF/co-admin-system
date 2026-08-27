"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { mobileApi } from "@/lib/api/resources";
import { loadVisitorCache } from "@/lib/visitorCache";

export default function HistoryPage() {
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    setMemberId(loadVisitorCache()?.memberId || sessionStorage.getItem("memberId"));
  }, []);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mobile-history", memberId],
    queryFn: () => mobileApi.history(memberId!),
    enabled: !!memberId,
  });

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-slate-500">Chargement…</p>
      ) : !data.length ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Aucune visite pour le moment.
        </p>
      ) : (
        data.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <div className="font-medium">
                {format(new Date(v.date), "dd/MM/yyyy")}
              </div>
              <div className="text-sm text-slate-500">
                {v.priceName || "Forfait"} · {v.durationLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{v.payedAmount} DT</div>
              <Badge
                variant={
                  v.isOpen ? "default" : v.isPayed ? "secondary" : "outline"
                }
                className="mt-1"
              >
                {v.isOpen ? "En cours" : v.isPayed ? "Payé" : "Non payé"}
              </Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
