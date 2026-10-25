"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Hand } from "lucide-react";
import type { Space, SpaceSeat, SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Seat box size used by the floor-plan editor (offsets are the box's top-left). */
const PLAN_SEAT = 28;
const MAP_H = 250;
const PAD = 26;

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

function chairSide(t: SpaceTable, s: SpaceSeat) {
  if (s.offsetY + PLAN_SEAT <= 2) return 0;
  if (s.offsetY >= t.height - 2) return 180;
  if (s.offsetX + PLAN_SEAT <= 2) return -90;
  if (s.offsetX >= t.width - 2) return 90;
  return 0;
}

/**
 * Reservation map: real tables + chairs (turned toward their table).
 * Free chairs breathe; picked ones slide in, show your initials and their order.
 */
export function ChairMap({
  space,
  taken,
  picked,
  activeTableId,
  onActiveTable,
  onToggle,
  initials,
}: {
  space: Space;
  /** Seat labels already requested on that slot */
  taken: Set<string>;
  /** Your chosen labels, in order */
  picked: string[];
  activeTableId: string | null;
  onActiveTable: (tableId: string) => void;
  onToggle: (label: string, tableId: string | null) => void;
  initials: string;
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
    const sc = Math.min((boxW - PAD * 2) / Math.max(1, maxX - minX), (MAP_H - PAD * 2) / Math.max(1, maxY - minY), 1.4);
    const ox = (boxW - (maxX - minX) * sc) / 2;
    const oy = (MAP_H - (maxY - minY) * sc) / 2;
    return { sc, X: (v: number) => ox + (v - minX) * sc, Y: (v: number) => oy + (v - minY) * sc };
  }, [tables, chairs, boxW]);

  if (!view) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-600">
        Plan pas encore dessiné pour cet espace.
      </div>
    );
  }

  const chairPx = Math.max(13, Math.min(24, PLAN_SEAT * view.sc));
  const firstFree =
    picked.length === 0
      ? chairs.find((c) => c.tableId === activeTableId && !taken.has(c.label)) ??
        chairs.find((c) => !taken.has(c.label)) ??
        null
      : null;

  return (
    <div
      ref={boxRef}
      className="relative overflow-hidden rounded-2xl bg-slate-50 shadow-[inset_0_0_0_1px_#e2e8f0]"
      style={{
        height: MAP_H,
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
        const free = (t.seats || []).filter((s) => s.isActive !== false && !taken.has(s.label)).length;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={`${t.name}, ${free} places libres`}
            aria-pressed={on}
            onClick={() => onActiveTable(t.id)}
            className={cn(
              "absolute flex flex-col items-center justify-center rounded-[9px] transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none",
              on
                ? "v-node-pulse border-2 border-indigo-600 bg-gradient-to-br from-indigo-50 to-indigo-200 text-indigo-900"
                : "border-[1.5px] border-[#d6c4ad] bg-gradient-to-br from-[#f5ede3] to-[#e7d8c5] text-amber-900 shadow-sm"
            )}
            style={{ left: view.X(t.x), top: view.Y(t.y), width: w, height: h }}
          >
            <span className="text-xs font-black leading-none">{tableShort(t.name)}</span>
            {w > 34 && h > 28 ? (
              <span className={cn("mt-0.5 text-[9px] font-extrabold", on ? "text-indigo-700" : "text-amber-800")}>
                {free} libres
              </span>
            ) : null}
          </button>
        );
      })}

      {chairs.map((c, i) => {
        const isTaken = taken.has(c.label);
        const order = picked.indexOf(c.label);
        const on = order >= 0;
        const x = view.X(c.cx);
        const y = view.Y(c.cy);
        return (
          <button
            key={c.label}
            type="button"
            disabled={isTaken}
            aria-pressed={on}
            aria-label={`Chaise ${c.label}${isTaken ? ", occupée" : on ? ", choisie" : ", libre"}`}
            onClick={() => onToggle(c.label, c.tableId)}
            className="absolute disabled:cursor-not-allowed"
            style={{
              left: x - chairPx / 2,
              top: y - chairPx / 2,
              width: chairPx,
              height: chairPx,
              transform: `rotate(${c.rot}deg)`,
            }}
          >
            <span
              className={cn("relative block h-full w-full", isTaken ? "" : on ? "v-tuck" : "v-breathe")}
              style={{ animationDelay: on ? "0s" : `${((i * 0.37) % 2.6).toFixed(2)}s` }}
            >
              <span
                className={cn(
                  "absolute inset-x-[5%] top-0 h-[23%] rounded-t-[3px] rounded-b-[2px] transition-colors duration-200",
                  isTaken ? "bg-slate-300" : on ? "bg-indigo-900" : "bg-emerald-600"
                )}
              />
              <span
                className={cn(
                  "absolute inset-x-[14%] bottom-[4%] top-[28%] rounded-[4px_4px_7px_7px] transition-[background-color,box-shadow] duration-200",
                  isTaken
                    ? "bg-slate-200"
                    : on
                      ? "bg-indigo-600 shadow-md shadow-indigo-600/40"
                      : "bg-white shadow-[inset_0_0_0_2px_#059669,0_2px_3px_-1px_rgba(15,23,42,.2)]"
                )}
              />
            </span>
          </button>
        );
      })}

      {/* Upright markers: your initials, or a person when occupied */}
      {chairs.map((c) => {
        const isTaken = taken.has(c.label);
        const order = picked.indexOf(c.label);
        if (!isTaken && order < 0) return null;
        const ms = Math.max(12, chairPx * 0.66);
        const x = view.X(c.cx);
        const y = view.Y(c.cy);
        return (
          <span key={`m-${c.label}`} className="pointer-events-none">
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full text-[7px] font-black tracking-tight",
                order >= 0 ? "v-pop bg-white text-indigo-700 ring-[1.5px] ring-indigo-600" : "bg-slate-100"
              )}
              style={{ left: x - ms / 2, top: y - ms / 2, width: ms, height: ms }}
            >
              {order >= 0 ? (
                initials
              ) : (
                <svg aria-hidden width="8" height="8" viewBox="0 0 24 24" fill="#64748b">
                  <circle cx="12" cy="7" r="5" />
                  <path d="M3 22a9 9 0 0 1 18 0z" />
                </svg>
              )}
            </span>
            {order >= 0 ? (
              <>
                <span
                  className="v-pop absolute flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-300 text-[10px] font-black text-amber-950 shadow-[0_0_0_2px_#fff,0_3px_6px_-2px_rgba(217,119,6,.7)] [animation-delay:.1s]"
                  style={{ left: x + 3, top: y - chairPx / 2 - 10 }}
                >
                  {order + 1}
                </span>
                {[
                  ["-14px", "-10px", "bg-amber-400"],
                  ["14px", "-10px", "bg-indigo-300"],
                  ["0px", "-15px", "bg-emerald-400"],
                ].map(([sx, sy, bg]) => (
                  <span
                    key={sx + sy}
                    className={cn("v-spark absolute h-[5px] w-[5px] rounded-full", bg)}
                    style={{ left: x - 2.5, top: y - 2.5, ["--tx" as string]: sx, ["--ty" as string]: sy } as CSSProperties}
                  />
                ))}
              </>
            ) : null}
          </span>
        );
      })}

      {/* First tap: rings + tooltip on the first free chair */}
      {firstFree ? (
        <span className="pointer-events-none">
          {[0, 0.65].map((d) => (
            <span
              key={d}
              className="v-ring-out absolute h-7 w-7 rounded-full border-2 border-indigo-600"
              style={{ left: view.X(firstFree.cx) - 14, top: view.Y(firstFree.cy) - 14, animationDelay: `${d}s` }}
            />
          ))}
          {(() => {
            const fx = view.X(firstFree.cx);
            const fy = view.Y(firstFree.cy);
            const above = fy > 46;
            const tx = Math.min(Math.max(fx, 58), boxW - 58);
            return (
              <span
                className="v-tip absolute flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
                style={{ left: tx, top: above ? fy - 44 : fy + 18 }}
              >
                <Hand className="h-3.5 w-3.5" />
                Touchez ici
                <span
                  className="absolute h-2.5 w-2.5 rotate-45 rounded-[2px] bg-slate-900"
                  style={{ left: `calc(50% + ${fx - tx}px - 5px)`, ...(above ? { bottom: -4 } : { top: -4 }) }}
                />
              </span>
            );
          })()}
        </span>
      ) : null}
    </div>
  );
}
