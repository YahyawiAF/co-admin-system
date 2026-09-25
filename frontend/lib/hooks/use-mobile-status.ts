"use client";

import { useQuery } from "@tanstack/react-query";
import {
  mobileApi,
  type MobileStatusResponse,
} from "@/lib/api/resources";
import { useVisitorSession } from "@/lib/visitor-session";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";

const OPTIMISTIC_SESSION_KEY = "visitorOptimisticSession";

export type OptimisticSessionPayload = {
  memberId: string;
  at: number;
  session?: MobileStatusResponse["session"] | Record<string, unknown> | null;
  seat?: MobileStatusResponse["seat"] | Record<string, unknown> | null;
  pendingRequest?: MobileStatusResponse["pendingRequest"] | Record<string, unknown> | null;
};

export function writeOptimisticSession(payload: OptimisticSessionPayload) {
  try {
    sessionStorage.setItem(OPTIMISTIC_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearOptimisticSession() {
  try {
    sessionStorage.removeItem(OPTIMISTIC_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function readOptimisticSession(
  memberId: string
): OptimisticSessionPayload | null {
  try {
    const raw = sessionStorage.getItem(OPTIMISTIC_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OptimisticSessionPayload;
    if (parsed.memberId !== memberId) return null;
    if (Date.now() - parsed.at > 45_000) {
      sessionStorage.removeItem(OPTIMISTIC_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

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
    queryFn: async (): Promise<MobileStatusResponse> => {
      const data = await mobileApi.status(memberId!);
      const opt = readOptimisticSession(memberId!);

      // Server caught up — drop optimistic overlay
      if (data.session || (data.pendingRequest && !opt?.session)) {
        clearOptimisticSession();
        writeLocalCache("mobile-status", data, memberId);
        return data;
      }

      // Keep showing session UI while create/approve is still in flight
      if (opt?.session && !data.session) {
        const merged: MobileStatusResponse = {
          ...data,
          hasOpenSession: true,
          pendingRequest: null,
          session: (opt.session as MobileStatusResponse["session"]) ?? null,
          seat:
            (opt.seat as MobileStatusResponse["seat"]) ?? data.seat,
        };
        writeLocalCache("mobile-status", merged, memberId);
        return merged;
      }

      if (opt?.pendingRequest && !data.pendingRequest && !data.session) {
        const merged: MobileStatusResponse = {
          ...data,
          pendingRequest:
            (opt.pendingRequest as MobileStatusResponse["pendingRequest"]) ??
            null,
        };
        writeLocalCache("mobile-status", merged, memberId);
        return merged;
      }

      writeLocalCache("mobile-status", data, memberId);
      return data;
    },
    enabled,
    staleTime: 15_000,
    gcTime: 30 * 60_000,
    refetchInterval: interval,
    refetchOnReconnect: true,
    placeholderData: (): MobileStatusResponse | undefined => {
      if (!memberId) return undefined;
      const cached =
        readLocalCache<MobileStatusResponse>("mobile-status", memberId) ??
        undefined;
      const opt = readOptimisticSession(memberId);
      if (opt?.session && !cached?.session) {
        return {
          ...(cached || {
            session: null,
            subscription: null,
            hasActiveSubscription: false,
            pendingRequest: null,
            hasOpenSession: true,
          }),
          hasOpenSession: true,
          session: (opt.session as MobileStatusResponse["session"]) ?? null,
          seat:
            (opt.seat as MobileStatusResponse["seat"]) ?? cached?.seat,
        };
      }
      return cached;
    },
  });
}
