"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { BadgeCheck, Calculator, CalendarClock, Clock, HandCoins, History, Repeat, Search, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { membersApi, outreachApi } from "@/lib/api/resources";
import { memberDisplayName } from "@/lib/journal-utils";
import { CHANNEL_UI } from "@/lib/outreach-ui";
import type { OutreachChannel, OutreachReason } from "@/lib/types";

/** What was proposed (the relance's reason). */
const PROPOSALS: Array<{ id: OutreachReason; label: string; icon: typeof Repeat }> = [
  { id: "CONVERT", label: "Passer à l'abonnement", icon: Repeat },
  { id: "ABO_EXPIRING", label: "Renouveler (avant la fin)", icon: CalendarClock },
  { id: "ABO_ENDED", label: "Reprendre un abonnement", icon: UserMinus },
  { id: "TOP_UP", label: "Compléter l'abonnement", icon: Calculator },
  { id: "INACTIVE", label: "Revenir", icon: Clock },
  { id: "UNPAID", label: "Payer son reste", icon: HandCoins },
];
const CHANNELS: OutreachChannel[] = ["PERSON", "CALL", "WHATSAPP", "INSTAGRAM"];
/** The server keeps relances this far back. */
const MAX_DAYS_BACK = 90;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;

type Who = { id: string; name: string; phone: string | null };

/**
 * "Relance passée": a proposal made outside the app (at the desk, before the member was in a list).
 * Logged on its real day, so an abonnement taken since then counts as converted.
 */
export function PastRelanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [reason, setReason] = useState<OutreachReason>("CONVERT");
  const [channel, setChannel] = useState<OutreachChannel>("PERSON");
  const [day, setDay] = useState(ymd(subDays(new Date(), 7)));
  useEffect(() => {
    if (!open) return;
    setQ("");
    setWho(null);
    setReason("CONVERT");
    setChannel("PERSON");
    setDay(ymd(subDays(new Date(), 7)));
  }, [open]);

  const search = useQuery({
    queryKey: ["past-relance-search", q.trim()],
    queryFn: () => membersApi.listPage({ search: q.trim(), perPage: 6 }),
    enabled: open && !who && q.trim().length >= 2,
  });
  const check = useQuery({
    queryKey: ["outreach-past-check", who?.id, day],
    queryFn: () => outreachApi.pastCheck(who!.id, day),
    enabled: open && !!who && !!day,
  });
  const abo = check.data?.abonnement ?? null;

  const save = useMutation({
    mutationFn: () => outreachApi.log({ memberId: who!.id, reason, channel, contactedAt: day }),
    onSuccess: () => {
      toast.success(
        abo
          ? `${who!.name} : relance du ${format(new Date(`${day}T12:00:00`), "d MMM", { locale: fr })} notée, comptée comme convertie`
          : `${who!.name} : relance notée, en suivi`,
      );
      qc.invalidateQueries({ queryKey: ["outreach"] });
      qc.invalidateQueries({ queryKey: ["outreach-suivi"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-lg [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <DialogHeader className="relative space-y-1 pr-10 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Déjà fait, hors de l&apos;app</p>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-white">
              <History className="h-6 w-6 shrink-0" />
              Relance passée
            </DialogTitle>
            <DialogDescription className="text-[13px] text-indigo-100">
              Tu lui as proposé avant qu&apos;il soit dans la liste ? Note-le ici, la conversion est comptée.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Qui ?</span>
            {who ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-indigo-600 bg-indigo-50 px-3 py-2 animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none dark:bg-indigo-950/40">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{who.name}</span>
                  {who.phone ? <span className="block text-xs text-muted-foreground">{who.phone}</span> : null}
                </span>
                <button type="button" aria-label="Changer de personne" onClick={() => setWho(null)} className="rounded-lg p-1.5 text-indigo-700 transition-colors hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone…" className="h-10 rounded-xl pl-9" />
                </div>
                {q.trim().length >= 2 ? (
                  <ul className="space-y-1 rounded-xl bg-muted/40 p-1 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                    {(search.data?.data ?? []).map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setWho({ id: m.id, name: memberDisplayName(m), phone: m.phone ?? null })}
                          className="flex w-full items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          <span className="truncate font-medium">{memberDisplayName(m)}</span>
                          {m.phone ? <span className="shrink-0 text-xs text-muted-foreground">{m.phone}</span> : null}
                        </button>
                      </li>
                    ))}
                    {search.data && !search.data.data.length ? (
                      <li className="px-3 py-3 text-center text-sm text-muted-foreground">Personne trouvé.</li>
                    ) : null}
                    {search.isLoading ? <li className="px-3 py-3 text-center text-sm text-muted-foreground">…</li> : null}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Tu lui as proposé quoi ?</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PROPOSALS.map((p) => {
                const on = reason === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setReason(p.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-[13px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                      on ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40" : "border-transparent bg-muted/50 hover:bg-muted",
                    )}
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", on ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground")}>
                      <p.icon className="h-3.5 w-3.5" />
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Comment ?</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as OutreachChannel)}
                className="h-10 w-full rounded-xl border bg-background px-2.5 text-sm"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_UI[c].button}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Quel jour ?</span>
              <Input
                type="date"
                value={day}
                min={ymd(subDays(new Date(), MAX_DAYS_BACK))}
                max={ymd(new Date())}
                onChange={(e) => setDay(e.target.value)}
                className="h-10 rounded-xl"
              />
            </label>
          </div>

          <div className={cn("grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none", who ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              {who ? (
                abo ? (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <b>Abonnement trouvé :</b> {abo.name}, pris le {format(new Date(abo.at), "d MMM", { locale: fr })}
                      {abo.amount ? ` (${dt(abo.amount)})` : ""}.
                      <br />
                      Il sera compté comme <b>converti grâce à ta relance</b>.
                    </div>
                  </div>
                ) : check.isFetching ? (
                  <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Recherche d&apos;un abonnement…</div>
                ) : (
                  <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                    Pas d&apos;abonnement pris depuis ce jour. La relance reste « en suivi » et se clôture toute seule s&apos;il en prend un.
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Annuler
          </Button>
          <Button className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" disabled={!who || !day || save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
