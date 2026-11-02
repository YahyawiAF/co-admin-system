"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Coffee, CupSoda, Gift, Loader2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { isDrink } from "@/lib/drinks";
import { usePlayer } from "@/lib/hooks/use-player";
import { formatDt } from "@/lib/promo-price";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils";
import type { ProductOrder } from "@/lib/types";
import { QuestLabel, QuestSheet, type QuestTone } from "@/components/visitor/quest/QuestSheet";
import { useCafeDeals } from "@/components/visitor/cafe/use-cafe-deals";

const MIN = 60_000;
const COLD_RE = /jus|juice|soda|cola|eau|water|smoothie|limonade|citronnade|milkshake|energy/i;

type Drink = {
  id: string;
  name: string;
  description?: string | null;
  sellingPrice: number;
  stock: number;
  img?: string | null;
};

/** Photo of the drink, or a coloured tile with its icon when it has none. */
function DrinkPhoto({ drink, className }: { drink: Drink; className?: string }) {
  const cold = COLD_RE.test(drink.name);
  if (drink.img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={drink.img} alt={drink.name} loading="lazy" className={cn("w-full object-cover", className)} />;
  }
  const Icon = cold ? CupSoda : Coffee;
  return (
    <span
      className={cn(
        "flex w-full items-center justify-center",
        cold ? "bg-sky-50 text-sky-800" : "bg-orange-50 text-orange-800",
        className
      )}
    >
      <Icon className="h-8 w-8" aria-hidden />
    </span>
  );
}

function PriceLine({
  before,
  after,
  big,
}: {
  before: number;
  after: number;
  big?: boolean;
}) {
  const off = after < before - 0.0005;
  return (
    <span className="flex items-baseline gap-1.5 tabular-nums">
      {off ? (
        <span className={cn("text-slate-400 line-through", big ? "text-xs" : "text-[10px]")}>
          {formatDt(before)} DT
        </span>
      ) : null}
      <span className={cn("font-black", off ? "text-rose-700" : "text-slate-900", big ? "text-[15px]" : "text-xs")}>
        {after <= 0 ? "Offert" : `${formatDt(after)} DT`}
      </span>
    </span>
  );
}

type Phase = "pick" | "status";

const STATUS = {
  PENDING: {
    strip: "bg-amber-50 ring-amber-200 text-amber-800",
    dot: "bg-amber-500 motion-safe:animate-pulse",
    text: "En attente de l’accueil…",
  },
  CONFIRMED: {
    strip: "bg-emerald-50 ring-emerald-200 text-emerald-800",
    dot: "bg-emerald-500",
    text: "Acceptée · on vous l’apporte",
  },
  CANCELLED: {
    strip: "bg-rose-50 ring-rose-200 text-rose-800",
    dot: "bg-rose-500",
    text: "Refusée par l’accueil",
  },
} as const;

/**
 * Session "Choisissez votre boisson": favourite drinks as photos, the visit's gift
 * offer on top, a picker sheet, then the request status (sent → accepted / refused),
 * live from the reception's answer.
 */
