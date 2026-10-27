"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Ban, Check, CheckCircle2, DoorOpen, Phone, Trash2, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChairMap, type SeatInfo } from "@/components/visitor/reserve/ChairMap";
import { TablePhoto } from "@/components/visitor/reserve/TablePhoto";
import { bookingRequestsApi } from "@/lib/api/resources";
import type { BookingRequest, Space } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dt, initialsOf, labelsOf, overlaps, spaceOfBooking, tableOfLabel } from "./shared";

type Status = BookingRequest["status"];

const STATUS: Record<Status, { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-900" },
  APPROVED: { label: "Acceptée", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Refusée", cls: "bg-slate-100 text-slate-600" },
};

export function StatusPill({ status, cancelled }: { status: Status; cancelled?: boolean }) {
  if (cancelled) {
    return (
      <span className="rounded-md bg-rose-100 px-1.5 py-px text-[11px] font-extrabold text-rose-800">Annulée</span>
    );
  }
  return (
    <span className={cn("rounded-md px-1.5 py-px text-[11px] font-extrabold", STATUS[status].cls)}>
      {STATUS[status].label}
    </span>
  );
}

/** Fee kept on a cancelled booking: still owed, or already collected. */
function CancelFeeChip({ r }: { r: BookingRequest }) {
  if (!r.cancelFee) return null;
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-px text-[11px] font-extrabold",
        r.feePaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-600 text-white"
      )}
    >
      {r.feePaid ? `Frais ${dt(r.cancelFee)} réglés` : `Frais ${dt(r.cancelFee)} dus`}
    </span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "fee" }) {
  return (
    <div className={cn("rounded-xl px-3 py-2", tone === "fee" ? "bg-amber-50 ring-1 ring-amber-200" : "bg-muted/60")}>
      <p className={cn("text-[11px] font-bold uppercase tracking-wide", tone === "fee" ? "text-amber-800" : "text-muted-foreground")}>
        {label}
      </p>
      <p className={cn("mt-0.5 text-[15px] font-extrabold", tone === "fee" ? "text-amber-900" : "text-foreground")}>{value}</p>
    </div>
  );
}

