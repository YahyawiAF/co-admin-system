"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Check, CreditCard, DoorOpen, Hourglass, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChairMap, PLAN_SEAT, tableShort } from "@/components/visitor/reserve/ChairMap";
import { TablePhoto } from "@/components/visitor/reserve/TablePhoto";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { formatDt } from "@/lib/session-pricing";
import type { BookingRequest, Space, SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingFeeNotice, bookingFeesKey } from "@/components/visitor/BookingFeeNotice";

const CARD = "rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5";
const LABEL = "text-[11px] font-extrabold uppercase tracking-[.06em] text-slate-500";
const EMPTY = new Set<string>();

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function labelsOf(b: BookingRequest) {
  return b.seatLabels?.length ? b.seatLabels : b.seatLabel ? [b.seatLabel] : [];
}

/** "Demain", "Aujourd’hui", "Jeudi"… */
function whenWord(start: Date, now: number) {
  const d = differenceInCalendarDays(start, now);
  if (d === 0) return "Aujourd’hui";
  if (d === 1) return "Demain";
  return cap(format(start, "EEEE", { locale: fr }));
}

/** Ticket eyebrow: "Aujourd’hui", "Demain", "Dans 5 jours" (the date line has the weekday). */
function soon(start: Date, now: number) {
  const d = differenceInCalendarDays(start, now);
  return d <= 1 ? whenWord(start, now) : `Dans ${d} jours`;
}

function partOfDay(start: Date, end: Date) {
  const hours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10;
  if (hours >= 7) return "Journée";
  const h = start.getHours();
  return `${h < 12 ? "Matin" : h < 18 ? "Après-midi" : "Soir"} · ${String(hours).replace(".", ",")} h`;
}

/** "Table C-1" → "C-1" (the table is already named next to it) */
const seatShort = (label: string) => label.replace(/^table\s+/i, "");

