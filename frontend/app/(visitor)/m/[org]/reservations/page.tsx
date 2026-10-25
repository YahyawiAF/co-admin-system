"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChairMap } from "@/components/visitor/reserve/ChairMap";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { formatDt } from "@/lib/session-pricing";
import type { BookingRequest, Space } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5";
const EMPTY = new Set<string>();

function StatusChip({ status }: { status: BookingRequest["status"] }) {
  if (status === "APPROVED") {
    return (
      <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
        Confirmée ✓
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
        En attente
        <span className="v-dot h-1 w-1 rounded-full bg-amber-700" />
        <span className="v-dot h-1 w-1 rounded-full bg-amber-700 [animation-delay:.15s]" />
        <span className="v-dot h-1 w-1 rounded-full bg-amber-700 [animation-delay:.3s]" />
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">
      Refusée / annulée
    </span>
  );
}

export default function MyReservationsPage() {
  const { href, slug } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();
  const { data: status } = useMobileStatus();
  const [tab, setTab] = useState<"next" | "past">("next");
  const [openMap, setOpenMap] = useState<string | null>(null);

  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["my-bookings", memberId],
    queryFn: () => mobileApi.myBookingRequests(memberId!),
    enabled: !!memberId,
  });
  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
    staleTime: 5 * 60_000,
  });
  const spaces = (layout?.spaces || []) as Space[];

  const cancel = useMutation({
    mutationFn: (id: string) => mobileApi.cancelBookingRequest(id, memberId!),
    onSuccess: () => {
      toast.success("Demande annulée");
      queryClient.invalidateQueries({ queryKey: ["my-bookings", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();
  const { next, past } = useMemo(() => {
    const n: BookingRequest[] = [];
    const p: BookingRequest[] = [];
    for (const b of mine) {
      const upcoming = b.status !== "REJECTED" && new Date(b.endAt).getTime() >= now;
      (upcoming ? n : p).push(b);
    }
    n.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return { next: n, past: p };
  }, [mine, now]);
  const list = tab === "next" ? next : past;

  if (!memberId) {
    return (
      <div className={cn(CARD, "py-6 text-center")}>
        <p className="text-sm font-bold text-slate-900">Connectez-vous pour voir vos réservations</p>
        <Link href={href("/reserve")} className="mt-3 inline-flex h-11 items-center rounded-full bg-indigo-600 px-5 text-sm font-extrabold text-white">
          Réserver
        </Link>
      </div>
    );
  }

  const initials = (
    (status?.member?.firstName?.[0] || "") + (status?.member?.lastName?.[0] || "") || "V"
  ).toUpperCase();

  return (
    <div className="space-y-3 pb-2">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
        {(
          [
            { id: "next", label: `À venir${next.length ? ` · ${next.length}` : ""}` },
            { id: "past", label: "Passées" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 rounded-full text-sm font-bold transition-colors duration-200 motion-reduce:transition-none",
              tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Chargement…</p>
      ) : !list.length ? (
        <div className={cn(CARD, "v-rise py-6 text-center")}>
          <CalendarDays className="mx-auto h-8 w-8 text-indigo-600" />
          <p className="mt-2 text-sm font-bold text-slate-900">
            {tab === "next" ? "Aucune réservation à venir" : "Rien pour l’instant"}
          </p>
          <p className="text-xs text-slate-600">Réservez vos places pour demain ou plus tard.</p>
        </div>
      ) : (
        list.map((b, i) => {
          const start = new Date(b.startAt);
          const labels = b.seatLabels?.length ? b.seatLabels : b.seatLabel ? [b.seatLabel] : [];
          const space = spaces.find((s) => s.id === (b.seatSpaceId || b.spaceId)) || null;
          const tomorrow = format(new Date(now + 86_400_000), "yyyy-MM-dd") === format(start, "yyyy-MM-dd");
          const mapOpen = openMap === b.id;
          return (
            <article key={b.id} className={cn(CARD, "v-rise")} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <div className="flex gap-3">
                <span
                  className={cn(
                    "flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl leading-tight",
                    b.status === "APPROVED" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-800"
                  )}
                >
                  <span className="text-[10px] font-extrabold uppercase">{format(start, "EEE", { locale: fr }).replace(".", "")}</span>
                  <span className="text-xl font-black">{format(start, "d")}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-black text-slate-900">
                      {tomorrow ? "Demain · " : ""}
                      {format(start, "HH:mm")} – {format(new Date(b.endAt), "HH:mm")}
                    </span>
                    <StatusChip status={b.status} />
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {b.kind === "ROOM"
                      ? `${b.spaceName || "Salle"} · ${b.places ?? 1} personne${(b.places ?? 1) > 1 ? "s" : ""}`
                      : `${b.spaceName || space?.name || "Open space"} · ${labels.length} place${labels.length > 1 ? "s" : ""}`}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {labels.map((l) => (
                      <span key={l} className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-extrabold text-indigo-900">
                        {l}
                      </span>
                    ))}
                    {(b.fee ?? 0) > 0 ? (
                      <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                        Frais {formatDt(b.fee!)} · à l’arrivée
                      </span>
                    ) : null}
                  </span>
                </span>
              </div>

              {mapOpen && space && b.kind === "SEAT" ? (
                <div className="v-rise mt-2.5">
                  <ChairMap
                    space={space}
                    taken={EMPTY}
                    picked={labels}
                    activeTableId={
                      space.tables?.find((t) => (t.seats || []).some((s) => s.label === labels[0]))?.id ?? null
                    }
                    onActiveTable={() => {}}
                    onToggle={() => {}}
                    initials={initials}
                  />
                </div>
              ) : null}

              {tab === "next" ? (
                <div className="mt-2.5 flex gap-1.5">
                  {b.kind === "SEAT" && space ? (
                    <button
                      type="button"
                      onClick={() => setOpenMap(mapOpen ? null : b.id)}
                      className="h-10 flex-1 rounded-full bg-indigo-50 text-[13px] font-extrabold text-indigo-900 transition-colors hover:bg-indigo-100"
                    >
                      {mapOpen ? "Masquer le plan" : "Voir sur le plan"}
                    </button>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {b.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(b.id)}
                      className="h-10 rounded-full bg-white px-4 text-[13px] font-extrabold text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-50 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })
      )}

      {tab === "next" ? (
        <section className="v-rise rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3 ring-1 ring-indigo-200">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Le jour J</p>
          <div className="mt-1.5 space-y-1.5 text-[13px] text-indigo-950">
            {["Scannez le QR à l’entrée", "Vos places réservées sont déjà prêtes", "Frais + tarif auto réglés à l’accueil"].map((t, i) => (
              <p key={t} className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white">{i + 1}</span>
                {t}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <Link
        href={href("/reserve")}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" />
        Nouvelle réservation
      </Link>
    </div>
  );
}
