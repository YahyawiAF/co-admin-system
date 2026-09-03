"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api/httpClient";
import { queryKeys } from "@/lib/query-client";
import type { VisitRequest } from "@/lib/types";

type RealtimeContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
});

/**
 * Debounced background invalidation — avoids flooding the network
 * when multiple socket events fire in quick succession.
 */
function debouncedInvalidate(qc: QueryClient, keys: readonly (readonly unknown[])[], ms = 300) {
  const tag = keys.map((k) => JSON.stringify(k)).join("|");
  const w = window as unknown as Record<string, ReturnType<typeof setTimeout> | undefined>;
  const timerKey = `__rt_inv_${tag}`;
  if (w[timerKey]) clearTimeout(w[timerKey]);
  w[timerKey] = setTimeout(() => {
    for (const k of keys) qc.invalidateQueries({ queryKey: k as unknown[] });
    w[timerKey] = undefined;
  }, ms);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  useEffect(() => {
    const raw =
      process.env.NEXT_PUBLIC_WS_URL ||
      API_BASE_URL.replace(/\/api\/?$/, "");
    const base = raw.replace(/\/$/, "");
    const s = io(base, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 12,
      timeout: 12_000,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    // --- Visit request: inject payload directly, then background-refetch ---
    s.on("visit_request", (payload: VisitRequest) => {
      const qc = qcRef.current;
      // Optimistically insert into pending list (instant bell)
      if (!payload.status || payload.status === "PENDING") {
        qc.setQueryData<VisitRequest[]>(
          queryKeys.visitRequestsPending,
          (old) => {
            if (!old) return [payload];
            if (old.some((r) => r.id === payload.id)) return old;
            return [payload, ...old];
          }
        );
      }
      debouncedInvalidate(qc, [
        queryKeys.visitRequestsPending,
        ["bookings"],
        ["facility-occupancy"],
      ]);
    });

    s.on("visit_request_resolved", (payload: { id?: string; status?: string; autoApproved?: boolean; memberId?: string }) => {
      const qc = qcRef.current;
      // Remove from pending list immediately
      if (payload.id) {
        qc.setQueryData<VisitRequest[]>(
          queryKeys.visitRequestsPending,
          (old) => old?.filter((r) => r.id !== payload.id)
        );
      }
      // Visitor side: poke mobile-status so accueil re-renders
      qc.invalidateQueries({ queryKey: ["mobile-status"] });
      debouncedInvalidate(qc, [
        queryKeys.visitRequestsPending,
        queryKeys.visitArrivals,
        ["journal"],
        ["bookings"],
        ["facility-occupancy"],
      ]);
    });

    s.on("visit_arrival", () => {
      debouncedInvalidate(qcRef.current, [
        queryKeys.visitArrivals,
        ["bookings"],
        ["facility-occupancy"],
      ]);
    });

    s.on("visitor_checkout", () => {
      debouncedInvalidate(qcRef.current, [
        ["journal"],
        ["bookings"],
        ["facility-occupancy"],
        ["seat-history"],
      ]);
    });

    s.on("table_updates", () => {
      debouncedInvalidate(qcRef.current, [
        ["bookings"],
        ["facility-occupancy"],
        ["seat-history"],
      ]);
    });

    s.on("payment_updated", () => {
      debouncedInvalidate(qcRef.current, [["journal"]]);
    });

    s.on("booking_request", () => {
      debouncedInvalidate(qcRef.current, [
        queryKeys.bookingRequestsPending,
        ["my-bookings"],
      ]);
    });
    s.on("booking_request_resolved", () => {
      debouncedInvalidate(qcRef.current, [
        queryKeys.bookingRequestsPending,
        ["my-bookings"],
      ]);
    });

    s.on("product_order", () => {
      debouncedInvalidate(qcRef.current, [
        queryKeys.productOrdersPending,
        ["mobile-orders"],
        ["visitor-day"],
      ]);
    });
    s.on("product_order_confirmed", () => {
      debouncedInvalidate(qcRef.current, [
        queryKeys.productOrdersPending,
        ["mobile-orders"],
        ["visitor-day"],
      ]);
    });
    s.on("product_updated", () => {
      debouncedInvalidate(qcRef.current, [
        ["mobile-products"],
        ["products"],
      ]);
    });

    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []); // stable — qcRef avoids queryClient in deps

  const value = useMemo(
    () => ({ socket, connected }),
    [socket, connected]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
