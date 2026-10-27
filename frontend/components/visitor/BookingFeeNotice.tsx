"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { mobileApi } from "@/lib/api/resources";
import { formatDt } from "@/lib/session-pricing";
import { cn } from "@/lib/utils";

export const bookingFeesKey = (memberId?: string | null) => ["booking-fees", memberId] as const;

/**
 * Fee kept on a cancelled reservation, asked at the next visit.
 * `arrived`: the visitor is on site → "pay it now at reception".
 */
export function BookingFeeNotice({
  memberId,
  arrived,
  className,
}: {
  memberId?: string | null;
  arrived?: boolean;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: bookingFeesKey(memberId),
    queryFn: () => mobileApi.myBookingFees(memberId!),
    enabled: !!memberId,
    staleTime: 60_000,
  });
  if (!data || data.total <= 0.0005) return null;
  const n = data.items.length;
  return (
    <div
      role="status"
      className={cn(
        "v-rise flex items-center gap-3 rounded-3xl bg-rose-50 p-3 ring-1 ring-inset ring-rose-200",
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white">
        <Receipt className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-rose-950">
          {arrived ? "À régler à l’accueil" : "À régler à votre prochaine visite"}
        </p>
        <p className="text-xs text-rose-900/80">
          {n > 1 ? `${n} réservations annulées` : "Réservation annulée"} · frais gardés
        </p>
      </div>
      <span className="shrink-0 text-lg font-black tabular-nums text-rose-700">{formatDt(data.total)}</span>
    </div>
  );
}
