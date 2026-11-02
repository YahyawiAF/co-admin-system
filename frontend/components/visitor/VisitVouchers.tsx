"use client";

import { useQuery } from "@tanstack/react-query";
import { promotionsApi } from "@/lib/api/resources";
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
