"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  Space,
  SpaceSeat,
  SpaceTable,
  SpaceWall,
  SpaceFixture,
  FixtureKind,
} from "@/lib/types";
import type { SeatBooking } from "@/lib/api/resources";
import { bookedLabelsForSpace } from "@/lib/seat-booking";

export type EditTool = "select" | "seat" | "wall" | "table" | "fixture";

export const FIXTURE_OPTIONS: { kind: FixtureKind; label: string }[] = [
  { kind: "ARMCHAIR", label: "Fauteuil" },
  { kind: "TV", label: "TV" },
  { kind: "TRIANGLE", label: "Triangle" },
  { kind: "CIRCLE", label: "Cercle" },
  { kind: "DOOR", label: "Porte" },
  { kind: "TOILET", label: "WS" },
  { kind: "KITCHEN", label: "Cuisine" },
  { kind: "ARROW", label: "Flèche" },
  { kind: "STAIRS", label: "Escalier" },
  { kind: "TEXT", label: "Texte" },
];

type Props = {
  space: Space;
  bookings: SeatBooking[];
  editMode: boolean;
  tool?: EditTool;
  /**
   * editor = scrollable fixed plan (facility editor).
   * picker = fill container width (admin dialogs / occupation).
   * fit = fill width+height, no scroll (mobile visitor).
   */
  variant?: "editor" | "picker" | "fit";
  /** Extra zoom multiplier (1 = default). */
  zoom?: number;
  onSelectSeat?: (seat: SpaceSeat) => void;
  onMoveTable?: (tableId: string, x: number, y: number) => void;
  onMoveSeat?: (
    seatId: string,
    offsetX: number,
    offsetY: number,
    tableId: string | null
  ) => void;
  onMoveWall?: (wallId: string, x: number, y: number) => void;
  onMoveFixture?: (fixtureId: string, x: number, y: number) => void;
  onSelectTable?: (table: SpaceTable) => void;
  onSelectWall?: (wall: SpaceWall) => void;
  onSelectFixture?: (fixture: SpaceFixture) => void;
  onCanvasPlace?: (tool: EditTool, x: number, y: number, tableId?: string) => void;
  selectedTableId?: string | null;
  selectedWallId?: string | null;
  selectedSeatId?: string | null;
  selectedSeatIds?: string[];
  selectedFixtureId?: string | null;
  className?: string;
};

function contentBounds(space: Space) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = 40;
  let maxY = 40;
  const grow = (x: number, y: number, w = 36, h = 36) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const t of space.tables || []) {
    grow(t.x, t.y, t.width, t.height);
    for (const s of t.seats || []) {
      grow(t.x + s.offsetX - 4, t.y + s.offsetY - 4, 32, 32);
    }
  }
  for (const w of space.walls || []) grow(w.x, w.y, w.width, w.height);
  for (const f of space.fixtures || []) grow(f.x, f.y, f.width, f.height);
  for (const s of space.seats || []) {
    if (s.tableId) continue;
    grow(s.offsetX, s.offsetY, 32, 32);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 640, height: 420 };
  }
  const pad = 28;
  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    width: Math.max(280, maxX - Math.max(0, minX - pad) + pad),
    height: Math.max(220, maxY - Math.max(0, minY - pad) + pad),
  };
}

type DragKind = "table" | "seat" | "wall" | "fixture";

