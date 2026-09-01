"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlarmClock,
  Bell,
  CalendarClock,
  ChevronRight,
  CreditCard,
  TimerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Abonnement, Journal } from "@/lib/types";
import {
  isActiveVisit,
  isLeavingSoon,
  isOverstay,
  memberOf,
  remainingMs,
  visitorLabel,
} from "@/lib/journal-utils";
import {
  daysLeft,
  subscriptionExpiryLabel,
} from "@/lib/subscription-utils";
import { useJournalAlerts } from "@/lib/journal-alerts-context";
import { cn } from "@/lib/utils";

export type JournalAlertItem = {
  id: string;
  kind:
    | "session_ending"
    | "overstay"
    | "leaving_soon"
    | "sub_expiring"
    | "sub_today"
    | "sub_expired"
    | "reservation_tomorrow";
  title: string;
  detail: string;
  severity: "urgent" | "warning" | "info";
  journalId?: string;
  memberId?: string;
};

type BuildInput = {
  rows: Journal[];
  subByMember: Map<string, Abonnement>;
  tomorrowReservations: Journal[];
  now: number;
};

export function buildJournalAlerts({
  rows,
  subByMember,
  tomorrowReservations,
  now,
}: BuildInput): JournalAlertItem[] {
  const items: JournalAlertItem[] = [];
  const FIVE_MIN = 5 * 60_000;

  for (const row of rows) {
    if (!isActiveVisit(row)) continue;
    const name = memberOf(row)?.firstName || visitorLabel(row);
    const rem = remainingMs(row, now);

    if (rem != null && rem > 0 && rem <= FIVE_MIN) {
      items.push({
        id: `session-${row.id}`,
        kind: "session_ending",
        title: name,
        detail: "Moins de 5 min restantes sur la session",
        severity: "urgent",
        journalId: row.id,
        memberId: row.memberID || undefined,
      });
    }

    if (isOverstay(row, now)) {
      items.push({
        id: `overstay-${row.id}`,
        kind: "overstay",
        title: name,
        detail: "Session dépassée",
        severity: "urgent",
        journalId: row.id,
        memberId: row.memberID || undefined,
      });
    } else if (isLeavingSoon(row, now)) {
      items.push({
        id: `leaving-${row.id}`,
        kind: "leaving_soon",
        title: name,
        detail: "Départ dans moins de 30 min",
        severity: "warning",
        journalId: row.id,
        memberId: row.memberID || undefined,
      });
    }

    if (row.memberID) {
      const sub = subByMember.get(row.memberID);
      if (sub) {
        const left = daysLeft(sub);
        const label = subscriptionExpiryLabel(left);
        if (left != null && left < 0) {
          items.push({
            id: `sub-exp-${row.memberID}`,
            kind: "sub_expired",
            title: name,
            detail: `Abonnement expiré · ${sub.price?.name || "Abo"}`,
            severity: "urgent",
            journalId: row.id,
            memberId: row.memberID,
          });
        } else if (left === 0) {
          items.push({
            id: `sub-today-${row.memberID}`,
            kind: "sub_today",
            title: name,
            detail: `Abonnement expire aujourd'hui · ${sub.price?.name || "Abo"}`,
            severity: "urgent",
            journalId: row.id,
            memberId: row.memberID,
          });
        } else if (left != null && left <= 3) {
          items.push({
            id: `sub-warn-${row.memberID}`,
            kind: "sub_expiring",
            title: name,
            detail: `Abonnement · ${label} · ${sub.price?.name || "Abo"}`,
            severity: left <= 3 ? "warning" : "info",
            journalId: row.id,
            memberId: row.memberID,
          });
        }
      }
    }
  }

  for (const r of tomorrowReservations) {
    const name = memberOf(r)?.firstName || visitorLabel(r);
    const time = format(new Date(r.registredTime), "HH:mm", { locale: fr });
    items.push({
      id: `res-${r.id}`,
      kind: "reservation_tomorrow",
      title: name,
      detail: `Réservation demain à ${time}`,
      severity: "info",
      journalId: r.id,
      memberId: r.memberID || undefined,
    });
  }

  const order = { urgent: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

const KIND_LABEL: Record<JournalAlertItem["kind"], string> = {
  session_ending: "Fin imminente",
  overstay: "Dépassement",
  leaving_soon: "Bientôt parti",
  sub_expiring: "Abo bientôt fini",
  sub_today: "Abo expire aujourd'hui",
  sub_expired: "Abo expiré",
  reservation_tomorrow: "Demain",
};

function useJournalAlertData() {
  const { data } = useJournalAlerts();

  const alerts = useMemo(() => {
    if (!data) return [];
    return buildJournalAlerts(data);
  }, [data]);

  const counts = useMemo(() => {
    const session = alerts.filter((a) =>
      ["session_ending", "overstay", "leaving_soon"].includes(a.kind),
    ).length;
    const sub = alerts.filter((a) =>
      ["sub_expiring", "sub_today", "sub_expired"].includes(a.kind),
    ).length;
    const tomorrow = alerts.filter(
      (a) => a.kind === "reservation_tomorrow",
    ).length;
    return { session, sub, tomorrow, total: alerts.length };
  }, [alerts]);

  return { data, alerts, counts };
}

function AlertIcon({ kind }: { kind: JournalAlertItem["kind"] }) {
  if (kind === "overstay") {
    return <TimerOff className="h-4 w-4 text-amber-700" />;
  }
  if (kind === "session_ending" || kind === "leaving_soon") {
    return <AlarmClock className="h-4 w-4 text-sky-700" />;
  }
  if (kind.startsWith("sub")) {
    return <CreditCard className="h-4 w-4 text-violet-700" />;
  }
  return <CalendarClock className="h-4 w-4 text-violet-600" />;
}

function useHandleAlertItem() {
  const { data, actionsRef, setOpen } = useJournalAlerts();
  const rowById = useMemo(
    () => new Map(data?.rows.map((r) => [r.id, r]) ?? []),
    [data?.rows],
  );

  return (item: JournalAlertItem) => {
    const actions = actionsRef.current;
    if (item.kind === "overstay") {
      actions.onFilterOverstay?.();
      setOpen(false);
      return;
    }
    if (item.kind === "leaving_soon") {
      actions.onFilterLeavingSoon?.();
      setOpen(false);
      return;
    }
    if (item.kind === "reservation_tomorrow") {
      actions.onViewTomorrow?.();
      setOpen(false);
      return;
    }
    if (item.journalId) {
      const row = rowById.get(item.journalId);
      if (row) actions.onFocusRow?.(row);
      setOpen(false);
    }
  };
}

/** Icon button for AdminShell top nav (journal page only). */
export function JournalAlertNavBell() {
  const pathname = usePathname();
  const { open, setOpen, data } = useJournalAlerts();
  const { counts } = useJournalAlertData();

  if (!pathname.startsWith("/journal")) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative shrink-0"
        title="Alertes journal"
        onClick={() => setOpen(true)}
        disabled={!data}
      >
        <Bell className="h-5 w-5" />
        {counts.total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
            {counts.total > 9 ? "9+" : counts.total}
          </span>
        ) : null}
      </Button>
      <JournalAlertsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Compact strip under journal title — top urgent items. */
export function JournalAlertStrip() {
  const { setOpen } = useJournalAlerts();
  const { alerts, counts } = useJournalAlertData();
  const handleItem = useHandleAlertItem();

  if (!counts.total) return null;

  const preview = alerts.slice(0, 4);

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
          <Bell className="h-4 w-4" />
          Alertes
          <Badge variant="secondary" className="h-5">
            {counts.total}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-amber-900"
          onClick={() => setOpen(true)}
        >
          Tout voir
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {preview.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleItem(item)}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white/80 px-3 py-1 text-left text-xs transition-colors hover:bg-white dark:bg-background/80",
              item.severity === "urgent" && "border-rose-300",
              item.severity === "warning" && "border-amber-300",
            )}
          >
            <AlertIcon kind={item.kind} />
            <span className="truncate font-medium">{item.title}</span>
            <span className="hidden text-muted-foreground sm:inline">
              · {KIND_LABEL[item.kind]}
            </span>
          </button>
        ))}
        {counts.total > preview.length ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:bg-white/60"
          >
            +{counts.total - preview.length} autres
          </button>
        ) : null}
      </div>
    </div>
  );
}

function JournalAlertsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState("all");
  const { alerts, counts } = useJournalAlertData();
  const handleItem = useHandleAlertItem();

  const filtered = useMemo(() => {
    if (tab === "session") {
      return alerts.filter((a) =>
        ["session_ending", "overstay", "leaving_soon"].includes(a.kind),
      );
    }
    if (tab === "sub") {
      return alerts.filter((a) =>
        ["sub_expiring", "sub_today", "sub_expired"].includes(a.kind),
      );
    }
    if (tab === "tomorrow") {
      return alerts.filter((a) => a.kind === "reservation_tomorrow");
    }
    return alerts;
  }, [alerts, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Centre d&apos;alertes
            {counts.total > 0 ? (
              <Badge variant="secondary">{counts.total}</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-4">
            <TabsTrigger value="all" className="text-xs">
              Tout {counts.total || ""}
            </TabsTrigger>
            <TabsTrigger value="session" className="text-xs">
              Sessions {counts.session || ""}
            </TabsTrigger>
            <TabsTrigger value="sub" className="text-xs">
              Abos {counts.sub || ""}
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="text-xs">
              Demain {counts.tomorrow || ""}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!filtered.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune alerte pour ce filtre.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                        item.severity === "urgent" &&
                          "border-rose-200 bg-rose-50/50",
                        item.severity === "warning" &&
                          "border-amber-200 bg-amber-50/50",
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        <AlertIcon kind={item.kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {KIND_LABEL[item.kind]}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tabs>

        <div className="flex flex-wrap gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/abonnements">Abonnements</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