export function DrinkPickerCard({ memberId, since }: { memberId: string; since: string }) {
  const { slug, href } = useOrg();
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const { player, isPwa } = usePlayer(memberId);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [picked, setPicked] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), MIN);
    return () => window.clearInterval(t);
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["mobile-products", slug],
    queryFn: () => mobileApi.products(slug),
    staleTime: 60_000,
  });
  const start = new Date(since).getTime();
  const { data: orders = [] } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId),
    staleTime: 20_000,
    // Socket first; this only catches a missed event while a request waits.
    refetchInterval: (q) =>
      (q.state.data ?? []).some(
        (o: ProductOrder) => o.status === "PENDING" && new Date(o.createdAt).getTime() >= start
      )
        ? 15_000
        : false,
  });
  const { voucherOf, vouchers, priceOf } = useCafeDeals(products);

  // Reception accepts / refuses → refresh the status right away
  useEffect(() => {
    if (!socket) return;
    const refresh = (payload?: { memberId?: string }) => {
      if (payload?.memberId && payload.memberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-vouchers"] });
    };
    socket.on("product_order", refresh);
    socket.on("product_order_confirmed", refresh);
    socket.on("table_updates", refresh);
    return () => {
      socket.off("product_order", refresh);
      socket.off("product_order_confirmed", refresh);
      socket.off("table_updates", refresh);
    };
  }, [socket, memberId, queryClient]);

  const drinks = useMemo(() => {
    const favorite = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      favorite.set(o.productName, (favorite.get(o.productName) ?? 0) + o.quantity);
    }
    return products
      // Drinks, plus anything the visit's gift covers (a croissant offered with the pass…)
      .filter((p) => p.stock > 0 && (isDrink(p.name, p.description) || voucherOf.has(p.id)))
      .sort(
        (a, b) =>
          Number(voucherOf.has(b.id)) - Number(voucherOf.has(a.id)) ||
          (favorite.get(b.name) ?? 0) - (favorite.get(a.name) ?? 0) ||
          a.sellingPrice - b.sellingPrice
      );
  }, [products, orders, voucherOf]);

  const gift = vouchers.find((v) => v.status === "ACCEPTED" && drinks.some((d) => voucherOf.has(d.id)));
  const giftOnDrinks = drinks.filter((d) => voucherOf.has(d.id)).every((d) => isDrink(d.name, d.description));
  const giftWhat = giftOnDrinks ? "une boisson" : "un produit";
  const sessionOrders = orders
    .filter((o) => new Date(o.createdAt).getTime() >= (Number.isNaN(start) ? 0 : start))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = sessionOrders[0] ?? null;
  const tracked = (trackId && orders.find((o) => o.id === trackId)) || latest;

  const lastDrinkAt = sessionOrders.find((o) => o.status !== "CANCELLED")?.createdAt;
  const refAt = lastDrinkAt ? new Date(lastDrinkAt).getTime() : Number.isNaN(start) ? now : start;
  const minutes = Math.max(0, Math.round((now - refAt) / MIN));
  const pause =
    minutes < 20
      ? "Bonne pause !"
      : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} sans pause`;

  const order = useMutation({
    mutationFn: (productId: string) => mobileApi.order({ memberId, productId, quantity: 1 }),
    onSuccess: (res) => {
      setTrackId(res.id);
      setPhase("status");
      queryClient.setQueryData<ProductOrder[]>(["mobile-orders", memberId], (cur) => [
        res,
        ...(cur ?? []).filter((o) => o.id !== res.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["member-points", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!drinks.length) return null;
  const top = drinks.slice(0, 3);
  const pickedDrink = drinks.find((d) => d.id === picked) ?? null;
  const cafe = player?.stats.cafeOrders ?? null;

  const openPicker = (id?: string) => {
    setPicked(id ?? picked ?? drinks[0]?.id ?? null);
    setPhase("pick");
    setOpen(true);
  };
  const openStatus = () => {
    setTrackId(latest?.id ?? null);
    setPhase("status");
    setOpen(true);
  };

  const st = tracked ? STATUS[tracked.status] : null;
  const sheet: { tone: QuestTone; eyebrow: string; title: string; subtitle: string } =
    phase === "pick"
      ? gift
        ? {
            tone: "gold",
            eyebrow: "Votre cadeau · avec votre pass",
            title: "Choisissez votre boisson",
            subtitle: `${gift.label} sur ${giftWhat} au choix, servi à votre place.`,
          }
        : {
            tone: "brand",
            eyebrow: "Pause café",
            title: "Choisissez votre boisson",
            subtitle: "Servie à votre place, payée avec la session.",
          }
      : tracked?.status === "CONFIRMED"
        ? {
            tone: "emerald",
            eyebrow: "Demande acceptée",
            title: "C’est en préparation !",
            subtitle: "L’accueil vous l’apporte dans quelques minutes.",
          }
        : tracked?.status === "CANCELLED"
          ? {
              tone: "rose",
              eyebrow: "Demande refusée",
              title: "Pas disponible pour le moment",
              subtitle: gift
                ? "Votre cadeau reste valable : choisissez une autre boisson."
                : "Rien n’est facturé. Choisissez une autre boisson.",
            }
          : {
              tone: "brand",
              eyebrow: "Demande envoyée",
              title: "L’accueil a reçu votre demande",
              subtitle: "Vous êtes prévenu ici dès qu’elle est acceptée.",
            };

  const steps = tracked
    ? [
        {
          title: "Demande envoyée",
          sub: `${format(new Date(tracked.createdAt), "HH:mm")} · ${tracked.productName}`,
          state: "done" as const,
        },
        tracked.status === "PENDING"
          ? { title: "En attente de l’accueil", sub: "Généralement moins de 2 min", state: "wait" as const }
          : { title: "Vue par l’accueil", sub: "Réponse reçue", state: "done" as const },
        tracked.status === "CONFIRMED"
          ? { title: "Acceptée · on vous l’apporte", sub: "Payée avec la session", state: "ok" as const }
          : tracked.status === "CANCELLED"
            ? { title: "Refusée", sub: "Rien n’est facturé", state: "no" as const }
            : { title: "Acceptée ou refusée", sub: "La réponse s’affiche ici", state: "todo" as const },
      ]
    : [];

  return (
    <section className="v-rise rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5 [animation-delay:60ms]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">Pause café</p>
          <p className="mt-0.5 text-[19px] font-black leading-tight text-slate-900">Choisissez votre boisson</p>
          <p className="mt-0.5 text-xs text-slate-600">{pause} · servie à votre place</p>
        </div>
        <Link
          href={href("/cafe")}
          className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 transition-colors duration-200 hover:bg-slate-200 motion-reduce:transition-none"
        >
          Menu
        </Link>
      </div>

      {gift ? (
        <button
          type="button"
          onClick={() => openPicker()}
          className="v-rise mt-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-100 to-amber-200 px-2.5 py-2 text-left transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-amber-500 text-white shadow-[0_0_0_4px_rgba(245,158,11,0.25)] motion-safe:animate-pulse">
            <Gift className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-amber-950">
              Votre cadeau : {gift.label} sur {giftWhat}
            </span>
            <span className="block truncate text-[11px] text-amber-900">
              {gift.productName ?? "Au choix"} · avec votre pass
            </span>
          </span>
        </button>
      ) : null}

      <div className={cn("mt-2.5 grid gap-2", top.length === 1 ? "grid-cols-1" : top.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {top.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => openPicker(d.id)}
            style={{ animationDelay: `${80 + i * 50}ms` }}
            className="v-rise relative overflow-hidden rounded-[18px] bg-white text-left ring-1 ring-slate-900/10 transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
          >
            <DrinkPhoto drink={d} className="h-[78px]" />
            <span className="block px-2 pb-2 pt-1.5">
              <span className="block truncate text-xs font-extrabold text-slate-900">{d.name}</span>
              <PriceLine before={d.sellingPrice} after={priceOf(d)} />
            </span>
            {voucherOf.has(d.id) ? (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                {voucherOf.get(d.id)!.label}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {latest && st ? (
        <button
          key={`${latest.id}-${latest.status}`}
          type="button"
          onClick={openStatus}
          className={cn(
            "v-rise mt-2.5 flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left ring-1 transition-colors duration-300 motion-reduce:transition-none",
            STATUS[latest.status].strip
          )}
        >
          {latest.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latest.img} alt="" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/70">
              <Coffee className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold text-slate-900">{latest.productName}</span>
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS[latest.status].dot)} />
              {STATUS[latest.status].text}
            </span>
          </span>
          <span className="text-xs font-extrabold text-slate-600">Voir</span>
        </button>
      ) : null}

      {cafe != null && cafe < 5 ? (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-700 to-amber-500 text-white">
            <Trophy className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex justify-between text-xs font-bold text-amber-900">
              <span>Trophée « Habitué café »</span>
              <span className="tabular-nums">{cafe}/5</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-amber-600/15">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${(cafe / 5) * 100}%` }}
              />
            </span>
          </span>
        </div>
      ) : isPwa ? (
        <p className="mt-2 text-center text-[11px] text-slate-500">Chaque DT payé = 50 pts</p>
      ) : null}

      <QuestSheet
        open={open}
        onOpenChange={setOpen}
        tone={sheet.tone}
        eyebrow={sheet.eyebrow}
        title={sheet.title}
        subtitle={sheet.subtitle}
        footer={
          phase === "pick" ? (
            <div className="space-y-1.5">
              <button
                type="button"
                disabled={!pickedDrink || order.isPending}
                onClick={() => pickedDrink && order.mutate(pickedDrink.id)}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-[15px] font-black text-white shadow-lg shadow-indigo-600/30 transition-[transform,background-color] duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none"
              >
                {order.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pickedDrink
                  ? `Envoyer ma demande · ${pickedDrink.name} ${priceOf(pickedDrink) <= 0 ? "offert" : `${formatDt(priceOf(pickedDrink))} DT`}`
                  : "Choisissez une boisson"}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                L’accueil confirme puis vous l’apporte · payé avec la session
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (tracked?.status === "CANCELLED" ? setPhase("pick") : setOpen(false))}
              className={cn(
                "flex h-[50px] w-full items-center justify-center rounded-full text-[15px] font-black transition-colors duration-200 active:scale-[0.98] motion-reduce:transition-none",
                tracked?.status === "CANCELLED"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : tracked?.status === "CONFIRMED"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {tracked?.status === "CANCELLED"
                ? "Choisir une autre boisson"
                : tracked?.status === "CONFIRMED"
                  ? "Parfait"
                  : "Fermer · je serai prévenu"}
            </button>
          )
        }
      >
        {phase === "pick" ? (
          <div key="pick" className="grid grid-cols-2 gap-2.5 pb-1">
            {drinks.map((d, i) => {
              const on = picked === d.id;
              const g = voucherOf.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(d.id)}
                  style={{ animationDelay: `${Math.min(i * 35, 240)}ms` }}
                  className={cn(
                    "v-rise relative overflow-hidden rounded-[20px] bg-white text-left transition-shadow duration-200 active:scale-[0.98] motion-reduce:transition-none",
                    on ? "shadow-lg shadow-indigo-600/20 ring-[3px] ring-indigo-600" : "ring-1 ring-slate-900/10"
                  )}
                >
                  <DrinkPhoto drink={d} className="h-24" />
                  <span className="block px-2.5 pb-2.5 pt-2">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{d.name}</span>
                    <PriceLine before={d.sellingPrice} after={priceOf(d)} big />
                  </span>
                  {g ? (
                    <span className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-[0_0_0_3px_rgba(251,191,36,0.3)]">
                      Cadeau
                    </span>
                  ) : null}
                  {on ? (
                    <span className="absolute left-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-indigo-600 text-white shadow-md animate-in zoom-in-50 duration-200 motion-reduce:animate-none">
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : tracked ? (
          <div key="status" className="v-rise space-y-4 pb-1">
            <div className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-2.5">
              {tracked.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tracked.img} alt="" className="h-14 w-14 shrink-0 rounded-[14px] object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-800">
                  <Coffee className="h-6 w-6" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-black text-slate-900">{tracked.productName}</span>
                <span className="block text-[13px] tabular-nums text-slate-600">
                  {tracked.quantity > 1 ? `${tracked.quantity} × · ` : ""}
                  {tracked.amount <= 0 ? "Offert" : `${formatDt(tracked.amount)} DT`}
                </span>
              </span>
            </div>
            <div>
              <QuestLabel>Suivi</QuestLabel>
              <ol>
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex w-7 flex-col items-center">
                      <span
                        key={s.state}
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-300",
                          s.state === "done" && "bg-indigo-600",
                          s.state === "wait" && "bg-amber-500 motion-safe:animate-pulse",
                          s.state === "ok" && "bg-emerald-600 animate-in zoom-in-50 duration-300",
                          s.state === "no" && "bg-rose-600 animate-in zoom-in-50 duration-300",
                          s.state === "todo" && "bg-slate-200"
                        )}
                      >
                        {s.state === "done" || s.state === "ok" ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                        ) : s.state === "no" ? (
                          <X className="h-3.5 w-3.5" strokeWidth={3.5} />
                        ) : null}
                      </span>
                      {i < steps.length - 1 ? (
                        <span
                          className={cn(
                            "min-h-[14px] w-0.5 flex-1 transition-colors duration-300",
                            steps[i + 1].state === "todo" || steps[i + 1].state === "wait"
                              ? "bg-slate-200"
                              : steps[i + 1].state === "ok"
                                ? "bg-emerald-600"
                                : steps[i + 1].state === "no"
                                  ? "bg-rose-600"
                                  : "bg-indigo-600"
                          )}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 pb-3.5 pt-0.5">
                      <span
                        className={cn(
                          "block text-sm font-extrabold",
                          s.state === "wait" && "text-amber-700",
                          s.state === "ok" && "text-emerald-700",
                          s.state === "no" && "text-rose-700",
                          s.state === "todo" && "font-bold text-slate-400",
                          s.state === "done" && "text-slate-900"
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="block text-xs text-slate-500">{s.sub}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </QuestSheet>
    </section>
  );
}
