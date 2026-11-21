"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientSegment } from "@/lib/types";
import { SEGMENT_ORDER, SEGMENT_UI, nf } from "./clients-ui";

/** Gap between two slices, in degrees */
const GAP = 1.5;

/**
 * Ring of the client groups. Inactive clients are left out by default:
 * they are most of the list and would hide the small groups.
 */
export function ClientGroupsRing({
  counts,
  selected,
  onPick,
}: {
  counts: Record<ClientSegment, number>;
  selected: ClientSegment | null;
  onPick: (s: ClientSegment | null) => void;
}) {
  const [withInactive, setWithInactive] = useState(false);
  const groups = SEGMENT_ORDER.filter((s) => withInactive || s !== "INACTIVE");
  const total = groups.reduce((n, s) => n + counts[s], 0);

  let at = 0;
  const stops: string[] = [];
  for (const s of groups) {
    if (!counts[s] || !total) continue;
    const from = at;
    at += (counts[s] / total) * 360;
    const end = Math.max(from, at - GAP);
    const faded = selected && selected !== s;
    const color = faded ? `${SEGMENT_UI[s].color}40` : SEGMENT_UI[s].color;
    stops.push(`${color} ${from}deg ${end}deg`, `transparent ${end}deg ${at}deg`);
  }
  const ring = total ? `conic-gradient(${stops.join(",")})` : "hsl(var(--muted))";

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Vos clients par groupe</p>
            <p className="text-sm text-muted-foreground">
              {withInactive
                ? "Tous les clients, inactifs compris."
                : `Les clients venus ces 30 jours. Les inactifs (${nf(counts.INACTIVE)}) sont à part.`}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={withInactive}
            onClick={() => setWithInactive((v) => !v)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm transition-colors duration-200 motion-reduce:transition-none",
              withInactive ? "border-indigo-600 bg-indigo-600 text-white" : "hover:bg-muted",
            )}
          >
            Avec les inactifs
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div
            role="img"
            aria-label={`Répartition : ${groups.map((s) => `${SEGMENT_UI[s].label} ${counts[s]}`).join(", ")}`}
            className="relative h-44 w-44 shrink-0"
          >
            <div className="absolute inset-0 rounded-full transition-[background] duration-300" style={{ background: ring }} />
            <div className="absolute inset-[30px] flex flex-col items-center justify-center rounded-full bg-card text-center">
              <span className="text-2xl font-bold tabular-nums">{nf(total)}</span>
              <span className="max-w-[90px] text-xs leading-tight text-muted-foreground">
                {withInactive ? "clients au total" : "venus ces 30 jours"}
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-[1_1_260px] space-y-1">
            {groups.map((s) => {
              const on = selected === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => onPick(on ? null : s)}
                    aria-pressed={on}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors duration-200 motion-reduce:transition-none",
                      on ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: SEGMENT_UI[s].color }} />
                    <span className="flex-1">{SEGMENT_UI[s].label}</span>
                    <span className="w-12 text-right font-semibold tabular-nums">{nf(counts[s])}</span>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {total ? Math.round((counts[s] / total) * 100) : 0} %
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Cliquez un groupe pour voir ses clients dans la liste.</p>
      </CardContent>
    </Card>
  );
}
