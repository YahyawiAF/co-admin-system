"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Coffee, Clock, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import {
  enableVisitorNotifications,
  hasSessionWarned,
  isNotifyOptIn,
  markSessionWarned,
  showVisitorNotification,
  unlockVisitorAudio,
} from "@/lib/visitor-notify";
import { useOrg } from "@/lib/org";
import { useRouter } from "next/navigation";

type CoffeeReady = {
  productName: string;
  quantity?: number;
  orderId?: string;
};

type VisitAlert = {
  status: "APPROVED" | "REJECTED";
  type?: string;
};

type InboxAlert = {
  fromName: string;
  text: string;
  fromMemberId: string;
};

type SessionWarn = {
  sessionId: string;
};

const FIVE_MIN = 5 * 60 * 1000;

export function VisitorAlerts() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const { href } = useOrg();
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(false);
  const [coffee, setCoffee] = useState<CoffeeReady | null>(null);
  const [visit, setVisit] = useState<VisitAlert | null>(null);
  const [inbox, setInbox] = useState<InboxAlert | null>(null);
  const [sessionWarn, setSessionWarn] = useState<SessionWarn | null>(null);
  const warnedRef = useRef<string | null>(null);

  useEffect(() => {
    setMemberId(
      loadVisitorCache()?.memberId || sessionStorage.getItem("memberId")
    );
    setOptIn(isNotifyOptIn());
  }, []);

  const { data: status } = useQuery({
    queryKey: ["mobile-status", memberId],
    queryFn: () => mobileApi.status(memberId!),
    enabled: !!memberId,
    refetchInterval: 4000,
  });

  // Session ending in < 5 minutes
  useEffect(() => {
    const session = status?.session as
      | {
          id?: string;
          remainingMs?: number | null;
          expectedLeaveTime?: string;
        }
      | null
      | undefined;
    if (!session?.id) return;

    let remaining = session.remainingMs ?? null;
    if (remaining == null && session.expectedLeaveTime) {
      remaining =
        new Date(session.expectedLeaveTime).getTime() - Date.now();
    }
    if (remaining == null || remaining <= 0 || remaining > FIVE_MIN) return;
    if (hasSessionWarned(session.id) || warnedRef.current === session.id) return;

    warnedRef.current = session.id;
    markSessionWarned(session.id);
    setSessionWarn({ sessionId: session.id });
    showVisitorNotification({
      title: "Fin de session bientôt",
      body: "Il vous reste moins de 5 minutes.",
      tag: `session-end-${session.id}`,
      sound: "alert",
    });
  }, [status?.session]);

  useEffect(() => {
    if (!socket || !memberId) return;

    const onProductOrder = (payload: {
      type?: string;
      memberId?: string;
      status?: string;
      ready?: boolean;
      productName?: string;
      label?: string;
      quantity?: number;
      orderId?: string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });

      const forMe = !payload.memberId || payload.memberId === memberId;
      const confirmed =
        payload.type === "product_order_confirmed" ||
        payload.status === "CONFIRMED" ||
        payload.ready === true;
      if (!forMe || !confirmed) return;

      const productName = payload.productName || payload.label || "Votre commande";
      setCoffee({
        productName,
        quantity: payload.quantity,
        orderId: payload.orderId,
      });
      showVisitorNotification({
        title: "Commande prête",
        body: `${productName} est prêt·e — venez récupérer.`,
        tag: `order-${payload.orderId || "ready"}`,
        sound: "ready",
      });
    };

    const onProductUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    };

    const onVisitResolved = (payload: {
      memberId?: string;
      status?: string;
      type?: string;
    }) => {
      if (payload.memberId && payload.memberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
      if (payload.status === "APPROVED" || payload.status === "REJECTED") {
        setVisit({
          status: payload.status,
          type: payload.type,
        });
        showVisitorNotification({
          title:
            payload.status === "APPROVED"
              ? "Demande confirmée"
              : "Demande refusée",
          body:
            payload.status === "APPROVED"
              ? "Votre demande a été acceptée par l’accueil."
              : "Votre demande a été refusée.",
          tag: `visit-${payload.status}`,
          sound: payload.status === "APPROVED" ? "ready" : "alert",
        });
      }
    };

    const onCommunity = (payload: {
      toMemberId?: string;
      fromMemberId?: string;
      fromName?: string;
      text?: string;
    }) => {
      if (payload.toMemberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["mobile-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-thread"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-community"] });
      setInbox({
        fromName: payload.fromName || "Membre",
        text: payload.text || "Nouveau message",
        fromMemberId: payload.fromMemberId || "",
      });
      showVisitorNotification({
        title: `Message de ${payload.fromName || "la communauté"}`,
        body: payload.text || "Vous avez reçu un message.",
        tag: `msg-${payload.fromMemberId}`,
        sound: "message",
      });
    };

    const onStaff = (payload: { memberId?: string; text?: string }) => {
      if (payload.memberId && payload.memberId !== memberId) return;
      showVisitorNotification({
        title: "Message de l’accueil",
        body: payload.text || "Nouveau message de l’équipe.",
        tag: "staff-message",
        sound: "message",
      });
    };

    socket.on("product_order", onProductOrder);
    socket.on("product_order_confirmed", onProductOrder);
    socket.on("product_updated", onProductUpdated);
    socket.on("visit_request_resolved", onVisitResolved);
    socket.on("community_message", onCommunity);
    socket.on("staff_message", onStaff);

    return () => {
      socket.off("product_order", onProductOrder);
      socket.off("product_order_confirmed", onProductOrder);
      socket.off("product_updated", onProductUpdated);
      socket.off("visit_request_resolved", onVisitResolved);
      socket.off("community_message", onCommunity);
      socket.off("staff_message", onStaff);
    };
  }, [socket, memberId, queryClient]);

  const onEnable = async () => {
    const ok = await enableVisitorNotifications();
    setOptIn(ok || isNotifyOptIn());
  };

  return (
    <>
      {!optIn ? (
        <button
          type="button"
          onClick={() => void onEnable()}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950"
        >
          <BellRing className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1">
            Activer les notifications (café prêt, messages, fin de session)
          </span>
          <span className="rounded-full bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white">
            Activer
          </span>
        </button>
      ) : null}

      <Dialog open={!!coffee} onOpenChange={(o) => !o && setCoffee(null)}>
        <DialogContent className="max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              Commande prête
            </DialogTitle>
          </DialogHeader>
          <p className="text-base leading-relaxed">
            {coffee?.productName}
            {coffee?.quantity && coffee.quantity > 1
              ? ` × ${coffee.quantity}`
              : ""}{" "}
            est prêt·e. Venez récupérer à l’accueil.
          </p>
          <DialogFooter>
            <Button
              className="h-11 w-full"
              onClick={() => {
                void unlockVisitorAudio();
                setCoffee(null);
              }}
            >
              OK, j’arrive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!visit} onOpenChange={(o) => !o && setVisit(null)}>
        <DialogContent className="max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {visit?.status === "APPROVED"
                ? "Demande confirmée"
                : "Demande refusée"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-base leading-relaxed">
            {visit?.status === "APPROVED"
              ? "L’accueil a accepté votre demande. Vous pouvez continuer."
              : "L’accueil a refusé votre demande. Vous pouvez en faire une nouvelle."}
          </p>
          <DialogFooter>
            <Button
              className="h-11 w-full"
              onClick={() => {
                setVisit(null);
                router.push(href());
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inbox} onOpenChange={(o) => !o && setInbox(null)}>
        <DialogContent className="max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Message de {inbox?.fromName}
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {inbox?.text}
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {inbox?.fromMemberId ? (
              <Button
                className="h-11 w-full"
                onClick={() => {
                  const id = inbox.fromMemberId;
                  setInbox(null);
                  router.push(href(`/community?peer=${id}`));
                }}
              >
                Répondre
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setInbox(null)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sessionWarn}
        onOpenChange={(o) => !o && setSessionWarn(null)}
      >
        <DialogContent className="max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Moins de 5 minutes
            </DialogTitle>
          </DialogHeader>
          <p className="text-base leading-relaxed">
            Votre session se termine bientôt. Pensez à finaliser ou à demander
            une prolongation à l’accueil.
          </p>
          <DialogFooter>
            <Button
              className="h-11 w-full"
              onClick={() => setSessionWarn(null)}
            >
              Compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
