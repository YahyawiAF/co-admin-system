"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MapPin, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Abonnement } from "@/lib/types";
import {
  daysLeft,
  hoursLeft,
  isActiveSub,
  splitMemberSubscriptions,
  subscriptionExpiryLabel,
} from "@/lib/subscription-utils";
import { cn } from "@/lib/utils";

type Props = {
  memberId: string;
  memberName: string;
  abonnements: Abonnement[];
  onEdit?: (a: Abonnement) => void;
  onViewSeat?: (seatLabel: string, spaceId?: string | null) => void;
  compact?: boolean;
};

function SubCard({
  a,
  current,
  onEdit,
  onViewSeat,
}: {
  a: Abonnement;
  current: boolean;
  onEdit?: (a: Abonnement) => void;
  onViewSeat?: (seatLabel: string, spaceId?: string | null) => void;
}) {
  const left = daysLeft(a);
  const hLeft = hoursLeft(a);
  const expiry = subscriptionExpiryLabel(left);

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        current
          ? "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30"
          : "border-dashed bg-muted/30 opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold">{a.price?.name || "Abonnement"}</p>
            {current ? (
              <Badge className="h-5 bg-violet-600 text-[10px] hover:bg-violet-600">
                Actuel
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 text-[10px]">
                Terminé
              </Badge>
            )}
            {!a.isPayed ? (
              <Badge variant="destructive" className="h-5 text-[10px]">
                Impayé
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(a.registredDate), "dd MMM yyyy", { locale: fr })}
            {a.leaveDate
              ? ` → ${format(new Date(a.leaveDate), "dd MMM yyyy", { locale: fr })}`
              : ""}
          </p>
        </div>
        <div className="text-right text-xs">
          {current && expiry ? (
            <Badge
              variant={
                left != null && left <= 3
                  ? "destructive"
                  : left != null && left <= 7
                    ? "secondary"
                    : "outline"
              }
              className="text-[10px]"
            >
              {expiry}
            </Badge>
          ) : null}
          {hLeft != null ? (
            <p className="mt-1 text-muted-foreground">{hLeft}h restantes</p>
          ) : null}
          <p className="mt-1 font-medium">{a.payedAmount} DT</p>
        </div>
      </div>
      {a.reservedSeatLabel ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>
            Place{" "}
            <strong className="text-foreground">{a.reservedSeatLabel}</strong>
          </span>
          {current && onViewSeat ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() =>
                onViewSeat(a.reservedSeatLabel!, a.reservedSeatSpaceId)
              }
            >
              Voir sur le plan
            </Button>
          ) : null}
        </div>
      ) : null}
      {onEdit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 gap-1 text-xs"
          onClick={() => onEdit(a)}
        >
          <Pencil className="h-3 w-3" />
          Modifier
        </Button>
      ) : null}
    </div>
  );
}

export function SubscriptionMemberPanel({
  memberId,
  memberName,
  abonnements,
  onEdit,
  onViewSeat,
  compact,
}: Props) {
  const { current, history } = splitMemberSubscriptions(abonnements, memberId);

  if (!current && !history.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun abonnement pour {memberName}.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {current ? (
        <div>
          {!compact ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Abonnement actuel
            </p>
          ) : null}
          <SubCard
            a={current}
            current
            onEdit={onEdit}
            onViewSeat={onViewSeat}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Pas d&apos;abonnement actif.
        </p>
      )}
      {history.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historique ({history.length})
          </p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {history.map((a) => (
              <SubCard key={a.id} a={a} current={false} onEdit={onEdit} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function subscriptionSummaryLine(a: Abonnement | null | undefined) {
  if (!a || !isActiveSub(a)) return null;
  const left = daysLeft(a);
  const parts = [a.price?.name || "Abonnement"];
  if (a.reservedSeatLabel) parts.push(`place ${a.reservedSeatLabel}`);
  const expiry = subscriptionExpiryLabel(left);
  if (expiry) parts.push(expiry);
  return parts.join(" · ");
}
