"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api/httpClient";
import { queryKeys } from "@/lib/query-client";

type RealtimeContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();

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

    const invalidateOps = () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.visitRequestsPending });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["seat-history"] });
    };

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("visit_request", invalidateOps);
    s.on("visit_request_resolved", () => {
      invalidateOps();
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
    });
    s.on("visitor_checkout", invalidateOps);
    s.on("table_updates", invalidateOps);
    s.on("payment_updated", invalidateOps);
    const invalidateBookings = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookingRequestsPending,
      });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    };
    s.on("booking_request", invalidateBookings);
    s.on("booking_request_resolved", invalidateBookings);
    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productOrdersPending });
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["visitor-day"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    };
    s.on("product_order", invalidateOrders);
    s.on("product_order_confirmed", invalidateOrders);
    s.on("product_updated", invalidateOrders);

    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [queryClient]);

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
