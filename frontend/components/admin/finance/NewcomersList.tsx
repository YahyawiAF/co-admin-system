"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageCircle, Phone, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPager } from "@/components/ui/list-pager";
import { AwayReasonChips } from "@/components/admin/AwayReasonChips";
import { analyticsApi, outreachApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import type { NewcomerRow } from "@/lib/types";

type Status = "NOT_BACK" | "NEW" | "BACK" | "ALL";

const STATUS_UI: Record<Exclude<Status, "ALL">, { label: string; cls: string }> = {
  NOT_BACK: {
    label: "Pas revenu",
    cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  },
  NEW: {
    label: "1ʳᵉ visite (< 3 j)",
    cls: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  },
  BACK: {
    label: "Revenu",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

const FILTERS: { value: Status; label: string }[] = [
  { value: "NOT_BACK", label: "Pas revenus · à relancer" },
  { value: "NEW", label: "1ʳᵉ visite (< 3 j)" },
  { value: "BACK", label: "Revenus" },
  { value: "ALL", label: "Tous" },
];

const PROFILE: Record<string, string> = { STUDENT: "Étudiant", PUPIL: "Élève", PRO: "Pro" };

/** Every newcomer of the period: who came back, who to relance (WhatsApp / appel + pourquoi). */
export function NewcomersList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("NOT_BACK");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["newcomers-list", status, days, page],
    queryFn: () => analyticsApi.newcomersList({ status, days, page }),
    placeholderData: keepPreviousData,
  });

  const contact = useMutation({
    mutationFn: (v: { row: NewcomerRow; channel: "WHATSAPP" | "CALL" }) =>
      outreachApi.log({
        memberId: v.row.memberId,
        reason: "NEW_NOT_BACK",
        channel: v.channel,
        message: v.channel === "WHATSAPP" ? v.row.message : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newcomers-list"] });
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = (s: Status) => {
    setStatus(s);
    setPage(1);
  };

  return (
    <Card id="nouveaux-liste" className="scroll-mt-20">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Les nouveaux, un par un</CardTitle>
            <p className="text-sm text-muted-foreground">
              Relancez ceux qui ne sont pas revenus : le message est prêt, notez ensuite pourquoi.
            </p>
          </div>
          <select
            id="newcomers-days"
            aria-label="Période"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={14}>14 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={60}>60 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Statut">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => pick(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors duration-200",
                status === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {f.label}
              {data ? <span className="ml-1 tabular-nums opacity-80">· {data.counts[f.value]}</span> : null}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading || !data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data.rows.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {status === "NOT_BACK" ? "Personne à relancer sur cette période." : "Aucun nouveau sur cette période."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              key={`${status}:${days}:${page}`}
              className={cn(
                "w-full min-w-[760px] text-sm animate-in fade-in-0 duration-200 motion-reduce:animate-none",
                isFetching && "opacity-70 transition-opacity"
              )}
            >
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Client</th>
                  <th className="px-2 py-2 font-semibold">1ʳᵉ visite</th>
                  <th className="px-2 py-2 text-right font-semibold">Jours</th>
                  <th className="px-2 py-2 font-semibold">Statut</th>
                  <th className="px-2 py-2 font-semibold">Dernier contact</th>
                  <th className="px-4 py-2 text-right font-semibold">Relance</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.memberId} className="border-b align-top last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{r.name}</span>
                        {r.profileType ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{PROFILE[r.profileType]}</span>
                        ) : null}
                        {r.hasApp ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300">
                            <Smartphone className="h-3 w-3" /> app
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.phone || "Pas de téléphone"}</p>
                      {r.status === "NOT_BACK" ? (
                        <AwayReasonChips memberId={r.memberId} awayReason={r.awayReason} recallAt={r.recallAt} />
                      ) : null}
                    </td>
                    <td className="px-2 py-3">
                      <p>{format(parseISO(r.first), "EEE d MMM · HH:mm", { locale: fr })}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.firstService, r.stayHours != null ? `${String(r.stayHours).replace(".", ",")} h` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.visitDays}</td>
                    <td className="px-2 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_UI[r.status].cls)}>
                        {STATUS_UI[r.status].label}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {r.lastContact
                        ? `${formatDistanceToNow(parseISO(r.lastContact.at), { locale: fr, addSuffix: true })} · ${
                            r.lastContact.channel === "WHATSAPP" ? "WhatsApp" : r.lastContact.channel === "CALL" ? "appel" : "notif"
                          }`
                        : "Jamais"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.whatsapp ? (
                          <Button
                            asChild
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => contact.mutate({ row: r, channel: "WHATSAPP" })}
                          >
                            <a
                              href={`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(r.message)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="mr-1 h-4 w-4" />
                              WhatsApp
                            </a>
                          </Button>
                        ) : null}
                        {r.phone ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            onClick={() => contact.mutate({ row: r, channel: "CALL" })}
                          >
                            <a href={`tel:${r.phone}`}>
                              <Phone className="mr-1 h-4 w-4" />
                              Appel
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? (
          <ListPager
            page={data.meta.currentPage}
            lastPage={data.meta.lastPage}
            total={data.meta.total}
            onPage={(p) => {
              setPage(p);
              document.getElementById("nouveaux-liste")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
