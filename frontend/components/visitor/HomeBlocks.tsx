"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Coffee, CupSoda, Gift, Zap } from "lucide-react";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { usePricingContext } from "@/lib/hooks/use-pricing-context";
import { usePricePromos } from "@/components/visitor/PassPickerSheet";
import { formatDt, uniqueTiersByDuration } from "@/lib/session-pricing";
import { isDrink } from "@/lib/drinks";
import { readLocalCache, writeLocalCache } from "@/lib/visitor-local-cache";
import { BillingUnit, PriceCategory, PriceType, type Price } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5";
const LABEL = "text-[11px] font-bold uppercase tracking-wide text-slate-500";

function tierShort(hours: number) {
  return hours >= 7 ? "Jour" : `${hours}h`;
}

/** Tarif auto ladder (2h → 4h → 6h → Jour): you climb on your own; promo tier glows. */
export function TarifLadder({ tarifs }: { tarifs: Price[] }) {
  const { slug, href } = useOrg();
  const { data: ctx } = usePricingContext({ orgSlug: slug });
  const promos = usePricePromos();
  const tiers = useMemo(
    () =>
      uniqueTiersByDuration(ctx?.allTiers ?? []).slice(0, 4),
    [ctx?.allTiers]
  );
  const minSub = useMemo(() => {
    const subs = tarifs.filter(
      (t) =>
        (t.category === PriceCategory.ABONNEMENT || t.type === PriceType.abonnement) &&
        t.billingUnit !== BillingUnit.HOURLY &&
        (t.durationHours ?? 0) > 0
    );
    return subs.length ? Math.min(...subs.map((s) => s.price)) : null;
  }, [tarifs]);
  if (!tiers.length) return null;
  const promoTier = tiers.find((t) => promos.has(t.priceId)) ?? null;
  const promo = promoTier ? promos.get(promoTier.priceId)! : null;
  const cols = tiers.length;

  return (
    <section className={cn(CARD, "v-rise px-3.5 py-3 [animation-delay:120ms]")}>
      <div className="flex items-center justify-between gap-2">
        <p className={LABEL}>Tarifs · palier auto</p>
        {minSub != null ? (
          <Link
            href={href("/choose?mode=subscription")}
            className="text-xs font-bold text-indigo-700 transition-colors hover:text-indigo-900"
          >
            Abonnements dès {formatDt(minSub)}
          </Link>
        ) : null}
      </div>
      <div
        className="relative mt-3 grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="absolute top-4 h-[3px] rounded-full bg-slate-200"
          style={{ left: `${50 / cols}%`, right: `${50 / cols}%` }}
        />
        <span
          aria-hidden
          className="v-bar-grow absolute top-4 h-[3px] rounded-full bg-indigo-600"
          style={{ left: `${50 / cols}%`, width: `${100 / cols}%` }}
        />
        {tiers.map((t, i) => {
          const gift = promos.has(t.priceId);
          const last = i === tiers.length - 1;
          return (
            <Link
              key={t.priceId}
              href={href(`/choose?mode=day&priceId=${encodeURIComponent(t.priceId)}`)}
              className="relative flex flex-col items-center gap-1 rounded-xl py-0.5 transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
            >
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black",
                  i === 0
                    ? "v-node-pulse bg-indigo-600 text-white"
                    : last
                      ? "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950"
                      : "border-2 border-indigo-200 bg-indigo-50 text-indigo-800"
                )}
              >
                {tierShort(t.durationHours)}
                {gift ? (
                  <span className="v-gift-glow absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-amber-950">
                    <Gift className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "text-[13px] font-extrabold tabular-nums",
                  i === 0 ? "text-slate-900" : "text-slate-700"
                )}
              >
                {formatDt(t.price)}
              </span>
            </Link>
          );
        })}
      </div>
      {promo && promoTier ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-900">
          <Gift className="v-wiggle h-3.5 w-3.5" />
          {promo.title} · pass {promoTier.name}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-600">
          Vous montez de palier tout seul selon votre temps.
        </p>
      )}
    </section>
  );
}

