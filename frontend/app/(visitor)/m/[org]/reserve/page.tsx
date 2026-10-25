"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Armchair,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Loader2,
  MapPin,
  Minus,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuestBanner } from "@/components/visitor/quest/QuestSheet";
import { ChairMap } from "@/components/visitor/reserve/ChairMap";
import { TablePhoto } from "@/components/visitor/reserve/TablePhoto";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { formatDt } from "@/lib/session-pricing";
import { spaceAllowsSeat, spaceAllowsWhole } from "@/lib/space-occupy";
import type { BookingRequest, ReservationRules, Space } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_RULES: ReservationRules = {
  fee: 2,
  feePerPlace: false,
  maxDaysAhead: 14,
  maxPlaces: 4,
  autoApprove: false,
};

const SLOTS = [
  { id: "matin", label: "Matin", start: "09:00", end: "13:00" },
  { id: "aprem", label: "Après-midi", start: "13:00", end: "18:00" },
  { id: "jour", label: "Journée", start: "09:00", end: "18:00" },
  { id: "custom", label: "Sur mesure", start: "", end: "" },
] as const;
type SlotId = (typeof SLOTS)[number]["id"];

const CARD = "rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5";
const LABEL = "px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500";

function feeFor(rules: ReservationRules, places: number) {
  return Math.round(rules.fee * (rules.feePerPlace ? Math.max(1, places) : 1) * 1000) / 1000;
}

function initialsOf(first?: string | null, last?: string | null) {
  const a = (first || "").trim()[0] || "";
  const b = (last || "").trim()[0] || "";
  return (a + b || "V").toUpperCase();
}

