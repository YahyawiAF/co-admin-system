"use client";

import { useEffect, useMemo, useState } from "react";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import type { SeatBooking } from "@/lib/api/resources";
import { bookedLabelsForSpace } from "@/lib/seat-booking";
import type { Space, SpaceSeat, SpaceTable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOOSE = "__loose__";

type Props = {
  space: Space;
  bookings: SeatBooking[];
  selectedSeatId?: string | null;
  onSelectSeat: (seat: SpaceSeat) => void;
  onTableChange?: () => void;
  onFocusTableChange?: (tableId: string | null) => void;
  /** Zoom to this seat's table and hide table picking. */
  lockSeatLabel?: string | null;
  className?: string;
};

export function TableSeatPicker({
  space,
  bookings,
  selectedSeatId,
  onSelectSeat,
  onTableChange,
  onFocusTableChange,
  lockSeatLabel,
  className,
}: Props) {
  const [tableId, setTableId] = useState<string | null>(null);
  const booked = useMemo(
    () => bookedLabelsForSpace(bookings, space.id),
    [bookings, space.id]
  );

  const tables = useMemo(
    () => (space.tables || []).filter((t) => (t.seats || []).length > 0),
    [space.tables]
  );
  const looseSeats = useMemo(
    () =>
      (space.seats || []).filter(
        (s) => !s.tableId && s.isActive !== false
      ),
    [space.seats]
  );

  useEffect(() => {
    setTableId(null);
  }, [space.id]);

  useEffect(() => {
    onFocusTableChange?.(tableId);
  }, [tableId, onFocusTableChange]);

  useEffect(() => {
    if (lockSeatLabel) {
      const parent = tables.find((t) =>
        (t.seats || []).some((s) => s.label === lockSeatLabel)
      );
      if (parent) {
        setTableId(parent.id);
        return;
      }
      if (looseSeats.some((s) => s.label === lockSeatLabel)) {
        setTableId(LOOSE);
        return;
      }
    }
    if (!lockSeatLabel && tables.length === 1 && !looseSeats.length) {
      setTableId(tables[0].id);
    }
  }, [tables, looseSeats, lockSeatLabel]);

  const activeTable: SpaceTable | null =
    tableId && tableId !== LOOSE
      ? tables.find((t) => t.id === tableId) || null
      : null;

  const visibleSeats: SpaceSeat[] = useMemo(() => {
    if (!tableId) return [];
    if (tableId === LOOSE) return looseSeats;
    return (activeTable?.seats || []).filter((s) => s.isActive !== false);
  }, [tableId, looseSeats, activeTable]);

  const hasTableStep = tables.length > 0 || looseSeats.length > 0;

  const pickTable = (id: string) => {
    if (lockSeatLabel) return;
    if (id === tableId) {
      setTableId(null);
      onTableChange?.();
      return;
    }
    setTableId(id);
    onTableChange?.();
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {hasTableStep && !lockSeatLabel ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">
            {tableId
              ? "Table sélectionnée — retouchez pour revenir"
              : "Choisissez une table"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={tableId === t.id ? "default" : "outline"}
                className="h-9"
                onClick={() => pickTable(t.id)}
              >
                {t.name}
                <span className="ml-1 opacity-70">
                  ({(t.seats || []).length})
                </span>
              </Button>
            ))}
            {looseSeats.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant={tableId === LOOSE ? "default" : "outline"}
                className="h-9"
                onClick={() => pickTable(LOOSE)}
              >
                Autres ({looseSeats.length})
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-slate-50",
          lockSeatLabel ? "h-[min(40vh,280px)]" : "h-[min(55vh,420px)]"
        )}
      >
        <FloorPlanCanvas
          space={space}
          bookings={bookings}
          editMode={false}
          variant="fit"
          touchMode
          focusTableId={tableId}
          selectedTableId={activeTable?.id || null}
          selectedSeatId={selectedSeatId}
          className="h-full min-h-0 rounded-none border-0"
          onSelectTable={(t) => pickTable(t.id)}
          onSelectSeat={(seat) => {
            if (!tableId && tables.length > 0) {
              const parent = tables.find((t) =>
                (t.seats || []).some((s) => s.id === seat.id)
              );
              if (parent) {
                pickTable(parent.id);
                if (!booked.has(seat.label)) onSelectSeat(seat);
                return;
              }
              if (looseSeats.some((s) => s.id === seat.id)) {
                pickTable(LOOSE);
              }
            }
            if (booked.has(seat.label)) return;
            onSelectSeat(seat);
          }}
        />
      </div>

      {tableId && visibleSeats.length > 0 && !lockSeatLabel ? (
        <div>
          <p className="text-[11px] font-medium text-slate-500">
            Place libre{activeTable ? ` · ${activeTable.name}` : ""}
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {visibleSeats.map((s) => {
              const taken = booked.has(s.label);
              const active = selectedSeatId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={taken}
                  onClick={() => onSelectSeat(s)}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold",
                    taken &&
                      "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through",
                    !taken &&
                      !active &&
                      "border-emerald-200 bg-emerald-50 text-emerald-900",
                    active &&
                      "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {s.label}
                  {taken ? (
                    <span className="mt-0.5 block text-[10px] font-normal">
                      Occupée
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
