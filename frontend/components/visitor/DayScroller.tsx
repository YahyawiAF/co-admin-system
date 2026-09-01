"use client";

import { useMemo, useState, useEffect } from "react";
import {
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  addMonths,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "month" | "native";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function DayScroller({ value, onChange, className }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => parseISO(value), [value]);
  const [mode, setMode] = useState<Mode>("native");
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value)));

  useEffect(() => {
    setMonth(startOfMonth(parseISO(value)));
  }, [value]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const padStart = (month.getDay() + 6) % 7; // Monday-first

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Jour</p>
        <div className="flex rounded-full bg-slate-100 p-0.5">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              mode === "native" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
            onClick={() => setMode("native")}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Calendrier
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              mode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
            onClick={() => setMode("month")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Mois
          </button>
        </div>
      </div>

      {mode === "native" ? (
        <Input
          type="date"
          className="h-12 text-base"
          value={value}
          min={format(today, "yyyy-MM-dd")}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold capitalize">
              {format(month, "MMMM yyyy", { locale: fr })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: padStart }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const disabled = isBefore(d, today);
              const active = isSameDay(d, selected);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(iso)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-xl text-sm font-semibold",
                    disabled && "text-slate-300",
                    !disabled && !active && "text-slate-800 hover:bg-slate-100",
                    active && "bg-primary text-primary-foreground shadow-sm"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
