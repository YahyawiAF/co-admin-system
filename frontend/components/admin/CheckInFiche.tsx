"use client";

import { format } from "date-fns";
import { Clock, LogIn, LogOut, Minus, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Price } from "@/lib/types";
import { formatTarifPrice } from "@/lib/tarif-labels";
import { UnpaidDebtBadge } from "@/components/admin/UnpaidDebtBadge";

export const SUB_TARIF = "__sub__";

export type FicheLine = {
  key: string;
  name: string;
  subtitle?: string | null;
  debt?: number;
  /** "hours" = hours-pool abonnement, "period" = period abonnement, null = none */
  subKind: "hours" | "period" | null;
  subName?: string | null;
  /** Price id shown in the tarif select ("" = none, SUB_TARIF = abonnement pointage) */
  tarifValue: string;
  pack: Price | null;
  hourly: boolean;
  hours: number;
  discountPercent: number;
  listAmount: number;
  amount: number;
  arrival: Date;
  leaveAt: Date | null;
  paid: boolean;
  usesSub: boolean;
};

export function CheckInFicheCard({
  line,
  packs,
  onTarif,
  onHours,
  onPaid,
  onRemove,
}: {
  line: FicheLine;
  packs: Price[];
  onTarif: (value: string) => void;
  onHours: (hours: number) => void;
  onPaid: (paid: boolean) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{line.name}</p>
          {line.subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{line.subtitle}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {line.subKind ? (
              <Badge className="h-5 bg-violet-600 px-1.5 text-[10px] hover:bg-violet-600">
                {line.subName || "Abonné"}
              </Badge>
            ) : null}
            {line.discountPercent > 0 && !line.usesSub ? (
              <Badge className="h-5 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600">
                −{line.discountPercent}%
              </Badge>
            ) : null}
            <UnpaidDebtBadge amount={line.debt} />
          </div>
        </div>
        {onRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onRemove}
            title="Retirer de la fiche"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {line.subKind === "hours" ? (
          <p className="rounded-md bg-violet-50 px-2 py-1.5 text-xs text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            Abonnement heures : pointage, temps décompté du solde.
          </p>
        ) : (
          <Select value={line.tarifValue || undefined} onValueChange={onTarif}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choisir un tarif" />
            </SelectTrigger>
            <SelectContent>
              {line.subKind === "period" ? (
                <SelectItem value={SUB_TARIF}>Abonnement (pointage)</SelectItem>
              ) : null}
              {packs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {formatTarifPrice(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border px-2 py-1.5">
            <p className="flex items-center gap-1 text-muted-foreground">
              <LogIn className="h-3 w-3" /> Arrivée
            </p>
            <p className="font-semibold tabular-nums">{format(line.arrival, "HH:mm")}</p>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <p className="flex items-center gap-1 text-muted-foreground">
              <LogOut className="h-3 w-3" /> Départ prévu
            </p>
            <p className="font-semibold tabular-nums">
              {line.leaveAt ? format(line.leaveAt, "HH:mm") : line.usesSub ? "—" : "Ouvert"}
            </p>
          </div>
        </div>

        {line.hourly && !line.usesSub ? (
          <div className="flex items-center justify-between rounded-md border px-2 py-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Heures prépayées
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={line.hours <= 0}
                onClick={() => onHours(Math.max(0, line.hours - 0.5))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-10 text-center text-xs font-semibold tabular-nums">
                {line.hours > 0 ? `${line.hours}h` : "—"}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onHours(line.hours + 0.5)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t pt-2">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={line.paid}
              disabled={line.usesSub}
              onCheckedChange={onPaid}
            />
            <span className={cn(line.paid ? "font-semibold text-emerald-700" : "text-muted-foreground")}>
              {line.usesSub ? "Couvert par l'abonnement" : line.paid ? "Payé" : "Non payé"}
            </span>
          </label>
          {!line.usesSub && line.pack ? (
            <span className="text-right tabular-nums">
              {line.discountPercent > 0 ? (
                <span className="mr-1 text-xs text-muted-foreground line-through">
                  {line.listAmount.toFixed(1)}
                </span>
              ) : null}
              <span className="font-bold">
                {line.hourly && line.hours <= 0 ? "au compteur" : `${line.amount.toFixed(1)} DT`}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
