"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isJournalPack } from "@/lib/journal-utils";
import {
  categoriesPresentInSpaces,
  formatTarifPrice,
  isHourlyVisitTarif,
  PRICE_CATEGORY_LABEL,
  spaceCategoryOf,
  tarifSubtitle,
} from "@/lib/tarif-labels";
import { spacesForPrice } from "@/lib/space-occupy";
import { PriceCategory, type Price, type Space } from "@/lib/types";
import { bestDeal, dealTag, giftPriceLine, giftTag, type TarifPromos } from "@/lib/tarif-promos";

export type ReserveKind = "none" | "open" | "salle" | "all" | "space";
export type OccupyMode = "bureau" | "group" | "whole";

type Props = {
  prices: Price[];
  spaces: Space[];
  priceId: string;
  onPriceId: (id: string) => void;
  reserveKind: ReserveKind;
  spaceId: string;
  tableId?: string;
  onReserve: (kind: ReserveKind, spaceId?: string, tableId?: string) => void;
  hours: string;
  onHours: (v: string) => void;
  optionalPrice?: boolean;
  showTarif?: boolean;
  showSpace?: boolean;
  /** Member/group remise % applied to displayed prices */
  discountPercent?: number;
  discountLabel?: string;
  /** Live tarif promos: a corner tag, struck price for discounts, gift question for the selected pass */
  tarifPromos?: (priceId: string) => TarifPromos;
  giftAnswers?: Record<string, boolean>;
  onGiftAnswer?: (promotionId: string, yes: boolean) => void;
};

