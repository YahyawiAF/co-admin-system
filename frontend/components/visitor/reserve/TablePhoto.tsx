"use client";

import { Armchair } from "lucide-react";
import type { Space, SpaceTable } from "@/lib/types";

/**
 * "Which table is it?": the table's photo (or the zone photo) with its name and
 * description, right above the map. Admin uploads photos in Réservations → Réglages & photos.
 */
export function TablePhoto({
  space,
  table,
  badge = "Sur le plan ↓",
  className,
}: {
  space: Space;
  table: SpaceTable | null;
  /** Small pill bottom-right (null = none) */
  badge?: string | null;
  className?: string;
}) {
  const src = table?.imageUrl || table?.galleryUrls?.[0] || space.galleryUrls?.[0] || null;
  const isZonePhoto = !!src && !(table?.imageUrl || table?.galleryUrls?.[0]);
  const title = table ? `${table.name} · ${space.name}` : space.name;
  const desc =
    table?.description?.trim() ||
    (table ? `${(table.seats || []).length} places autour de la table` : "Choisissez une table sur le plan");

  return (
    <section
      key={table?.id || space.id}
      className={`v-rise relative overflow-hidden ${className || "h-[118px]"} rounded-[20px] bg-gradient-to-b from-indigo-100 to-indigo-200 shadow-sm`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
          <Armchair className="h-12 w-12" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/10 to-slate-900/80" />
      <span className="absolute left-2.5 top-2.5 rounded-lg bg-slate-900/50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
        {src ? (isZonePhoto ? "Photo de l’espace" : "Photo de la table") : "Photo bientôt"}
      </span>
      <div className={`absolute bottom-2 left-3 text-white ${badge ? "right-24" : "right-3"}`}>
        <p className="truncate text-[15px] font-black">{title}</p>
        <p className="truncate text-xs text-slate-200">{desc}</p>
      </div>
      {badge ? (
        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-indigo-900">
          {badge}
        </span>
      ) : null}
    </section>
  );
}
