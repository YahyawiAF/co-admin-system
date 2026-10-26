"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Hand } from "lucide-react";
import type { SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChairMarker, ChairShape, PickedBurst, PLAN_SEAT, chairSide, tableShort, type ChairState } from "./ChairMap";

const GAP = 8;

type Placed = { label: string; x: number; y: number; rot: number };

/** Spread chairs on one side of the table so big chairs never overlap. */
function spread(pos: number[], length: number, size: number) {
  const n = pos.length;
  if (n === 0) return pos;
  const sorted = pos.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const ok = sorted.every((s, k) => k === 0 || s.p - sorted[k - 1].p >= size + GAP);
  if (ok) return pos;
  const out = [...pos];
  sorted.forEach((s, k) => {
    out[s.i] = (length * (k + 1)) / (n + 1);
  });
  return out;
}

/**
 * One table, large: chairs of 44–52 px around it, in the same places as on the
 * floor plan. Tap a chair to take it, tap again to give it back.
 */
export function TableZoom({
  table,
  taken,
  picked,
  initials,
  onToggle,
  onBack,
  backLabel = "Toute la salle",
}: {
  table: SpaceTable;
  taken: Set<string>;
  picked: string[];
  initials: string;
  onToggle: (label: string, tableId: string | null) => void;
  onBack: () => void;
  backLabel?: string;
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

  const seats = useMemo(() => (table.seats || []).filter((s) => s.isActive !== false), [table.seats]);

  const layout = useMemo(() => {
    const sides = { 0: [] as typeof seats, 180: [] as typeof seats, [-90]: [] as typeof seats, 90: [] as typeof seats } as Record<number, typeof seats>;
    for (const s of seats) sides[chairSide(table, s)].push(s);
    const nTB = Math.max(sides[0].length, sides[180].length);
    const nLR = Math.max(sides[-90].length, sides[90].length);

    let chair = 52;
    let tw = 0, th = 0, W = 0, H = 0;
    for (; chair >= 44; chair -= 2) {
      const ratio = table.width / Math.max(1, table.height);
      tw = Math.max(nTB * (chair + GAP) + GAP, 120);
      th = Math.max(nLR * (chair + GAP) + GAP, 64);
      // keep the table's shape roughly like on the plan
      if (tw / th < ratio) tw = Math.min(th * ratio, boxW - 40);
      else th = Math.min(Math.max(th, tw / ratio), 220);
      W = tw + (nLR ? 2 * (chair + GAP) : 0);
      H = th + 2 * (chair + GAP);
      if (W <= boxW - 16) break;
    }
    if (W > boxW - 16) {
      // very long tables: squeeze the table, chairs stay ≥ 44 px
      tw = Math.max(80, boxW - 16 - (nLR ? 2 * (chair + GAP) : 0));
      W = boxW - 16;
    }
    const height = Math.round(H + 28);
    const left = (boxW - tw) / 2;
    const top = (height - th) / 2;

    const along = (s: (typeof seats)[number], axis: "x" | "y") =>
      axis === "x"
        ? ((s.offsetX + PLAN_SEAT / 2) / Math.max(1, table.width)) * tw
        : ((s.offsetY + PLAN_SEAT / 2) / Math.max(1, table.height)) * th;

    const placed: Placed[] = [];
    for (const rot of [0, 180, -90, 90]) {
      const list = sides[rot];
      const axis = rot === 0 || rot === 180 ? "x" : "y";
      const length = axis === "x" ? tw : th;
      const pos = spread(list.map((s) => Math.min(Math.max(along(s, axis), chair / 2), length - chair / 2)), length, chair);
      list.forEach((s, i) => {
        const p = pos[i];
        if (rot === 0) placed.push({ label: s.label, rot, x: left + p, y: top - GAP - chair / 2 });
        else if (rot === 180) placed.push({ label: s.label, rot, x: left + p, y: top + th + GAP + chair / 2 });
        else if (rot === -90) placed.push({ label: s.label, rot, x: left - GAP - chair / 2, y: top + p });
        else placed.push({ label: s.label, rot, x: left + tw + GAP + chair / 2, y: top + p });
      });
    }
    return { chair, tw, th, left, top, height, placed };
  }, [seats, table, boxW]);

  const free = seats.filter((s) => !taken.has(s.label) && !picked.includes(s.label)).length;
  const mineHere = seats.filter((s) => picked.includes(s.label)).length;
  const hintChair = picked.length === 0 ? layout.placed.find((p) => !taken.has(p.label)) : null;
  const { chair } = layout;

  return (
    <div className="v-zoom-in">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[13px] font-extrabold text-slate-700 transition-colors duration-150 hover:bg-slate-200 motion-reduce:transition-none"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <span className="flex-1" />
        <span className="text-right text-[12px] font-bold leading-tight text-slate-600">
          <span className="block text-[15px] font-black text-slate-900">{table.name}</span>
          {mineHere ? `${mineHere} à vous · ` : ""}
          {free} libre{free > 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={boxRef}
        className="relative mt-2 overflow-hidden rounded-2xl bg-slate-50 shadow-[inset_0_0_0_1px_#e2e8f0]"
        style={{
          height: layout.height,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 23px, #e9eef5 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, #e9eef5 23px 24px)",
        }}
      >
        <span
          className="absolute flex items-center justify-center rounded-2xl border-2 border-[#d6c4ad] bg-gradient-to-br from-[#f5ede3] to-[#e7d8c5] text-amber-900 shadow-sm"
          style={{ left: layout.left, top: layout.top, width: layout.tw, height: layout.th }}
        >
          <span className="text-2xl font-black">{tableShort(table.name)}</span>
        </span>

        {layout.placed.map((p, i) => {
          const order = picked.indexOf(p.label);
          const isTaken = taken.has(p.label);
          const state: ChairState = order >= 0 ? "mine" : isTaken ? "taken" : "free";
          return (
            <button
              key={p.label}
              type="button"
              disabled={isTaken}
              aria-pressed={order >= 0}
              aria-label={`Chaise ${p.label}${isTaken ? ", occupée" : order >= 0 ? ", choisie" : ", libre"}`}
              onClick={() => onToggle(p.label, table.id)}
              className="absolute rounded-xl transition-transform duration-150 active:scale-90 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none"
              style={{ left: p.x - chair / 2, top: p.y - chair / 2, width: chair, height: chair }}
            >
              <span className="absolute inset-0" style={{ transform: `rotate(${p.rot}deg)` }}>
                <ChairShape state={state} delay={(i * 0.37) % 2.6} />
              </span>
            </button>
          );
        })}

        {layout.placed.map((p) => {
          const order = picked.indexOf(p.label);
          const isTaken = taken.has(p.label);
          if (order < 0 && !isTaken) return null;
          const ms = chair * 0.56;
          return (
            <span key={`m-${p.label}`} className="pointer-events-none">
              <span className="absolute" style={{ left: p.x - ms / 2, top: p.y - ms / 2 + (p.rot === 0 ? 3 : p.rot === 180 ? -3 : 0), width: ms, height: ms }}>
                <ChairMarker state={order >= 0 ? "mine" : "taken"} initials={initials} size={ms} />
              </span>
              {order >= 0 ? <PickedBurst x={p.x} y={p.y} order={order} chairPx={chair} big /> : null}
            </span>
          );
        })}

        {hintChair ? (
          <span className="pointer-events-none">
            {[0, 0.65].map((d) => (
              <span
                key={d}
                className="v-ring-out absolute h-10 w-10 rounded-full border-2 border-indigo-600"
                style={{ left: hintChair.x - 20, top: hintChair.y - 20, animationDelay: `${d}s` }}
              />
            ))}
            {(() => {
              // put the hint over the table, never off the box
              const below = hintChair.rot !== 180;
              const tx = Math.min(Math.max(hintChair.x, 80), boxW - 80);
              const ty = below ? hintChair.y + chair / 2 + 10 : hintChair.y - chair / 2 - 40;
              return (
                <span
                  className="v-tip absolute z-[4] flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-slate-900 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
                  style={{ left: tx, top: Math.max(4, ty) }}
                >
                  <Hand className="h-3.5 w-3.5" />
                  Touchez une chaise
                </span>
              );
            })()}
          </span>
        ) : null}
      </div>

      <p className={cn("mt-2 text-center text-[12px] font-semibold text-slate-600")}>
        Touchez à nouveau une chaise pour la libérer.
      </p>
    </div>
  );
}