export function VisitTarifSpacePickers({
  prices,
  spaces,
  priceId,
  onPriceId,
  reserveKind,
  spaceId,
  tableId,
  onReserve,
  hours,
  onHours,
  optionalPrice,
  showTarif = true,
  showSpace = true,
  discountPercent = 0,
  discountLabel,
  tarifPromos,
  giftAnswers = {},
  onGiftAnswer,
}: Props) {
  const presentCats = useMemo(
    () => categoriesPresentInSpaces(spaces),
    [spaces]
  );
  const spaceIds = useMemo(() => new Set(spaces.map((s) => s.id)), [spaces]);
  const hasSeats = useMemo(
    () =>
      spaces.some(
        (s) =>
          (s.seats || []).length > 0 ||
          (s.tables || []).some((t) => (t.seats || []).length > 0)
      ),
    [spaces]
  );

  const packs = useMemo(() => {
    return prices.filter((p) => {
      if (p.isActive === false) return false;
      if (!isJournalPack(p)) return false;
      const cat = p.category || "JOURNEE";
      if (cat === "ABONNEMENT") return false;
      if (p.spaceId && !spaceIds.has(p.spaceId)) return false;
      if (cat === "JOURNEE") return hasSeats || presentCats.has("JOURNEE");
      return true;
    });
  }, [prices, presentCats, spaceIds, hasSeats]);

  const byCat = useMemo(() => {
    const map: Record<string, Price[]> = {
      JOURNEE: [],
      SALLE: [],
      OPEN_SPACE: [],
    };
    for (const p of packs) {
      const key = p.category || "JOURNEE";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [packs]);

  const selected = packs.find((p) => p.id === priceId);

  const matchingSpaces = selected ? spacesForPrice(spaces, selected) : spaces;

  const effectiveId = priceId;
  const openMeter =
    selected && isHourlyVisitTarif(selected) && !selected.durationHours;

  const quick = useMemo(() => {
    const items: Array<{
      kind: Exclude<ReserveKind, "none" | "space">;
      label: string;
      hint: string;
    }> = [];
    if (spaces.length > 1) {
      items.push({
        kind: "all",
        label: "Tout le space",
        hint: "Toutes les places",
      });
    }
    if (presentCats.has(PriceCategory.OPEN_SPACE)) {
      items.push({
        kind: "open",
        label: "Open space",
        hint: "Places open space",
      });
    }
    if (presentCats.has(PriceCategory.SALLE)) {
      items.push({
        kind: "salle",
        label: "Salle de réunion",
        hint: "Toute la salle",
      });
    }
    return items;
  }, [spaces.length, presentCats]);

  return (
    <div className="space-y-6">
      {showTarif ? (
        <div className="space-y-3">
          <div>
            <Label className="text-base">Tarif</Label>
            <p className="text-xs text-muted-foreground">
              {optionalPrice
                ? "Forfait extra optionnel — ou laissez vide pour pointer l’abonnement."
                : "Choisissez un tarif (aucun n’est pré-sélectionné)."}
            </p>
          </div>
          {!spaces.length ? (
            <Alert>
              <AlertDescription>
                Créez d&apos;abord un espace dans Facility / Map — les tarifs
                s&apos;afficheront ensuite selon la catégorie (bureau, salle,
                open space).
              </AlertDescription>
            </Alert>
          ) : !packs.length ? (
            <Alert>
              <AlertDescription>
                Aucun tarif pour les espaces existants. Ajoutez un tarif dans
                Tarifs, ou changez la catégorie de l&apos;espace.
              </AlertDescription>
            </Alert>
          ) : (
            Object.entries(byCat)
              .filter(([, list]) => list.length)
              .map(([cat, list]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">
                      {PRICE_CATEGORY_LABEL[cat] || cat}
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      {list.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => {
                      const isSelected = effectiveId === p.id;
                      const afterMember =
                        discountPercent > 0
                          ? Math.round(p.price * (1 - discountPercent / 100) * 100) /
                            100
                          : p.price;
                      const promos = tarifPromos?.(p.id);
                      const deal = promos ? bestDeal(promos.deals, afterMember) : null;
                      const gift = promos?.bundles[0] ?? null;
                      const remised =
                        deal || discountPercent > 0
                          ? Math.round((deal ? deal.final : afterMember) * 100) / 100
                          : null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            onPriceId(
                              optionalPrice && priceId === p.id ? "" : p.id
                            )
                          }
                          className={cn(
                            "relative rounded-xl border px-3 py-3 text-left transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                              : gift
                                ? "border-amber-300 bg-amber-50 hover:border-amber-400"
                                : deal
                                  ? "border-rose-300 bg-rose-50 hover:border-rose-400"
                                  : "hover:border-primary/50"
                          )}
                        >
                          {gift || deal ? (
                            <span
                              className={cn(
                                "absolute -right-1.5 -top-2.5 rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm",
                                gift
                                  ? "bg-gradient-to-r from-amber-500 via-amber-200 to-amber-500 text-amber-950"
                                  : "bg-rose-600 text-white"
                              )}
                            >
                              {gift ? giftTag(gift) : dealTag(deal!.promo)}
                            </span>
                          ) : null}
                          <div className="font-semibold">{p.name}</div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-sm text-muted-foreground">
                            <span>{tarifSubtitle(p)}</span>
                            {remised != null ? (
                              <span
                                className={cn(
                                  "text-right font-bold",
                                  deal ? "text-rose-700" : "text-primary"
                                )}
                              >
                                <span className="mr-1 text-xs font-normal line-through opacity-60">
                                  {formatTarifPrice(p)}
                                </span>
                                {isHourlyVisitTarif(p)
                                  ? `${remised} DT / h`
                                  : `${remised} DT`}
                              </span>
                            ) : (
                              <span className="font-bold text-primary">
                                {formatTarifPrice(p)}
                              </span>
                            )}
                          </div>
                          {discountPercent > 0 && discountLabel ? (
                            <p className="mt-1 text-[10px] text-amber-800">
                              {discountLabel} −{discountPercent}%
                            </p>
                          ) : null}
                          {deal ? (
                            <p className="mt-1 text-[10px] font-semibold text-rose-700">
                              {deal.promo.title}
                            </p>
                          ) : null}
                          {p.spaceName ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Lié à {p.spaceName}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
          {selected && tarifPromos
            ? tarifPromos(selected.id).bundles.map((g) => {
                const answer = giftAnswers[g.id];
                return (
                  <div
                    key={`${selected.id}-${g.id}`}
                    className="animate-in fade-in-0 slide-in-from-top-1 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 duration-200 motion-reduce:animate-none"
                  >
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm font-semibold text-amber-950">
                        Cadeau avec ce pass : {g.itemName ?? "produit"} {g.label} ({giftPriceLine(g)})
                      </p>
                      <p className="text-xs text-amber-800">
                        Proposez-le au client. Oui = un bon pour sa visite.
                      </p>
                    </div>
                    <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-amber-200">
                      {(
                        [
                          [false, "Non"],
                          [true, "Oui"],
                        ] as const
                      ).map(([yes, text]) => (
                        <button
                          key={text}
                          type="button"
                          aria-pressed={answer === yes}
                          onClick={() => onGiftAnswer?.(g.id, yes)}
                          className={cn(
                            "h-8 min-w-14 rounded-md px-3 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
                            answer === yes
                              ? yes
                                ? "bg-amber-600 text-white"
                                : "bg-slate-600 text-white"
                              : "text-slate-700 hover:bg-amber-50"
                          )}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            : null}
          {selected && isHourlyVisitTarif(selected) ? (
            <div className="max-w-xs space-y-1">
              {openMeter ? (
                <p className="text-sm text-muted-foreground">
                  Compteur ouvert : à la sortie, montant = tarif × heures
                  réelles (ex. 1,5 h → × 1,5).
                </p>
              ) : (
                <>
                  <Label>Heures (limite {selected.durationHours}h)</Label>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={hours}
                    onChange={(e) => onHours(e.target.value)}
                    placeholder={String(selected.durationHours || "")}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {showSpace ? (
        <div className="space-y-3">
          <div>
            <Label className="text-base">Réserver un espace / une table</Label>
            <p className="text-xs text-muted-foreground">
              Un clic réserve toutes les places de l&apos;espace ou d&apos;une
              table. Si des places sont occupées, déplacez d&apos;abord les
              visiteurs.
            </p>
          </div>
          {quick.length ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {quick.map((q) => {
                const active = reserveKind === q.kind;
                return (
                  <button
                    key={q.kind}
                    type="button"
                    onClick={() => onReserve(active ? "none" : q.kind)}
                    className={cn(
                      "rounded-xl border px-3 py-4 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="font-semibold">{q.label}</div>
                    <div className="text-xs text-muted-foreground">{q.hint}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
          {matchingSpaces.length ? (
            <div className="space-y-3">
              {matchingSpaces.map((s) => {
                const spaceActive =
                  reserveKind === "space" && spaceId === s.id && !tableId;
                const tables = s.tables || [];
                return (
                  <div
                    key={s.id}
                    className="space-y-2 rounded-xl border p-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onReserve(
                          spaceActive ? "none" : "space",
                          spaceActive ? undefined : s.id
                        )
                      }
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left transition-colors",
                        spaceActive
                          ? "bg-primary/10 ring-2 ring-primary/30"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {PRICE_CATEGORY_LABEL[spaceCategoryOf(s)]} ·{" "}
                        {s.seats?.filter((seat) => !seat.isOverflow).length ||
                          s.capacityNormal ||
                          "—"}{" "}
                        places
                        {tables.length ? ` · ${tables.length} table(s)` : ""}
                      </div>
                    </button>
                    {tables.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {tables.map((t) => {
                          const active = tableId === t.id;
                          const n =
                            t.seats?.filter((seat) => !seat.isOverflow)
                              .length ?? 0;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() =>
                                onReserve(
                                  active ? "none" : "space",
                                  active ? undefined : s.id,
                                  active ? undefined : t.id
                                )
                              }
                              className={cn(
                                "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                active
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                  : "hover:border-primary/50"
                              )}
                            >
                              <div className="font-medium">{t.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {n || "—"} places
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun espace. Créez-le dans Facility / Map.
            </p>
          )}
          {reserveKind !== "none" ? (
            <p className="text-xs text-primary">
              Réservation :{" "}
              {tableId
                ? matchingSpaces
                    .flatMap((s) => s.tables || [])
                    .find((t) => t.id === tableId)?.name || "table"
                : reserveKind === "all"
                  ? "tout le space"
                  : reserveKind === "open"
                    ? "open space"
                    : reserveKind === "salle"
                      ? "salle de réunion"
                      : spaces.find((s) => s.id === spaceId)?.name || "espace"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucun espace bloqué — uniquement les places choisies (bureau /
              groupe).
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function visitReservePayload(
  reserveKind: ReserveKind,
  spaceId: string,
  selected?: Price,
  tableId?: string
) {
  if (tableId) {
    return {
      spaceId: spaceId || selected?.spaceId || undefined,
      tableId,
      reserveKind: undefined as undefined | "open" | "salle" | "all" | "none",
    };
  }
  if (reserveKind === "none") {
    return {
      spaceId: undefined as string | undefined,
      tableId: undefined as string | undefined,
      reserveKind: undefined as undefined | "open" | "salle" | "all" | "none",
    };
  }
  if (reserveKind === "space") {
    return {
      spaceId: spaceId || selected?.spaceId || undefined,
      tableId: undefined as string | undefined,
      reserveKind: undefined as undefined | "open" | "salle" | "all" | "none",
    };
  }
  return {
    spaceId: undefined as string | undefined,
    tableId: undefined as string | undefined,
    reserveKind: reserveKind as "open" | "salle" | "all",
  };
}

export function visitOccupyPayload(
  occupyMode: OccupyMode,
  reserveKind: ReserveKind,
  spaceId: string,
  tableId?: string,
  seatLabel?: string,
  seatLabels?: string[]
) {
  if (occupyMode === "bureau") {
    return {
      spaceId: undefined as string | undefined,
      tableId: undefined as string | undefined,
      reserveKind: "none" as const,
      seatLabel: seatLabel || undefined,
      seatLabels: undefined as string[] | undefined,
    };
  }
  if (occupyMode === "group") {
    return {
      spaceId: undefined as string | undefined,
      tableId: undefined as string | undefined,
      reserveKind: "none" as const,
      seatLabel: undefined as string | undefined,
      seatLabels: seatLabels?.length ? seatLabels : undefined,
    };
  }
  return {
    ...visitReservePayload(reserveKind, spaceId, undefined, tableId),
    seatLabel: undefined as string | undefined,
    seatLabels: undefined as string[] | undefined,
  };
}
