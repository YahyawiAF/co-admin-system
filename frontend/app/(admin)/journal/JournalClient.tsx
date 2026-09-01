"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import Fuse from "fuse.js";
import {
  AlarmClock,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Pencil,
  Printer,
  Share2,
  TimerOff,
  Trash2,
  Wallet,
  X,
  Coffee,
  UserRound,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { QuickCheckInPanel } from "@/components/admin/QuickCheckInPanel";
import { SeatOccupancyBoard } from "@/components/admin/SeatOccupancyBoard";
import { ReservationPanel } from "@/components/admin/ReservationPanel";
import { JournalAlertStrip } from "@/components/admin/JournalAlertCenter";
import { JournalReceptionToggles } from "@/components/admin/JournalReceptionToggles";
import { UnpaidDebtBadge } from "@/components/admin/UnpaidDebtBadge";
import { JournalEditSheet } from "@/components/admin/JournalEditSheet";
import { AssignSeatDialog } from "@/components/admin/AssignSeatDialog";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";
import { MemberLedgerDialog } from "@/components/admin/MemberLedgerDialog";
import { JournalCommandesRail } from "@/components/admin/JournalCommandesRail";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import {
  abonnementsApi,
  bookingApi,
  dailyProductsApi,
  facilityApi,
  journalApi,
  membersApi,
  mobileApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  isActiveVisit,
  isLeavingSoon,
  isOverstay,
  isPendingReservation,
  memberOf,
  priceOf,
  remainingMs,
  formatDurationHm,
  visitAmountDue,
  visitStatus,
  visitorLabel,
  isAnonymousVisit,
  groupOf,
  groupJournalByPerson,
  isAbonnementVisit,
} from "@/lib/journal-utils";
import {
  buildDayWhatsAppText,
  openDayPrintView,
} from "@/lib/journal-export";
import type { Abonnement, Journal, Member } from "@/lib/types";
import {
  activeSubByMember,
  daysLeft,
  paidSubscriptionRevenueOnDay,
} from "@/lib/subscription-utils";
import { useJournalAlertsDataEffect, useJournalAlerts } from "@/lib/journal-alerts-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type QuickFilter = "all" | "overstay" | "leaving_soon" | "first_out" | "unpaid_present";

export default function JournalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const dateParam = searchParams.get("date");
  const selectedDate = useMemo(() => {
    if (dateParam) {
      try {
        return parseISO(dateParam);
      } catch {
        return new Date();
      }
    }
    return new Date();
  }, [dateParam]);

  const setDate = (d: Date) => {
    router.push(`/journal?date=${format(d, "yyyy-MM-dd")}`);
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editRow, setEditRow] = useState<Journal | null>(null);
  const [seatRow, setSeatRow] = useState<Journal | null>(null);
  const [occupancyOpen, setOccupancyOpen] = useState(false);
  const [focusSeatLabel, setFocusSeatLabel] = useState<string | null>(null);
  const [focusSpaceId, setFocusSpaceId] = useState<string | null>(null);
  const [identityRow, setIdentityRow] = useState<Journal | null>(null);
  const [identityMode, setIdentityMode] = useState<"link" | "create">("link");
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [linkMemberId, setLinkMemberId] = useState("");
  const [promoteForm, setPromoteForm] = useState({
    firstName: "",
    phone: "",
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Clear selection when date or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDate, statusFilter, typeFilter, personFilter, payFilter, quickFilter, search]);

  const tomorrow = useMemo(() => addDays(startOfDay(new Date()), 1), []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.journal(selectedDate),
    queryFn: () =>
      journalApi.list({ journalDate: selectedDate, perPage: 100 }),
  });

  const { data: tomorrowPage } = useQuery({
    queryKey: queryKeys.journal(tomorrow),
    queryFn: () => journalApi.list({ journalDate: tomorrow, perPage: 100 }),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });

  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
    refetchInterval: 15_000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });

  const { data: dailyProducts = [] } = useQuery({
    queryKey: ["daily-products"],
    queryFn: () => dailyProductsApi.list(),
    refetchInterval: 20_000,
  });

  const { data: membersRaw } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
  });
  const { data: abonnementsRaw } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: () => abonnementsApi.list(),
    refetchInterval: 60_000,
  });
  const abonnements = useMemo((): Abonnement[] => {
    if (!abonnementsRaw) return [];
    return Array.isArray(abonnementsRaw)
      ? abonnementsRaw
      : abonnementsRaw.data || [];
  }, [abonnementsRaw]);
  const subByMember = useMemo(
    () => activeSubByMember(abonnements),
    [abonnements],
  );
  const allMembers = useMemo(
    () => (Array.isArray(membersRaw) ? membersRaw : []) as Member[],
    [membersRaw]
  );

  const seatByMember = useMemo(() => {
    const map = new Map<string, { seatId: string; spaceId?: string | null }>();
    for (const b of bookings) {
      if (b.isBooked && b.memberId) {
        map.set(b.memberId, { seatId: b.seatId, spaceId: b.spaceId });
      }
    }
    return map;
  }, [bookings]);

  const seatLabelsByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, v] of seatByMember) map.set(id, v.seatId);
    return map;
  }, [seatByMember]);

  /** Coffee orders for journal day: memberId -> { qty, allPaid } */
  const coffeeByMember = useMemo(() => {
    const map = new Map<string, { qty: number; allPaid: boolean }>();
    for (const dp of dailyProducts) {
      const mid = dp.memberId || dp.externalRef;
      if (!mid) continue;
      if (dp.status === "CANCELLED") continue;
      const d = dp.date ? new Date(dp.date) : null;
      if (d && !isSameDay(d, selectedDate)) continue;
      const cur = map.get(mid) || { qty: 0, allPaid: true };
      cur.qty += dp.quantite || 0;
      if (!dp.isPayed) cur.allPaid = false;
      map.set(mid, cur);
    }
    return map;
  }, [dailyProducts, selectedDate]);

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  const presentMemberIds = useMemo(
    () => rows.filter(isActiveVisit).map((r) => r.memberID || ""),
    [rows]
  );

  const tomorrowReservations = useMemo(
    () => (tomorrowPage?.data ?? []).filter(isPendingReservation),
    [tomorrowPage]
  );

  const { actionsRef } = useJournalAlerts();

  const alertsData = useMemo(
    () => ({
      rows,
      subByMember,
      tomorrowReservations,
      now,
    }),
    [rows, subByMember, tomorrowReservations, now],
  );

  actionsRef.current = {
    onFocusRow: (row: Journal) => setEditRow(row),
    onFilterOverstay: () => setQuickFilter("overstay"),
    onFilterLeavingSoon: () => setQuickFilter("leaving_soon"),
    onViewTomorrow: () => setDate(tomorrow),
  };

  useJournalAlertsDataEffect(alertsData);

  const overstayCount = useMemo(
    () => rows.filter((r) => isOverstay(r, now)).length,
    [rows, now]
  );
  const leavingSoonCount = useMemo(
    () => rows.filter((r) => isLeavingSoon(r, now)).length,
    [rows, now]
  );
  const unpaidPresentCount = useMemo(
    () => rows.filter((r) => isActiveVisit(r) && !r.isPayed).length,
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter === "present") list = list.filter(isActiveVisit);
    if (statusFilter === "left")
      list = list.filter((r) => visitStatus(r) === "left");
    if (statusFilter === "reservation") list = list.filter(isPendingReservation);
    if (typeFilter === "visits") list = list.filter((r) => !r.isReservation);
    if (typeFilter === "reservations")
      list = list.filter(isPendingReservation);
    if (personFilter === "abonnement")
      list = list.filter((r) => isAbonnementVisit(r, subByMember));
    if (personFilter === "visitor")
      list = list.filter((r) => !isAbonnementVisit(r, subByMember));
    if (payFilter === "paid") list = list.filter((r) => r.isPayed);
    if (payFilter === "unpaid") list = list.filter((r) => !r.isPayed);

    if (quickFilter === "overstay") {
      list = list.filter((r) => isOverstay(r, now));
    } else if (quickFilter === "leaving_soon") {
      list = list.filter((r) => isLeavingSoon(r, now));
    } else if (quickFilter === "first_out") {
      list = list.filter(isActiveVisit).filter((r) => remainingMs(r, now) != null);
      list = [...list].sort((a, b) => {
        const ra = remainingMs(a, now) ?? Number.POSITIVE_INFINITY;
        const rb = remainingMs(b, now) ?? Number.POSITIVE_INFINITY;
        return ra - rb;
      });
    } else if (quickFilter === "unpaid_present") {
      list = list.filter((r) => isActiveVisit(r) && !r.isPayed);
    }

    if (search.trim().length >= 2) {
      const fuse = new Fuse(list, {
        keys: [
          "members.firstName",
          "members.lastName",
          "members.phone",
          "members.visitorNumber",
          "member.firstName",
          "member.phone",
          "prices.name",
          "price.name",
          "guestName",
        ],
        threshold: 0.35,
      });
      list = fuse.search(search).map((r) => r.item);
    }
    return list;
  }, [rows, statusFilter, typeFilter, personFilter, payFilter, quickFilter, search, now, subByMember]);

  const displayRows = useMemo(
    () => groupJournalByPerson(filtered),
    [filtered]
  );

  const reservations = rows.filter(isPendingReservation).length;
  const present = rows.filter(isActiveVisit).length;
  const revenueVisits = rows
    .filter((r) => r.isPayed)
    .reduce((a, r) => a + (r.payedAmount || 0), 0);
  const revenueAbo = paidSubscriptionRevenueOnDay(abonnements, selectedDate);
  const revenue = revenueVisits + revenueAbo;
  const unpaid = rows.filter((r) => !r.isPayed).length;
  const capacity = occupancy?.normalCapacity || facilities[0]?.nbrPlaces || 0;
  const free = Math.max(
    0,
    (occupancy?.normalCapacity ?? capacity) - (occupancy?.normalOccupied ?? present)
  );
  const overflowOcc = occupancy?.overflowOccupied ?? 0;
  const occupied = occupancy?.normalOccupied ?? present;
  const occupancyPct =
    capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

  const selectedRows = useMemo(
    () => displayRows.filter((r) => selectedIds.has(r.id)),
    [displayRows, selectedIds]
  );
  const selectedPresent = selectedRows.filter(isActiveVisit);
  const allFilteredSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRows.map((r) => r.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const invalidateJournal = () => {
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const checkout = useMutation({
    mutationFn: (id: string) => mobileApi.checkout(id),
    onSuccess: () => {
      toast.success("Check-out effectué");
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPayment = useMutation({
    mutationFn: ({ id, isPayed }: { id: string; isPayed: boolean }) =>
      mobileApi.setPayment(id, isPayed),
    onSuccess: () => {
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => journalApi.remove(id),
    onSuccess: () => {
      toast.success("Entrée supprimée");
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmArrival = useMutation({
    mutationFn: (row: Journal) =>
      journalApi.update(row.id, {
        isReservation: false,
        leaveTime: null,
        registredTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success("Client enregistré — session en cours");
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMember = useMutation({
    mutationFn: () =>
      journalApi.linkMember(identityRow!.id, linkMemberId),
    onSuccess: () => {
      toast.success("Visiteur lié au membre");
      setIdentityRow(null);
      setLinkMemberId("");
      invalidateJournal();
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoteMember = useMutation({
    mutationFn: () =>
      journalApi.promoteMember(identityRow!.id, {
        firstName: promoteForm.firstName.trim() || undefined,
        phone: promoteForm.phone.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Membre créé et lié");
      setIdentityRow(null);
      setPromoteForm({ firstName: "", phone: "" });
      invalidateJournal();
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openIdentity = (row: Journal, mode: "link" | "create") => {
    setIdentityRow(row);
    setIdentityMode(mode);
    setLinkMemberId("");
    setPromoteForm({
      firstName: row.guestName || "",
      phone: "",
    });
  };

  const endOfDay = useMutation({
    mutationFn: async () => {
      const present = rows.filter(isActiveVisit);
      const results = await Promise.allSettled(
        present.map((r) => mobileApi.checkout(r.id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: present.length - failed, failed, total: present.length };
    },
    onSuccess: ({ ok, failed, total }) => {
      if (!total) {
        toast.message("Personne présent à check-outer");
        return;
      }
      if (ok) toast.success(`${ok} check-out${ok > 1 ? "s" : ""} — fin de journée`);
      if (failed) toast.error(`${failed} échec${failed > 1 ? "s" : ""}`);
      clearSelection();
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportWhatsApp = async () => {
    const text = buildDayWhatsAppText(selectedDate, rows, seatLabelsByMember);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Liste copiée — collez dans WhatsApp");
    } catch {
      toast.error("Impossible de copier");
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportPrint = () => {
    try {
      openDayPrintView(selectedDate, rows, seatLabelsByMember);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    }
  };

  const bulkCheckout = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => mobileApi.checkout(id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) toast.success(`${ok} check-out${ok > 1 ? "s" : ""} effectué${ok > 1 ? "s" : ""}`);
      if (failed) toast.error(`${failed} échec${failed > 1 ? "s" : ""}`);
      clearSelection();
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkPay = useMutation({
    mutationFn: async ({
      ids,
      isPayed,
    }: {
      ids: string[];
      isPayed: boolean;
    }) => {
      const results = await Promise.allSettled(
        ids.map((id) => mobileApi.setPayment(id, isPayed))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed, isPayed };
    },
    onSuccess: ({ ok, failed, isPayed }) => {
      if (ok)
        toast.success(
          `${ok} marqué${ok > 1 ? "s" : ""} ${isPayed ? "payé" : "non payé"}`
        );
      if (failed) toast.error(`${failed} échec${failed > 1 ? "s" : ""}`);
      clearSelection();
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => journalApi.remove(id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) toast.success(`${ok} entrée${ok > 1 ? "s" : ""} supprimée${ok > 1 ? "s" : ""}`);
      if (failed) toast.error(`${failed} échec${failed > 1 ? "s" : ""}`);
      clearSelection();
      invalidateJournal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const durationLabel = (row: Journal) => {
    const start = new Date(row.registredTime).getTime();
    const end = row.leaveTime ? new Date(row.leaveTime).getTime() : now;
    return formatDurationHm(end - start);
  };

  const remainingLabel = (row: Journal) => {
    const rem = remainingMs(row, now);
    if (rem == null) return null;
    return formatDurationHm(rem, { signed: true });
  };

  const quickChips: {
    id: QuickFilter;
    label: string;
    count?: number;
    icon: ReactNode;
    tone?: string;
  }[] = [
    {
      id: "overstay",
      label: "Dépassement",
      count: overstayCount,
      icon: <TimerOff className="h-3.5 w-3.5" />,
      tone: "border-amber-400 bg-amber-50 text-amber-900 data-[active=true]:bg-amber-500 data-[active=true]:text-white",
    },
    {
      id: "leaving_soon",
      label: "Bientôt parti (30 min)",
      count: leavingSoonCount,
      icon: <AlarmClock className="h-3.5 w-3.5" />,
      tone: "border-sky-300 bg-sky-50 text-sky-900 data-[active=true]:bg-sky-600 data-[active=true]:text-white",
    },
    {
      id: "first_out",
      label: "Premiers à partir",
      icon: <LogOut className="h-3.5 w-3.5" />,
      tone: "border-slate-300 bg-slate-50 text-slate-800 data-[active=true]:bg-slate-800 data-[active=true]:text-white",
    },
    {
      id: "unpaid_present",
      label: "Présents impayés",
      count: unpaidPresentCount,
      icon: <Wallet className="h-3.5 w-3.5" />,
      tone: "border-rose-300 bg-rose-50 text-rose-900 data-[active=true]:bg-rose-600 data-[active=true]:text-white",
    },
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1 rounded-lg border bg-card px-1 py-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDate(addDays(selectedDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] px-1 text-center text-sm font-medium">
                {format(selectedDate, "EEEE d MMM yyyy", { locale: fr })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setDate(new Date())}
              >
                Aujourd&apos;hui
              </Button>
            </div>
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto">
              <SeatOccupancyBoard
                date={selectedDate}
                open={occupancyOpen}
                onOpenChange={(o) => {
                  setOccupancyOpen(o);
                  if (!o) {
                    setFocusSeatLabel(null);
                    setFocusSpaceId(null);
                  }
                }}
                focusSeatLabel={focusSeatLabel}
                focusSpaceId={focusSpaceId}
              />
              <JournalCommandesRail date={selectedDate} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="lg">
                    <Printer className="mr-2 h-4 w-4" />
                    Exporter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimer / PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportWhatsApp}>
                    <Share2 className="mr-2 h-4 w-4" />
                    WhatsApp (copie + ouvrir)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={!present || endOfDay.isPending}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Fin de journée
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Check-out de {present} présent{present !== 1 ? "s" : ""} ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Toutes les sessions en cours seront clôturées et leurs places
                      libérées sur le plan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => endOfDay.mutate()}>
                      Check-out tous
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <ReservationPanel
                journalDate={selectedDate}
                onDone={() => refetch()}
              />
              <Button size="lg" variant="outline" asChild>
                <Link href="/abonnements">Abonnements</Link>
              </Button>
              <QuickCheckInPanel
                presentMemberIds={presentMemberIds}
                onDone={() => refetch()}
              />
            </div>
          </div>
          <JournalReceptionToggles />
        </div>
      </div>

      <JournalAlertStrip />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "Présents", value: String(present) },
          { label: "Réservations", value: String(reservations) },
          { label: "Revenu du jour", value: `${revenue.toFixed(1)} DT` },
          { label: "Impayés", value: String(unpaid), href: "/impayes" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {"href" in k && k.href ? (
                <Link href={k.href} className="text-2xl font-bold hover:underline">
                  {k.value}
                </Link>
              ) : (
                <div className="text-2xl font-bold">{k.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Places libres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {capacity ? String(free) : "—"}
            </div>
            {capacity ? (
              <>
                <Progress
                  value={occupancyPct}
                  className={
                    occupancyPct >= 100
                      ? "[&>div]:bg-destructive"
                      : occupancyPct >= 80
                        ? "[&>div]:bg-amber-500"
                        : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {occupied}/{capacity} occupées · {occupancyPct}%
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {occupancy?.overflowCapacity != null
                ? `${overflowOcc}/${occupancy.overflowCapacity}`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => {
            const active = quickFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                data-active={active}
                onClick={() =>
                  setQuickFilter(active ? "all" : chip.id)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  chip.tone
                )}
              >
                {chip.icon}
                {chip.label}
                {typeof chip.count === "number" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      active ? "bg-white/25" : "bg-black/5"
                    )}
                  >
                    {chip.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          {quickFilter !== "all" ? (
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Effacer filtre
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Rechercher nom / téléphone / #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="present">Présent</SelectItem>
              <SelectItem value="left">Parti</SelectItem>
              <SelectItem value="reservation">Réservation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visites + résa.</SelectItem>
              <SelectItem value="visits">Visites seules</SelectItem>
              <SelectItem value="reservations">Réservations seules</SelectItem>
            </SelectContent>
          </Select>
          <Select value={personFilter} onValueChange={setPersonFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Personne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous profils</SelectItem>
              <SelectItem value="abonnement">Abonnés</SelectItem>
              <SelectItem value="visitor">Visiteurs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={payFilter} onValueChange={setPayFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="unpaid">Non payé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center">
              <p className="mb-2 text-sm text-destructive">
                Impossible de charger le journal
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          ) : !displayRows.length ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="text-muted-foreground">
                {quickFilter !== "all"
                  ? "Aucun résultat pour ce filtre"
                  : "Aucune entrée pour cette date"}
              </p>
              {quickFilter === "all" ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <ReservationPanel journalDate={selectedDate} />
                  <QuickCheckInPanel presentMemberIds={presentMemberIds} />
                </div>
              ) : (
                <Button variant="outline" onClick={() => setQuickFilter("all")}>
                  Voir tout le journal
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Café</TableHead>
                  <TableHead>Forfait</TableHead>
                  <TableHead>Place</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Durée / reste</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row) => {
                  const m = memberOf(row);
                  const p = priceOf(row);
                  const over = isOverstay(row, now);
                  const soon = isLeavingSoon(row, now);
                  const status = visitStatus(row);
                  const rem = remainingLabel(row);
                  const selected = selectedIds.has(row.id);
                  const seatInfo =
                    (m?.id && seatByMember.get(m.id)) ||
                    (row.memberID && seatByMember.get(row.memberID)) ||
                    null;
                  const seat = seatInfo?.seatId || null;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={selected ? "selected" : undefined}
                      className={cn(
                        status === "reservation" &&
                          "bg-violet-50/60 dark:bg-violet-950/20",
                        !row.isPayed && "bg-rose-50/80 dark:bg-rose-950/25",
                        over && "bg-amber-50/70 dark:bg-amber-950/20",
                        soon && !over && row.isPayed && "bg-sky-50/50 dark:bg-sky-950/15",
                        selected && "bg-primary/5"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleSelect(row.id)}
                          aria-label="Sélectionner"
                        />
                      </TableCell>
                      <TableCell>
                        {isAnonymousVisit(row) ? (
                          <Badge variant="outline">Anon</Badge>
                        ) : m?.visitorNumber ? (
                          `#${m.visitorNumber}`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <VisitorAvatar
                            name={visitorLabel(row)}
                            src={m?.avatarUrl}
                            className="h-8 w-8"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 font-medium">
                              {visitorLabel(row)}
                              {row.checkoutCount > 1 ? (
                                <Badge variant="secondary" className="h-5 text-[10px]">
                                  {row.checkoutCount} check-out
                                </Badge>
                              ) : row.visitCount > 1 ? (
                                <Badge variant="secondary" className="h-5 text-[10px]">
                                  {row.visitCount} passages
                                </Badge>
                              ) : null}
                              {p?.category === "ABONNEMENT" ||
                              p?.type === "abonnement" ? (
                                <Badge className="h-5 bg-violet-600 text-[10px] hover:bg-violet-600">
                                  Abonné
                                </Badge>
                              ) : null}
                              {(() => {
                                const mid = row.memberID || m?.id;
                                if (!mid) return null;
                                const sub = subByMember.get(mid);
                                if (!sub) return null;
                                const left = daysLeft(sub);
                                if (left == null || left < 0 || left > 3)
                                  return null;
                                return (
                                  <Badge
                                    variant={
                                      left <= 3 ? "destructive" : "secondary"
                                    }
                                    className="h-5 text-[10px]"
                                  >
                                    Abo {left === 0 ? "J" : `J-${left}`}
                                  </Badge>
                                );
                              })()}
                              {groupOf(row)?.name ? (
                                <Badge variant="outline" className="h-5 text-[10px]">
                                  {groupOf(row)!.name}
                                </Badge>
                              ) : null}
                              <UnpaidDebtBadge amount={row.openDebtAmount} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isAnonymousVisit(row)
                                ? "Sans fiche membre"
                                : m?.phone || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const mid = row.memberID || m?.id;
                          if (!mid) return "—";
                          const coffee = coffeeByMember.get(mid);
                          if (!coffee?.qty) return "—";
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                coffee.allPaid
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              )}
                              title={
                                coffee.allPaid
                                  ? "Café / boutique payé"
                                  : "Café / boutique impayé"
                              }
                            >
                              <Coffee className="h-3.5 w-3.5" />
                              {coffee.qty}×
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{p?.name || "—"}</TableCell>
                      <TableCell>
                        {status === "present" || status === "reservation" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            title={
                              seat
                                ? "Voir sur le plan (double-clic pour changer)"
                                : "Assigner une place"
                            }
                            onClick={() => {
                              if (isAnonymousVisit(row)) {
                                toast.message(
                                  "Liez ou créez un membre avant d’assigner une place"
                                );
                                openIdentity(row, "link");
                                return;
                              }
                              if (seat) {
                                setFocusSeatLabel(seat);
                                setFocusSpaceId(seatInfo?.spaceId || null);
                                setOccupancyOpen(true);
                                return;
                              }
                              setSeatRow(row);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isAnonymousVisit(row)) return;
                              setSeatRow(row);
                            }}
                          >
                            <MapPin className="h-3 w-3" />
                            {seat || "Assigner"}
                          </Button>
                        ) : seat ? (
                          <span className="text-xs text-muted-foreground">
                            {seat}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(row.registredTime), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span>
                            {status === "reservation"
                              ? "Réservation"
                              : durationLabel(row)}
                          </span>
                          {status === "present" &&
                          p?.billingUnit === "HOURLY" &&
                          !p.durationHours &&
                          p.category !== "ABONNEMENT" ? (
                            <span className="text-xs text-muted-foreground">
                              (compteur horaire)
                            </span>
                          ) : null}
                          {status === "present" && rem ? (
                            <span
                              className={cn(
                                "text-xs",
                                over
                                  ? "font-semibold text-amber-700"
                                  : "text-muted-foreground"
                              )}
                            >
                              ({over ? rem : `reste ${rem}`})
                            </span>
                          ) : null}
                          {over ? (
                            <Badge
                              variant="outline"
                              className="border-amber-400 text-amber-700"
                            >
                              Dépassement
                            </Badge>
                          ) : null}
                          {soon && !over ? (
                            <Badge
                              variant="outline"
                              className="border-sky-400 text-sky-700"
                            >
                              Bientôt
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {visitAmountDue(row, now).toFixed(1)} DT
                        {status === "present" &&
                        p?.billingUnit === "HOURLY" &&
                        p.category !== "ABONNEMENT" &&
                        !p.durationHours ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (compteur)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.isPayed}
                          onCheckedChange={(v) =>
                            setPayment.mutate({ id: row.id, isPayed: v })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {status === "reservation" ? (
                          <Badge
                            variant="outline"
                            className="border-violet-400 text-violet-800"
                          >
                            Réservé
                          </Badge>
                        ) : status === "left" ? (
                          <Badge variant="secondary">Terminé</Badge>
                        ) : (
                          <Badge>En cours</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {status === "reservation" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Confirmer l'arrivée"
                              onClick={() => confirmArrival.mutate(row)}
                            >
                              <LogIn className="h-4 w-4 text-violet-700" />
                            </Button>
                          ) : null}
                          {status === "present" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Check-out"
                              onClick={() => checkout.mutate(row.id)}
                            >
                              <LogOut className="h-4 w-4 text-primary" />
                            </Button>
                          ) : null}
                          {isAnonymousVisit(row) && status === "present" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                title="Lier à un membre"
                                onClick={() => openIdentity(row, "link")}
                              >
                                Lier
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                title="Créer un membre"
                                onClick={() => openIdentity(row, "create")}
                              >
                                Créer
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditRow(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {m ? (
                            <MemberLedgerDialog
                              memberId={m.id}
                              memberName={visitorLabel(row)}
                              source="journal"
                              journalId={row.id}
                              defaultAmount={
                                row.isPayed
                                  ? undefined
                                  : visitAmountDue(row, now)
                              }
                              trigger={
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Compte visiteur"
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                              }
                            />
                          ) : null}
                          {m ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Fiche membre"
                              onClick={() => setDetailMember(m)}
                            >
                              <UserRound className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Supprimer cette entrée ?
                                </AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => remove.mutate(row.id)}
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(920px,calc(100%-2rem))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Badge variant="secondary">{selectedIds.size}</Badge>
            sélectionné{selectedIds.size > 1 ? "s" : ""}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Tout désélectionner
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={
                !selectedPresent.length || bulkCheckout.isPending
              }
              onClick={() =>
                bulkCheckout.mutate(selectedPresent.map((r) => r.id))
              }
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Check-out ({selectedPresent.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedIds.size || bulkPay.isPending}
              onClick={() =>
                bulkPay.mutate({
                  ids: [...selectedIds],
                  isPayed: true,
                })
              }
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Marquer payé
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedIds.size || bulkPay.isPending}
              onClick={() =>
                bulkPay.mutate({
                  ids: [...selectedIds],
                  isPayed: false,
                })
              }
            >
              Marquer non payé
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!selectedIds.size || bulkDelete.isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Supprimer {selectedIds.size} entrée
                    {selectedIds.size > 1 ? "s" : ""} ?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => bulkDelete.mutate([...selectedIds])}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : null}

      <JournalEditSheet
        journal={editRow}
        open={!!editRow}
        onOpenChange={(o) => {
          if (!o) setEditRow(null);
        }}
      />
      <MemberDetailSheet
        member={detailMember}
        open={!!detailMember}
        onOpenChange={(o) => {
          if (!o) setDetailMember(null);
        }}
      />
      <AssignSeatDialog
        journal={seatRow}
        open={!!seatRow}
        onOpenChange={(o) => {
          if (!o) setSeatRow(null);
        }}
      />

      <Dialog
        open={!!identityRow}
        onOpenChange={(o) => {
          if (!o) setIdentityRow(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {identityMode === "link"
                ? "Lier à un membre existant"
                : "Créer un membre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Visite :{" "}
              <span className="font-medium text-foreground">
                {identityRow ? visitorLabel(identityRow) : ""}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={identityMode === "link" ? "default" : "outline"}
                onClick={() => setIdentityMode("link")}
              >
                Lier existant
              </Button>
              <Button
                size="sm"
                variant={identityMode === "create" ? "default" : "outline"}
                onClick={() => setIdentityMode("create")}
              >
                Créer fiche
              </Button>
            </div>
            {identityMode === "link" ? (
              <div className="space-y-2">
                <Label>Membre</Label>
                <Select value={linkMemberId} onValueChange={setLinkMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName || "Visiteur"}
                        {m.visitorNumber ? ` #${m.visitorNumber}` : ""}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={promoteForm.firstName}
                    onChange={(e) =>
                      setPromoteForm((f) => ({
                        ...f,
                        firstName: e.target.value,
                      }))
                    }
                    placeholder="Optionnel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={promoteForm.phone}
                    onChange={(e) =>
                      setPromoteForm((f) => ({
                        ...f,
                        phone: e.target.value,
                      }))
                    }
                    inputMode="tel"
                    placeholder="Optionnel"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIdentityRow(null)}>
              Annuler
            </Button>
            <Button
              disabled={
                identityMode === "link"
                  ? !linkMemberId || linkMember.isPending
                  : promoteMember.isPending
              }
              onClick={() =>
                identityMode === "link"
                  ? linkMember.mutate()
                  : promoteMember.mutate()
              }
            >
              {identityMode === "link" ? "Lier" : "Créer et lier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
