"use client";

import { useQuery } from "@tanstack/react-query";
import { mobileApi } from "@/lib/api/resources";

/** Tier ladder + overtime rules for live session pricing (visitor or admin). */
export function usePricingContext(opts?: {
  orgSlug?: string;
  organizationId?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["pricing-context", opts?.orgSlug ?? null, opts?.organizationId ?? null],
    queryFn: () =>
      mobileApi.getPricingContext({
        orgSlug: opts?.orgSlug,
        organizationId: opts?.organizationId,
      }),
    enabled: opts?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}