export function DemandesView({
  lists,
  spaces,
  mayWrite,
  onApprove,
  onReject,
  onDelete,
  onCancel,
  busy,
}: {
  lists: Record<Status, BookingRequest[]>;
  spaces: Space[];
  mayWrite: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string, keepFee: boolean) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState<Status>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = lists[filter];
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  // A processed request leaves the list: follow it to the next one
  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col rounded-2xl border bg-card p-3 lg:max-h-[calc(100vh-200px)]">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(["PENDING", "APPROVED", "REJECTED"] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                filter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "PENDING" ? "En attente" : s === "APPROVED" ? "Acceptées" : "Refusées / annulées"}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-extrabold",
                  s === "PENDING" && lists.PENDING.length ? "bg-rose-600 text-white" : "bg-black/10"
                )}
              >
                {lists[s].length}
              </span>
            </button>
          ))}
        </div>

        <div className="-mx-1 mt-2 flex-1 space-y-1.5 overflow-y-auto px-1 py-1">
          {!rows.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune demande</p>
          ) : (
            rows.map((r, i) => {
              const on = r.id === selected?.id;
              const labels = labelsOf(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "v-rise flex w-full gap-3 rounded-xl p-2.5 text-left transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none",
                    on ? "bg-indigo-50 ring-2 ring-indigo-600" : "ring-1 ring-border hover:bg-muted/50"
                  )}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black",
                      on ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800"
                    )}
                  >
                    {initialsOf(r.memberName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-extrabold">{r.memberName || "Visiteur"}</span>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {format(new Date(r.createdAt), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </span>
                    <span className="block text-xs font-semibold text-slate-700">
                      {format(new Date(r.startAt), "EEE d MMM", { locale: fr })} · {format(new Date(r.startAt), "HH:mm")}–
                      {format(new Date(r.endAt), "HH:mm")}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {r.kind === "ROOM" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-px text-[11px] font-bold text-slate-700">
                          <DoorOpen className="h-3 w-3" />
                          {r.spaceName || "Salle"}
                        </span>
                      ) : (
                        labels.map((l) => (
                          <span key={l} className="rounded-md bg-indigo-100 px-1.5 py-px text-[11px] font-extrabold text-indigo-800">
                            {l}
                          </span>
                        ))
                      )}
                      {r.cancelledAt ? (
                        <span className="ml-auto flex gap-1">
                          <StatusPill status={r.status} cancelled />
                          <CancelFeeChip r={r} />
                        </span>
                      ) : (r.fee ?? 0) > 0 ? (
                        <span className="ml-auto text-[11px] font-extrabold text-amber-800">{dt(r.fee!)}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {selected ? (
        <RequestDetail
          key={selected.id}
          r={selected}
          spaces={spaces}
          mayWrite={mayWrite}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
          onCancel={onCancel}
          busy={busy}
        />
      ) : (
        <section className="flex min-h-[300px] items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">
          Choisissez une demande à gauche
        </section>
      )}
    </div>
  );
}

function RequestDetail({
  r,
  spaces,
  mayWrite,
  onApprove,
  onReject,
  onDelete,
  onCancel,
  busy,
}: {
  r: BookingRequest;
  spaces: Space[];
  mayWrite: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string, keepFee: boolean) => void;
  busy: boolean;
}) {
  const [keepFee, setKeepFee] = useState(true);
  const labels = labelsOf(r);
  const space = r.kind === "SEAT" ? spaceOfBooking(r, spaces) : spaces.find((s) => s.id === r.spaceId);
  const dayIso = format(new Date(r.startAt), "yyyy-MM-dd");
  const [tableId, setTableId] = useState<string | null>(() => tableOfLabel(space, labels[0])?.id ?? null);
  const table = space?.tables?.find((t) => t.id === tableId) ?? null;

  // Everything else booked that day → who else sits on this slot
  const { data: dayRows = [] } = useQuery({
    queryKey: ["booking-requests", "day", dayIso],
    queryFn: () => bookingRequestsApi.list(undefined, dayIso),
    staleTime: 15_000,
  });
  const others = useMemo(
    () => dayRows.filter((o) => o.id !== r.id && o.status !== "REJECTED" && overlaps(o, r)),
    [dayRows, r]
  );
  const seatInfo = useMemo(() => {
    const out: Record<string, SeatInfo> = {};
    for (const o of others) {
      if (o.kind !== "SEAT" || spaceOfBooking(o, spaces)?.id !== space?.id) continue;
      for (const l of labelsOf(o)) {
        out[l] = { initials: initialsOf(o.memberName), color: "#64748b", pending: o.status === "PENDING", title: o.memberName || "Visiteur" };
      }
    }
    return out;
  }, [others, spaces, space?.id]);
  const conflicts =
    r.kind === "SEAT"
      ? labels.filter((l) => seatInfo[l]).map((l) => `${l} (${seatInfo[l].title})`)
      : others.filter((o) => o.kind === "ROOM" && o.spaceId === r.spaceId).map((o) => o.memberName || "Visiteur");

  const places = r.kind === "SEAT" ? labels.length || r.places || 1 : r.places || 1;

  return (
    <section className="v-rise rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-base font-black text-white">
          {initialsOf(r.memberName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            {r.memberName || "Visiteur"}
            {r.visitorNumber != null ? <span className="text-sm font-bold text-muted-foreground">#{r.visitorNumber}</span> : null}
            <StatusPill status={r.status} cancelled={!!r.cancelledAt} />
            <CancelFeeChip r={r} />
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {r.phone ? (
              <>
                <Phone className="h-3.5 w-3.5" />
                {r.phone} ·{" "}
              </>
            ) : null}
            Demandé le {format(new Date(r.createdAt), "d MMM 'à' HH:mm", { locale: fr })}
          </p>
        </div>
        {mayWrite && r.status === "APPROVED" ? (
          <AlertDialog onOpenChange={(o) => o && setKeepFee(true)}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" disabled={busy}>
                <Ban className="mr-1 h-4 w-4" />
                Annuler
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cette réservation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {r.memberName || "Visiteur"} · {format(new Date(r.startAt), "EEEE d MMM HH:mm", { locale: fr })}. Les
                  places sont libérées et le visiteur prévenu.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {(r.fee ?? 0) > 0 ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm ring-1 ring-amber-200">
                  <Checkbox checked={keepFee} onCheckedChange={(v) => setKeepFee(v === true)} className="mt-0.5" />
                  <span>
                    <span className="block font-bold text-amber-950">Garder les frais · {dt(r.fee!)}</span>
                    <span className="block text-xs text-amber-900/80">
                      Enregistrés en dette, demandés à sa prochaine visite.
                    </span>
                  </span>
                </label>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Garder la réservation</AlertDialogCancel>
                <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => onCancel(r.id, keepFee)}>
                  Annuler la réservation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {mayWrite ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" disabled={busy}>
                <Trash2 className="mr-1 h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette réservation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {r.memberName || "Visiteur"} · {format(new Date(r.startAt), "EEEE d MMM HH:mm", { locale: fr })}
                  {r.status === "APPROVED"
                    ? ". Les places seront libérées, la ligne non payée du journal retirée et le visiteur prévenu."
                    : "."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Garder</AlertDialogCancel>
                <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => onDelete(r.id)}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {r.status === "PENDING" && mayWrite ? (
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => onReject(r.id)}>
              <X className="mr-1 h-4 w-4" />
              Refuser
            </Button>
            <Button disabled={busy} onClick={() => onApprove(r.id)}>
              <Check className="mr-1 h-4 w-4" />
              Accepter
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Jour" value={format(new Date(r.startAt), "EEEE d MMM", { locale: fr })} />
        <Tile label="Créneau" value={`${format(new Date(r.startAt), "HH:mm")} – ${format(new Date(r.endAt), "HH:mm")}`} />
        <Tile
          label="Places"
          value={r.kind === "ROOM" ? `${r.spaceName || "Salle"} · ${places} pers.` : `${places} · ${labels.join(", ") || "—"}`}
        />
        <Tile
          label={r.cancelledAt ? (r.cancelFee ? "Frais gardés (dette)" : "Frais") : "Frais à encaisser"}
          value={r.cancelledAt ? (r.cancelFee ? `${dt(r.cancelFee)}${r.feePaid ? " · réglés" : ""}` : "Aucun") : dt(r.fee ?? 0)}
          tone="fee"
        />
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
          conflicts.length ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-800"
        )}
      >
        {conflicts.length ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
        {conflicts.length
          ? `Déjà demandé sur ce créneau : ${conflicts.join(", ")}`
          : "Aucun conflit sur ce créneau"}
      </div>

      {r.note ? (
        <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <span className="font-bold">Note du visiteur : </span>
          {r.note}
        </p>
      ) : null}

      {space && r.kind === "SEAT" ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">Plan · {space.name}</p>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-indigo-600" />
                  Cette demande
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-slate-500" />
                  Autre réservation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-white shadow-[inset_0_0_0_2px_#059669]" />
                  Libre
                </span>
              </div>
            </div>
            <ChairMap
              space={space}
              picked={labels}
              initials={initialsOf(r.memberName)}
              seatInfo={seatInfo}
              activeTableId={tableId}
              onActiveTable={setTableId}
              showLabels
              showOrder={false}
              height={460}
            />
          </div>
          <div className="space-y-2">
            <TablePhoto space={space} table={table} badge={null} className="h-[170px]" />
            <p className="text-xs text-muted-foreground">Cliquez une table sur le plan pour voir sa photo.</p>
          </div>
        </div>
      ) : space ? (
        <div className="mt-4 max-w-md">
          <TablePhoto space={space} table={null} badge={null} className="h-[170px]" />
        </div>
      ) : r.kind === "SEAT" ? (
        <p className="mt-4 rounded-xl bg-muted/60 px-3 py-6 text-center text-sm text-muted-foreground">
          Plan introuvable pour {labels.join(", ") || "cette demande"}.
        </p>
      ) : null}
    </section>
  );
}
