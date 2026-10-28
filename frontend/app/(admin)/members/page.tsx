"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Pencil,
  Trash2,
  UserRound,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Users,
  Ticket,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberFormModal } from "@/components/admin/MemberFormModal";
import { DeleteMemberDialog } from "@/components/admin/DeleteMemberDialog";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";
import { NewClientBadge } from "@/components/admin/NewClientPopup";
import { MemberRewardsBadges } from "@/components/admin/MemberRewardsBadges";
import { SeatOccupancyBoard } from "@/components/admin/SeatOccupancyBoard";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import {
  membersApi,
  groupsApi,
  abonnementsApi,
  bookingApi,
  analyticsApi,
  pricesApi,
  facilityApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Member, MemberGroup, Abonnement } from "@/lib/types";
import { Label } from "@/components/ui/label";

export default function MembersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "groups" ? "groups" : "members";
  const topServiceId = searchParams.get("topServiceId") || "";
  const topSpaceId = searchParams.get("topSpaceId") || "";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [edit, setEdit] = useState<Member | null>(null);
  const [detail, setDetail] = useState<Member | null>(null);
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [occupancyOpen, setOccupancyOpen] = useState(false);
  const [focusSeatLabel, setFocusSeatLabel] = useState<string | null>(null);
  const [focusSpaceId, setFocusSpaceId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, groupFilter, statusFilter, perPage, topServiceId, topSpaceId]);

  const analyticsRange = useMemo(() => {
    const to = new Date();
    const from = subDays(to, 89);
    return {
      from: format(from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    };
  }, []);

  const setDemandParam = (key: "topServiceId" | "topSpaceId", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    // Keep mutual exclusivity for clarity
    if (key === "topServiceId" && value && value !== "all") {
      params.delete("topSpaceId");
    }
    if (key === "topSpaceId" && value && value !== "all") {
      params.delete("topServiceId");
    }
    if (tab === "groups") params.set("tab", "groups");
    const qs = params.toString();
    router.replace(qs ? `/members?${qs}` : "/members");
  };

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => groupsApi.list(),
  });
  const { data: abosRaw } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: () => abonnementsApi.list(),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
  });
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const spaces = layout?.spaces || [];

  const { data: demandMembers } = useQuery({
    queryKey: [
      "analytics-members",
      topServiceId,
      topSpaceId,
      analyticsRange.from,
      analyticsRange.to,
    ],
    queryFn: () =>
      analyticsApi.members({
        topServiceId: topServiceId || undefined,
        topSpaceId: topSpaceId || undefined,
        from: analyticsRange.from,
        to: analyticsRange.to,
      }),
    enabled: !!topServiceId || !!topSpaceId,
  });
  const demandMemberIds = demandMembers?.memberIds;
  const demandActive = !!(topServiceId || topSpaceId);

  const listParams = useMemo(
    () => ({
      page,
      perPage,
      search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      groupId: groupFilter,
      status: statusFilter,
      memberIds: demandActive ? demandMemberIds : undefined,
    }),
    [
      page,
      perPage,
      debouncedSearch,
      groupFilter,
      statusFilter,
      demandActive,
      demandMemberIds,
    ],
  );

  const emptyDemand =
    demandActive &&
    demandMemberIds !== undefined &&
    demandMemberIds.length === 0;

  const { data: membersPage, isLoading } = useQuery({
    queryKey: queryKeys.membersList(listParams),
    queryFn: () => membersApi.listPage(listParams),
    enabled:
      !emptyDemand && (!demandActive || demandMemberIds !== undefined),
  });

  const membersPageResolved = emptyDemand
    ? {
        data: [] as Member[],
        meta: {
          total: 0,
          lastPage: 0,
          currentPage: 1,
          perPage,
          prev: null as number | null,
          next: null as number | null,
        },
      }
    : membersPage;

  const { data: memberStats } = useQuery({
    queryKey: queryKeys.membersStats,
    queryFn: () => membersApi.stats(),
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
    enabled: tab === "groups",
  });

  const members = membersPageResolved?.data ?? [];
  const meta = membersPageResolved?.meta;
  const abos = useMemo(() => {
    if (!abosRaw) return [] as Abonnement[];
    return Array.isArray(abosRaw) ? abosRaw : abosRaw.data || [];
  }, [abosRaw]);

  const aboState = useMemo(() => {
    const now = new Date();
    const map = new Map<string, "active" | "expired">();
    for (const a of abos) {
      const id = a.memberID;
      if (!id) continue;
      let active = true;
      if (a.leaveDate && new Date(a.leaveDate) < now) active = false;
      if (a.price?.billingUnit === "HOURLY") {
        const quota = a.hoursQuota || a.price.durationHours || 0;
        if (quota > 0 && (a.hoursUsed || 0) >= quota) active = false;
      }
      const prev = map.get(id);
      if (active) map.set(id, "active");
      else if (prev !== "active") map.set(id, "expired");
    }
    return map;
  }, [abos]);

  const reservedByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of abos) {
      if (!a.memberID || !a.reservedSeatLabel) continue;
      const prev = aboState.get(a.memberID);
      if (prev !== "active") continue;
      map.set(a.memberID, a.reservedSeatLabel);
    }
    return map;
  }, [abos, aboState]);

  const seatByMember = useMemo(() => {
    const map = new Map<string, { seatId: string; spaceId?: string | null }>();
    for (const b of bookings) {
      if (b.isBooked && b.memberId) {
        map.set(b.memberId, { seatId: b.seatId, spaceId: b.spaceId });
      }
    }
    return map;
  }, [bookings]);

  const [toDelete, setToDelete] = useState<Member | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => {
      toast.success("Membre supprimé");
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["members", "list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.membersStats });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <DeleteMemberDialog
        member={toDelete}
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={(m) => remove.mutate(m.id)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            {memberStats?.total ?? meta?.total ?? "—"} membre
            {(memberStats?.total ?? meta?.total ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <SeatOccupancyBoard
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
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membres</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberStats?.total ?? "—"}</div>
            <p className="text-xs text-muted-foreground">Total inscrits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Abonnements actifs
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberStats?.activeAbonnements ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Membres avec abo en cours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Présents</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberStats?.presentNow ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              En session journal maintenant
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(v === "groups" ? "/members?tab=groups" : "/members")
        }
      >
        <TabsList>
          <TabsTrigger value="members">Membres</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Input
              className="max-w-sm"
              placeholder="Rechercher nom / téléphone / #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Groupe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les groupes</SelectItem>
                <SelectItem value="none">Sans groupe</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="present">Présents aujourd’hui</SelectItem>
                <SelectItem value="absent">Absents</SelectItem>
                <SelectItem value="abonne">Abonnement actif</SelectItem>
                <SelectItem value="expired">Abonnement expiré</SelectItem>
                <SelectItem value="visiteur">Forfait visiteur</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={topServiceId || "all"}
              onValueChange={(v) => setDemandParam("topServiceId", v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Service le + demandé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les services</SelectItem>
                {prices.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={topSpaceId || "all"}
              onValueChange={(v) => setDemandParam("topSpaceId", v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Espace le + fréquenté" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les espaces</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(perPage)}
              onValueChange={(v) => setPerPage(Number(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Par page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
            </div>
            <MemberFormModal
              trigger={<Button size="lg">+ Nouveau membre</Button>}
            />
          </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Chargement…</p>
          ) : members.length === 0 ? (
            <p className="p-6 text-muted-foreground">Aucun membre trouvé.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Points / promo</TableHead>
                  <TableHead>Place</TableHead>
                  <TableHead>Groupe</TableHead>
                  <TableHead>Créé</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.visitorNumber ? `#${m.visitorNumber}` : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left"
                        onClick={() => setDetail(m)}
                      >
                        <VisitorAvatar
                          name={[m.firstName, m.lastName].filter(Boolean).join(" ")}
                          src={m.avatarUrl}
                          className="h-8 w-8"
                        />
                        <span>
                          {[m.firstName, m.lastName].filter(Boolean).join(" ") ||
                            "Visiteur"}
                        </span>
                        {m.isFirstVisitToday ? <NewClientBadge /> : null}
                      </button>
                    </TableCell>
                    <TableCell>{m.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {m.plan === "Membership" ? "Abonné" : "Visiteur"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MemberRewardsBadges member={m} />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const live = seatByMember.get(m.id);
                        const reserved = reservedByMember.get(m.id);
                        const seat = live?.seatId || reserved;
                        if (!seat) {
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => {
                                setFocusSeatLabel(null);
                                setFocusSpaceId(null);
                                setOccupancyOpen(true);
                              }}
                            >
                              —
                            </Button>
                          );
                        }
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            title="Voir sur le plan"
                            onClick={() => {
                              setFocusSeatLabel(seat);
                              setFocusSpaceId(live?.spaceId || null);
                              setOccupancyOpen(true);
                            }}
                          >
                            <MapPin className="h-3 w-3" />
                            {seat}
                            {!live && reserved ? (
                              <span className="text-muted-foreground">abo</span>
                            ) : null}
                          </Button>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {m.group?.name ? (
                        <Badge>
                          {m.group.name}
                          {(m.discountForfait ?? m.group.discountForfait)
                            ? ` −${m.discountForfait ?? m.group.discountForfait}%`
                            : ""}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.createdAt
                        ? formatDistanceToNow(new Date(m.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Fiche"
                        onClick={() => setDetail(m)}
                      >
                        <UserRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEdit(m)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={() => setToDelete(m)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {meta && meta.lastPage > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {meta.currentPage} / {meta.lastPage} · {meta.total} résultat
                {meta.total !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.prev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.next}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsPanel members={allMembers} />
        </TabsContent>
      </Tabs>

      <MemberFormModal
        member={edit}
        open={!!edit}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
      />
      <MemberDetailSheet
        member={detail}
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      />
    </div>
  );
}

function GroupsPanel({ members }: { members: Member[] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState("15");
  const [discountForfait, setDiscountForfait] = useState("0");
  const [discountAbonnement, setDiscountAbonnement] = useState("0");
  const [discountSalle, setDiscountSalle] = useState("0");
  const [discountOpenSpace, setDiscountOpenSpace] = useState("0");
  const [edit, setEdit] = useState<MemberGroup | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [pickMember, setPickMember] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => groupsApi.list(),
  });

  const save = useMutation({
    mutationFn: () => {
      if (edit) {
        return groupsApi.update(edit.id, {
          name: name.trim() || edit.name,
          maxMembers: Number(maxMembers) || edit.maxMembers,
          discountForfait: Number(discountForfait),
          discountAbonnement: Number(discountAbonnement),
          discountSalle: Number(discountSalle),
          discountOpenSpace: Number(discountOpenSpace),
        });
      }
      return groupsApi.create({
        name: name.trim(),
        maxMembers: Number(maxMembers) || 15,
        discountForfait: Number(discountForfait) || 0,
        discountAbonnement: Number(discountAbonnement) || 0,
        discountSalle: Number(discountSalle) || 0,
        discountOpenSpace: Number(discountOpenSpace) || 0,
      });
    },
    onSuccess: () => {
      toast.success(edit ? "Groupe mis à jour" : "Groupe créé");
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["members", "list"] });
      setName("");
      setMaxMembers("15");
      setDiscountForfait("0");
      setDiscountAbonnement("0");
      setDiscountSalle("0");
      setDiscountOpenSpace("0");
      setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => {
      toast.success("Groupe supprimé");
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["members", "list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: () => groupsApi.addMember(addTo!, pickMember),
    onSuccess: () => {
      toast.success("Membre ajouté");
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["members", "list"] });
      setPickMember("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropMember = useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      groupsApi.removeMember(groupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["members", "list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">
            {edit ? `Modifier ${edit.name}` : "Nouveau groupe"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="TBS"
              />
            </div>
            <div className="space-y-1">
              <Label>Max membres</Label>
              <Input
                type="number"
                min={1}
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Remise forfait %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountForfait}
                onChange={(e) => setDiscountForfait(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Remise abo %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountAbonnement}
                onChange={(e) => setDiscountAbonnement(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Remise salle %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountSalle}
                onChange={(e) => setDiscountSalle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Remise open %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountOpenSpace}
                onChange={(e) => setDiscountOpenSpace(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {edit ? "Enregistrer" : "Créer"}
            </Button>
            {edit ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEdit(null);
                  setName("");
                }}
              >
                Annuler
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {groups.map((g) => (
        <Card key={g.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {g.members?.length || 0}/{g.maxMembers} membres · forfait −
                  {g.discountForfait}% · abo −{g.discountAbonnement ?? 0}% ·
                  salle −{g.discountSalle}% · open −{g.discountOpenSpace}%
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEdit(g);
                    setName(g.name);
                    setMaxMembers(String(g.maxMembers));
                    setDiscountForfait(String(g.discountForfait));
                    setDiscountAbonnement(String(g.discountAbonnement ?? 0));
                    setDiscountSalle(String(g.discountSalle));
                    setDiscountOpenSpace(String(g.discountOpenSpace));
                  }}
                >
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(g.id)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(g.members || []).map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1">
                  {m.firstName || m.phone || "Visiteur"}
                  <button
                    type="button"
                    className="ml-1 text-destructive"
                    onClick={() =>
                      dropMember.mutate({ groupId: g.id, memberId: m.id })
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            {addTo === g.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label>Ajouter un membre</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pickMember}
                    onChange={(e) => setPickMember(e.target.value)}
                  >
                    <option value="">Choisir…</option>
                    {members
                      .filter((m) => m.groupId !== g.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName || "Visiteur"} {m.phone || ""}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  disabled={!pickMember || addMember.isPending}
                  onClick={() => addMember.mutate()}
                >
                  Ajouter
                </Button>
                <Button variant="outline" onClick={() => setAddTo(null)}>
                  Fermer
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAddTo(g.id)}>
                + Ajouter un membre
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {!groups.length ? (
        <p className="text-sm text-muted-foreground">Aucun groupe pour l’instant.</p>
      ) : null}
    </div>
  );
}
