"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemandesView } from "@/components/admin/reservations/DemandesView";
import { DayPlanView } from "@/components/admin/reservations/DayPlanView";
import { ResaSettingsView } from "@/components/admin/reservations/ResaSettingsView";
import { pickMainFacility, seatSpacesOf } from "@/components/admin/reservations/shared";
import { bookingRequestsApi, facilityApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { useStaffAccess } from "@/lib/staff-access";

type Tab = "demandes" | "jour" | "reglages";
const TABS: Tab[] = ["demandes", "jour", "reglages"];

export default function ReservationsAdminPage() {
  const { can, isStaff } = useStaffAccess();
  const mayWrite = can("reservations", "write");
  const queryClient = useQueryClient();

  // ?tab=jour|reglages keeps the view on reload and lets other pages link here
  const [tab, setTab] = useState<Tab>("demandes");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
  }, []);
  const changeTab = (v: string) => {
    const t = v as Tab;
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "demandes") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.bookingRequestsPending,
    queryFn: () => bookingRequestsApi.pending(),
    refetchInterval: 12_000,
  });
  const { data: approved = [] } = useQuery({
    queryKey: ["booking-requests", "APPROVED"],
    queryFn: () => bookingRequestsApi.list("APPROVED"),
  });
  const { data: rejected = [] } = useQuery({
    queryKey: ["booking-requests", "REJECTED"],
    queryFn: () => bookingRequestsApi.list("REJECTED"),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });
  const facility = useMemo(() => pickMainFacility(facilities), [facilities]);
  const { data: layout } = useQuery({
    queryKey: ["facility-layout", facility?.id],
    queryFn: () => facilityApi.layout(facility?.id),
    enabled: !!facility?.id,
  });
  const spaces = useMemo(() => seatSpacesOf(layout?.spaces || []), [layout?.spaces]);
  const allSpaces = layout?.spaces || [];

  const markedDays = useMemo(
    () => new Set([...pending, ...approved].map((r) => format(new Date(r.startAt), "yyyy-MM-dd"))),
    [pending, approved]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bookingRequestsPending });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.approve(id),
    onSuccess: () => {
      toast.success("Réservation acceptée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.reject(id),
    onSuccess: () => {
      toast.success("Réservation refusée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.remove(id),
    onSuccess: () => {
      toast.success("Réservation supprimée");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Tabs value={isStaff && tab === "reglages" ? "demandes" : tab} onValueChange={changeTab} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Réservations</h1>
          <p className="text-sm text-muted-foreground">
            {tab === "demandes"
              ? "Demandes du mobile, avec les chaises exactes sur le plan"
              : tab === "jour"
                ? "Toute la salle, jour par jour"
                : "Frais, règles et photos vues par les visiteurs"}
          </p>
        </div>
        <TabsList className="h-11 rounded-xl p-1">
          <TabsTrigger value="demandes" className="h-9 gap-1.5 rounded-lg px-4 font-bold">
            Demandes
            {pending.length ? (
              <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-extrabold text-white">{pending.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="jour" className="h-9 rounded-lg px-4 font-bold">
            Plan du jour
          </TabsTrigger>
          {!isStaff ? (
            <TabsTrigger value="reglages" className="h-9 rounded-lg px-4 font-bold">
              Réglages &amp; photos
            </TabsTrigger>
          ) : null}
        </TabsList>
      </div>

      <TabsContent value="demandes" className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0">
        <DemandesView
          lists={{ PENDING: pending, APPROVED: approved, REJECTED: rejected }}
          spaces={allSpaces}
          mayWrite={mayWrite}
          onApprove={(id) => approve.mutate(id)}
          onReject={(id) => reject.mutate(id)}
          onDelete={(id) => remove.mutate(id)}
          busy={approve.isPending || reject.isPending || remove.isPending}
        />
      </TabsContent>
      <TabsContent value="jour" className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0">
        <DayPlanView spaces={spaces} daysAhead={facility?.reservationMaxDaysAhead ?? 14} markedDays={markedDays} />
      </TabsContent>
      {!isStaff ? (
        <TabsContent value="reglages" className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0">
          <ResaSettingsView facility={facility} spaces={spaces} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
