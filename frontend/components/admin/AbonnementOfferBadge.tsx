"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AbonnementOffer } from "@/lib/types";

const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;

function periodLabel(days: number) {
  if (days === 7) return "la semaine";
  if (days === 14) return "2 semaines";
  if (days >= 28 && days <= 31) return "le mois";
  return `${days} jours`;
}

/** Desk hint: this visitor pays passes at an abonnement pace. */
export function AbonnementOfferBadge({
  offer,
  name,
}: {
  offer?: AbonnementOffer | null;
  name: string;
}) {
  if (!offer) return null;
  const save = offer.strength === "save";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
            save
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
          )}
        >
          <Sparkles className="h-3 w-3" />
          Proposer abonnement
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div>
          <div className="text-sm font-semibold">{offer.plan.name}</div>
          <div className="text-xs text-muted-foreground">
            {dt(offer.plan.price)} pour {periodLabel(offer.plan.periodDays)}, accès illimité
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md bg-muted p-2">
            <div className="text-[11px] text-muted-foreground">Payé en passes</div>
            <div className="text-sm font-semibold tabular-nums">{dt(offer.spend)}</div>
            <div className="text-[11px] text-muted-foreground">
              {offer.visitDays} jours en {offer.spanDays} j
            </div>
          </div>
          <div className="rounded-md bg-muted p-2">
            <div className="text-[11px] text-muted-foreground">
              À ce rythme sur {periodLabel(offer.plan.periodDays)}
            </div>
            <div className="text-sm font-semibold tabular-nums">{dt(offer.projectedSpend)}</div>
            <div
              className={cn(
                "text-[11px] font-medium",
                save ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {save
                ? `économise ${dt(offer.savings)}`
                : `abonnement +${dt(-offer.savings)}`}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {save
            ? `Dites à ${name.split(" ")[0]} : « Avec l'abonnement vous payez moins et vous venez autant que vous voulez. »`
            : `Presque le même prix que ses passes, sans compter les heures : un bon argument pour ${name.split(" ")[0]}.`}
        </p>
        <Button asChild size="sm" className="w-full">
          <Link
            href={`/abonnements?new=1&memberId=${offer.memberId}&priceId=${offer.plan.id}`}
          >
            Créer l&apos;abonnement
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