export default function ReservePage() {
  const { slug, href } = useOrg();
  const { memberId, confirm } = useVisitorSession();
  const queryClient = useQueryClient();
  const { data: status } = useMobileStatus();
  const member = status?.member;

  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
  });
  const rules: ReservationRules = layout?.seatSettings?.reservation ?? DEFAULT_RULES;

  const bookable = useMemo(
    () => ((layout?.spaces || []) as Space[]).filter((s) => s.openForReservation === true),
    [layout?.spaces]
  );
  const rooms = useMemo(() => bookable.filter((s) => spaceAllowsWhole(s)), [bookable]);
  const seatSpaces = useMemo(
    () =>
      bookable.filter(
        (s) => spaceAllowsSeat(s) && (s.tables || []).some((t) => (t.seats || []).length > 0)
      ),
    [bookable]
  );

  // ----- Step 1: when & how many -----
  const days = useMemo(
    () =>
      Array.from({ length: rules.maxDaysAhead }, (_, i) => {
        const d = addDays(new Date(), i + 1);
        return {
          iso: format(d, "yyyy-MM-dd"),
          top: i === 0 ? "Demain" : format(d, "EEE", { locale: fr }).replace(".", ""),
          num: format(d, "d"),
          long: format(d, "EEEE d MMMM", { locale: fr }),
        };
      }),
    [rules.maxDaysAhead]
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<SlotId>("matin");
  const [customStart, setCustomStart] = useState("10:00");
  const [customEnd, setCustomEnd] = useState("15:00");
  const [kind, setKind] = useState<"SEAT" | "ROOM">("SEAT");
  const [count, setCount] = useState(1);

  useEffect(() => {
    // Picked from Accueil ("Réserver pour plus tard"): /reserve?date=yyyy-MM-dd
    const picked = new URLSearchParams(window.location.search).get("date");
    if (!picked) return;
    const i = days.findIndex((d) => d.iso === picked);
    if (i >= 0) setDayIdx(i);
  }, [days]);
  useEffect(() => {
    if (kind === "SEAT" && !seatSpaces.length && rooms.length) setKind("ROOM");
    if (kind === "ROOM" && !rooms.length && seatSpaces.length) setKind("SEAT");
  }, [kind, seatSpaces.length, rooms.length]);

  const day = days[Math.min(dayIdx, days.length - 1)];
  const slotDef = SLOTS.find((s) => s.id === slot)!;
  const startTime = slot === "custom" ? customStart : slotDef.start;
  const endTime = slot === "custom" ? customEnd : slotDef.end;
  const timeOk = !!startTime && !!endTime && endTime > startTime;
  const maxCount = kind === "SEAT" ? rules.maxPlaces : 20;
  const need = Math.min(count, maxCount);

  // ----- Step 2: where -----
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const zone = seatSpaces.find((s) => s.id === zoneId) || seatSpaces[0] || null;
  const activeTable =
    zone?.tables?.find((t) => t.id === activeTableId) ||
    zone?.tables?.find((t) => (t.seats || []).length > 0) ||
    null;

  const { data: availability } = useQuery({
    queryKey: ["booking-availability", slug, day?.iso, startTime, endTime],
    queryFn: () => mobileApi.bookingAvailability(slug, day!.iso, startTime, endTime),
    enabled: step >= 2 && !!day && timeOk,
    staleTime: 15_000,
  });
  const takenInZone = useMemo(
    () =>
      new Set(
        (availability?.seats || [])
          .filter((s) => !s.spaceId || s.spaceId === zone?.id)
          .map((s) => s.label)
      ),
    [availability?.seats, zone?.id]
  );
  const takenRooms = useMemo(() => new Set(availability?.rooms || []), [availability?.rooms]);

  const toggleSeat = (label: string, tableId: string | null) => {
    if (tableId) setActiveTableId(tableId);
    setPicked((p) => {
      if (p.includes(label)) return p.filter((l) => l !== label);
      const next = [...p, label];
      return next.length > need ? next.slice(next.length - need) : next;
    });
  };
  const pickZone = (id: string) => {
    if (id === zone?.id) return;
    setZoneId(id);
    setActiveTableId(null);
    setPicked([]);
  };

  // ----- Step 3: confirm -----
  const [note, setNote] = useState("");
  const [guest, setGuest] = useState({ firstName: "", lastName: "", phone: "" });
  const [sent, setSent] = useState<BookingRequest | null>(null);
  const places = kind === "SEAT" ? picked.length || need : need;
  const fee = feeFor(rules, places);
  const room = rooms.find((r) => r.id === roomId) || null;
  const tableOfLabel = (label: string) =>
    zone?.tables?.find((t) => (t.seats || []).some((s) => s.label === label)) || null;

  const create = useMutation({
    mutationFn: async () => {
      const booking = {
        kind,
        spaceId: kind === "ROOM" ? roomId || undefined : zone?.id,
        seatLabels: kind === "SEAT" ? picked : undefined,
        seatLabel: kind === "SEAT" ? picked[0] : undefined,
        seatSpaceId: kind === "SEAT" ? zone?.id : undefined,
        places: kind === "ROOM" ? need : undefined,
        date: day!.iso,
        startTime,
        endTime,
        note: note.trim() || undefined,
      };
      if (memberId) return mobileApi.createBookingRequest({ memberId, ...booking });
      const res = await mobileApi.publicBookingRequest({
        orgSlug: slug,
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim() || undefined,
        phone: guest.phone.trim(),
        ...booking,
      });
      confirm(res.member, res.accessToken);
      return res.booking;
    },
    onSuccess: (b) => {
      setSent(b);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!bookable.length && layout) {
    return (
      <div className={cn(CARD, "py-6 text-center")}>
        <CalendarDays className="mx-auto h-8 w-8 text-indigo-600" />
        <p className="mt-2 text-sm font-bold text-slate-900">Aucun espace ouvert à la réservation</p>
        <p className="text-xs text-slate-600">Demandez à l’accueil.</p>
      </div>
    );
  }

  const canNext =
    step === 1
      ? !!day && timeOk
      : step === 2
        ? kind === "SEAT"
          ? picked.length === need
          : !!roomId
        : true;
  const guestOk = !!memberId || (!!guest.firstName.trim() && guest.phone.replace(/\D/g, "").length >= 8);

  const bannerTitle =
    sent ? (sent.status === "APPROVED" ? "Réservation confirmée" : "Demande envoyée")
    : step === 1 ? "Quand venez-vous ?"
    : step === 2 ? (kind === "SEAT" ? "Choisissez vos chaises" : "Choisissez la salle")
    : "Votre réservation";
  const bannerSub =
    sent
      ? sent.status === "APPROVED"
        ? "Vos places vous attendent."
        : "L’accueil confirme, vous êtes prévenu dans l’app."
      : step === 1
        ? "Le jour, l’heure et le nombre de places."
        : step === 2
          ? kind === "SEAT"
            ? picked.length === 0
              ? "Touchez les chaises vertes sur le plan."
              : picked.length === need
                ? "Parfait, vos places sont prêtes."
                : `Encore ${need - picked.length} chaise${need - picked.length > 1 ? "s" : ""} à choisir.`
            : "Une salle pour tout le groupe."
          : `${day?.long} · ${startTime} – ${endTime}`;

  return (
    <div className="space-y-3 pb-2">
      <div className="flex items-center justify-between">
        {step > 1 && !sent ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s))}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-900/5"
          >
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
        ) : (
          <span />
        )}
        {memberId ? (
          <Link href={href("/reservations")} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">
            Mes réservations
          </Link>
        ) : null}
      </div>

      <div className="v-rise overflow-hidden rounded-[24px] shadow-sm">
        <QuestBanner
          tone={sent ? "emerald" : "brand"}
          eyebrow={sent ? "Réservation" : `Réservation · étape ${step}/3`}
          icon={sent ? <Check className="h-5 w-5" /> : step === 2 ? <MapPin className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
          title={bannerTitle}
          subtitle={bannerSub}
          reward={
            step === 3 || sent
              ? { label: "Frais de réservation", value: formatDt(sent?.fee ?? fee) }
              : null
          }
          chip={
            step === 2 && kind === "SEAT" && !sent
              ? { label: "Places", value: `${picked.length}/${need}` }
              : step === 3 || sent
                ? { label: kind === "SEAT" ? "Places" : "Personnes", value: String(sent?.places ?? places) }
                : null
          }
        >
          {!sent ? (
            <span className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span key={n} className="h-1.5 overflow-hidden rounded-full bg-white/25">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-200 transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: n < step ? "100%" : n === step ? (step === 2 && kind === "SEAT" ? `${(picked.length / Math.max(1, need)) * 100}%` : "50%") : "0%" }}
                  />
                </span>
              ))}
            </span>
          ) : null}
        </QuestBanner>
      </div>

      {sent ? (
        <div className="space-y-2">
          <div className={cn(CARD, "space-y-1.5")}>
            <p className="text-sm font-extrabold text-slate-900">
              {format(new Date(sent.startAt), "EEEE d MMMM", { locale: fr })} · {format(new Date(sent.startAt), "HH:mm")} – {format(new Date(sent.endAt), "HH:mm")}
            </p>
            <p className="text-xs text-slate-600">
              {sent.kind === "SEAT" ? (sent.seatLabels || []).join(", ") : sent.spaceName}
            </p>
            <p className="text-xs font-bold text-amber-800">
              Frais {formatDt(sent.fee ?? 0)} · réglés à l’accueil le jour J
            </p>
          </div>
          <Link
            href={href("/reservations")}
            className="flex h-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30"
          >
            Voir mes réservations
          </Link>
        </div>
      ) : step === 1 ? (
        <>
          <section className={cn(CARD, "v-rise [animation-delay:40ms]")}>
            <p className={LABEL}>Quel jour ?</p>
            <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Jour">
              {days.map((d, i) => {
                const on = i === dayIdx;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDayIdx(i)}
                    className={cn(
                      "flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl capitalize transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95 motion-reduce:transition-none",
                      on ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-slate-50 text-slate-900 ring-1 ring-slate-200"
                    )}
                  >
                    <span className="text-[10px] font-bold">{d.top}</span>
                    <span className="text-base font-black leading-tight">{d.num}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 px-0.5 text-xs text-slate-600">
              Jusqu’à {rules.maxDaysAhead} jours à l’avance · aujourd’hui : demandez à l’accueil
            </p>
          </section>

          <section className={cn(CARD, "v-rise [animation-delay:80ms]")}>
            <p className={LABEL}>À quelle heure ?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Créneau">
              {SLOTS.map((s) => {
                const on = s.id === slot;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSlot(s.id)}
                    className={cn(
                      "min-h-[54px] rounded-2xl px-3 py-2 text-left transition-[background-color,box-shadow] duration-200 active:scale-[0.98] motion-reduce:transition-none",
                      on ? "bg-indigo-50 text-indigo-950 ring-2 ring-indigo-600" : "bg-slate-50 text-slate-900 ring-1 ring-slate-200"
                    )}
                  >
                    <span className="block text-[13px] font-extrabold">{s.label}</span>
                    <span className="block text-xs font-semibold text-slate-600">
                      {s.id === "custom" ? "Choisir l’heure" : `${s.start} – ${s.end}`}
                    </span>
                  </button>
                );
              })}
            </div>
            {slot === "custom" ? (
              <div className="v-rise mt-2 grid grid-cols-2 gap-1.5">
                <label className="space-y-1 text-[11px] font-bold text-slate-600">
                  De
                  <Input type="time" step={900} className="h-11 text-base font-bold" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </label>
                <label className="space-y-1 text-[11px] font-bold text-slate-600">
                  À
                  <Input type="time" step={900} className="h-11 text-base font-bold" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </label>
                {!timeOk ? <p className="col-span-2 text-xs font-medium text-rose-600">La fin doit être après le début.</p> : null}
              </div>
            ) : null}
          </section>

          <section className={cn(CARD, "v-rise [animation-delay:120ms]")}>
            {seatSpaces.length && rooms.length ? (
              <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
                {(
                  [
                    { id: "SEAT", label: "Places open space", icon: Armchair },
                    { id: "ROOM", label: "Salle entière", icon: DoorOpen },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={kind === k.id}
                    onClick={() => {
                      setKind(k.id);
                      setPicked([]);
                      setRoomId(null);
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-extrabold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                      kind === k.id ? "bg-white text-indigo-950 shadow-sm" : "text-slate-600"
                    )}
                  >
                    <k.icon className="h-4 w-4" />
                    {k.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-slate-900">
                  {kind === "SEAT" ? `${need} place${need > 1 ? "s" : ""}` : `${need} personne${need > 1 ? "s" : ""}`}
                </span>
                <span className="block text-xs text-slate-600">
                  {kind === "SEAT" ? `Pour vous et vos collègues · max ${rules.maxPlaces}` : "On vous propose la bonne salle"}
                </span>
              </span>
              <button
                type="button"
                aria-label="Moins"
                disabled={need <= 1}
                onClick={() => setCount(Math.max(1, need - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-800 transition-transform active:scale-90 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span key={need} className="v-pop min-w-[26px] text-center text-2xl font-black tabular-nums">{need}</span>
              <button
                type="button"
                aria-label="Plus"
                disabled={need >= maxCount}
                onClick={() => setCount(Math.min(maxCount, need + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition-transform active:scale-90 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: Math.min(need, 8) }, (_, i) => (
                <span key={i} className="v-pop flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700" style={{ animationDelay: `${i * 30}ms` }}>
                  <UsersRound className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </section>
        </>
      ) : step === 2 && kind === "SEAT" ? (
        <>
          {seatSpaces.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {seatSpaces.map((s) => {
                const on = s.id === zone?.id;
                const free = (s.tables || []).reduce((n, t) => n + (t.seats || []).length, 0);
                const photo = s.galleryUrls?.[0];
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickZone(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl bg-white p-1.5 text-left transition-shadow duration-200 motion-reduce:transition-none",
                      on ? "ring-2 ring-indigo-600" : "ring-1 ring-slate-200"
                    )}
                  >
                    <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-b from-indigo-100 to-indigo-200">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-extrabold text-slate-900">{s.name}</span>
                      <span className="block text-[11px] font-bold text-emerald-700">{free} chaises</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {zone ? <TablePhoto space={zone} table={activeTable} /> : null}

          {zone ? (
            <section className={CARD}>
              <div className="flex items-center justify-between px-0.5">
                <p className={LABEL}>Plan · {zone.name}</p>
                <span className="text-[11px] font-semibold text-slate-600">1 chaise = 1 place</span>
              </div>
              <div className="mt-1.5">
                <ChairMap
                  space={zone}
                  taken={takenInZone}
                  picked={picked}
                  activeTableId={activeTable?.id ?? null}
                  onActiveTable={setActiveTableId}
                  onToggle={toggleSeat}
                  initials={initialsOf(member?.firstName || guest.firstName, member?.lastName || guest.lastName)}
                />
              </div>
              <div className="mt-2 flex justify-center gap-3.5 text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="flex flex-col items-center gap-px">
                    <span className="h-[3px] w-3 rounded-sm bg-emerald-600" />
                    <span className="h-2 w-2.5 rounded-[3px] bg-white shadow-[inset_0_0_0_2px_#059669]" />
                  </span>
                  Libre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-[6px] font-black text-white">
                    {initialsOf(member?.firstName || guest.firstName, member?.lastName || guest.lastName)}
                  </span>
                  Vous
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-200" />
                  Occupée
                </span>
              </div>
            </section>
          ) : null}
        </>
      ) : step === 2 ? (
        <div className="space-y-2">
          {rooms.map((r, i) => {
            const on = r.id === roomId;
            const busy = takenRooms.has(r.id);
            const photo = r.galleryUrls?.[0];
            return (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => setRoomId(r.id)}
                className={cn(
                  "v-rise flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-white p-2 text-left shadow-sm transition-shadow duration-200 disabled:opacity-55 motion-reduce:transition-none",
                  on ? "ring-2 ring-indigo-600" : "ring-1 ring-slate-900/5"
                )}
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-100 to-indigo-200">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <DoorOpen className="absolute inset-0 m-auto h-7 w-7 text-indigo-400" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900">{r.name}</span>
                  <span className="block text-xs text-slate-600">
                    {r.capacityNormal ? `Jusqu’à ${r.capacityNormal} personnes` : "Salle entière"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold",
                    busy ? "bg-rose-100 text-rose-800" : on ? "bg-indigo-600 text-white" : "bg-emerald-100 text-emerald-800"
                  )}
                >
                  {busy ? "Prise" : on ? "Choisie ✓" : "Libre"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <section className={cn(CARD, "v-rise space-y-2")}>
            <p className={LABEL}>{kind === "SEAT" ? "Vos places" : "Votre salle"}</p>
            {kind === "SEAT" ? (
              picked.map((label, i) => {
                const t = tableOfLabel(label);
                return (
                  <div key={label} className="flex items-center gap-2.5 rounded-2xl p-2 ring-1 ring-slate-200">
                    <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-b from-indigo-100 to-indigo-200">
                      {t?.imageUrl || t?.galleryUrls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.imageUrl || t.galleryUrls![0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Armchair className="absolute inset-0 m-auto h-5 w-5 text-indigo-400" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-slate-900">{label}</span>
                      <span className="block truncate text-xs text-slate-600">
                        {t?.description?.trim() || (t ? `${t.name} · ${zone?.name}` : zone?.name)}
                      </span>
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-300 text-[10px] font-black text-amber-950">
                      {i + 1}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl p-2.5 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200">
                {room?.name} · {need} personne{need > 1 ? "s" : ""}
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 px-3 py-1">
              {[
                ["Frais de réservation", rules.feePerPlace && kind === "SEAT" ? `${formatDt(rules.fee)} × ${places} = ${formatDt(fee)}` : formatDt(fee)],
                ["Sur place", "Tarif auto · selon le temps"],
                ["Paiement", "À l’accueil, le jour J"],
              ].map(([k, v], i) => (
                <div key={k} className={cn("flex justify-between gap-3 py-2 text-[13px]", i < 2 && "border-b border-slate-200/70")}>
                  <span className="text-slate-600">{k}</span>
                  <span className="text-right font-extrabold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <label className="block space-y-1 text-[11px] font-bold text-slate-600">
              Note pour l’accueil (facultatif)
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Atelier, besoin d’un écran…" />
            </label>
          </section>

          {!memberId ? (
            <section className={cn(CARD, "space-y-2")}>
              <p className={LABEL}>Vos coordonnées</p>
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-11" placeholder="Prénom" autoComplete="given-name" value={guest.firstName} onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))} />
                <Input className="h-11" placeholder="Nom" autoComplete="family-name" value={guest.lastName} onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))} />
              </div>
              <Input className="h-11" type="tel" inputMode="tel" placeholder="Téléphone (ex. 22 123 456)" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
            </section>
          ) : null}
        </>
      )}

      {!sent ? (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 space-y-2 rounded-3xl bg-white/95 p-2.5 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
          {step === 2 && kind === "SEAT" ? (
            <div className="flex min-h-[26px] items-center gap-1.5 overflow-hidden">
              {picked.length ? (
                picked.map((l, i) => (
                  <span key={l} className="v-pop inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-50 py-0.5 pl-0.5 pr-2.5 text-xs font-extrabold text-indigo-900 ring-1 ring-indigo-200">
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-300 text-[10px] font-black text-amber-950">{i + 1}</span>
                    {l}
                  </span>
                ))
              ) : (
                <span className="text-xs font-semibold text-slate-600">Touchez {need} chaise{need > 1 ? "s" : ""} verte{need > 1 ? "s" : ""} sur le plan</span>
              )}
            </div>
          ) : step === 1 ? (
            <p className="text-center text-xs text-slate-600">
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-extrabold text-amber-900">
                Frais de réservation {formatDt(feeFor(rules, need))}
                {rules.feePerPlace && kind === "SEAT" ? ` (${formatDt(rules.fee)}/place)` : ""}
              </span>{" "}
              · tarif sur place inchangé
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canNext || (step === 3 && (!guestOk || create.isPending))}
            onClick={() => {
              if (step === 3) create.mutate();
              else setStep((s) => (s + 1) as 2 | 3);
            }}
            className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30 transition-opacity duration-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-600 disabled:shadow-none motion-reduce:transition-none"
          >
            {canNext && step === 2 ? (
              <span aria-hidden className="v-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/0 via-white/35 to-white/0" />
            ) : null}
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="relative">
              {step === 1
                ? kind === "SEAT" ? "Choisir mes places sur le plan" : "Choisir la salle"
                : step === 2
                  ? kind === "SEAT"
                    ? picked.length === need ? `Continuer · ${need} place${need > 1 ? "s" : ""}` : `Encore ${need - picked.length} chaise${need - picked.length > 1 ? "s" : ""} à choisir`
                    : roomId ? "Continuer" : "Choisissez une salle"
                  : create.isPending ? "Envoi…" : `Envoyer ma demande · ${formatDt(fee)}`}
            </span>
            {step < 3 ? <ChevronRight className="relative h-4 w-4" /> : null}
          </button>
          {step === 3 ? (
            <p className="text-center text-[11px] text-slate-600">
              {rules.autoApprove ? "Confirmée tout de suite" : "L’accueil confirme · vous êtes prévenu dans l’app"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
