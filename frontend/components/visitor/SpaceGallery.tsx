"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Space, SpaceTable } from "@/lib/types";
import { cn } from "@/lib/utils";

function uniqueUrls(urls: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

function tableGallery(table: SpaceTable | undefined): string[] {
  if (!table) return [];
  return uniqueUrls([...(table.galleryUrls || []), table.imageUrl]);
}

function spaceImages(
  space: Space | null | undefined,
  tableId?: string | null
): { urls: string[]; caption: string } {
  if (!space) return { urls: [], caption: "" };
  const tables = space.tables || [];
  const focused =
    tableId && tableId !== "__loose__"
      ? tables.find((t) => t.id === tableId)
      : undefined;
  const tableUrls = tableGallery(focused);
  if (tableUrls.length) {
    return { urls: tableUrls, caption: focused?.name || space.name };
  }
  const spaceUrls = uniqueUrls(space.galleryUrls || []);
  if (spaceUrls.length) {
    return { urls: spaceUrls, caption: space.name };
  }
  const fromTables = uniqueUrls(
    tables.flatMap((t) => [...(t.galleryUrls || []), t.imageUrl])
  );
  return { urls: fromTables, caption: space.name };
}

type Props = {
  space: Space | null | undefined;
  tableId?: string | null;
  className?: string;
};

export function SpaceGallery({ space, tableId, className }: Props) {
  const { urls: images, caption } = useMemo(
    () => spaceImages(space, tableId),
    [space, tableId]
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [space?.id, tableId]);

  const safeIdx = images.length ? idx % images.length : 0;
  const current = images[safeIdx];

  if (!space) return null;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-slate-200", className)}>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={caption}
          className="aspect-[16/10] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900 text-white">
          <Building2 className="h-10 w-10 opacity-80" />
          <p className="text-sm font-medium">{space.name}</p>
        </div>
      )}

      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            onClick={() =>
              setIdx((i) => (i - 1 + images.length) % images.length)
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            onClick={() => setIdx((i) => (i + 1) % images.length)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => setIdx(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === safeIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
        <p className="text-sm font-semibold text-slate-900">{caption}</p>
        {images.length ? (
          <p className="text-[10px] text-slate-500">
            {images.length} photo{images.length > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