export function FloorPlanCanvas({
  space,
  bookings,
  editMode,
  tool = "select",
  variant = "editor",
  zoom = 1,
  onSelectSeat,
  onMoveTable,
  onMoveSeat,
  onMoveWall,
  onMoveFixture,
  onSelectTable,
  onSelectWall,
  onSelectFixture,
  onCanvasPlace,
  selectedTableId,
  selectedWallId,
  selectedSeatId,
  selectedSeatIds,
  selectedFixtureId,
  className,
}: Props) {
  const booked = bookedLabelsForSpace(bookings, space.id);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [localPos, setLocalPos] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const dragRef = useRef<{
    kind: DragKind;
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const placeDownRef = useRef<{ x: number; y: number } | null>(null);

  const tables = space.tables || [];
  const walls = space.walls || [];
  const fixtures = space.fixtures || [];
  const looseSeats = (space.seats || []).filter((s) => !s.tableId);
  const bounds = contentBounds(space);
  const isFit = variant === "fit";
  const isPicker = variant === "picker" || isFit;
  const planW = Math.max(bounds.width, 280);
  const planH = Math.max(bounds.height, 220);

  useEffect(() => {
    if (!isPicker) {
      setFitScale(1);
      return;
    }
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const pad = 8;
      const availW = Math.max(el.clientWidth - pad, 120);
      const availH = Math.max(el.clientHeight - pad, 120);
      let s: number;
      if (isFit) {
        s = Math.min(availW / planW, availH / planH) * zoom;
      } else {
        // Fill width; height can scroll if needed. Allow scale-up.
        s = (availW / planW) * zoom;
      }
      setFitScale(Number.isFinite(s) && s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPicker, isFit, planW, planH, zoom, space.id]);

  useEffect(() => {
    if (!selectedSeatId || !canvasRef.current) return;
    const el = canvasRef.current.querySelector(
      `[data-seat-id="${CSS.escape(selectedSeatId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedSeatId, space.id]);

  const posOf = (id: string, x: number, y: number) =>
    localPos[id] || { x, y };

  const clientToCanvas = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scale = isPicker ? fitScale : zoom || 1;
    return {
      x: (clientX - rect.left) / scale + (isPicker ? bounds.minX : 0),
      y: (clientY - rect.top) / scale + (isPicker ? bounds.minY : 0),
    };
  };

  const findTableAt = (x: number, y: number) => {
    for (let i = tables.length - 1; i >= 0; i--) {
      const t = tables[i];
      const p = posOf(t.id, t.x, t.y);
      if (x >= p.x && x <= p.x + t.width && y >= p.y && y <= p.y + t.height) {
        return t;
      }
    }
    return null;
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag || !editMode) {
      dragRef.current = null;
      return;
    }
    const p = localPos[drag.id];
    if (p && drag.moved) {
      if (drag.kind === "table") onMoveTable?.(drag.id, p.x, p.y);
      if (drag.kind === "wall") onMoveWall?.(drag.id, p.x, p.y);
      if (drag.kind === "fixture") onMoveFixture?.(drag.id, p.x, p.y);
      if (drag.kind === "seat") {
        const over = findTableAt(p.x + 14, p.y + 14);
        if (over) {
          const tp = posOf(over.id, over.x, over.y);
          onMoveSeat?.(drag.id, p.x - tp.x, p.y - tp.y, over.id);
        } else {
          onMoveSeat?.(drag.id, p.x, p.y, null);
        }
      }
    }
    dragRef.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative w-full rounded-xl border bg-slate-100",
        isFit
          ? "h-full min-h-[240px] overflow-hidden"
          : isPicker
            ? "min-h-[min(52vh,520px)] overflow-auto"
            : "min-h-[420px] overflow-auto",
        className
      )}
    >
      <div
        className={cn(isPicker && "mx-auto")}
        style={
          isPicker
            ? {
                width: Math.ceil(planW * fitScale),
                height: Math.ceil(planH * fitScale),
              }
            : { minWidth: "100%" }
        }
      >
      <div
        ref={canvasRef}
        className={cn(
          "relative bg-cover bg-center",
          !isPicker && "min-h-[420px] min-w-full",
          editMode && tool !== "select" && "cursor-crosshair"
        )}
        style={{
          backgroundImage: space.floorPlanUrl
            ? `url(${space.floorPlanUrl})`
            : undefined,
          backgroundColor: space.floorPlanUrl ? undefined : "#e8eef5",
          width: isPicker ? planW + bounds.minX : undefined,
          height: isPicker ? planH + bounds.minY : Math.max(planH + bounds.minY, 560),
          transform: isPicker
            ? `translate(${-bounds.minX * fitScale}px, ${-bounds.minY * fitScale}px) scale(${fitScale})`
            : zoom !== 1
              ? `scale(${zoom})`
              : undefined,
          transformOrigin: "top left",
        }}
        onPointerDown={(e) => {
          if (!editMode || tool === "select") return;
          if ((e.target as HTMLElement).closest("[data-floor-item]")) return;
          placeDownRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (drag && editMode) {
            const dist = Math.hypot(
              e.clientX - drag.startX,
              e.clientY - drag.startY
            );
            if (dist > 3) drag.moved = true;
            const scale = isPicker ? fitScale : zoom || 1;
            const x = Math.max(
              0,
              drag.origX + (e.clientX - drag.startX) / scale
            );
            const y = Math.max(
              0,
              drag.origY + (e.clientY - drag.startY) / scale
            );
            setLocalPos((p) => ({ ...p, [drag.id]: { x, y } }));
          }
        }}
        onPointerUp={(e) => {
          const wasDragging = !!dragRef.current;
          finishDrag();

          if (
            editMode &&
            !wasDragging &&
            placeDownRef.current &&
            (tool === "seat" || tool === "wall" || tool === "table" || tool === "fixture")
          ) {
            const dist = Math.hypot(
              e.clientX - placeDownRef.current.x,
              e.clientY - placeDownRef.current.y
            );
            if (dist < 6) {
              const { x, y } = clientToCanvas(e.clientX, e.clientY);
              const over = findTableAt(x, y);
              onCanvasPlace?.(tool, x, y, over?.id);
            }
          }
          placeDownRef.current = null;
        }}
      >
        {!space.floorPlanUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Ajoutez une image de plan (URL) pour cet espace
          </div>
        ) : null}

        {walls.map((wall) => {
          const pos = posOf(wall.id, wall.x, wall.y);
          return (
            <div
              key={wall.id}
              data-floor-item
              className={cn(
                "absolute z-[5] rounded-sm bg-slate-700/90 shadow",
                selectedWallId === wall.id && "ring-2 ring-primary",
                editMode && tool === "select" && "cursor-grab"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                width: wall.width,
                height: wall.height,
                transform: `rotate(${wall.rotation || 0}deg)`,
              }}
              title={wall.label || "Mur"}
              onPointerDown={(e) => {
                if (!editMode || tool !== "select") return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture?.(
                  e.pointerId
                );
                dragRef.current = {
                  kind: "wall",
                  id: wall.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: pos.x,
                  origY: pos.y,
                  moved: false,
                };
                onSelectWall?.(wall);
              }}
            >
              {wall.label ? (
                <span className="pointer-events-none absolute -top-4 left-0 text-[9px] font-medium text-slate-600">
                  {wall.label}
                </span>
              ) : null}
            </div>
          );
        })}

        {fixtures.map((fixture) => {
          const pos = posOf(fixture.id, fixture.x, fixture.y);
          const caption = fixtureCaption(fixture);
          const isText = fixture.kind === "TEXT";
          return (
            <div
              key={fixture.id}
              data-floor-item
              className={cn(
                "absolute z-[6] flex flex-col items-center justify-center rounded-md border border-slate-300 bg-white/90 shadow-sm",
                isText && "bg-amber-50 px-1",
                selectedFixtureId === fixture.id && "ring-2 ring-primary",
                editMode && tool === "select" && "cursor-grab"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                width: fixture.width,
                height: fixture.height,
                transform: `rotate(${fixture.rotation || 0}deg)`,
              }}
              title={fixture.label || fixture.kind}
              onPointerDown={(e) => {
                if (!editMode || tool !== "select") return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture?.(
                  e.pointerId
                );
                dragRef.current = {
                  kind: "fixture",
                  id: fixture.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: pos.x,
                  origY: pos.y,
                  moved: false,
                };
                onSelectFixture?.(fixture);
              }}
            >
              {isText ? null : <FixtureGlyph kind={fixture.kind} />}
              {caption ? (
                <span
                  className={cn(
                    "max-w-full truncate px-0.5 text-center font-semibold leading-tight text-slate-700",
                    isText ? "text-[11px]" : "text-[9px]"
                  )}
                >
                  {caption}
                </span>
              ) : null}
            </div>
          );
        })}

        {tables.map((table) => {
          const pos = posOf(table.id, table.x, table.y);
          return (
            <div
              key={table.id}
              data-floor-item
              className={cn(
                "absolute z-10 select-none rounded-lg border-2 bg-white/90 shadow-md",
                selectedTableId === table.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-slate-300",
                editMode &&
                  tool === "select" &&
                  "cursor-grab active:cursor-grabbing"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                width: table.width,
                height: table.height,
                transform: `rotate(${table.rotation || 0}deg)`,
              }}
              onPointerDown={(e) => {
                if (!editMode) {
                  onSelectTable?.(table);
                  return;
                }
                if (tool !== "select") return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture?.(
                  e.pointerId
                );
                dragRef.current = {
                  kind: "table",
                  id: table.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: pos.x,
                  origY: pos.y,
                  moved: false,
                };
                onSelectTable?.(table);
              }}
            >
              {table.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={table.imageUrl}
                  alt={table.name}
                  className="h-full w-full rounded-md object-cover opacity-90"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-50 text-xs font-semibold text-slate-600">
                  {table.name}
                </div>
              )}
              <div className="absolute -top-5 left-0 truncate text-[10px] font-bold text-slate-700">
                {table.name}
              </div>
              {(table.seats || []).map((seat) => {
                if (localPos[seat.id] && dragRef.current?.id === seat.id) {
                  return null;
                }
                return (
                  <SeatChip
                    key={seat.id}
                    seat={seat}
                    occupied={booked.has(seat.label)}
                    selected={
                      selectedSeatId === seat.id ||
                      selectedSeatIds?.includes(seat.id)
                    }
                    editMode={editMode && tool === "select"}
                    style={{ left: seat.offsetX, top: seat.offsetY }}
                    onPointerDown={(ev) => {
                      if (!editMode || tool !== "select") return;
                      ev.preventDefault();
                      ev.stopPropagation();
                      const absX = pos.x + seat.offsetX;
                      const absY = pos.y + seat.offsetY;
                      setLocalPos((p) => ({
                        ...p,
                        [seat.id]: { x: absX, y: absY },
                      }));
                      dragRef.current = {
                        kind: "seat",
                        id: seat.id,
                        startX: ev.clientX,
                        startY: ev.clientY,
                        origX: absX,
                        origY: absY,
                        moved: false,
                      };
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectSeat?.(seat);
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        {[
          ...looseSeats,
          ...tables.flatMap((t) =>
            (t.seats || []).filter(
              (s) => localPos[s.id] && dragRef.current?.id === s.id
            )
          ),
        ].map((seat) => {
          const pos = posOf(seat.id, seat.offsetX, seat.offsetY);
          return (
            <SeatChip
              key={`abs-${seat.id}`}
              seat={seat}
              occupied={booked.has(seat.label)}
              selected={
                selectedSeatId === seat.id ||
                selectedSeatIds?.includes(seat.id)
              }
              editMode={editMode && tool === "select"}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={(ev) => {
                if (!editMode || tool !== "select") return;
                ev.preventDefault();
                ev.stopPropagation();
                (ev.currentTarget as HTMLElement).setPointerCapture?.(
                  ev.pointerId
                );
                dragRef.current = {
                  kind: "seat",
                  id: seat.id,
                  startX: ev.clientX,
                  startY: ev.clientY,
                  origX: pos.x,
                  origY: pos.y,
                  moved: false,
                };
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectSeat?.(seat);
              }}
            />
          );
        })}
      </div>
      </div>
    </div>
  );
}

function SeatChip({
  seat,
  occupied,
  selected,
  editMode,
  style,
  onClick,
  onPointerDown,
}: {
  seat: SpaceSeat;
  occupied: boolean;
  selected?: boolean;
  editMode?: boolean;
  style?: React.CSSProperties;
  onClick: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      data-floor-item
      data-seat-id={seat.id}
      onClick={onClick}
      onPointerDown={onPointerDown}
      title={`${seat.label}${seat.isOverflow ? " (overflow)" : ""}`}
      className={cn(
        "absolute z-20 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-1 text-[9px] font-bold shadow transition-transform touch-manipulation",
        seat.isOverflow
          ? occupied
            ? "border-rose-500 bg-rose-500 text-white"
            : "border-rose-400 bg-rose-50 text-rose-800"
          : occupied
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-emerald-400 bg-emerald-50 text-emerald-900",
        selected && "z-30 scale-125 ring-2 ring-primary ring-offset-1",
        editMode && "cursor-grab active:cursor-grabbing"
      )}
      style={style}
    >
      {selected ? (
        <span
          aria-hidden
          className="seat-pulse-ring pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
        />
      ) : null}
      {seat.isOverflow ? "X" : seat.label.split("-").pop()}
    </button>
  );
}

function fixtureCaption(fixture: SpaceFixture): string | null {
  const custom = fixture.label?.trim() || "";
  if (fixture.kind === "TEXT") return custom || "Texte";
  if (fixture.kind === "TOILET") {
    if (!custom || custom === "Toilettes" || custom === "TOILET" || custom === "WS")
      return null;
    return custom;
  }
  if (fixture.kind === "KITCHEN" || fixture.kind === "STAIRS" || custom) {
    return custom || (fixture.kind === "KITCHEN" ? "Cuisine" : fixture.kind === "STAIRS" ? "Escalier" : custom);
  }
  return null;
}

function FixtureGlyph({ kind }: { kind: FixtureKind }) {
  const cls = "h-[70%] w-[70%] text-slate-700";
  if (kind === "TV") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <rect x="3" y="5" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 21h8M12 17v4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "ARMCHAIR") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <rect x="6" y="8" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 12v5h2M20 12v5h-2M8 16v3h8v-3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "TRIANGLE") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <path d="M12 4l9 16H3z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "CIRCLE") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "DOOR") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "TOILET") {
    return (
      <span className="text-[10px] font-bold tracking-wide text-slate-700">
        WS
      </span>
    );
  }
  if (kind === "ARROW") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <path
          d="M3 12h14M13 6l8 6-8 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "STAIRS") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <path
          d="M3 20h5v-4h4v-4h4V8h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "TEXT") {
    return null;
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden>
      <rect x="3" y="7" width="18" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 7V5h4v2M15 11h4M3 13h6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
