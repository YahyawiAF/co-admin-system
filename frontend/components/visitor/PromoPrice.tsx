"use client";

import { cn } from "@/lib/utils";
import { formatDt } from "@/lib/promo-price";

type Props = {
  original: number;
  final: number;
  /** Show promo only when final < original */
  hasPromo?: boolean;
  suffix?: string;
  align?: "start" | "end" | "center";
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * E-commerce style: struck original + promo price when discounted.
 */
export function PromoPrice({
  original,
  final,
  hasPromo,
  suffix = "DT",
  align = "end",
  size = "md",
  className,
}: Props) {
  const discounted =
    hasPromo ?? final < original - 0.001;

  const alignCls =
    align === "center"
      ? "items-center text-center"
      : align === "start"
        ? "items-start text-left"
        : "items-end text-right";

  const finalCls =
    size === "lg"
      ? "text-2xl font-bold text-indigo-600"
      : size === "sm"
        ? "text-sm font-bold text-indigo-600"
        : "text-base font-bold text-indigo-600";

  const struckCls =
    size === "lg"
      ? "text-sm text-slate-400 line-through"
      : size === "sm"
        ? "text-[11px] text-slate-400 line-through"
        : "text-xs text-slate-400 line-through";

  if (!discounted) {
    return (
      <span
        className={cn(
          size === "lg"
            ? "text-2xl font-bold text-indigo-600"
            : size === "sm"
              ? "text-sm font-bold text-indigo-600"
              : "font-bold text-indigo-600",
          className
        )}
      >
        {formatDt(original)} {suffix}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex flex-col gap-0.5", alignCls, className)}
    >
      <span className={struckCls}>
        {formatDt(original)} {suffix}
      </span>
      <span className={finalCls}>
        {formatDt(final)} {suffix}
      </span>
    </span>
  );
}
