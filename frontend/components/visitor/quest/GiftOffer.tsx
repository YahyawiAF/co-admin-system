"use client";

import { Check, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDt } from "@/lib/promo-price";
import type { Promotion } from "@/lib/types";

/**
 * Gift offered with a pass ("Café −50 % avec ce pass"): the client says Oui or Non.
 * Opens under the pass it belongs to.
 */
export function GiftOfferPanel({
  promo,
  answer,
  onAnswer,
  disabled,
}: {
  promo: Promotion;
  answer: boolean | undefined;
  onAnswer: (yes: boolean) => void;
  disabled?: boolean;
}) {
  const free = promo.priceAfter != null && promo.priceAfter <= 0;
  return (
    <div className="v-rise mt-2 space-y-3 rounded-[18px] bg-amber-50 p-3.5 ring-1 ring-inset ring-amber-300">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-amber-100 text-amber-700">
          {promo.itemImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promo.itemImg} alt="" className="h-full w-full object-cover" />
          ) : (
            <Coffee className="h-6 w-6" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-amber-950">
            {promo.itemName ?? "Cadeau"} {free ? "offert" : `à ${promo.label}`} avec ce pass
          </span>
          <span className="block text-xs text-amber-800">
            {promo.description?.trim() || "1 pendant votre visite"}
          </span>
        </span>
        {promo.priceBefore != null && promo.priceAfter != null ? (
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-[11px] text-amber-800 line-through">
              {formatDt(promo.priceBefore)} DT
            </span>
            <span className="text-base font-black text-amber-700">
              {free ? "0" : formatDt(promo.priceAfter)} DT
            </span>
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={answer === false}
          onClick={() => onAnswer(false)}
          className={cn(
            "h-11 rounded-full text-[13px] font-bold transition-colors duration-200 motion-reduce:transition-none",
            answer === false
              ? "bg-slate-700 text-white"
              : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200"
          )}
        >
          Non merci
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={answer === true}
          onClick={() => onAnswer(true)}
          className={cn(
            "flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold transition-colors duration-200 motion-reduce:transition-none",
            answer === true ? "bg-amber-700 text-white" : "bg-amber-600 text-white hover:bg-amber-700"
          )}
        >
          {answer === true ? <Check className="h-4 w-4" /> : null}
          Oui, je le prends
        </button>
      </div>
    </div>
  );
}

/** Collapsed answer under the pass, with a way to change it. */
export function GiftAnswerLine({
  promo,
  answer,
  onChange,
}: {
  promo: Promotion;
  answer: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="v-rise mt-1 block w-full rounded-xl px-3 py-1.5 text-left text-xs font-extrabold text-amber-800 transition-colors duration-200 hover:bg-amber-50 motion-reduce:transition-none"
    >
      {answer
        ? `+ ${promo.itemName ?? "Cadeau"} ${promo.label} inclus`
        : `${promo.itemName ?? "Cadeau"} refusé`}
      <span className="ml-1 font-semibold text-amber-700 underline">changer</span>
    </button>
  );
}
