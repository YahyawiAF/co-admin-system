"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import {
  Users,
  Wallet,
  AlertCircle,
  ArrowRight,
  CalendarClock,
  QrCode,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  journalApi,
  facilityApi,
  abonnementsApi,
  visitRequestsApi,
  caisseApi,
  organizationsApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { isPendingReservation, memberOf } from "@/lib/journal-utils";
import { paidSubscriptionRevenueOnDay, asAbonnementList } from "@/lib/subscription-utils";
import { VisitorQrCard } from "@/components/admin/VisitorQrCard";

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => addDays(startOfDay(new Date()), 1), []);
  const [qrOpen, setQrOpen] = useState(false);

  const { data: journalPage } = useQuery({
    queryKey: queryKeys.journal(today),
    queryFn: () => journalApi.list({ journalDate: today, perPage: 100 }),
  });

  const { data: tomorrowJournal } = useQuery({
    queryKey: queryKeys.journal(tomorrow),
    queryFn: () => journalApi.list({ journalDate: tomorrow, perPage: 100 }),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: queryKeys.facility,
    queryFn: () => facilityApi.list(),
  });

  const { data: abonnements = [] } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: async () => {
      try {
        return await abonnementsApi.list();
      } catch {
        return [];
      }
    },
  });

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.visitRequestsPending,
    queryFn: () => visitRequestsApi.pending(),
  });

  const { data: finance } = useQuery({
    queryKey: ["caisse-summary", format(today, "yyyy-MM-dd")],
    queryFn: () => caisseApi.summary(today),
  });

  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
    enabled: qrOpen,
  });

  const rows = journalPage?.data ?? [];
  const tomorrowReservations = (tomorrowJournal?.data ?? []).filter(
    isPendingReservation
  );
  const present = rows.filter((r) => !r.isReservation && !r.leaveTime).length;
  const abos = asAbonnementList(abonnements);
  const revenueVisits = rows
    .filter((r) => r.isPayed)
    .reduce((acc, r) => acc + (r.payedAmount || 0), 0);
  const revenueAbo = paidSubscriptionRevenueOnDay(abos, today);
  const revenue = revenueVisits + revenueAbo;
  const unpaid = rows.filter((r) => !r.isPayed).length;
  const capacity = facilities[0]?.nbrPlaces || 0;
  const occupancyPct =
    capacity > 0 ? Math.min(100, Math.round((present / capacity) * 100)) : 0;

  const now = new Date();
  const expiring = (Array.isArray(abonnements) ? abonnements : []).filter(
    (a) => {
      if (!a.leaveDate) return false;
      const end = new Date(a.leaveDate);
      const days = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 3;
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE d MMMM yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/finance">
              Finance / Caisse
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="mr-2 h-4 w-4" />
                QR visiteur
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>QR visiteur</DialogTitle>
                <DialogDescription>
                  Chaque organisation a son propre lien mobile (/m/slug).
                  Téléchargez ou copiez le QR pour l&apos;accueil.
                </DialogDescription>
              </DialogHeader>
              {organizations.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {organizations.map((org) => (
                    <VisitorQrCard
                      key={org.id}
                      orgSlug={org.slug}
                      orgName={org.name}
                      size="md"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune organisation. Créez-en une dans Facility → Profil &amp;
                  QR.
                </p>
              )}
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link href="/journal">
              Check-in rapide
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {finance ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pilotage lite</CardTitle>
            <CardDescription>
              Net {finance.net.toFixed(1)} DT · caisse{" "}
              {finance.session?.closedAt
                ? "clôturée"
                : finance.session
                  ? "ouverte"
                  : "non ouverte"}
              {occupancy
                ? ` · places ${occupancy.normalOccupied}/${occupancy.normalCapacity}`
                : ""}
              {occupancy?.overflowOccupied
                ? ` · overflow ${occupancy.overflowOccupied}`
                : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Présents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{present}</div>
            <p className="text-xs text-muted-foreground">
              {capacity ? `sur ${capacity} places` : "capacité non définie"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenu du jour</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{revenue.toFixed(1)} DT</div>
            <p className="text-xs text-muted-foreground">
              Journal {revenueVisits.toFixed(1)} + abo {revenueAbo.toFixed(1)}
              {unpaid ? ` · ${unpaid} impayé${unpaid !== 1 ? "s" : ""}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Occupation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">{occupancyPct}%</div>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pending.length}</div>
            <p className="text-xs text-muted-foreground">
              demandes en attente
            </p>
          </CardContent>
        </Card>
      </div>

      {tomorrowReservations.length > 0 ? (
        <Card className="border-violet-300 bg-violet-50/50 dark:bg-violet-950/20">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CalendarClock className="h-5 w-5 text-violet-700" />
            <div>
              <CardTitle className="text-base">
                {tomorrowReservations.length} réservation
                {tomorrowReservations.length !== 1 ? "s" : ""} demain
              </CardTitle>
              <CardDescription>
                {format(tomorrow, "EEEE d MMMM", { locale: undefined })}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {tomorrowReservations.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-violet-200 bg-background px-3 py-2 text-sm"
              >
                <span>
                  {memberOf(r)?.firstName || "Visiteur"}
                  {memberOf(r)?.visitorNumber
                    ? ` #${memberOf(r)?.visitorNumber}`
                    : ""}
                </span>
                <Badge variant="outline" className="border-violet-400">
                  {r.prices?.name || r.price?.name || "Forfait"}
                </Badge>
              </div>
            ))}
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href={`/journal?date=${format(tomorrow, "yyyy-MM-dd")}`}>
                Voir le journal de demain →
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Abonnements qui expirent</CardTitle>
            <CardDescription>Dans les 3 prochains jours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien à signaler</p>
            ) : (
              expiring.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>
                    {a.members?.firstName || a.memberID.slice(0, 8)}
                  </span>
                  <Badge variant="secondary">
                    {a.leaveDate
                      ? format(new Date(a.leaveDate), "dd/MM")
                      : "—"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Demandes mobiles</CardTitle>
            <CardDescription>À confirmer à l&apos;accueil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande</p>
            ) : (
              pending.slice(0, 6).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {req.member?.firstName || "Visiteur"} · {req.price?.name}
                  </span>
                  <Badge>{req.type}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
