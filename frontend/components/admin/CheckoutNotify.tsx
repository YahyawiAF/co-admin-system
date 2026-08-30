"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

type CheckoutPayload = {
  visitLabel?: string;
  visitorNumber?: number | null;
  durationLabel?: string;
  priceName?: string | null;
  isPayed?: boolean;
};

export function CheckoutNotify() {
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) return;
    const onCheckout = (payload: CheckoutPayload) => {
      const who =
        payload.visitLabel ||
        (payload.visitorNumber ? `#${payload.visitorNumber}` : "Visiteur");
      const desc = [
        payload.durationLabel,
        payload.priceName,
        payload.isPayed ? "payé" : "impayé",
      ]
        .filter(Boolean)
        .join(" · ");
      if (payload.isPayed === false) {
        toast.warning(`${who} a quitté`, { description: desc, duration: 8000 });
      } else {
        toast.message(`${who} a quitté`, { description: desc, duration: 8000 });
      }
    };
    socket.on("visitor_checkout", onCheckout);
    return () => {
      socket.off("visitor_checkout", onCheckout);
    };
  }, [socket]);

  return null;
}
