"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BellRing, Loader2, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { clientsApi, outreachApi, promotionsApi } from "@/lib/api/resources";
import { channelLabel } from "@/lib/outreach-ui";
import { cn } from "@/lib/utils";
import type { ClientFile, OutreachReason } from "@/lib/types";
import { DEFAULT_REASON, HEARD_FROM_LABEL, SEGMENT_UI, nf } from "./clients-ui";

const OUTCOME_LABEL: Record<string, string> = {
  INTERESTED: "Intéressé",
  OTHER_OFFER: "Veut une autre offre",
  KEEP_TARIF: "Garde le tarif",
  AWAY: "Parti / en voyage",
  NO_ANSWER: "Pas de réponse",
  NOT_INTERESTED: "Pas intéressé",
};
const RESULT_LABEL: Record<string, string> = { WON: "Revenu", LOST: "Perdu", REPLACED: "Remplacé" };

const day = (d: string) => format(d.length === 10 ? parseISO(`${d}T12:00:00`) : parseISO(d), "d MMM yyyy", { locale: fr });

type Tab = "info" | "message";

/** Finance › Clients: the client file (Fiche) and the message to send (Message). */
export function ClientDialog({
  memberId,
  tab,
  onTab,
  onClose,
}: {
  memberId: string | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["clients", "file", memberId],
    queryFn: () => clientsApi.get(memberId!),
    enabled: !!memberId,
  });

  return (
    <Dialog open={!!memberId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-4xl sm:max-w-4xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-0 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          </div>
          <DialogHeader className="relative space-y-1 pr-10 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Finance · Client</p>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-white">
              <UserRound className="h-6 w-6 shrink-0" />
              <span className="truncate">{data?.name ?? "Client"}</span>
              {data?.segment ? (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", SEGMENT_UI[data.segment].badge)}>
                  {SEGMENT_UI[data.segment].label}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-sm text-indigo-100">
              {data
                ? [data.phone, data.hasApp ? "App installée" : "Pas d'app", data.heardFrom ? `Source : ${HEARD_FROM_LABEL[data.heardFrom] ?? data.heardFrom}` : null]
                    .filter(Boolean)
                    .join(" · ")
                : "Chargement…"}
            </DialogDescription>
          </DialogHeader>
          <div role="tablist" className="relative mt-4 flex gap-1">
            {(
              [
                ["info", "Fiche"],
                ["message", "Message"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => onTab(k)}
                className={cn(
                  "min-h-11 rounded-t-xl px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
                  tab === k ? "bg-background text-foreground" : "text-indigo-100 hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading || !data ? (
            isError ? (
              <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>
            ) : (
              <div className="grid gap-3 p-6 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
              </div>
            )
          ) : tab === "info" ? (
            <ClientInfo key={data.memberId} file={data} onMessage={() => onTab("message")} />
          ) : (
            <ClientMessage key={data.memberId} file={data} onSent={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Box({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border p-4", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-2 space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

function ClientInfo({ file, onMessage }: { file: ClientFile; onMessage: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(file.staffNote ?? "");
  const save = useMutation({
    mutationFn: (data: { doNotContact?: boolean; staffNote?: string | null }) => clientsApi.update(file.memberId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-in fade-in-0 duration-300 motion-reduce:animate-none">
      <div className="grid gap-3 p-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Pourquoi {file.segment ? SEGMENT_UI[file.segment].label : "ce groupe"}
          </h3>
          <p className="mt-2 font-semibold">{file.why}</p>
          {file.rule ? <p className="mt-1 text-sm text-muted-foreground">Règle : {file.rule}</p> : null}
          {file.action ? (
            <p className="mt-2 text-sm">
              Action suggérée : <b>{file.action.label}</b>
            </p>
          ) : null}
        </section>
        <Box title="Visites">
          {file.stats ? (
            <>
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold tabular-nums">{nf(file.stats.total)}</p>
                  <p className="text-xs text-muted-foreground">au total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{file.stats.visits30}</p>
                  <p className="text-xs text-muted-foreground">en 30 jours</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{file.stats.perWeek.toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-muted-foreground">par semaine</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                1ʳᵉ visite le {day(file.stats.first)} · client depuis le {day(file.since)}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {file.visits.slice(0, 12).map((v) => (
                  <span key={v} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                    {format(parseISO(`${v}T12:00:00`), "d MMM", { locale: fr })}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Jamais venu.</p>
          )}
        </Box>
        <Box title="Abonnements">
          {file.abonnements.length ? (
            file.abonnements.slice(0, 5).map((a) => (
              <p key={a.id} className="flex justify-between gap-3">
                <span>
                  {a.name}{" "}
                  <span className={a.active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                    · {a.active ? "en cours" : "terminé"}
                    {a.until ? ` le ${day(a.until)}` : ""}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">{nf(a.amount)} DT</span>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">Aucun abonnement.</p>
          )}
        </Box>
        <Box title="Paiements">
          {file.payments.length ? (
            file.payments.slice(0, 6).map((p, i) => (
              <p key={i} className="flex justify-between gap-3">
                <span>
                  {day(p.at)} · {p.label}
                </span>
                <span className="tabular-nums font-medium">{nf(p.amount)} DT</span>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">Aucun paiement.</p>
          )}
        </Box>
        <Box title="Contacts et campagnes">
          {file.contacts.length ? (
            file.contacts.slice(0, 6).map((c) => (
              <p key={c.id}>
                {day(c.at)} · {channelLabel(c.channel)}
                {c.campaign ? ` · ${c.campaign}` : ""}
                <span className="text-muted-foreground">
                  {c.outcome ? ` · ${OUTCOME_LABEL[c.outcome] ?? c.outcome}` : ""}
                  {c.closedResult ? ` · ${RESULT_LABEL[c.closedResult] ?? c.closedResult}` : ""}
                </span>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">Aucun contact pour l'instant.</p>
          )}
        </Box>
        <Box title="Notes">
          <Textarea
            rows={3}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (file.staffNote ?? "") && save.mutate({ staffNote: note })}
            placeholder="Ex. : travaille le soir, aime le coin fenêtre"
            className="rounded-xl"
          />
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3">
            <span>
              Ne pas contacter
              <span className="block text-xs text-muted-foreground">Plus aucun message, ni relance, ni campagne.</span>
            </span>
            <Switch
              checked={file.doNotContact}
              onCheckedChange={(v) => save.mutate({ doNotContact: v })}
              className="data-[state=checked]:bg-red-600"
            />
          </label>
        </Box>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 text-sm">
        <span className="text-muted-foreground">
          {[file.email, file.awayReason ? "A dit pourquoi il ne venait plus (Relances)" : null].filter(Boolean).join(" · ")}
        </span>
        <Button onClick={onMessage} className="min-h-11 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700">
          Contacter
        </Button>
      </div>
    </div>
  );
}

function ClientMessage({ file, onSent }: { file: ClientFile; onSent: () => void }) {
  const qc = useQueryClient();
  const reason: OutreachReason = file.action?.reason ?? (file.segment ? DEFAULT_REASON[file.segment] : "NEWS");
  const base = file.message || `Bonjour ${file.firstName}, `.replace(" ,", ",");
  const { data: promos = [] } = useQuery({ queryKey: ["promotions"], queryFn: () => promotionsApi.list() });
  const offers = useMemo(() => {
    const now = new Date();
    return promos.filter((p) => p.isActive && new Date(p.startsAt) <= now && (!p.endsAt || new Date(p.endsAt) >= now));
  }, [promos]);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [text, setText] = useState(base);
  const offer = offers.find((o) => o.id === offerId) ?? null;

  // Picking an offer rewrites the end of the ready message (not an AI draft the staff already got)
  const pickOffer = (id: string | null) => {
    setOfferId(id);
    const o = offers.find((x) => x.id === id);
    setText(o ? `${base.trim()} Petit plus : ${o.title}.` : base);
  };

  const ai = useMutation({
    mutationFn: () => clientsApi.draft(file.memberId, { reason, promotionId: offerId, previous: text }),
    onSuccess: (r) => setText(r.message),
    onError: (e: Error) => toast.error(e.message),
  });
  const done = () => {
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(`Noté dans Relances pour ${file.firstName || file.name}. On regarde s'il revient dans les 14 jours.`);
    onSent();
  };
  const whatsapp = useMutation({
    mutationFn: () => outreachApi.log({ memberId: file.memberId, reason, channel: "WHATSAPP", message: text }),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const push = useMutation({
    mutationFn: () => outreachApi.push({ memberId: file.memberId, reason, message: text }),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const blocked = file.blocked;
  const busy = whatsapp.isPending || push.isPending;

  return (
    <div className="animate-in fade-in-0 duration-300 motion-reduce:animate-none">
      <div className="space-y-4 p-6">
        {blocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <b>Pas de message pour l'instant.</b> {blocked}
          </div>
        ) : null}
        <p className="text-sm">
          <span className="text-muted-foreground">Raison : </span>
          <b>{file.action?.label ?? "Prendre des nouvelles"}</b>
        </p>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Offre (seulement vos promos actives)</p>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: null as string | null, title: "Aucune offre" }, ...offers].map((o) => (
              <button
                key={o.id ?? "none"}
                type="button"
                aria-pressed={offerId === o.id}
                onClick={() => pickOffer(o.id)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-sm transition-colors duration-200 motion-reduce:transition-none",
                  offerId === o.id ? "border-indigo-600 bg-indigo-600 text-white" : "hover:bg-muted",
                )}
              >
                {o.title}
              </button>
            ))}
            {!offers.length ? (
              <span className="self-center text-xs text-muted-foreground">
                Aucune promo active. <Link href="/promotions" className="underline">Créer une promo</Link>
              </span>
            ) : null}
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Message — vous pouvez tout modifier</span>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl text-[15px]" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => ai.mutate()}
            disabled={ai.isPending}
            className="min-h-10 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
          >
            {ai.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Autre version (IA)
          </Button>
          <span className="text-xs text-muted-foreground">
            L'IA écrit à partir de : {file.why}
            {offer ? ` · offre « ${offer.title} »` : ""}. Elle n'invente ni chiffre ni offre.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        <Link href="/relances" className="text-sm text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">
          Noter sa réponse dans Relances
        </Link>
        <div className="flex flex-wrap gap-2">
          {file.hasPush ? (
            <Button
              disabled={!!blocked || busy || !text.trim()}
              onClick={() => push.mutate()}
              className="min-h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              <BellRing className="mr-1.5 h-4 w-4" />
              Envoyer en push
            </Button>
          ) : null}
          <Button
            disabled={!!blocked || busy || !text.trim() || !file.whatsapp}
            title={!file.whatsapp ? "Pas de numéro WhatsApp" : undefined}
            onClick={() => {
              // Open WhatsApp in the click itself (pop-up blockers), then note the contact
              window.open(`https://wa.me/${file.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
              whatsapp.mutate();
            }}
            className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Ouvrir WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
