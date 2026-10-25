"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, CupSoda, Loader2, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { isDrink } from "@/lib/drinks";
import { usePlayer } from "@/lib/hooks/use-player";
import { formatDt } from "@/lib/session-pricing";
import { cn } from "@/lib/utils";

const MIN = 60_000;
/** Energy lost per minute without a drink (≈ 50 % after 1 h 25). */
const DRAIN_PER_MIN = 0.6;

function energyCopy(energy: number, minutes: number) {
  if (energy >= 70) return "Rechargé ! Gardez le rythme.";
  if (energy >= 35) {
    const h = Math.floor(minutes / 60);
    const m = String(minutes % 60).padStart(2, "0");
    return `${h} h ${m} sans pause : un boost ?`;
  }
  return "Énergie basse : rechargez maintenant";
}

/**
 * Session "Boost d'énergie": an animated cup that empties with time and refills
 * when the member orders a drink (one tap). Replaces the old drink popup/card.
 */
export function EnergyCupCard({ memberId, since }: { memberId: string; since: string }) {
  const { slug, href } = useOrg();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [bump, setBump] = useState(0);
  const { player, isPwa } = usePlayer(memberId);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), MIN);
    return () => window.clearInterval(t);
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["mobile-products", slug],
    queryFn: () => mobileApi.products(slug),
    staleTime: 60_000,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId),
    staleTime: 60_000,
  });

  const picks = useMemo(() => {
    const favorite = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      favorite.set(o.productName, (favorite.get(o.productName) ?? 0) + o.quantity);
    }
    return products
      .filter((p) => p.stock > 0 && isDrink(p.name, p.description))
      .sort(
        (a, b) =>
          (favorite.get(b.name) ?? 0) - (favorite.get(a.name) ?? 0) ||
          a.sellingPrice - b.sellingPrice
      )
      .slice(0, 3);
  }, [products, orders]);

  const start = new Date(since).getTime();
  const lastDrinkAt = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((t, o) => Math.max(t, new Date(o.createdAt).getTime()), 0);
  const refAt = Math.max(Number.isNaN(start) ? now : start, lastDrinkAt);
  const minutes = Math.max(0, Math.round((now - refAt) / MIN));
  const energy = Math.max(8, Math.min(100, 100 - minutes * DRAIN_PER_MIN));
  const tone =
    energy >= 60 ? "bg-emerald-500" : energy >= 35 ? "bg-amber-500" : "bg-rose-600";

  const order = useMutation({
    mutationFn: (productId: string) => mobileApi.order({ memberId, productId, quantity: 1 }),
    onSuccess: (res) => {
      toast.success(`${res.productName} commandé · ${res.amount} DT`);
      setBump((n) => n + 1);
      setNow(Date.now());
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["member-points", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!picks.length) return null;
  const cafe = player?.stats.cafeOrders ?? null;

  return (
    <section className="v-rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-3.5 py-3 shadow-sm ring-1 ring-orange-600/15 [animation-delay:60ms]">
      <div className="flex items-center gap-3.5">
        {/* Cup: steam, handle, liquid level = energy */}
        <div key={bump} className={cn("relative h-[92px] w-[78px] shrink-0", bump > 0 && "v-cup-bump")} aria-hidden>
          <span className="v-steam absolute left-5 top-0.5 h-[18px] w-1.5 rounded-full bg-slate-400/50" />
          <span className="v-steam absolute left-[31px] top-0 h-[22px] w-1.5 rounded-full bg-slate-400/50 [animation-delay:.6s]" />
          <span className="v-steam absolute left-[42px] top-1 h-4 w-1.5 rounded-full bg-slate-400/50 [animation-delay:1.2s]" />
          <span className="absolute right-0.5 top-[38px] h-[26px] w-[22px] rounded-r-[14px] border-[5px] border-l-0 border-orange-600" />
          <span className="absolute left-1 top-[26px] block h-[62px] w-14 overflow-hidden rounded-b-[22px] rounded-t-md border-4 border-orange-600 bg-white">
            <span
              className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-amber-700 to-amber-900 transition-[height] duration-700 ease-out motion-reduce:transition-none"
              style={{ height: `${energy}%` }}
            >
              <span className="v-liquid-wave absolute -left-1/2 -top-[5px] h-2.5 w-[200%] rounded-[45%] bg-amber-700" />
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-orange-800">
            <Zap className="h-3.5 w-3.5 fill-amber-400 text-orange-700" />
            Boost d’énergie
          </p>
          <p className="mt-0.5 text-lg font-black leading-tight text-slate-900">
            Énergie {Math.round(energy)} %
          </p>
          <p className="mt-0.5 text-xs text-orange-900">{energyCopy(energy, minutes)}</p>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-orange-600/15">
            <span
              className={cn("block h-full rounded-full transition-[width,background-color] duration-700 motion-reduce:transition-none", tone)}
              style={{ width: `${energy}%` }}
            />
          </span>
        </div>
      </div>

      <div className={cn("mt-3 grid gap-1.5", picks.length === 1 ? "grid-cols-1" : picks.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {picks.map((p, i) => {
          const busy = order.isPending && order.variables === p.id;
          const cold = /jus|juice|soda|cola|eau|water|smoothie|limonade|citronnade|milkshake|energy/i.test(p.name);
          return (
            <button
              key={p.id}
              type="button"
              disabled={order.isPending}
              onClick={() => order.mutate(p.id)}
              aria-label={`Commander ${p.name} · ${formatDt(p.sellingPrice)}`}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-extrabold transition-transform duration-150 active:scale-95 disabled:opacity-60 motion-reduce:transition-none",
                i === 0
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                  : "bg-white text-orange-900 ring-1 ring-orange-600/25"
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : cold ? (
                <CupSoda className="h-4 w-4 shrink-0" />
              ) : (
                <Coffee className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {cafe != null && cafe < 5 ? (
          <>
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-700 to-amber-500 text-white">
              <span aria-hidden className="v-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
              <Trophy className="relative h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between text-xs font-bold text-orange-900">
                <span>Trophée « Habitué café »</span>
                <span className="tabular-nums">{cafe}/5</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-orange-600/15">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-[width] duration-700 motion-reduce:transition-none"
                  style={{ width: `${(cafe / 5) * 100}%` }}
                />
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-xs text-orange-900">
            {isPwa ? "Chaque DT payé = 50 pts" : "Préparé par l’accueil, payé avec la session"}
          </span>
        )}
        <Link href={href("/cafe")} className="shrink-0 text-xs font-bold text-orange-800 hover:text-orange-950">
          Menu
        </Link>
      </div>
    </section>
  );
}
