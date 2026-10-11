"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  Copy,
  HandCoins,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  UserMinus,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { outreachApi } from "@/lib/api/resources";
import type { OutreachChannel, OutreachItem, OutreachReason } from "@/lib/types";

const REASON_UI: Record<
  OutreachReason,
  { label: string; icon: typeof Sparkles; tone: string; why: string }
> = {
  ABO_EXPIRING: {
    label: "Fin d'abonnement",
    icon: CalendarClock,
    tone: "bg-amber-100 text-amber-800",
    why: "Relancé avant la fin, un abonné renouvelle bien plus souvent.",
  },
  ABO_ENDED: {
    label: "Pas renouvelé",
    icon: UserMinus,
    tone: "bg-rose-100 text-rose-700",
    why: "Plus on attend, plus il prend l'habitude de travailler ailleurs.",
  },
  UNPAID: {
    label: "Impayé",
    icon: HandCoins,
    tone: "bg-red-100 text-red-700",
    why: "L'argent déjà gagné : le plus rapide à récupérer.",
  },
  INACTIVE: {
    label: "Habitué absent",
    icon: UserX,
    tone: "bg-sky-100 text-sky-800",
    why: "Venait souvent, plus vu depuis un moment.",
  },
  CONVERT: {
    label: "À passer en abonnement",
    icon: Sparkles,
    tone: "bg-emerald-100 text-emerald-800",
    why: "Paie presque un abonnement en passes : revenu garanti s'il passe abonné.",
  },
  REVIEW: {
    label: "Avis Google",
    icon: Star,
    tone: "bg-yellow-100 text-yellow-800",
    why: "Un client fidèle et content : chaque avis aide les nouveaux à vous trouver sur Google Maps.",
  },
};

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  WHATSAPP: "WhatsApp",
  PUSH: "notification",
  CALL: "appel",
  SKIP: "ignoré",
};

const dt = (n: number) => `${Math.round(n * 10) / 10} DT`;

function actionLink(item: OutreachItem) {
  if (item.reason === "CONVERT" && item.offer) {
    return {
      label: "Créer l'abonnement",
      href: `/abonnements?new=1&memberId=${item.memberId}&priceId=${item.offer.plan.id}`,
    };
  }
  if (item.reason === "ABO_EXPIRING" || item.reason === "ABO_ENDED") {
    return { label: "Renouveler", href: `/abonnements?memberId=${item.memberId}` };
  }
  if (item.reason === "UNPAID") return { label: "Encaisser", href: "/impayes" };
  return null;
}

