"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import { readLocalCache, writeLocalCache } from "@/lib/visitor-local-cache";
import {
  disableDrinkOffer,
  drinkOfferSeen,
  markDrinkOfferSeen,
} from "@/lib/visitorCache";

const DELAY_MS = 2 * 60_000;
const COUNT = 3;

function isDrink(name: string, desc?: string | null) {
  const t = `${name} ${desc || ""}`.toLowerCase();
  return /caf|coffee|espresso|cappuc|latte|thé|tea|boisson|jus|juice|eau|water|soda|limonade|citronnade|smoothie|chocolat|mojito|milkshake|frapp/.test(
    t
  );
}

function pickRandom<T>(list: T[], n: number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/**
 * Gentle "envie d'un café ?" 2 min into the session — once per session.
 * Nothing pre-selected, "Non merci" as big as ordering, opt-out for good.
 */
export function DrinkOfferSheet({
  memberId,
  sessionId,
  sessionStart,
  blocked,
}: {
  memberId: string;
  sessionId: string;
  sessionStart: number;
  /** Another sheet (tarif, checkout…) is up: wait for it. */
  blocked: boolean;
}) {
  const { slug, href } = useOrg();
  const queryClient = useQueryClient();
  const [due, setDue] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    setDue(false);
    if (drinkOfferSeen(slug, sessionId)) return;
    const t = setTimeout(
      () => setDue(true),
      Math.max(0, sessionStart + DELAY_MS - Date.now())
    );
    return () => clearTimeout(t);
  }, [slug, sessionId, sessionStart]);

  const { data: products = [] } = useQuery({
    queryKey: ["mobile-products", slug],
    queryFn: async () => {
      const data = await mobileApi.products(slug);
      writeLocalCache("products", data, slug);
      return data;
    },
    enabled: due,
    staleTime: 60_000,
    placeholderData: () => readLocalCache("products", slug) ?? undefined,
  });
  const { data: orders, isFetched: ordersFetched } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId),
    enabled: due,
    staleTime: 20_000,
  });

  // Drawn once when it becomes due, so the list doesn't reshuffle on refetch
  const [drinks, setDrinks] = useState<typeof products>([]);
  useEffect(() => {
    if (!due || drinks.length || !products.length) return;
    const inStock = products.filter((p) => p.stock > 0);
    const pool = inStock.filter((p) => isDrink(p.name, p.description));
    setDrinks(pickRandom(pool.length ? pool : inStock, COUNT));
  }, [due, products, drinks.length]);

  const orderedThisVisit = (orders ?? []).some(
    (o) =>
      o.status !== "CANCELLED" &&
      new Date(o.createdAt).getTime() >= sessionStart
  );

  useEffect(() => {
    if (!due || blocked || open || !ordersFetched || !drinks.length) return;
    if (drinkOfferSeen(slug, sessionId)) return;
    if (orderedThisVisit) {
      markDrinkOfferSeen(slug, sessionId);
      return;
    }
    setPicked(null);
    setOpen(true);
  }, [due, blocked, open, ordersFetched, drinks.length, orderedThisVisit, slug, sessionId]);

  const close = () => {
    setOpen(false);
    setDue(false);
    markDrinkOfferSeen(slug, sessionId);
  };

  const order = useMutation({
    mutationFn: (productId: string) =>
      mobileApi.order({ memberId, productId, quantity: 1 }),
    onSuccess: (res) => {
      toast.success(`Commande envoyée : ${res.productName} ☕`);
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const choice = drinks.find((d) => d.id === picked) ?? null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      dismissible={!order.isPending}
      title={
        <span className="inline-flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-600" />
          Envie d&apos;une boisson ?
        </span>
      }
      description="Si ça vous dit — on vous l'apporte, sinon aucun souci."
      footer={
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={order.isPending}
              onClick={close}
              className="h-12 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-60"
            >
              Non merci
            </button>
            <button
              type="button"
              disabled={!choice || order.isPending}
              onClick={() => choice && order.mutate(choice.id)}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
            >
              {order.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {choice
                ? `Commander · ${choice.sellingPrice.toFixed(2)} DT`
                : "Choisissez"}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <Link
              href={href("/cafe")}
              onClick={close}
              className="font-medium text-indigo-600"
            >
              Voir la carte
            </Link>
            <button
              type="button"
              disabled={order.isPending}
              onClick={() => {
                disableDrinkOffer(slug);
                close();
              }}
              className="text-slate-400 underline-offset-2 hover:underline"
            >
              Ne plus me proposer
            </button>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {drinks.map((d) => {
          const selected = picked === d.id;
          return (
            <button
              key={d.id}
              type="button"
              disabled={order.isPending}
              aria-pressed={selected}
              onClick={() => setPicked(selected ? null : d.id)}
              className={cn(
                "overflow-hidden rounded-2xl text-left ring-1 transition active:scale-95",
                selected
                  ? "ring-2 ring-indigo-600 shadow-md"
                  : "ring-slate-200"
              )}
            >
              <div className="aspect-square bg-slate-100">
                {d.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.img} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <Coffee className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-[12px] font-semibold text-slate-900">
                  {d.name}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    selected ? "text-indigo-600" : "text-slate-500"
                  )}
                >
                  {d.sellingPrice.toFixed(2)} DT
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
