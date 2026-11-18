"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAdminOrg } from "@/lib/admin-org-context";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import {
  disableAdminPush,
  enableAdminPush,
  fireAdminAlert,
  isPushOn,
  isSoundOn,
  notificationsSupported,
  setSoundOn,
  syncAdminPush,
} from "@/lib/admin-alerts";
import type { BookingRequest, StaffMessage, VisitRequest } from "@/lib/types";

type OrderPayload = {
  type?: string;
  orderId?: string;
  id?: string;
  memberName?: string;
  quantity?: number;
  label?: string;
  seat?: { seatLabel?: string | null } | null;
};

/**
 * Rings for every new request (café order, booking, visit, visitor message),
 * whatever admin page is open — and outside it via system notifications / push.
 */
export function AdminAlerts({
  journal,
  reservations,
}: {
  journal: boolean;
  reservations: boolean;
}) {
  const { socket } = useRealtime();
  const { organizationId } = useAdminOrg();
  const [pushOn, setPushOn] = useState(false);
  const [soundOn, setSound] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPushOn(isPushOn());
    setSound(isSoundOn());
  }, []);

  // Keep the server's copy of this browser fresh (reload, org switch).
  useEffect(() => {
    if (organizationId && isPushOn()) void syncAdminPush(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (!socket) return;
    const onOrder = (p: OrderPayload) => {
      if (p?.type && p.type !== "product_order") return;
      const seat = p.seat?.seatLabel ? ` · place ${p.seat.seatLabel}` : "";
      fireAdminAlert({
        title: "☕ Nouvelle commande",
        body: `${p.memberName || "Visiteur"} · ${p.quantity || 1}× ${p.label || "produit"}${seat}`,
        tag: `order-${p.orderId || p.id}`,
        url: "/commandes",
      });
    };
    const onBooking = (p: BookingRequest) => {
      fireAdminAlert({
        title: "📅 Nouvelle réservation",
        body: [
          p.memberName || "Visiteur",
          p.kind === "ROOM" ? p.spaceName || "Salle" : `Place ${p.seatLabel}`,
          p.startAt
            ? format(new Date(p.startAt), "d MMM HH:mm", { locale: fr })
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tag: `booking-${p.id}`,
        url: "/reservations",
      });
    };
    const onVisit = (p: VisitRequest & { priceName?: string; memberName?: string }) => {
      if (p.status && p.status !== "PENDING") return;
      fireAdminAlert({
        title: "🚪 Demande d’entrée",
        body: [p.memberName || "Visiteur", p.priceName].filter(Boolean).join(" · "),
        tag: `visit-${p.id}`,
        url: "/dashboard",
      });
    };
    const onMessage = (p: StaffMessage & { direction?: string }) => {
      if (p.direction !== "TO_STAFF") return;
      fireAdminAlert({
        title: `💬 ${p.memberName || "Visiteur"}`,
        body: (p.text || "Nouveau message").slice(0, 120),
        tag: `staff-in-${p.id}`,
        url: "/dashboard",
      });
    };
    if (journal) {
      socket.on("product_order", onOrder);
      socket.on("visit_request", onVisit);
      socket.on("staff_message", onMessage);
    }
    if (reservations) socket.on("booking_request", onBooking);
    return () => {
      socket.off("product_order", onOrder);
      socket.off("visit_request", onVisit);
      socket.off("staff_message", onMessage);
      socket.off("booking_request", onBooking);
    };
  }, [socket, journal, reservations]);

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      if (!on) {
        await disableAdminPush();
        setPushOn(false);
        return;
      }
      const res = await enableAdminPush(organizationId);
      if (res === "denied") {
        toast.error(
          "Le navigateur bloque les notifications. Autorisez-les dans le cadenas à gauche de l’adresse."
        );
      } else if (res === "unsupported") {
        toast.error("Ce navigateur ne gère pas les notifications.");
      } else {
        setPushOn(true);
        if (res === "error") {
          toast.message(
            "Alertes actives tant que l’onglet est ouvert. Navigateur fermé : pas encore disponible ici."
          );
        } else {
          toast.success("Alertes activées, même navigateur fermé");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleSound = (on: boolean) => {
    setSoundOn(on);
    setSound(on);
  };

  const active = pushOn || soundOn;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Alertes"
        >
          {active ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          {!pushOn && notificationsSupported() ? (
            <span className="admin-alerts-dot absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-semibold">Alertes</p>
        <p className="text-xs text-muted-foreground">
          Commande café, réservation, demande d’entrée, message.
        </p>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Notifications
            <span className="block text-xs text-muted-foreground">
              Autre onglet ou navigateur fermé
            </span>
          </span>
          <Switch
            checked={pushOn}
            disabled={busy}
            onCheckedChange={(v) => void togglePush(v)}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Son « ding »</span>
          <Switch checked={soundOn} onCheckedChange={toggleSound} />
        </label>
      </PopoverContent>
    </Popover>
  );
}
