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
import type { Member, Price, Space, SpaceSeat } from "@/lib/types";
import { PriceCategory, PriceType } from "@/lib/types";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import { VisitorSeatMap } from "@/components/visitor/VisitorSeatMap";
import { SpaceGallery } from "@/components/visitor/SpaceGallery";
import {
  priceAllowsSeatIn,
  priceAllowsWholeIn,
  spacesForPrice,
} from "@/lib/space-occupy";

function ChooseInner() {
  const router = useRouter();
  const { href, slug } = useOrg();
  const { memberId: sessionMemberId } = useVisitorSession();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as string) || "day";
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pickedPrice, setPickedPrice] = useState<Price | null>(null);
  const [seatLabel, setSeatLabel] = useState("");
  const [seatSpaceId, setSeatSpaceId] = useState("");
  const [occupyWhole, setOccupyWhole] = useState(false);
  const { socket } = useRealtime();
  const pendingPoll = useVisibleInterval(pendingId ? 8_000 : false);

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

  const { data: status, refetch } = useMobileStatus({
    enabled: !!memberId,
    intervalMs: pendingId ? 10_000 : 20_000,
  });

  const { data: tarifs = [] } = useQuery({
    queryKey: ["mobile-tarifs", slug],
    queryFn: () => mobileApi.tarifs(slug),
    staleTime: 5 * 60_000,
  });

  const { data: seatSettings } = useQuery({
    queryKey: ["mobile-seat-settings", slug],
    queryFn: () => mobileApi.seatSettings(slug),
    staleTime: 15_000,
  });
  const autoAccept = !!seatSettings?.receptionAway;
  const visitorChoose = seatSettings?.mobileSeatMode === "VISITOR_CHOOSE";
  const needPlaceStep = visitorChoose && mode === "day";

  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
    enabled: needPlaceStep,
    staleTime: 60_000,
  });
  const layoutSpaces = (layout?.spaces || []) as Space[];

  const { data: pendingRequest } = useQuery({
    queryKey: ["visit-request", pendingId],
    queryFn: () => mobileApi.getVisitRequest(pendingId!),
    enabled: !!pendingId,
    refetchInterval: pendingPoll,
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
    mutationFn: (opts: {
      priceId: string;
      seatLabel?: string;
      spaceId?: string;
      occupyWhole?: boolean;
    }) =>
      mobileApi.createVisitRequest({
        memberId: memberId!,
        priceId: opts.priceId,
        type: mode === "subscription" ? "SUBSCRIPTION" : "DAY",
        seatLabel: opts.seatLabel,
        spaceId: opts.spaceId,
        occupyWhole: opts.occupyWhole,
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
        <div className="text-left">
          <MobileBackHome />
        </div>
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
  if (mode === "day" && status?.canChooseForfait === false) {
    const rem =
      status.dailyCreditRemainingHours ??
      (status.subscription as { dailyCreditRemainingHours?: number } | null)
        ?.dailyCreditRemainingHours;
    return (
      <div className="space-y-3 text-center">
        <div className="text-left">
          <MobileBackHome />
        </div>
        <Alert>
          <AlertDescription>
            {subKind === "HOURS_POOL"
              ? "Abonnement heures actif : pointez pour entrer. Pas de forfait tant que l’abonnement est actif."
              : `Crédit abonnement du jour encore disponible${
                  rem != null ? ` (${Number(rem).toFixed(1)} h)` : ""
                }. Pointez votre présence et utilisez votre forfait abonnement avant d’acheter un forfait.`}
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
      <div className="py-4 text-center">
        <div className="mb-4 text-left">
          <MobileBackHome />
        </div>
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

  const hint = autoAccept
    ? visitorChoose
      ? "Choisissez un forfait — votre place ensuite."
      : "Choisissez un forfait — place auto."
    : visitorChoose
      ? "L’accueil confirme, puis vous choisissez votre place."
      : "L’accueil confirmera.";

  const onPickTarif = (o: Price) => {
    create.mutate({ priceId: o.id });
  };

  if (needPlaceStep && pickedPrice && memberId) {
    const placeSpaces = spacesForPrice(layoutSpaces, pickedPrice);
    const wholeSpaces = placeSpaces.filter((s) =>
      priceAllowsWholeIn(pickedPrice, s)
    );
    const seatSpaces = placeSpaces.filter((s) =>
      priceAllowsSeatIn(pickedPrice, s)
    );
    const wholeOnly = wholeSpaces.length > 0 && seatSpaces.length === 0;
    const canConfirm = occupyWhole ? !!seatSpaceId : !!seatLabel;
    const selectedWhole = occupyWhole
      ? wholeSpaces.find((s) => s.id === seatSpaceId)
      : null;
    return (
      <div className="space-y-2.5">
        <MobileBackHome />
        <button
          type="button"
          className="text-sm font-medium text-primary"
          onClick={() => setPickedPrice(null)}
        >
          ← {pickedPrice.name}
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {wholeOnly ? "Votre espace" : "Votre place"}
          </h1>
          <p className="text-xs text-slate-500">
            {pickedPrice.price} DT
            {seatLabel
              ? ` · place ${seatLabel}`
              : selectedWhole
                ? ` · ${selectedWhole.name}`
                : " · touchez pour choisir"}
          </p>
        </div>
        {create.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {(create.error as Error).message}
            </AlertDescription>
          </Alert>
        ) : null}
        {wholeSpaces.length ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">
              Espace entier
              {occupyWhole ? " — retouchez pour annuler" : ""}
            </p>
            <div className="grid gap-2">
              {wholeSpaces.map((s) => {
                const selected = occupyWhole && seatSpaceId === s.id;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selected) {
                        setOccupyWhole(false);
                        setSeatSpaceId("");
                        return;
                      }
                      setOccupyWhole(true);
                      setSeatSpaceId(s.id);
                      setSeatLabel("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (selected) {
                        setOccupyWhole(false);
                        setSeatSpaceId("");
                        return;
                      }
                      setOccupyWhole(true);
                      setSeatSpaceId(s.id);
                      setSeatLabel("");
                    }}
                    className={cn(
                      "cursor-pointer overflow-hidden rounded-xl border text-left transition",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-slate-200"
                    )}
                  >
                    <SpaceGallery
                      space={s}
                      className="rounded-none"
                      interactive={false}
                    />
                    <div className="flex items-center justify-between bg-white px-3 py-2">
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className="text-xs text-primary">
                        {selected ? "Sélectionné" : "Réserver tout"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {seatSpaces.length ? (
          <div className="space-y-1.5">
            {wholeSpaces.length ? (
              <p className="text-[11px] font-medium text-slate-500">
                Ou une place
              </p>
            ) : null}
            <VisitorSeatMap
              memberId={memberId}
              pickOnly
              seatMode="VISITOR_CHOOSE"
              allowedSpaceIds={seatSpaces.map((s) => s.id)}
              onPicked={(seat: SpaceSeat) => {
                setOccupyWhole(false);
                setSeatLabel(seat.label);
                setSeatSpaceId(seat.spaceId || "");
              }}
            />
          </div>
        ) : null}
        <Button
          className="h-11 w-full rounded-full"
          disabled={create.isPending || !canConfirm}
          onClick={() =>
            create.mutate({
              priceId: pickedPrice.id,
              seatLabel: occupyWhole ? undefined : seatLabel,
              spaceId: seatSpaceId || undefined,
              occupyWhole,
            })
          }
        >
          {create.isPending
            ? "Envoi…"
            : occupyWhole
              ? "Confirmer l’espace"
              : seatLabel
                ? `Confirmer ${seatLabel}`
                : "Choisir d’abord"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <MobileBackHome />
      <div className="mb-3 flex gap-2">
        <Button
          type="button"
          className="h-10 flex-1 rounded-full"
          variant={mode !== "subscription" ? "default" : "outline"}
          onClick={() => router.replace(href("/choose?mode=day"))}
        >
          Forfait
        </Button>
        <Button
          type="button"
          className="h-10 flex-1 rounded-full"
          variant={mode === "subscription" ? "default" : "outline"}
          onClick={() => router.replace(href("/choose?mode=subscription"))}
        >
          Abonnement
        </Button>
      </div>
      <h1 className="text-xl font-bold">
        {mode === "subscription" ? "Abonnement" : "Forfait"}
      </h1>
      <p className="mb-3 text-xs text-slate-500">{hint}</p>
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
            onClick={() => onPickTarif(o)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3.5 text-left",
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
