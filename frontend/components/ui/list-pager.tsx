"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Default page size for every list in the admin. */
export const DEFAULT_PER_PAGE = 20;

/** "Page 2 / 5 · 87 résultats" + Précédent / Suivant. Hidden when everything fits on one page. */
export function ListPager({
  page,
  lastPage,
  total,
  onPage,
  className,
}: {
  page: number;
  lastPage: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (lastPage <= 1) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3", className)}>
      <p className="text-sm text-muted-foreground tabular-nums">
        Page {page} / {lastPage} · {total} résultat{total !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
          Suivant
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Client-side pagination of an already loaded list. Goes back to page 1 when
 * `resetKey` changes (a filter), and stays in range when the list shrinks.
 */
export function usePaged<T>(items: T[], perPage = DEFAULT_PER_PAGE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, lastPage);
  const pageItems = useMemo(
    () => items.slice((current - 1) * perPage, current * perPage),
    [items, current, perPage]
  );
  return { page: current, lastPage, total: items.length, pageItems, setPage };
}
