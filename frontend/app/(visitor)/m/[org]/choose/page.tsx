"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Crown, Gift, Loader2, Timer } from "lucide-react";
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
import {
  useMobileStatus,
  writeOptimisticSession,
  clearOptimisticSession,
} from "@/lib/hooks/use-mobile-status";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import { VisitorSeatMap } from "@/components/visitor/VisitorSeatMap";
import { SpaceGallery } from "@/components/visitor/SpaceGallery";
import {
  priceAllowsSeatIn,
  priceAllowsWholeIn,
  spacesForPrice,
} from "@/lib/space-occupy";
import {
  memberAppPromos,
  pricedWithPromo,
  promoCategoriesOf,
} from "@/lib/promo-price";
import { PromoPrice } from "@/components/visitor/PromoPrice";
import { QuestBanner, QuestLabel } from "@/components/visitor/quest/QuestSheet";
import { QuestOption } from "@/components/visitor/quest/QuestOption";
import { useTarifPromos } from "@/components/visitor/PassPickerSheet";
import { GiftAnswerLine, GiftOfferPanel } from "@/components/visitor/quest/GiftOffer";
import { acceptedBundleIds, bestDeal, dealTag, giftTag } from "@/lib/tarif-promos";
import { usePlayer } from "@/lib/hooks/use-player";
import { dtToPoints } from "@/lib/points-catalog";
import { formatDt } from "@/lib/session-pricing";
import { toast } from "sonner";

function ChooseInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { href, slug } = useOrg();
  const { memberId: sessionMemberId } = useVisitorSession();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as string) || "day";
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pickedPrice, setPickedPrice] = useState<Price | null>(null);
  const presetPriceId = searchParams.get("priceId");
  const [selectedId, setSelectedId] = useState<string | null>(presetPriceId);
  useEffect(() => {
    setSelectedId(presetPriceId);
  }, [mode, presetPriceId]);
  const [seatLabel, setSeatLabel] = useState("");
  const [seatSpaceId, setSeatSpaceId] = useState("");
  const [occupyWhole, setOccupyWhole] = useState(false);
  const [subKindTab, setSubKindTab] = useState<"half" | "full">("half");
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
    queryKey: ["mobile-floor-plan", slug, memberId],
    queryFn: () => mobileApi.floorPlan(slug, memberId ?? undefined),
    staleTime: 60_000,
  });
  const layoutSpaces = (layout?.spaces || []) as Space[];
  const appPromos = memberAppPromos(layout?.facility, status?.member);
  /** Discounted price only once the app is installed (promo activated). */
  const promoActive = appPromos.active;
  const promoOpts = promoActive
    ? { promos: appPromos.promos, globalPromo: appPromos.globalPromo }
    : { promos: null, globalPromo: null };
  const promosOf = useTarifPromos();
  /** Gift-with-pass answers (promo id → yes / no) and the pass whose offer is open */
  const [giftAnswers, setGiftAnswers] = useState<Record<string, boolean>>({});
  const [giftOpenFor, setGiftOpenFor] = useState<string | null>(null);
  const { player, isPwa } = usePlayer(memberId);
  /** Install promo or live golden-card offer, whichever is cheaper (the server applies the same rule). */
  const priceFor = (o: Price) => {
    const priced = pricedWithPromo(o.price, o.id, {
      ...promoOpts,
      categories: promoCategoriesOf(o),
    });
    if (priced.hasPromo) return priced;
    const flash = bestDeal(promosOf(o.id).deals, o.price);
    return flash ? { original: o.price, final: flash.final, hasPromo: true } : priced;
  };

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
        pendingRequest.type === "SUBSCRIPTION"
          ? href("/subscription")
          : href("/session")
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
          payload.type === "SUBSCRIPTION"
            ? href("/subscription")
            : href("/session")
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
  const selectedOption = options.find((o) => o.id === selectedId) || null;
  // Preselected abonnement (e.g. "Renouveler"): open the matching half/full tab
  useEffect(() => {
    if (!selectedOption) return;
    setSubKindTab((selectedOption.durationHours ?? 0) > 6 ? "full" : "half");
  }, [selectedOption]);

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
        bundleIds:
          mode === "day"
            ? acceptedBundleIds(promosOf(opts.priceId).bundles, giftAnswers)
            : undefined,
      }),
    onSuccess: (req) => {
      if (req.status === "APPROVED" || req.autoApproved) {
        sessionStorage.removeItem("pendingVisitRequestId");
        setPendingId(null);
        clearOptimisticSession();
        void queryClient.invalidateQueries({
          queryKey: ["mobile-status", memberId],
        });
        router.replace(
          req.type === "SUBSCRIPTION" ? href("/subscription") : href("/session")
        );
        return;
      }
      clearOptimisticSession();
      queryClient.setQueryData(
        ["mobile-status", memberId],
        (old: any) =>
          old
            ? {
                ...old,
                pendingRequest: req,
                // Subscription requested mid-session: the session keeps running
                session: req.type === "SUBSCRIPTION" ? old.session : null,
              }
            : old
      );
      sessionStorage.setItem("pendingVisitRequestId", req.id);
      setPendingId(req.id);
      // Already on Accueil if we navigated optimistically; otherwise stay for pending UI
      if (mode === "day") router.replace(href());
    },
    onError: (e: Error) => {
      clearOptimisticSession();
      void queryClient.invalidateQueries({
        queryKey: ["mobile-status", memberId],
      });
      toast.error(e.message || "Impossible de démarrer la session");
      router.replace(href(`/choose?mode=${mode === "subscription" ? "subscription" : "day"}`));
    },
  });

  const cancel = useMutation({
    mutationFn: () => {
      const id = pendingId || status?.pendingRequest?.id;
      if (!id || String(id).startsWith("optimistic")) {
        return Promise.resolve(null);
      }
      return mobileApi.cancelVisitRequest(id, memberId!);
    },
    onSuccess: () => {
      sessionStorage.removeItem("pendingVisitRequestId");
      clearOptimisticSession();
      setPendingId(null);
      refetch();
    },
  });

  const seedOptimisticAndGo = (opts: {
    price: Price;
    seatLabel?: string;
    spaceId?: string;
    occupyWhole?: boolean;
    expectAutoSession: boolean;
  }) => {
    if (!memberId) return;
    const nowIso = new Date().toISOString();
    const seat =
      opts.seatLabel || opts.occupyWhole
        ? {
            label: opts.seatLabel || null,
            spaceId: opts.spaceId || null,
            occupyWhole: !!opts.occupyWhole,
          }
        : null;

    if (opts.expectAutoSession && mode === "day") {
      const session = {
        id: `optimistic-${Date.now()}`,
        memberID: memberId,
        priceId: opts.price.id,
        registredTime: nowIso,
        leaveTime: null,
        isPayed: false,
        payedAmount: opts.price.price,
        isReservation: false,
        prices: opts.price,
        price: opts.price,
        amountDue: opts.price.price,
        _optimistic: true,
      };
      writeOptimisticSession({
        memberId,
        at: Date.now(),
        session,
        seat,
      });
      queryClient.setQueryData(["mobile-status", memberId], (old: any) => ({
        ...(old || {}),
        pendingRequest: null,
        hasOpenSession: true,
        session,
        seat: seat || old?.seat || null,
      }));
      router.replace(href("/session"));
      return;
    }

    const pendingRequest = {
      id: `optimistic-pending-${Date.now()}`,
      status: "PENDING",
      type: mode === "subscription" ? "SUBSCRIPTION" : "DAY",
      priceId: opts.price.id,
      price: opts.price,
      createdAt: nowIso,
      _optimistic: true,
    };
    writeOptimisticSession({
      memberId,
      at: Date.now(),
      session: null,
      seat,
      pendingRequest,
    });
    queryClient.setQueryData(["mobile-status", memberId], (old: any) => ({
      ...(old || {}),
      session: null,
      hasOpenSession: false,
      pendingRequest,
    }));
    setPendingId(String(pendingRequest.id));
    if (mode === "day") router.replace(href());
  };

  const submitVisit = (opts: {
    priceId: string;
    seatLabel?: string;
    spaceId?: string;
    occupyWhole?: boolean;
  }) => {
    const price =
      pickedPrice?.id === opts.priceId
        ? pickedPrice
        : options.find((o) => o.id === opts.priceId) ||
          tarifs.find((t) => t.id === opts.priceId);
    if (!price || !memberId) return;

    // Day + auto-accept: show session UI immediately, sync server in background
    const expectAuto = mode === "day" && autoAccept;
    seedOptimisticAndGo({
      price,
      seatLabel: opts.seatLabel,
      spaceId: opts.spaceId,
      occupyWhole: opts.occupyWhole,
      expectAutoSession: expectAuto,
    });
    // Reception must confirm: still go Accueil with pending (day) / keep choose pending UI (sub)
    if (!expectAuto && mode === "day") {
      // already navigated with pending overlay
    }
    create.mutate(opts);
  };
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
  if (mode === "day" && status?.canChooseForfait === false) {
    const rem =
      status.dailyCreditRemainingHours ??
      (status.subscription as { dailyCreditRemainingHours?: number } | null)
        ?.dailyCreditRemainingHours;
    return (
      <div className="space-y-3 text-center">
        <Alert>
          <AlertDescription>
            {subKind === "HOURS_POOL"
              ? "Abonnement heures actif : pointez pour entrer. Pas de pass tant que l’abonnement est actif."
              : `Crédit abonnement du jour encore disponible${
                  rem != null ? ` (${Number(rem).toFixed(1)} h)` : ""
                }. Pointez votre présence et utilisez votre crédit abonnement avant d’acheter un pass.`}
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
        {rejected ? (
          <>
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertDescription>
                Demande refusée. Choisissez un autre pass.
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
              choisir un autre pass.
            </p>
            {status?.session ? (
              <p className="mt-2 text-sm font-medium text-indigo-600">
                Votre session en cours passera sur l&apos;abonnement dès la
                validation.
              </p>
            ) : null}
            {status?.session ? (
              <Button className="mt-4 mr-2" onClick={() => router.push(href())}>
                Voir ma session
              </Button>
            ) : null}
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
      ? "Choisissez un pass — votre place ensuite."
      : "Choisissez un pass — place auto."
    : visitorChoose
      ? "L’accueil confirme, puis vous choisissez votre place."
      : "L’accueil confirmera.";

  const onPickTarif = (o: Price) => {
    if (needPlaceStep) {
      setPickedPrice(o);
      setSeatLabel("");
      setSeatSpaceId("");
      setOccupyWhole(false);
      return;
    }
    submitVisit({ priceId: o.id });
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
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white py-1.5 pl-2 pr-3 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70 active:scale-[0.98]"
          onClick={() => setPickedPrice(null)}
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">
            Pass : <span className="font-semibold text-slate-900">{pickedPrice.name}</span>
          </span>
          <span className="shrink-0 text-indigo-600">· Changer</span>
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {wholeOnly ? "Votre espace" : "Votre place"}
          </h1>
          <p className="text-xs text-slate-500">
            <span className="inline-flex align-middle">
              <PromoPrice
                {...priceFor(pickedPrice)}
                size="sm"
                align="start"
              />
            </span>
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
            submitVisit({
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

  const isSub = mode === "subscription";
  const halfOpts = options.filter((o) => (o.durationHours ?? 0) > 0 && (o.durationHours ?? 0) <= 6);
  const fullOpts = options.filter((o) => (o.durationHours ?? 0) > 6);
  const showKindToggle = isSub && halfOpts.length > 0 && fullOpts.length > 0;
  const listed = showKindToggle ? (subKindTab === "half" ? halfOpts : fullOpts) : options;
  const selectedPriced = selectedOption ? priceFor(selectedOption) : null;
  const selectedAmount = selectedPriced ? selectedPriced.final : null;
  const earned = selectedAmount != null ? dtToPoints(selectedAmount) : 0;
  const nextTrophy = player?.nextTrophy ?? null;
  const unlocks =
    player && nextTrophy && earned > 0 && player.points + earned >= nextTrophy.target
      ? nextTrophy.name
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
        {(
          [
            { id: "day", label: "Pass", icon: Timer },
            { id: "subscription", label: "Abonnement", icon: Crown },
          ] as const
        ).map((tab) => {
          const active = tab.id === "subscription" ? isSub : !isSub;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => router.replace(href(`/choose?mode=${tab.id}`))}
              className={cn(
                "flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition-colors duration-200 motion-reduce:transition-none",
                active
                  ? tab.id === "subscription"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div key={mode} className="v-rise overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-900/5">
        <QuestBanner
          tone={isSub ? "violet" : "brand"}
          eyebrow={isSub ? "Abonnement" : "Pass du jour"}
          icon={
            isSub ? (
              <Crown className="v-float h-5 w-5 text-amber-200" />
            ) : (
              <Timer className="h-5 w-5" />
            )
          }
          title={isSub ? "Venez quand vous voulez" : "Choisir un pass"}
          subtitle={isSub ? "Demandé ici, validé et payé à l’accueil." : hint}
          reward={
            selectedOption && selectedPriced
              ? isSub && earned > 0
                ? {
                    label: "Récompense",
                    value: (
                      <>
                        <Gift className="h-5 w-5" />+{earned.toLocaleString("fr-FR")}
                        <span className="text-sm font-bold opacity-80">pts</span>
                      </>
                    ),
                  }
                : { label: selectedOption.name, value: formatDt(selectedPriced.final) }
              : null
          }
          chip={
            unlocks
              ? { label: "Débloque", value: unlocks }
              : !isSub && earned > 0 && isPwa
                ? { label: "Points", value: `+${earned}` }
                : null
          }
        />
        <div className="space-y-2.5 px-4 pb-4 pt-4">
          {isSub && status?.session ? (
            <p className="rounded-2xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
              Session en cours : une fois l&apos;abonnement validé, elle passe sur
              l&apos;abonnement (plus rien à payer aujourd&apos;hui).
            </p>
          ) : null}
          {showKindToggle ? (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
              {(
                [
                  { id: "half", label: "Demi-journée · 6h" },
                  { id: "full", label: "Journée · 12h" },
                ] as const
              ).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={subKindTab === k.id}
                  onClick={() => setSubKindTab(k.id)}
                  className={cn(
                    "h-9 rounded-full text-xs font-extrabold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                    subKindTab === k.id
                      ? "bg-white text-violet-900 shadow-sm"
                      : "text-slate-600"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          ) : null}
          {create.isError ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {(create.error as Error).message}
            </p>
          ) : null}
          {listed.length ? (
            <>
              <QuestLabel className="mb-0 mt-1">{isSub ? "Durée" : "Durée du pass"}</QuestLabel>
              {listed.map((o, i) => {
                const priced = priceFor(o);
                const tp = promosOf(o.id);
                const giftPromo = !isSub ? (tp.bundles[0] ?? null) : null;
                const dealPromo = bestDeal(tp.deals, o.price)?.promo ?? null;
                const answer = giftPromo ? giftAnswers[giftPromo.id] : undefined;
                const pts = dtToPoints(priced.final);
                return (
                  <div
                    key={o.id}
                    className="v-rise pt-1"
                    style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                  >
                    <QuestOption
                      tone={isSub ? "violet" : "indigo"}
                      selected={selectedOption?.id === o.id}
                      disabled={create.isPending}
                      onClick={() => {
                        setSelectedId(o.id);
                        setGiftOpenFor(giftPromo && answer === undefined ? o.id : null);
                      }}
                      icon={
                        isSub ? (
                          <CalendarDays className="h-5 w-5" />
                        ) : (o.durationHours ?? 0) >= 7 ? (
                          "Jour"
                        ) : (o.durationHours ?? 0) > 0 ? (
                          `${o.durationHours}h`
                        ) : (
                          <Timer className="h-5 w-5" />
                        )
                      }
                      title={o.name}
                      hint={
                        isSub ? (
                          pts > 0 ? (
                            <span className="font-bold text-amber-700">
                              +{pts.toLocaleString("fr-FR")} pts
                            </span>
                          ) : null
                        ) : (o.durationHours ?? 0) > 0 ? (
                          `${o.durationHours} h sur place`
                        ) : null
                      }
                      price={<PromoPrice {...priced} size="sm" align="end" />}
                      gift={giftPromo ? giftTag(giftPromo) : null}
                      deal={
                        dealPromo ? dealTag(dealPromo) : priced.hasPromo ? "Promo" : null
                      }
                    />
                    {giftPromo && giftOpenFor === o.id ? (
                      <GiftOfferPanel
                        promo={giftPromo}
                        answer={answer}
                        disabled={create.isPending}
                        onAnswer={(yes) => {
                          setGiftAnswers((a) => ({ ...a, [giftPromo.id]: yes }));
                          setGiftOpenFor(null);
                          setSelectedId(o.id);
                        }}
                      />
                    ) : giftPromo && answer !== undefined ? (
                      <GiftAnswerLine
                        promo={giftPromo}
                        answer={answer}
                        onChange={() => {
                          setSelectedId(o.id);
                          setGiftOpenFor(o.id);
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : (
            <p className="py-5 text-center text-sm text-slate-600">Aucun tarif disponible.</p>
          )}
        </div>
      </div>

      {options.length ? (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10">
          <Button
            className={cn(
              "h-12 w-full rounded-full text-sm font-bold shadow-lg transition-colors duration-200 motion-reduce:transition-none",
              isSub
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-600/30 hover:from-violet-700 hover:to-indigo-700"
                : "bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-700"
            )}
            disabled={!selectedOption || create.isPending}
            onClick={() => selectedOption && onPickTarif(selectedOption)}
          >
            {create.isPending
              ? "Envoi…"
              : !selectedOption
                ? isSub
                  ? "Choisissez votre abonnement"
                  : "Choisissez votre pass"
                : isSub
                  ? `Demander · ${selectedOption.name} · ${formatDt(selectedPriced!.final)}`
                  : needPlaceStep
                    ? `Continuer avec « ${selectedOption.name} »`
                    : `Prendre « ${selectedOption.name} »`}
          </Button>
          {isSub ? (
            <p className="mt-1.5 text-center text-[11px] text-slate-600">
              Points crédités une fois l’abonnement payé
            </p>
          ) : null}
        </div>
      ) : null}
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
