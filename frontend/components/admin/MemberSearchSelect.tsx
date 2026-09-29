"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Lock, Search, X } from "lucide-react";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { fuzzySearchByName } from "@/lib/fuzzy-search";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 50;

function label(m: Member) {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || "Visiteur";
}

/**
 * Searchable member dropdown — typo-tolerant ranking shared with the Journal
 * search. Rendered inline (no portal) so it scrolls correctly inside dialogs.
 */
export type MemberLock = { title: string; detail?: string };

export function MemberSearchSelect({
  members,
  value,
  onChange,
  lockedFor,
  placeholder = "Choisir un membre",
  className,
}: {
  members: Member[];
  value: string;
  onChange: (id: string) => void;
  /** Listed with the reason but not selectable (e.g. already subscribed) */
  lockedFor?: (m: Member) => MemberLock | null;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = members.find((m) => m.id === value) || null;

  const results = useMemo(() => {
    const list = q.trim()
      ? fuzzySearchByName(members, q, (m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          phone: m.phone,
          visitorNumber: m.visitorNumber,
          extra: [m.email, m.functionality],
        }))
      : members;
    return list.slice(0, MAX_RESULTS);
  }, [members, q]);

  useEffect(() => {
    setCursor(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const pick = (m: Member) => {
    if (lockedFor?.(m)) return;
    onChange(m.id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {selected ? (
          <>
            <VisitorAvatar
              name={label(selected)}
              src={selected.avatarUrl}
              className="h-6 w-6"
            />
            <span className="min-w-0 flex-1 truncate">
              {label(selected)}
              {selected.phone ? (
                <span className="ml-2 text-muted-foreground">
                  {selected.phone}
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (results[cursor]) pick(results[cursor]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Nom, prénom, téléphone, n°…"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q ? (
              <button
                type="button"
                aria-label="Effacer"
                onClick={() => setQ("")}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1"
          >
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun membre trouvé
              </li>
            ) : (
              results.map((m, i) => {
                const lock = lockedFor?.(m) ?? null;
                return (
                  <li
                    key={m.id}
                    data-index={i}
                    role="option"
                    aria-selected={m.id === value}
                    aria-disabled={!!lock}
                    onMouseEnter={() => setCursor(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(m);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                      lock ? "cursor-not-allowed" : "cursor-pointer",
                      i === cursor &&
                        (lock ? "bg-muted/60" : "bg-accent text-accent-foreground"),
                    )}
                  >
                    <VisitorAvatar
                      name={label(m)}
                      src={m.avatarUrl}
                      className={cn("h-7 w-7", lock && "opacity-60")}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-medium",
                          lock && "text-muted-foreground",
                        )}
                      >
                        {label(m)}
                        {m.visitorNumber ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            #{m.visitorNumber}
                          </span>
                        ) : null}
                      </span>
                      {lock ? (
                        <span className="mt-0.5 block text-xs">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                            <Lock className="h-3 w-3" />
                            {lock.title}
                          </span>
                          {lock.detail ? (
                            <span className="ml-1.5 text-muted-foreground">
                              {lock.detail}
                            </span>
                          ) : null}
                        </span>
                      ) : m.phone ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.phone}
                        </span>
                      ) : null}
                    </span>
                    {m.id === value && !lock ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