/** Drinks right on Accueil ("Boosts d'énergie") — tap opens the café. */
export function BoostsRow() {
  const { slug, href } = useOrg();
  const { data: products = [] } = useQuery({
    queryKey: ["mobile-products", slug],
    queryFn: async () => {
      const data = await mobileApi.products(slug);
      writeLocalCache("products", data, slug);
      return data;
    },
    staleTime: 60_000,
    placeholderData: () => readLocalCache("products", slug) ?? undefined,
  });
  const drinks = useMemo(
    () =>
      products
        .filter((p) => p.stock > 0 && isDrink(p.name, p.description))
        .sort((a, b) => a.sellingPrice - b.sellingPrice)
        .slice(0, 3),
    [products]
  );
  if (!drinks.length) return null;

  return (
    <section className={cn(CARD, "v-rise px-3.5 py-3 [animation-delay:180ms]")}>
      <div className="flex items-center justify-between">
        <p className={cn(LABEL, "flex items-center gap-1")}>
          <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-600" />
          Boosts d’énergie
        </p>
        <Link href={href("/cafe")} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">
          Menu café
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {drinks.map((p, i) => {
          const cold = /jus|juice|soda|cola|eau|water|smoothie|limonade|citronnade|milkshake|energy/i.test(p.name);
          return (
            <Link
              key={p.id}
              href={href(`/cafe`)}
              className="flex items-center gap-2 rounded-[18px] bg-slate-50 p-2 ring-1 ring-slate-900/5 transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl",
                  cold ? "bg-orange-100 text-orange-800" : i % 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                )}
              >
                {p.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.img} alt="" className="h-full w-full object-cover" />
                ) : cold ? (
                  <CupSoda className="h-[18px] w-[18px]" />
                ) : (
                  <Coffee className="h-[18px] w-[18px]" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-extrabold text-slate-900">{p.name}</span>
                <span className="block text-[11px] font-semibold text-slate-600">
                  {formatDt(p.sellingPrice)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** "Réserver pour plus tard": pick a day, then the reserve page opens on it. */
export function ReserveLaterCard() {
  const { href } = useOrg();
  const days = useMemo(() => {
    const today = new Date();
    return [0, 1, 2, 3].map((n) => {
      const d = addDays(today, n);
      const wd = format(d, "EEEE", { locale: fr });
      return {
        iso: format(d, "yyyy-MM-dd"),
        top: n === 0 ? "Auj." : n === 1 ? "Demain" : `${wd.slice(0, 3)}.`,
        num: format(d, "d"),
        label: n === 0 ? "aujourd’hui" : n === 1 ? "demain" : `${wd} ${format(d, "d")}`,
      };
    });
  }, []);
  const [picked, setPicked] = useState(1);
  const day = days[picked];

  return (
    <section className={cn(CARD, "v-rise px-3.5 py-3 [animation-delay:240ms]")}>
      <div className="flex items-center justify-between">
        <p className={cn(LABEL, "flex items-center gap-1")}>
          <CalendarDays className="h-3.5 w-3.5" />
          Réserver pour plus tard
        </p>
        <Link href={href("/reservations")} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">
          Mes réservations
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Jour">
        {days.map((d, i) => {
          const on = i === picked;
          return (
            <button
              key={d.iso}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(i)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-2xl capitalize transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95 motion-reduce:transition-none",
                on
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-50 text-slate-900 ring-1 ring-slate-200"
              )}
            >
              <span className="text-[11px] font-bold">{d.top}</span>
              <span className="text-lg font-black leading-none">{d.num}</span>
            </button>
          );
        })}
      </div>
      <Link
        href={href(`/reserve?date=${day.iso}`)}
        className="mt-2 flex h-11 items-center justify-center rounded-full bg-indigo-50 text-sm font-extrabold text-indigo-800 ring-1 ring-indigo-200 transition-colors duration-200 hover:bg-indigo-100 motion-reduce:transition-none"
      >
        Réserver {day.label} · place ou salle
      </Link>
    </section>
  );
}
