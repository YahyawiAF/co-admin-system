"use client";

import { useQuery } from "@tanstack/react-query";
import { mobileApi } from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";

/** Shared mobile status — one network poll for the whole shell. */
export function useMobileStatus(opts?: {
  /** Override poll ms while visible (default 20s). */
  intervalMs?: number | false;
  enabled?: boolean;
}) {
  const { memberId, onboarded } = useVisitorSession();
  const enabled =
    opts?.enabled !== undefined
      ? opts.enabled && !!memberId
      : !!memberId && onboarded;
  const interval = useVisibleInterval(
    opts?.intervalMs === undefined ? 20_000 : opts.intervalMs
  );

  return useQuery({
    queryKey: ["mobile-status", memberId],
    queryFn: async () => {
      const data = await mobileApi.status(memberId!);
      writeLocalCache("mobile-status", data, memberId);
      return data;
    },
    enabled,
    staleTime: 15_000,
    gcTime: 30 * 60_000,
    refetchInterval: interval,
    refetchOnReconnect: true,
    placeholderData: () =>
      memberId ? readLocalCache("mobile-status", memberId) ?? undefined : undefined,
  });
}
