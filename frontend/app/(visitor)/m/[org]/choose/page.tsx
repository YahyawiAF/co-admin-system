"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { mobileApi } from "@/lib/api/resources";
import { loadVisitorCache } from "@/lib/visitorCache";
import { isJournalPack } from "@/lib/journal-utils";
import { VisitorAuthDialog } from "@/components/visitor/VisitorAuthDialog";
import type { Member } from "@/lib/types";
import { PriceCategory, PriceType } from "@/lib/types";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";

function ChooseInner() {
  const router = useRouter();
  const { href } = useOrg();
  const { memberId: sessionMemberId } = useVisitorSession();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as string) || "day";
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { socket } = useRealtime();

  useEffect(() => {
    const cached = loadVisitorCache();
    setMemberId(
      sessionMemberId ||
        cached?.memberId ||
        sessionStorage.getItem("memberId")
    );
    const stored = sessionStorage.getItem("pendingVisitRequestId");
    if (stored) setPendingId(stored);
    if (
      !sessionMemberId &&
      !cached?.memberId &&
      !sessionStorage.getItem("memberId")
    ) {
      setAuthOpen(true);
    }
  }, [sessionMemberId]);

  const { data: status, refetch } = useQuery({
    queryKey: ["mobile-status", memberId],
    queryFn: () => mobileApi.status(memberId!),
    enabled: !!memberId,
    refetchInterval: pendingId ? 2000 : 8000,
  });

  const { data: tarifs = [] } = useQuery({
    queryKey: ["mobile-tarifs"],
    queryFn: () => mobileApi.tarifs(),
  });

  const { data: pendingRequest } = useQuery({
    queryKey: ["visit-request", pendingId],
    queryFn: () => mobileApi.getVisitRequest(pendingId!),
    enabled: !!pendingId,
    refetchInterval: pendingId ? 3000 : false,
  });

  useEffect(() => {
    if (status?.pendingRequest?.id) {
      sessionStorage.setItem("pendingVisitRequestId", status.pendingRequest.id);
      setPendingId(status.pendingRequest.id);
    }
  }, [status?.pendingRequest?.id]);

  useEffect(() => {
    if (!pendingRequest) return;
    if (pendingRequest.status === "APPROVED") {
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
      router.push(
        pendingRequest.type === "SUBSCRIPTION" ? href("/subscription") : href()
      );
    }
    if (pendingRequest.status === "REJECTED") {
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
    }
  }, [pendingRequest, router]);

  useEffect(() => {
    if (!memberId || !socket) return;
    const onResolved = (payload: {
      memberId?: string;
      status?: string;
      type?: string;
    }) => {
      if (payload?.memberId && payload.memberId !== memberId) return;
      if (payload?.status === "REJECTED" || payload?.status === "CANCELLED") {
        sessionStorage.removeItem("pendingVisitRequestId");
        setPendingId(null);
        refetch();
        return;
      }
      if (payload?.status === "APPROVED") {
        sessionStorage.removeItem("pendingVisitRequestId");
        setPendingId(null);
        router.replace(
          payload.type === "SUBSCRIPTION" ? href("/subscription") : href()
        );
      }
    };
    socket.on("visit_request_resolved", onResolved);
    return () => {
      socket.off("visit_request_resolved", onResolved);
    };
  }, [memberId, socket, refetch, router]);

  const options = useMemo(() => {
    if (mode === "subscription") {
      return tarifs.filter(
        (t) =>
          t.category === PriceCategory.ABONNEMENT ||
          t.type === PriceType.abonnement
      );
    }
    return tarifs.filter((t) => isJournalPack(t));
  }, [tarifs, mode]);

  const create = useMutation({
    mutationFn: (priceId: string) =>
      mobileApi.createVisitRequest({
        memberId: memberId!,
        priceId,
        type: mode === "subscription" ? "SUBSCRIPTION" : "DAY",
      }),
    onSuccess: (req) => {
      if (req.status === "APPROVED" || req.autoApproved) {
        sessionStorage.removeItem("pendingVisitRequestId");
        setPendingId(null);
        router.push(
          req.type === "SUBSCRIPTION" ? href("/subscription") : href()
        );
        return;
      }
      sessionStorage.setItem("pendingVisitRequestId", req.id);
      setPendingId(req.id);
    },
  });

  const cancel = useMutation({
    mutationFn: () =>
      mobileApi.cancelVisitRequest(
        pendingId || status!.pendingRequest!.id,
        memberId!
      ),
    onSuccess: () => {
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
      refetch();
    },
  });

  if (!memberId) {
    return (
      <>
        <VisitorAuthDialog
          open={authOpen}
          onOpenChange={setAuthOpen}
          title="Connexion requise"
          onSuccess={(m: Member) => {
            setMemberId(m.id);
            setAuthOpen(false);
          }}
        />
        <Alert>
          <AlertDescription className="space-y-3">
            <p>Connectez-vous ou créez un profil pour continuer.</p>
            <Button onClick={() => setAuthOpen(true)}>Connexion / Inscription</Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  if (mode === "day" && status?.session && !status.pendingRequest) {
    return (
      <div className="space-y-3 text-center">
        <Alert>
          <AlertDescription>
            Vous avez déjà une session en cours.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push(href())}>
          Voir ma session
        </Button>
      </div>
    );
  }

  const subKind = (status?.subscription as { kind?: string } | null)?.kind;
  if (mode === "day" && subKind === "HOURS_POOL") {
    return (
      <div className="space-y-3 text-center">
        <Alert>
          <AlertDescription>
            Abonnement heures actif : pointez pour entrer. L&apos;accueil vous
            attribue une place. Pas de forfait.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push(href())}>
          Accueil / pointer
        </Button>
      </div>
    );
  }

  if (pendingId || status?.pendingRequest) {
    const rejected = pendingRequest?.status === "REJECTED";
    return (
      <div className="py-10 text-center">
        {rejected ? (
          <>
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertDescription>
                Demande refusée. Choisissez un autre forfait.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                sessionStorage.removeItem("pendingVisitRequestId");
                setPendingId(null);
              }}
            >
              Réessayer
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            <h2 className="text-lg font-semibold">En attente de confirmation</h2>
            <p className="mt-2 text-slate-500">
              L&apos;accueil a reçu votre demande. Vous pouvez annuler pour
              choisir un autre forfait.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Annuler ma demande
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {mode === "subscription" ? "Abonnement" : "Forfait"}
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        L&apos;accueil confirmera pour démarrer.
      </p>
      {create.isError ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            {(create.error as Error).message}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate(o.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-left",
              "hover:border-primary/50"
            )}
          >
            <div>
              <div className="font-semibold">{o.name}</div>
              <div className="text-sm text-slate-500">
                {o.durationHours
                  ? `${o.durationHours}h`
                  : o.periodDays
                    ? `${o.periodDays} jours`
                    : ""}
              </div>
            </div>
            <div className="font-bold text-primary">{o.price} DT</div>
          </button>
        ))}
        {!options.length ? (
          <Alert>
            <AlertDescription>Aucun tarif disponible.</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ChooseInner />
    </Suspense>
  );
}