function MessageDialog({
  item,
  onClose,
}: {
  item: OutreachItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  if (item && forId !== `${item.memberId}:${item.reason}`) {
    setForId(`${item.memberId}:${item.reason}`);
    setText(item.message);
  }
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["outreach"] });
    onClose();
  };
  const log = useMutation({
    mutationFn: (channel: OutreachChannel) =>
      outreachApi.log({
        memberId: item!.memberId,
        reason: item!.reason,
        channel,
        message: text,
      }),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const push = useMutation({
    mutationFn: () =>
      outreachApi.push({ memberId: item!.memberId, reason: item!.reason, message: text }),
    onSuccess: () => {
      toast.success("Notification envoyée");
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!item) return null;
  const openWhatsApp = () => {
    window.open(
      `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
    log.mutate("WHATSAPP");
  };
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Message copié");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message pour {item.name}</DialogTitle>
          <DialogDescription>
            Modifiez le texte si besoin, puis envoyez-le.
            {item.phone ? ` Téléphone : ${item.phone}.` : " Pas de numéro enregistré."}
          </DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {item.whatsapp ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!text.trim() || log.isPending}
              onClick={openWhatsApp}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Envoyer sur WhatsApp
            </Button>
          ) : null}
          {item.hasPush ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={!text.trim() || push.isPending}
              onClick={() => push.mutate()}
            >
              <BellRing className="mr-2 h-4 w-4" />
              Envoyer une notification dans l&apos;app
            </Button>
          ) : null}
          <div className="flex w-full gap-2">
            <Button variant="ghost" className="flex-1" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" />
              Copier
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={log.isPending}
              onClick={() => log.mutate("CALL")}
            >
              <Phone className="mr-2 h-4 w-4" />
              Contacté autrement
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutreachRow({
  item,
  onMessage,
}: {
  item: OutreachItem;
  onMessage: () => void;
}) {
  const queryClient = useQueryClient();
  const ui = REASON_UI[item.reason];
  const Icon = ui.icon;
  const link = actionLink(item);
  const skip = useMutation({
    mutationFn: () =>
      outreachApi.log({ memberId: item.memberId, reason: item.reason, channel: "SKIP" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outreach"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", ui.tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ui.tone)}>
            {ui.label}
          </span>
          {item.owed > 0 && item.reason !== "UNPAID" ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
              doit {dt(item.owed)}
            </span>
          ) : null}
        </div>
        <div className="text-sm">{item.title}</div>
        <div className="text-xs text-muted-foreground">
          {item.detail}
          {item.lastContact
            ? ` · contacté ${formatDistanceToNow(new Date(item.lastContact.at), { locale: fr, addSuffix: true })} (${CHANNEL_LABEL[item.lastContact.channel]})`
            : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {link ? (
          <Button asChild size="sm" variant="outline">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ) : null}
        <Button
          size="sm"
          className={item.whatsapp ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
          onClick={onMessage}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          Contacter
        </Button>
        {!item.snoozed ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            title="Ignorer pour l'instant"
            disabled={skip.isPending}
            onClick={() => skip.mutate()}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default function RelancesPage() {
  const [filter, setFilter] = useState<OutreachReason | "ALL">("ALL");
  const [messaging, setMessaging] = useState<OutreachItem | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["outreach"],
    queryFn: () => outreachApi.list(),
  });

  const counts = useMemo(() => {
    const c: Partial<Record<OutreachReason, number>> = {};
    for (const i of data?.todo ?? []) c[i.reason] = (c[i.reason] ?? 0) + 1;
    return c;
  }, [data]);
  const todo = (data?.todo ?? []).filter((i) => filter === "ALL" || i.reason === filter);
  const atStake = (data?.todo ?? []).reduce((a, i) => a + i.value, 0);
  const results = data?.results;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relances</h1>
        <p className="text-muted-foreground">
          Les clients à contacter aujourd&apos;hui. Un message au bon moment fait renouveler, revenir et payer.
        </p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">À contacter</div>
                <div className="text-2xl font-semibold tabular-nums">{data.todo.length}</div>
                <div className="text-xs text-muted-foreground">~{dt(atStake)} en jeu</div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Contactés (30 jours)</div>
                <div className="text-2xl font-semibold tabular-nums">{results?.contacted ?? 0}</div>
                <div className="text-xs text-muted-foreground">
                  {results?.contacted
                    ? `${results.won} ont renouvelé, payé ou sont revenus (${Math.round((results.won / results.contacted) * 100)} %)`
                    : "Commencez par la liste ci-dessous"}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Gagné grâce aux relances</div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-700">
                  {dt(results?.revenue ?? 0)}
                </div>
                <div className="text-xs text-muted-foreground">Dans les 14 jours après le message</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              Tous · {data.todo.length}
            </FilterChip>
            {(Object.keys(REASON_UI) as OutreachReason[]).map((r) =>
              counts[r] ? (
                <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)}>
                  {REASON_UI[r].label} · {counts[r]}
                </FilterChip>
              ) : null,
            )}
          </div>

          <Card className="shadow-none">
            <CardContent className="px-4 py-1">
              {filter !== "ALL" ? (
                <p className="border-b py-2 text-xs text-muted-foreground">{REASON_UI[filter].why}</p>
              ) : null}
              {todo.length ? (
                <ul className="divide-y">
                  {todo.map((item) => (
                    <OutreachRow
                      key={`${item.memberId}:${item.reason}`}
                      item={item}
                      onMessage={() => setMessaging(item)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Personne à relancer pour le moment. Revenez demain.
                </p>
              )}
            </CardContent>
          </Card>

          {data.contacted.length ? (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowDone((v) => !v)}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} />
                Déjà contactés récemment ({data.contacted.length})
              </button>
              {showDone ? (
                <Card className="mt-2 shadow-none">
                  <CardContent className="px-4 py-1">
                    <ul className="divide-y opacity-80">
                      {data.contacted.map((item) => (
                        <OutreachRow
                          key={`${item.memberId}:${item.reason}`}
                          item={item}
                          onMessage={() => setMessaging(item)}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {!data.pushEnabled ? (
            <p className="text-xs text-muted-foreground">
              Les notifications dans l&apos;app sont désactivées sur le serveur (clés VAPID manquantes) : seuls WhatsApp et l&apos;appel sont proposés.
            </p>
          ) : null}
        </>
      )}

      <MessageDialog item={messaging} onClose={() => setMessaging(null)} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
