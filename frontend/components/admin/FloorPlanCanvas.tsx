"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Space, SpaceSeat, SpaceTable, SpaceWall } from "@/lib/types";
import type { SeatBooking } from "@/lib/api/resources";

export type EditTool = "select" | "seat" | "wall" | "table";

type Props = {
  space: Space;
  bookings: SeatBooking[];
  editMode: boolean;
  tool?: EditTool;
  onSelectSeat?: (seat: SpaceSeat) => void;
  onMoveTable?: (tableId: string, x: number, y: number) => void;
  onMoveSeat?: (
    seatId: string,
    offsetX: number,
    offsetY: number,
    tableId: string | null
  ) => void;
  onMoveWall?: (wallId: string, x: number, y: number) => void;
  onSelectTable?: (table: SpaceTable) => void;
  onSelectWall?: (wall: SpaceWall) => void;
  onCanvasPlace?: (tool: EditTool, x: number, y: number, tableId?: string) => void;
  selectedTableId?: string | null;
  selectedWallId?: string | null;
  selectedSeatId?: string | null;
  selectedSeatIds?: string[];
};

type DragKind = "table" | "seat" | "wall";

export function FloorPlanCanvas({
  space,
  bookings,
  editMode,
  tool = "select",
  onSelectSeat,
  onMoveTable,
  onMoveSeat,
  onMoveWall,
  onSelectTable,
  onSelectWall,
  onCanvasPlace,
  selectedTableId,
  selectedWallId,
  selectedSeatId,
  selectedSeatIds,
}: Props) {
  const booked = new Set(
    bookings.filter((b) => b.isBooked).map((b) => b.seatId)
  );
  const canvasRef = useRef<HTMLDivElement>(null);
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
  const looseSeats = (space.seats || []).filter((s) => !s.tableId);

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
    return {
      x: clientX - rect.left + el.scrollLeft,
      y: clientY - rect.top + el.scrollTop,
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
    <div className="relative min-h-[420px] w-full overflow-auto rounded-xl border bg-slate-100">
      <div
        ref={canvasRef}
        className={cn(
          "relative min-h-[420px] min-w-full bg-cover bg-center",
          editMode && tool !== "select" && "cursor-crosshair"
        )}
        style={{
          backgroundImage: space.floorPlanUrl
            ? `url(${space.floorPlanUrl})`
            : undefined,
          backgroundColor: space.floorPlanUrl ? undefined : "#e8eef5",
          height: 560,
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
            const x = Math.max(0, drag.origX + (e.clientX - drag.startX));
            const y = Math.max(0, drag.origY + (e.clientY - drag.startY));
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
            (tool === "seat" || tool === "wall" || tool === "table")
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
        "absolute z-20 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-1 text-[9px] font-bold shadow transition-transform",
        seat.isOverflow
          ? occupied
            ? "border-rose-500 bg-rose-500 text-white"
            : "border-rose-400 bg-rose-50 text-rose-800"
          : occupied
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-emerald-400 bg-emerald-50 text-emerald-900",
        selected &&
          "z-30 scale-125 animate-pulse ring-4 ring-primary ring-offset-2 ring-offset-background",
        editMode && "cursor-grab active:cursor-grabbing"
      )}
      style={style}
    >
      {seat.isOverflow ? "X" : seat.label.split("-").pop()}
    </button>
  );
}
