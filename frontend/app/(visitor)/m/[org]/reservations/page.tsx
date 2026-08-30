"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Armchair, DoorOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { cn } from "@/lib/utils";

const STATUS = {
  PENDING: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  APPROVED: {
    label: "Confirmée",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  },
  REJECTED: {
    label: "Refusée",
    className: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  },
} as const;

export default function MyReservationsPage() {
  const { href } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();

  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["my-bookings", memberId],
    queryFn: () => mobileApi.myBookingRequests(memberId!),
    enabled: !!memberId,
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      mobileApi.cancelBookingRequest(id, memberId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings", memberId] });
    },
  });

  const pending = mine.filter((b) => b.status === "PENDING");
  const confirmed = mine.filter((b) => b.status === "APPROVED");
  const past = mine.filter((b) => b.status === "REJECTED");

  if (!memberId) {
    return <p className="text-sm text-slate-500">Connectez-vous.</p>;
  }

  const Section = ({
    title,
    items,
  }: {
    title: string;
    items: typeof mine;
  }) =>
    items.length ? (
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        {items.map((b) => {
          const st = STATUS[b.status] || STATUS.PENDING;
          return (
            <div
              key={b.id}
              className="rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-primary">
                    {b.kind === "ROOM" ? (
                      <DoorOpen className="h-4 w-4" />
                    ) : (
                      <Armchair className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {b.kind === "ROOM"
                        ? b.spaceName || "Salle"
                        : `Place ${b.seatLabel}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(b.startAt), "EEEE d MMM · HH:mm", {
                        locale: fr,
                      })}{" "}
                      → {format(new Date(b.endAt), "HH:mm", { locale: fr })}
                    </p>
                    {b.note ? (
                      <p className="mt-1 text-xs text-slate-400">{b.note}</p>
                    ) : null}
                  </div>
                </div>
                <Badge className={cn("shrink-0", st.className)}>
                  {st.label}
                </Badge>
              </div>
              {b.status === "PENDING" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 px-0 text-rose-600"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(b.id)}
                >
                  Annuler
                </Button>
              ) : null}
            </div>
          );
        })}
      </section>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <MobileBackHome />
        <Button size="sm" className="rounded-full" asChild>
          <Link href={href("/reserve")}>
            <Plus className="mr-1 h-4 w-4" />
            Nouvelle
          </Link>
        </Button>
      </div>
      <h1 className="text-xl font-bold">Mes réservations</h1>
      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !mine.length ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">Aucune demande pour l’instant.</p>
          <Button className="mt-3 rounded-full" asChild>
            <Link href={href("/reserve")}>Réserver</Link>
          </Button>
        </div>
      ) : (
        <>
          <Section title="En attente" items={pending} />
          <Section title="Confirmées" items={confirmed} />
          <Section title="Refusées / annulées" items={past} />
        </>
      )}
    </div>
  );
}
