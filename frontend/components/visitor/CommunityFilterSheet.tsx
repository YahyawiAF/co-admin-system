"use client";

import { useEffect, useMemo, useState } from "react";
import { Handshake, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AVAILABILITY,
  EMPTY_FILTERS,
  activeFilterCount,
  countValues,
  filterMembers,
  type CommunityFilters,
} from "@/lib/community";
import type { Member, MemberAvailability } from "@/lib/types";
import { cn } from "@/lib/utils";

const SKILL_SEARCH_FROM = 12;

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count?: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95",
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {children}
      {count != null ? (
        <span className={active ? "text-white/70" : "text-slate-400"}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

export function CommunityFilterSheet({
  open,
  onOpenChange,
  people,
  query,
  value,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Everyone present (unfiltered) */
  people: Member[];
  query: string;
  value: CommunityFilters;
  onApply: (next: CommunityFilters) => void;
}) {
  const [draft, setDraft] = useState<CommunityFilters>(value);
  const [skillQuery, setSkillQuery] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSkillQuery("");
    }
  }, [open, value]);

  const jobs = useMemo(
    () => countValues(people.map((p) => p.functionality || "")),
    [people],
  );
  const skills = useMemo(
    () => countValues(people.flatMap((p) => p.skills || [])),
    [people],
  );
  const availCounts = useMemo(() => {
    const c: Record<MemberAvailability, number> = { OPEN_TO_CHAT: 0, FOCUS: 0 };
    for (const p of people) if (p.availability) c[p.availability] += 1;
    return c;
  }, [people]);

  const visibleSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    return q ? skills.filter((s) => s.label.toLowerCase().includes(q)) : skills;
  }, [skills, skillQuery]);

  const hasDraftFilters =
    activeFilterCount(draft) + activeFilterCount(value) > 0;

  const resultCount = useMemo(
    () => filterMembers(people, draft, query).length,
    [people, draft, query],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
      >
        <div className="mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.18)]">
          <div className="flex justify-center pb-1 pt-2.5">
            <div className="h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
          </div>
          <SheetHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 text-left">
            <div>
              <SheetTitle className="text-[17px]">Filtres</SheetTitle>
              <SheetDescription className="text-[11px]">
                Parmi les membres sur place
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
            <Section title="Disponibilité">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(AVAILABILITY) as MemberAvailability[]).map((k) => {
                  const meta = AVAILABILITY[k];
                  return (
                    <Chip
                      key={k}
                      active={draft.availability.includes(k)}
                      count={availCounts[k]}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          availability: toggle(d.availability, k),
                        }))
                      }
                    >
                      <meta.icon className="h-3.5 w-3.5" />
                      {meta.short}
                    </Chip>
                  );
                })}
              </div>
            </Section>

            {jobs.length ? (
              <Section title="Métier">
                <div className="flex flex-wrap gap-1.5">
                  {jobs.map((j) => (
                    <Chip
                      key={j.label}
                      active={draft.jobs.includes(j.label)}
                      count={j.count}
                      onClick={() =>
                        setDraft((d) => ({ ...d, jobs: toggle(d.jobs, j.label) }))
                      }
                    >
                      {j.label}
                    </Chip>
                  ))}
                </div>
              </Section>
            ) : null}

            {skills.length ? (
              <Section title="Compétences">
                {skills.length > SKILL_SEARCH_FROM ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={skillQuery}
                      onChange={(e) => setSkillQuery(e.target.value)}
                      placeholder="Filtrer les compétences…"
                      className="h-9 w-full rounded-full bg-slate-100 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {visibleSkills.map((s) => (
                    <Chip
                      key={s.label}
                      active={draft.skills.some(
                        (x) => x.toLowerCase() === s.label.toLowerCase(),
                      )}
                      count={s.count}
                      onClick={() =>
                        setDraft((d) => {
                          const on = d.skills.some(
                            (x) => x.toLowerCase() === s.label.toLowerCase(),
                          );
                          return {
                            ...d,
                            skills: on
                              ? d.skills.filter(
                                  (x) => x.toLowerCase() !== s.label.toLowerCase(),
                                )
                              : [...d.skills, s.label],
                          };
                        })
                      }
                    >
                      {s.label}
                    </Chip>
                  ))}
                  {!visibleSkills.length ? (
                    <p className="text-xs text-slate-400">Aucune compétence trouvée</p>
                  ) : null}
                </div>
              </Section>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, openToCollab: !d.openToCollab }))
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
                draft.openToCollab
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-slate-200 bg-white",
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <Handshake className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  Ouverts à la collaboration
                </span>
                <span className="block text-[11px] text-slate-500">
                  Membres qui acceptent de nouveaux projets
                </span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-9 items-center rounded-full p-0.5 transition",
                  draft.openToCollab ? "bg-indigo-600" : "bg-slate-200",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full bg-white shadow transition-transform",
                    draft.openToCollab && "translate-x-4",
                  )}
                />
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              disabled={!hasDraftFilters}
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                onApply(EMPTY_FILTERS);
              }}
              className="h-12 shrink-0 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Tout annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
              className="h-12 min-w-0 flex-1 rounded-full bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {resultCount === 0
                ? "Aucun membre"
                : `Voir ${resultCount} membre${resultCount > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