function joinLabels(labels: string[]) {
  const l = labels.map(seatShort);
  if (l.length < 2) return l[0] || "";
  return `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
}

function StatusChip({ b }: { b: BookingRequest }) {
  const status = b.status;
  if (b.cancelledAt) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">Annulée</span>
        {b.cancelFee ? (
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-[11px] font-extrabold",
              b.feePaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            )}
          >
            {b.feePaid ? `Frais ${formatDt(b.cancelFee)} réglés` : `Frais ${formatDt(b.cancelFee)} à régler`}
          </span>
        ) : null}
      </span>
    );
  }
  const cls =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PENDING"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-extrabold", cls)}>
      {status === "APPROVED" ? "Confirmée" : status === "PENDING" ? "En attente" : "Refusée"}
    </span>
  );
}

export default function MyReservationsPage() {
  const { href, slug } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();
  const { data: status } = useMobileStatus();
  const [tab, setTab] = useState<"next" | "past">("next");
  const [selId, setSelId] = useState<string | null>(null);
  const [showPlace, setShowPlace] = useState(false);

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
    onSuccess: (res) => {
      toast.success(
        res.cancelFee
          ? `Réservation annulée · frais ${formatDt(res.cancelFee)} à régler à votre prochaine visite`
          : "Demande annulée"
      );
      setSelId(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings", memberId] });
      queryClient.invalidateQueries({ queryKey: bookingFeesKey(memberId) });
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
    p.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    return { next: n, past: p };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

  if (!memberId) {
    return (
      <div className={cn(CARD, "p-3 py-6 text-center")}>
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

  const selected = next.find((b) => b.id === selId) || next[0] || null;
  const others = next.filter((b) => b.id !== selected?.id);
  const select = (id: string) => {
    setSelId(id);
    setShowPlace(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-3 pb-2">
      <BookingFeeNotice memberId={memberId} />
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
      ) : tab === "next" ? (
        selected ? (
          <>
            <Ticket
              key={selected.id}
              b={selected}
              now={now}
              spaces={spaces}
              initials={initials}
              showPlace={showPlace}
              onTogglePlace={() => setShowPlace((v) => !v)}
              cancelling={cancel.isPending}
              onCancel={() => cancel.mutate(selected.id)}
            />
            {others.length ? (
              <>
                <p className={cn(LABEL, "px-1 pt-1")}>Ensuite</p>
                {others.map((b, i) => (
                  <Row key={b.id} b={b} now={now} spaces={spaces} index={i} onClick={() => select(b.id)} />
                ))}
              </>
            ) : null}
          </>
        ) : (
          <Empty title="Aucune réservation à venir" />
        )
      ) : past.length ? (
        past.map((b, i) => <Row key={b.id} b={b} now={now} spaces={spaces} index={i} past />)
      ) : (
        <Empty title="Rien pour l’instant" />
      )}

      <Link
        href={href("/reserve")}
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-extrabold transition-colors duration-200",
          tab === "next" && selected
            ? "bg-white text-indigo-800 ring-[1.5px] ring-inset ring-indigo-200 hover:bg-indigo-50"
            : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
        )}
      >
        <Plus className="h-4 w-4" />
        Nouvelle réservation
      </Link>
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className={cn(CARD, "v-rise p-3 py-6 text-center")}>
      <CalendarDays className="mx-auto h-8 w-8 text-indigo-600" />
      <p className="mt-2 text-sm font-bold text-slate-900">{title}</p>
      <p className="text-xs text-slate-600">Réservez vos places pour demain ou plus tard.</p>
    </div>
  );
}

function placeOf(b: BookingRequest, spaces: Space[]) {
  const labels = labelsOf(b);
  const space = spaces.find((s) => s.id === (b.seatSpaceId || b.spaceId)) || null;
  const table =
    space?.tables?.find((t) => (t.seats || []).some((s) => s.label === labels[0])) || null;
  return { labels, space, table };
}

/** The next reservation, as a ticket: status, when, where (mini table), what to pay, steps. */
function Ticket({
  b,
  now,
  spaces,
  initials,
  showPlace,
  onTogglePlace,
  cancelling,
  onCancel,
}: {
  b: BookingRequest;
  now: number;
  spaces: Space[];
  initials: string;
  showPlace: boolean;
  onTogglePlace: () => void;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const ok = b.status === "APPROVED";
  const start = new Date(b.startAt);
  const end = new Date(b.endAt);
  const { labels, space, table } = placeOf(b, spaces);
  const room = b.kind === "ROOM";
  const where = room
    ? b.spaceName || space?.name || "Salle"
    : [b.spaceName || space?.name || "Open space", table?.name].filter(Boolean).join(" · ");
  const seats = room
    ? `${b.places ?? 1} personne${(b.places ?? 1) > 1 ? "s" : ""}`
    : labels.length > 1
      ? `Chaises ${joinLabels(labels)} · ${labels.length} places`
      : labels.length
        ? `Chaise ${seatShort(labels[0])} · 1 place`
        : "Place attribuée à l’arrivée";
  const fee = b.fee ?? 0;
  const canSeePlace = !room && !!space;
  const [confirming, setConfirming] = useState(false);
  const feeKept = ok && fee > 0;

  const steps = [
    { label: "Demande envoyée", state: 2 },
    { label: ok ? "Acceptée" : "Acceptation…", state: ok ? 2 : 1 },
    { label: "Jour J : scannez le QR", state: ok ? 1 : 0 },
  ];

  return (
    <article className={cn(CARD, "v-rise overflow-hidden shadow-[0_12px_26px_-18px_rgba(15,23,42,.5)]")}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-3",
          ok
            ? "bg-gradient-to-br from-emerald-600 to-emerald-500 text-white"
            : "bg-gradient-to-br from-amber-500 to-amber-400 text-amber-950"
        )}
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/25">
          {ok ? <Check className="h-4 w-4" strokeWidth={3} /> : <Hourglass className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-black">{ok ? "Confirmée" : "En attente de l’accueil"}</p>
          <p className="text-xs font-semibold opacity-90">
            {ok ? `Votre ${room ? "salle" : "place"} vous attend` : "Vous êtes notifié dès la réponse"}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2.5 px-3.5 pt-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.06em] text-indigo-600">{soon(start, now)}</p>
          <p className="mt-0.5 text-[22px] font-black leading-tight text-slate-900">
            {cap(format(start, "EEEE d MMM", { locale: fr }))}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black tabular-nums text-slate-900">
            {format(start, "HH:mm")} → {format(end, "HH:mm")}
          </p>
          <p className="text-xs text-slate-600">{partOfDay(start, end)}</p>
        </div>
      </div>

      <div className="mx-3.5 mt-3 flex items-center gap-3 rounded-[18px] bg-slate-50 p-2.5">
        {room ? (
          <span className="flex h-[70px] w-[92px] shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <DoorOpen className="h-8 w-8" />
          </span>
        ) : table ? (
          <MiniTable table={table} picked={labels} initials={initials} />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={LABEL}>Où</p>
          <p className="mt-0.5 text-[15px] font-black leading-tight text-slate-900">{where}</p>
          <p className="mt-0.5 text-[13px] text-slate-700">{seats}</p>
        </div>
      </div>

      <div className="mx-3.5 mt-2 flex items-center gap-2.5 rounded-[14px] bg-amber-50 px-2.5 py-2 ring-1 ring-inset ring-amber-200">
        <CreditCard className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-[13px] text-amber-950">
          <b>À l’arrivée :</b>{" "}
          {fee > 0
            ? `frais ${formatDt(fee)}${labels.length > 1 ? ` (${labels.length} places)` : ""} + votre temps`
            : "votre temps (tarif auto)"}
          , à l’accueil
        </p>
      </div>

      <ol className="relative mx-3.5 mt-3 grid grid-cols-3">
        <span aria-hidden className="absolute left-[16.6%] right-[16.6%] top-[11px] h-[3px] rounded-full bg-slate-200" />
        <span
          aria-hidden
          className="absolute left-[16.6%] top-[11px] h-[3px] rounded-full bg-emerald-500 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: ok ? "66.8%" : "33.4%" }}
        />
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black",
                s.state === 2
                  ? "bg-emerald-500 text-white"
                  : s.state === 1
                    ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                    : "bg-white text-slate-400 ring-2 ring-inset ring-slate-200"
              )}
            >
              {s.state === 2 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="text-[11px] font-bold leading-tight text-slate-700">{s.label}</span>
          </li>
        ))}
      </ol>

      {showPlace && space ? (
        <div className="v-rise mx-3.5 mt-3 space-y-2">
          <TablePhoto space={space} table={table} badge={null} className="h-[110px]" />
          <ChairMap
            space={space}
            taken={EMPTY}
            picked={labels}
            activeTableId={table?.id ?? null}
            initials={initials}
            showOrder={false}
          />
        </div>
      ) : null}

      <div className="flex gap-2 px-3.5 pb-3.5 pt-3">
        {canSeePlace ? (
          <button
            type="button"
            onClick={onTogglePlace}
            className="h-11 flex-1 rounded-full bg-indigo-600 text-sm font-black text-white transition-[background-color,transform] duration-150 hover:bg-indigo-700 active:scale-[.97] motion-reduce:transition-none"
          >
            {showPlace ? "Masquer ma place" : "Voir ma place"}
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {!confirming ? (
          <button
            type="button"
            disabled={cancelling}
            onClick={() => setConfirming(true)}
            className="h-11 rounded-full bg-white px-4 text-sm font-extrabold text-rose-700 ring-[1.5px] ring-inset ring-rose-200 transition-colors duration-200 hover:bg-rose-50 disabled:opacity-50"
          >
            Annuler
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div className="v-rise mx-3.5 mb-3.5 rounded-[18px] bg-rose-50 p-3 ring-1 ring-inset ring-rose-200">
          <p className="text-sm font-black text-rose-950">
            {ok ? "Annuler cette réservation ?" : "Annuler cette demande ?"}
          </p>
          <p className="mt-0.5 text-xs text-rose-900/80">
            {feeKept
              ? `Les frais de ${formatDt(fee)} restent dus : ils seront demandés à votre prochaine visite.`
              : "Gratuit : la demande n’était pas encore acceptée."}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 flex-1 rounded-full bg-white text-sm font-extrabold text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-slate-50"
            >
              Garder
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={onCancel}
              className="h-10 flex-1 rounded-full bg-rose-600 text-sm font-extrabold text-white transition-colors duration-150 hover:bg-rose-700 disabled:opacity-50"
            >
              {feeKept ? `Annuler · ${formatDt(fee)} dus` : "Oui, annuler"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** One line per reservation: date tile, time, where, status. */
function Row({
  b,
  now,
  spaces,
  index,
  past,
  onClick,
}: {
  b: BookingRequest;
  now: number;
  spaces: Space[];
  index: number;
  past?: boolean;
  onClick?: () => void;
}) {
  const start = new Date(b.startAt);
  const { labels, space, table } = placeOf(b, spaces);
  const what =
    b.kind === "ROOM"
      ? `${b.spaceName || space?.name || "Salle"} · ${b.places ?? 1} pers.`
      : [b.spaceName || space?.name || "Open space", table?.name, labels.map(seatShort).join(", ")].filter(Boolean).join(" · ");
  const body = (
    <>
      <span
        className={cn(
          "flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl leading-tight",
          past ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-800"
        )}
      >
        <span className="text-[10px] font-extrabold uppercase">{format(start, "EEE", { locale: fr }).replace(".", "")}</span>
        <span className="text-[19px] font-black">{format(start, "d")}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-900">
          {past ? cap(format(start, "d MMM", { locale: fr })) : whenWord(start, now)} · {format(start, "HH:mm")} →{" "}
          {format(new Date(b.endAt), "HH:mm")}
        </span>
        <span className="mt-px block truncate text-xs text-slate-600">{what}</span>
      </span>
      {past && b.status === "APPROVED" ? (
        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">Passée</span>
      ) : (
        <StatusChip b={b} />
      )}
    </>
  );
  const cls = cn(CARD, "v-rise flex w-full items-center gap-2.5 p-2.5 text-left");
  const style = { animationDelay: `${Math.min(index, 6) * 40}ms` };
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-transform duration-150 active:scale-[.98] motion-reduce:transition-none")} style={style}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

/** The booked table seen from above (real chair positions), my chairs in color. */
function MiniTable({ table, picked, initials }: { table: SpaceTable; picked: string[]; initials: string }) {
  const seats = (table.seats || []).filter((s) => s.isActive !== false);
  const xs = [0, table.width, ...seats.flatMap((s) => [s.offsetX, s.offsetX + PLAN_SEAT])];
  const ys = [0, table.height, ...seats.flatMap((s) => [s.offsetY, s.offsetY + PLAN_SEAT])];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  const k = Math.min(92 / w, 70 / h);
  const seat = Math.max(12, PLAN_SEAT * k);
  return (
    <div aria-hidden className="relative h-[70px] w-[92px] shrink-0">
      <span
        className="absolute flex items-center justify-center rounded-lg bg-slate-200 text-xs font-black text-slate-600"
        style={{ left: (0 - minX) * k, top: (0 - minY) * k, width: table.width * k, height: table.height * k }}
      >
        {tableShort(table.name)}
      </span>
      {seats.map((s) => {
        const mine = picked.includes(s.label);
        return (
          <span
            key={s.id}
            className={cn(
              "absolute flex items-center justify-center rounded-md text-[8px] font-black",
              mine
                ? "bg-indigo-600 text-white ring-2 ring-indigo-200"
                : "border-[1.5px] border-slate-300 bg-white text-slate-400"
            )}
            style={{
              left: (s.offsetX - minX) * k + (PLAN_SEAT * k - seat) / 2,
              top: (s.offsetY - minY) * k + (PLAN_SEAT * k - seat) / 2,
              width: seat,
              height: seat,
            }}
          >
            {mine ? initials : null}
          </span>
        );
      })}
    </div>
  );
}
