"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Hand } from "lucide-react";
import type { Space, SpaceSeat, SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Seat box size used by the floor-plan editor (offsets are the box's top-left). */
export const PLAN_SEAT = 28;
const PAD = 26;
/** Smallest comfortable tap target (px). */
const HIT = 44;

/** Who sits on a chair (admin views): initials + a color per booking. */
export type SeatInfo = {
  initials: string;
  color: string;
  /** Waiting for approval: outlined instead of filled */
  pending?: boolean;
  title?: string;
};

export type ChairState = "free" | "mine" | "taken" | "info";

type Chair = {
  label: string;
  tableId: string | null;
  cx: number;
  cy: number;
  /** 0 = backrest up (table below), 180, -90, 90 */
  rot: number;
};

/** Short table label: "Table C" → "C", "G" → "G". */
export function tableShort(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return last.length <= 3 ? last.toUpperCase() : name.slice(0, 3);
}

export function chairSide(t: Pick<SpaceTable, "width" | "height">, s: Pick<SpaceSeat, "offsetX" | "offsetY">) {
  if (s.offsetY + PLAN_SEAT <= 2) return 0;
  if (s.offsetY >= t.height - 2) return 180;
  if (s.offsetX + PLAN_SEAT <= 2) return -90;
  if (s.offsetX >= t.width - 2) return 90;
  return 0;
}

/** A chair seen from above, backrest away from the table. */
export function ChairShape({
  state,
  info,
  animate = true,
  delay = 0,
}: {
  state: ChairState;
  info?: SeatInfo;
  animate?: boolean;
  delay?: number;
}) {
  const back =
    state === "taken" ? "#cbd5e1" : state === "mine" ? "rgb(var(--indigo-900))" : state === "info" ? info?.color : "#059669";
  const seat: CSSProperties =
    state === "taken"
      ? { background: "#e2e8f0" }
      : state === "mine"
        ? { background: "rgb(var(--indigo-600))", boxShadow: "0 4px 8px -3px rgb(var(--indigo-600) / .5)" }
        : state === "info"
          ? info?.pending
            ? { background: "#fff", boxShadow: `inset 0 0 0 2px ${info.color}` }
            : { background: info?.color }
          : { background: "#fff", boxShadow: "inset 0 0 0 2px #059669, 0 2px 3px -1px rgba(15,23,42,.2)" };
  return (
    <span
      className={cn("relative block h-full w-full", animate && (state === "mine" ? "v-tuck" : state === "free" ? "v-breathe" : ""))}
      style={{ animationDelay: state === "mine" ? "0s" : `${delay.toFixed(2)}s` }}
    >
      <span
        className="absolute inset-x-[5%] top-0 h-[23%] rounded-t-[3px] rounded-b-[2px] transition-colors duration-200 motion-reduce:transition-none"
        style={{ background: back }}
      />
      <span
        className="absolute inset-x-[14%] bottom-[4%] top-[28%] rounded-[4px_4px_7px_7px] transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none"
        style={seat}
      />
    </span>
  );
}

/** Upright marker on a chair: your initials, someone's initials, or a person. */
export function ChairMarker({
  state,
  info,
  initials,
  size,
}: {
  state: ChairState;
  info?: SeatInfo;
  initials: string;
  size: number;
}) {
  if (state === "free") return null;
  const font = Math.max(7, Math.round(size * 0.36));
  if (state === "mine") {
    return (
      <span
        className="v-pop flex h-full w-full items-center justify-center rounded-full bg-white font-black tracking-tight text-indigo-700 ring-[1.5px] ring-indigo-600"
        style={{ fontSize: font }}
      >
        {initials}
      </span>
    );
  }
  if (state === "info" && info) {
    return (
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-black tracking-tight"
        style={{
          fontSize: font,
          ...(info.pending
            ? { background: "#fff", color: info.color, boxShadow: `0 0 0 1.5px ${info.color}` }
            : { background: "#fff", color: info.color, boxShadow: "0 1px 2px rgba(15,23,42,.25)" }),
        }}
      >
        {info.initials}
      </span>
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100">
      <svg aria-hidden width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="#64748b">
        <circle cx="12" cy="7" r="5" />
        <path d="M3 22a9 9 0 0 1 18 0z" />
      </svg>
    </span>
  );
}

/** Gold order badge + small sparks for a chair you just picked. */
export function PickedBurst({ x, y, order, chairPx, big = false }: { x: number; y: number; order: number; chairPx: number; big?: boolean }) {
  const b = big ? 20 : 16;
  const r = big ? 1.6 : 1;
  return (
    <span className="pointer-events-none">
      <span
        className="v-pop absolute flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-300 font-black text-amber-950 shadow-[0_0_0_2px_#fff,0_3px_6px_-2px_rgba(217,119,6,.7)] [animation-delay:.1s]"
        style={{ left: x + chairPx * 0.15, top: y - chairPx / 2 - b * 0.6, width: b, height: b, fontSize: big ? 12 : 10 }}
      >
        {order + 1}
      </span>
      {[
        [-14, -10, "bg-amber-400"],
        [14, -10, "bg-indigo-300"],
        [0, -15, "bg-emerald-400"],
      ].map(([sx, sy, bg]) => (
        <span
          key={`${sx}${sy}`}
          className={cn("v-spark absolute h-[5px] w-[5px] rounded-full", bg as string)}
          style={{ left: x - 2.5, top: y - 2.5, ["--tx" as string]: `${(sx as number) * r}px`, ["--ty" as string]: `${(sy as number) * r}px` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/**
 * Floor-plan map of one space: real tables + chairs turned toward their table.
 * - Visitor: tables are the tap targets (≥ 44 px), tapping one opens the table zoom.
 * - Admin: chairs carry who booked them (`seatInfo`) and can be clicked.
 */
export function ChairMap({
  space,
  taken,
  picked = [],
  initials = "",
  activeTableId = null,
  onActiveTable,
  onSeat,
  seatTap = "all",
  seatInfo,
  guide = false,
  showLabels = false,
  showOrder = true,
  focus = null,
  tip,
  height = 250,
}: {
  space: Space;
  /** Seat labels already requested on that slot (shown grey) */
  taken?: Set<string>;
  /** Highlighted labels ("you" / this request), in order */
  picked?: string[];
  initials?: string;
  activeTableId?: string | null;
  /** Makes tables tappable */
  onActiveTable?: (tableId: string) => void;
  /** Makes chairs tappable (see `seatTap`) */
  onSeat?: (label: string, tableId: string | null) => void;
  /** "all" chairs, or only "loose" ones (not around a table) */
  seatTap?: "all" | "loose";
  /** Admin: who sits where */
  seatInfo?: Record<string, SeatInfo>;
  /** "Touchez une table" hint on the active table */
  guide?: boolean;
  /** Seat label tag under picked chairs */
  showLabels?: boolean;
  showOrder?: boolean;
  /** Label to ring + show `tip` above */
  focus?: string | null;
  tip?: string;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(340);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth || 340));
    ro.observe(el);
    setBoxW(el.clientWidth || 340);
    return () => ro.disconnect();
  }, []);

  const tables = useMemo(() => space.tables || [], [space.tables]);
  const chairs = useMemo<Chair[]>(() => {
    const out: Chair[] = [];
    for (const t of tables) {
      for (const s of t.seats || []) {
        if (s.isActive === false) continue;
        out.push({
          label: s.label,
          tableId: t.id,
          cx: t.x + s.offsetX + PLAN_SEAT / 2,
          cy: t.y + s.offsetY + PLAN_SEAT / 2,
          rot: chairSide(t, s),
        });
      }
    }
    for (const s of space.seats || []) {
      if (s.tableId || s.isActive === false) continue;
      out.push({ label: s.label, tableId: null, cx: s.offsetX + PLAN_SEAT / 2, cy: s.offsetY + PLAN_SEAT / 2, rot: 0 });
    }
    return out;
  }, [tables, space.seats]);

  const view = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + t.width); maxY = Math.max(maxY, t.y + t.height);
    }
    for (const c of chairs) {
      minX = Math.min(minX, c.cx - PLAN_SEAT / 2); minY = Math.min(minY, c.cy - PLAN_SEAT / 2);
      maxX = Math.max(maxX, c.cx + PLAN_SEAT / 2); maxY = Math.max(maxY, c.cy + PLAN_SEAT / 2);
    }
    if (!Number.isFinite(minX)) return null;
    const sc = Math.min((boxW - PAD * 2) / Math.max(1, maxX - minX), (height - PAD * 2) / Math.max(1, maxY - minY), 1.4);
    const ox = (boxW - (maxX - minX) * sc) / 2;
    const oy = (height - (maxY - minY) * sc) / 2;
    return { sc, X: (v: number) => ox + (v - minX) * sc, Y: (v: number) => oy + (v - minY) * sc };
  }, [tables, chairs, boxW, height]);

  if (!view) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-600">
        Plan pas encore dessiné pour cet espace.
      </div>
    );
  }

  const chairPx = Math.max(13, Math.min(26, PLAN_SEAT * view.sc));
  const stateOf = (label: string): ChairState =>
    picked.includes(label) ? "mine" : seatInfo?.[label] ? "info" : taken?.has(label) ? "taken" : "free";
  const guideTable = guide && onActiveTable ? tables.find((t) => t.id === activeTableId) ?? tables[0] : null;
  const focusChair = focus ? chairs.find((c) => c.label === focus) : null;

  return (
    <div
      ref={boxRef}
      className="relative overflow-hidden rounded-2xl bg-slate-50 shadow-[inset_0_0_0_1px_#e2e8f0]"
      style={{
        height,
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent 0 19px, #e9eef5 19px 20px), repeating-linear-gradient(90deg, transparent 0 19px, #e9eef5 19px 20px)",
      }}
    >
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600 ring-1 ring-slate-200">
        Entrée
      </span>

      {tables.map((t) => {
        const on = t.id === activeTableId;
        const w = t.width * view.sc;
        const h = t.height * view.sc;
        const seats = (t.seats || []).filter((s) => s.isActive !== false);
        const free = seats.filter((s) => stateOf(s.label) === "free").length;
        const mine = seats.filter((s) => picked.includes(s.label)).length;
        const look = cn(
          "absolute flex flex-col items-center justify-center rounded-[9px] transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none",
          on
            ? "border-2 border-indigo-600 bg-gradient-to-br from-indigo-50 to-indigo-200 text-indigo-900"
            : "border-[1.5px] border-[#d6c4ad] bg-gradient-to-br from-[#f5ede3] to-[#e7d8c5] text-amber-900 shadow-sm",
          on && guide && "v-node-pulse"
        );
        const content = (
          <>
            <span className="text-xs font-black leading-none">{tableShort(t.name)}</span>
            {w > 34 && h > 28 ? (
              <span className={cn("mt-0.5 text-[9px] font-extrabold", on ? "text-indigo-700" : "text-amber-800")}>
                {mine ? `${mine} à vous` : `${free} libres`}
              </span>
            ) : null}
          </>
        );
        const style = { left: view.X(t.x), top: view.Y(t.y), width: w, height: h };
        if (!onActiveTable) {
          return (
            <span key={t.id} className={look} style={style}>
              {content}
            </span>
          );
        }
        // Grow the tap area to ≥ 44 px without changing how the table looks
        const growX = Math.max(0, (HIT - w) / 2);
        const growY = Math.max(0, (HIT - h) / 2);
        return (
          <button
            key={t.id}
            type="button"
            aria-label={`${t.name}, ${free} places libres`}
            aria-pressed={on}
            onClick={() => onActiveTable(t.id)}
            className={cn(look, "z-[1] active:scale-[0.97]")}
            style={style}
          >
            <span aria-hidden className="absolute" style={{ inset: `${-growY}px ${-growX}px` }} />
            {content}
          </button>
        );
      })}

      {chairs.map((c, i) => {
        const state = stateOf(c.label);
        const x = view.X(c.cx);
        const y = view.Y(c.cy);
        const tappable = !!onSeat && (seatTap === "all" || c.tableId === null) && (state !== "taken" || seatTap === "all");
        const hit = tappable ? Math.max(chairPx, seatTap === "loose" ? HIT : 30) : chairPx;
        const inner = (
          <span className="absolute" style={{ left: (hit - chairPx) / 2, top: (hit - chairPx) / 2, width: chairPx, height: chairPx, transform: `rotate(${c.rot}deg)` }}>
            <ChairShape state={state} info={seatInfo?.[c.label]} delay={(i * 0.37) % 2.6} />
          </span>
        );
        const style: CSSProperties = { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit };
        if (!tappable) {
          return (
            <span key={c.label} className="pointer-events-none absolute" style={style}>
              {inner}
            </span>
          );
        }
        const who = seatInfo?.[c.label]?.title;
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={state === "mine"}
            aria-label={`Chaise ${c.label}${who ? `, ${who}` : state === "taken" ? ", occupée" : state === "mine" ? ", choisie" : ", libre"}`}
            onClick={() => onSeat!(c.label, c.tableId)}
            className="absolute z-[2] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            style={style}
          >
            {inner}
          </button>
        );
      })}

      {/* Upright markers: initials / person */}
      {chairs.map((c) => {
        const state = stateOf(c.label);
        if (state === "free") return null;
        const ms = Math.max(12, chairPx * 0.7);
        const x = view.X(c.cx);
        const y = view.Y(c.cy);
        const order = picked.indexOf(c.label);
        return (
          <span key={`m-${c.label}`} className="pointer-events-none">
            <span className="absolute z-[3]" style={{ left: x - ms / 2, top: y - ms / 2, width: ms, height: ms }}>
              <ChairMarker state={state} info={seatInfo?.[c.label]} initials={initials} size={ms} />
            </span>
            {order >= 0 && showOrder ? <PickedBurst x={x} y={y} order={order} chairPx={chairPx} /> : null}
            {order >= 0 && showLabels ? (
              <span
                className="absolute z-[3] -translate-x-1/2 whitespace-nowrap rounded-md bg-indigo-600 px-1.5 py-px text-[10px] font-extrabold text-white shadow"
                style={{ left: x, top: c.rot === 0 ? y - chairPx / 2 - 18 : y + chairPx / 2 + 2 }}
              >
                {c.label}
              </span>
            ) : null}
          </span>
        );
      })}

      {/* Focused chair (admin): ring + tooltip */}
      {focusChair ? (
        <span className="pointer-events-none">
          <span
            className="v-pulse-ring absolute z-[3] rounded-lg"
            style={{ left: view.X(focusChair.cx) - chairPx / 2 - 3, top: view.Y(focusChair.cy) - chairPx / 2 - 3, width: chairPx + 6, height: chairPx + 6 }}
          />
          {tip ? (
            <span
              key={focus}
              className="v-rise absolute z-[4] -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
              style={{
                left: Math.min(Math.max(view.X(focusChair.cx), 130), boxW - 130),
                top: view.Y(focusChair.cy) > 60 ? view.Y(focusChair.cy) - chairPx / 2 - 38 : view.Y(focusChair.cy) + chairPx / 2 + 8,
              }}
            >
              {tip}
            </span>
          ) : null}
        </span>
      ) : null}

      {/* Visitor hint: rings + "Touchez une table" */}
      {guideTable ? (
        (() => {
          const gx = view.X(guideTable.x + guideTable.width / 2);
          const gy = view.Y(guideTable.y);
          const gh = guideTable.height * view.sc;
          const above = gy > 52;
          const tx = Math.min(Math.max(gx, 74), boxW - 74);
          return (
            <span className="pointer-events-none">
              {[0, 0.65].map((d) => (
                <span
                  key={d}
                  className="v-ring-out absolute z-[2] h-8 w-8 rounded-full border-2 border-indigo-600"
                  style={{ left: gx - 16, top: gy + gh / 2 - 16, animationDelay: `${d}s` }}
                />
              ))}
              <span
                className="v-tip absolute z-[4] flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
                style={{ left: tx, top: above ? gy - chairPx - 34 : gy + gh + chairPx + 6 }}
              >
                <Hand className="h-3.5 w-3.5" />
                Touchez une table
                <span
                  className="absolute h-2.5 w-2.5 rotate-45 rounded-[2px] bg-slate-900"
                  style={{ left: `calc(50% + ${gx - tx}px - 5px)`, ...(above ? { bottom: -4 } : { top: -4 }) }}
                />
              </span>
            </span>
          );
        })()
      ) : null}
    </div>
  );
}
