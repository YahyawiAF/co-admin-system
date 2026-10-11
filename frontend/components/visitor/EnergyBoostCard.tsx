"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { dtToPoints } from "@/lib/points-catalog";
import { isStandalonePwa } from "@/lib/visitor-notify";
import { isDrink } from "@/lib/drinks";
import { cn } from "@/lib/utils";

const MIN = 60_000;
/** Next suggestion this long after the last order or "Plus tard". */
const AGAIN_AFTER_MIN = 120;
/** Start of the session: "we have drinks" welcome wording. */
const WELCOME_MIN = 45;

const dismissKey = (memberId: string) => `energy-boost-dismissed:${memberId}`;

function pitch(hour: number, minutesIn: number) {
  if (minutesIn < WELCOME_MIN) {
    return {
      title: "Bienvenue ! On a des boissons",
      text:
        hour < 11
          ? "Un café pour bien démarrer ? Commandez ici, l'accueil vous le prépare."
          : "Café, thé, jus… commandez ici, l'accueil vous le prépare.",
    };
  }
  const worked =
    minutesIn >= 120 ? `${Math.floor(minutesIn / 60)}h de travail` : null;
  if (hour < 11) {
    return {
      title: "Bien lancer la matinée",
      text: worked
        ? `Déjà ${worked} : un café pour garder le rythme ?`
        : "Un café pour démarrer au top ?",
    };
  }
  if (hour >= 14 && hour < 17) {
    return {
      title: "Le coup de barre de l'après-midi ?",
      text: worked
        ? `${worked} au compteur : une boisson pour recharger les batteries.`
        : "Une boisson pour recharger les batteries et rester concentré.",
    };
  }
  if (hour >= 17) {
    return {
      title: "Dernière ligne droite",
      text: "Un thé ou un jus pour finir la journée en forme ?",
    };
  }
  return {
    title: "Petite pause énergie",
    text: worked
      ? `${worked} sans pause : une boisson, ça fait du bien.`
      : "Une boisson pour garder votre énergie ?",
  };
}

type Props = {
  memberId: string;
  /** Session start (ISO) */
  since: string;
};

/**
 * During a session: shows the drinks as soon as it starts, then again every
 * couple of hours (after an order or "Plus tard"), with one-tap order.
 */
export function EnergyBoostCard({ memberId, since }: Props) {
  const { slug, href } = useOrg();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [dismissedAt, setDismissedAt] = useState<number>(0);
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(isStandalonePwa());
    const raw = window.localStorage.getItem(dismissKey(memberId));
    setDismissedAt(raw ? Number(raw) || 0 : 0);
    const t = window.setInterval(() => setNow(Date.now()), 5 * MIN);
    return () => window.clearInterval(t);
  }, [memberId]);

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
    const inStock = products.filter((p) => p.stock > 0);
    const drinks = inStock.filter((p) => isDrink(p.name, p.description));
    return (drinks.length ? drinks : inStock)
      .sort(
        (a, b) =>
          (favorite.get(b.name) ?? 0) - (favorite.get(a.name) ?? 0) ||
          a.sellingPrice - b.sellingPrice
      )
      .slice(0, 3);
  }, [products, orders]);

  const order = useMutation({
    mutationFn: (productId: string) =>
      mobileApi.order({ memberId, productId, quantity: 1 }),
    onSuccess: (res) => {
      toast.success(`${res.productName} commandé · ${res.amount} DT`);
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = new Date(since).getTime();
  const lastOrderAt = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((t, o) => Math.max(t, new Date(o.createdAt).getTime()), 0);
  const pendingOrder = orders.some((o) => o.status === "PENDING");
  const minutesIn = Math.max(0, Math.round((now - start) / MIN));
  const quietSince = Math.max(lastOrderAt, dismissedAt) > start
    ? Math.max(lastOrderAt, dismissedAt)
    : 0;

  const due =
    !Number.isNaN(start) &&
    (!quietSince || now - quietSince >= AGAIN_AFTER_MIN * MIN) &&
    !pendingOrder;

  if (!due || !picks.length) return null;

  const { title, text } = pitch(new Date(now).getHours(), minutesIn);

  const dismiss = () => {
    const t = Date.now();
    window.localStorage.setItem(dismissKey(memberId), String(t));
    setDismissedAt(t);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 shadow-sm">
      <button
        type="button"
        aria-label="Plus tard"
        className="absolute right-3 top-3 rounded-full p-1 text-orange-700/60 hover:bg-white/70"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 pr-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
          <Zap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-slate-900">{title}</p>
          <p className="text-xs text-slate-600">{text}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {picks.map((p) => {
          const busy = order.isPending && order.variables === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={order.isPending}
              onClick={() => order.mutate(p.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl bg-white/90 p-2 text-left shadow-sm transition active:scale-[0.99]",
                order.isPending && !busy && "opacity-60"
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-100 text-orange-600">
                {p.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.img} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Coffee className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block text-xs text-slate-500">
                  {p.sellingPrice.toFixed(1)} DT
                  {isApp && dtToPoints(p.sellingPrice) > 0
                    ? ` · +${dtToPoints(p.sellingPrice)} pts`
                    : ""}
                </span>
              </span>
              <span className="flex h-8 shrink-0 items-center rounded-full bg-orange-500 px-3 text-xs font-semibold text-white">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Commander"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <Link href={href("/cafe")} className="font-medium text-orange-700 underline-offset-2 hover:underline">
          Voir tout le menu
        </Link>
        <button type="button" className="text-slate-500" onClick={dismiss}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
