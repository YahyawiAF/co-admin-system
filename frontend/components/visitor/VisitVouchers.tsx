"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Coffee } from "lucide-react";
import { promotionsApi } from "@/lib/api/resources";
import { formatDt } from "@/lib/promo-price";
import { orgHref, useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";

/** Gift-with-pass vouchers of the member's open visit. */
export function useMyVouchers(enabled = true) {
  const { memberId } = useVisitorSession();
  return useQuery({
    queryKey: ["mobile-vouchers", memberId],
    queryFn: () => promotionsApi.myVouchers(memberId!),
    enabled: enabled && !!memberId,
    staleTime: 20_000,
  });
}

/** Session screen: "Votre bon · Café −50 %" cards, linking to the café. */
export function VisitVouchers({ until }: { until?: string | null }) {
  const { slug } = useOrg();
  const { data: vouchers = [] } = useMyVouchers();
  if (!vouchers.length) return null;
  return (
    <div className="space-y-2">
      {vouchers.map((v) => {
        const used = v.status === "USED";
        const free = v.priceAfter != null && v.priceAfter <= 0;
        return (
          <div
            key={v.id}
            className="v-pop overflow-hidden rounded-[20px] bg-gradient-to-br from-amber-100 to-amber-200 p-3.5 shadow-md shadow-amber-600/15"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white text-amber-700">
                {v.productImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.productImg} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Coffee className="h-6 w-6" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
                  Votre bon · avec votre pass
                </span>
                <span className="block text-[15px] font-black text-amber-950">
                  {v.productName ?? "Cadeau"} {free ? "offert" : `${v.label} · ${formatDt(v.priceAfter ?? 0)} DT`}
                </span>
                {until && !used ? (
                  <span className="block text-xs text-amber-900">Valable jusqu’à {until}</span>
                ) : null}
              </span>
            </div>
            {used ? (
              <p className="v-rise mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-extrabold text-emerald-800">
                <Check className="h-4 w-4" /> Commandé
              </p>
            ) : (
              <Link
                href={orgHref(slug, `/cafe?voucher=${v.productId}`)}
                className="mt-3 flex h-11 items-center justify-center rounded-full bg-amber-700 text-[13px] font-extrabold text-white transition-colors duration-200 hover:bg-amber-800 motion-reduce:transition-none"
              >
                Commander mon {v.productName?.toLowerCase() ?? "cadeau"}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
