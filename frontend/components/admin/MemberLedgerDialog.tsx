"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Plus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { abonnementsApi, membersApi, mobileApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { MemberAccountVisit } from "@/lib/types";

type Props = {
  memberId: string;
  memberName?: string;
  source?: string;
  journalId?: string;
  abonnementId?: string;
  defaultAmount?: number;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const AVOIR_REASONS = [
  {
    id: "unused_today",
    label: "Forfait d’aujourd’hui payé mais non utilisé",
    hint: "Le visiteur a payé, il n’est pas venu (ou presque pas). On lui doit cet avoir.",
  },
  {
    id: "overpay",
    label: "Trop-perçu / solde en sa faveur",
    hint: "Il a payé plus que le forfait du jour. La différence reste à son crédit.",
  },
  {
    id: "unused_previous",
    label: "Ancien forfait payé non consommé",
    hint: "Un forfait d’un jour précédent n’a pas été utilisé. On lui doit un avoir.",
  },
  {
    id: "other",
    label: "Autre avoir",
    hint: "Geste commercial, correction, etc.",
  },
] as const;

export function MemberLedgerDialog({
  memberId,
  memberName,
  source = "member",
  journalId,
  abonnementId,
  defaultAmount,
  trigger,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [showAvoir, setShowAvoir] = useState(false);
  const [reason, setReason] = useState<(typeof AVOIR_REASONS)[number]["id"]>(
    "unused_today"
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const { data } = useQuery({
    queryKey: ["member-ledger", memberId],
    queryFn: () => membersApi.ledger(memberId),
    enabled: dialogOpen && !!memberId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["member-ledger", memberId] });
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.abonnements });
    queryClient.invalidateQueries({ queryKey: queryKeys.debtors });
    queryClient.invalidateQueries({ queryKey: ["member-insights", memberId] });
  };

  const today = data?.todayVisit;
  const reasonMeta = AVOIR_REASONS.find((r) => r.id === reason)!;
  const suggestedAvoir = useMemo(() => {
    if (reason === "unused_today" && today?.isPayed) return today.amount;
    if (reason === "overpay" && today) return defaultAmount || today.amount;
    return defaultAmount || undefined;
  }, [reason, today, defaultAmount]);

  const saveAvoir = useMutation({
    mutationFn: () =>
      membersApi.addLedger(memberId, {
        kind: "ECHEANCE",
        amount: Number(amount || suggestedAvoir || 0),
        note:
          note.trim() ||
          `${reasonMeta.label}${today?.forfait ? ` · ${today.forfait}` : ""}`,
        source,
        journalId:
          reason === "unused_today" || reason === "overpay"
            ? today?.id || journalId
            : journalId,
        abonnementId,
      }),
    onSuccess: () => {
      toast.success("Avoir enregistré — nous lui devons cette somme");
      setAmount("");
      setNote("");
      setShowAvoir(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: (id: string) => membersApi.settleLedger(id, true),
    onSuccess: () => {
      toast.success("Avoir soldé");
      invalidate();
    },
  });

  const payVisit = useMutation({
    mutationFn: (id: string) => mobileApi.setPayment(id, true),
    onSuccess: () => {
      toast.success("Forfait marqué payé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payAbo = useMutation({
    mutationFn: (id: string) =>
      abonnementsApi.update(id, { isPayed: true }),
    onSuccess: () => {
      toast.success("Abonnement marqué payé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAvoirs = (data?.entries || []).filter(
    (e) => e.kind === "ECHEANCE" && !e.settled
  );
  const history = (data?.entries || []).filter((e) => e.settled);

  return (
    <Dialog open={dialogOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : open === undefined ? (
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline">
            <Wallet className="mr-1.5 h-4 w-4" />
            Compte visiteur
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl">Compte visiteur</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {memberName || "Membre"} — forfaits du jour, dettes et avoirs
          </p>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-800">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                Il nous doit
              </p>
              <p className="mt-1 text-3xl font-bold text-rose-950">
                {(data?.owedByMember ?? 0).toFixed(1)}{" "}
                <span className="text-base font-medium">DT</span>
              </p>
              <p className="mt-1 text-xs text-rose-800/80">
                Forfaits ou abonnements non encaissés
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Nous lui devons
              </p>
              <p className="mt-1 text-3xl font-bold text-sky-950">
                {(data?.owedToMember ?? 0).toFixed(1)}{" "}
                <span className="text-base font-medium">DT</span>
              </p>
              <p className="mt-1 text-xs text-sky-800/80">
                Avoirs : forfait payé non utilisé, trop-perçu
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Aujourd’hui
            </h3>
            {today ? (
              <VisitCard
                visit={today}
                highlight
                onPay={() => payVisit.mutate(today.id)}
                paying={payVisit.isPending}
              />
            ) : (
              <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
                Pas de visite enregistrée aujourd’hui.
              </p>
            )}
          </section>

          {(data?.unpaidVisits || []).length ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Forfaits précédents non payés
              </h3>
              <p className="text-xs text-muted-foreground">
                Visites d’autres jours encore dues. Le plan des places est
                libéré, le compte reste.
              </p>
              <div className="space-y-2">
                {(data?.unpaidVisits || []).map((v) => (
                  <VisitCard
                    key={v.id}
                    visit={v}
                    onPay={() => payVisit.mutate(v.id)}
                    paying={payVisit.isPending}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {(data?.unpaidAbos || []).length ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Abonnements non payés</h3>
              {(data?.unpaidAbos || []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-rose-50/50 px-3 py-2.5"
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.registredDate), "d MMM yyyy", {
                        locale: fr,
                      })}{" "}
                      · {a.amount.toFixed(1)} DT
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={payAbo.isPending}
                    onClick={() => payAbo.mutate(a.id)}
                  >
                    Marquer payé
                  </Button>
                </div>
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Avoirs (nous lui devons)</h3>
              <Button
                size="sm"
                variant={showAvoir ? "secondary" : "outline"}
                onClick={() => setShowAvoir((v) => !v)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Enregistrer un avoir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Un avoir, c’est de l’argent que le coworking doit au visiteur :
              forfait payé sans venue, trop-perçu, geste commercial. Il sera
              déduit plus tard.
            </p>
            {showAvoir ? (
              <div className="space-y-3 rounded-2xl border bg-sky-50/60 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {AVOIR_REASONS.map((r) => {
                    const disabled =
                      r.id === "unused_today" && today && !today.isPayed;
                    return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setReason(r.id);
                        if (r.id === "unused_today" && today?.isPayed) {
                          setAmount(String(today.amount));
                        }
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm",
                        disabled && "cursor-not-allowed opacity-40",
                        reason === r.id
                          ? "border-sky-500 bg-white shadow-sm"
                          : "border-transparent bg-white/60 hover:bg-white"
                      )}
                    >
                      <p className="font-medium">{r.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {disabled
                          ? "Le forfait du jour n’est pas payé — pas d’avoir."
                          : r.hint}
                      </p>
                    </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Montant (DT)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={amount}
                      placeholder={
                        suggestedAvoir ? String(suggestedAvoir) : "0"
                      }
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Précision (optionnel)</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex. parti au bout d’1 h"
                    />
                  </div>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    saveAvoir.isPending ||
                    !Number(amount || suggestedAvoir || 0)
                  }
                  onClick={() => saveAvoir.mutate()}
                >
                  Enregistrer l’avoir
                </Button>
              </div>
            ) : null}
            {openAvoirs.length ? (
              <div className="space-y-2">
                {openAvoirs.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-white px-3 py-2.5"
                  >
                    <div>
                      <p className="font-medium">
                        {e.amount.toFixed(1)} DT
                        {e.forfaitName ? ` · ${e.forfaitName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.createdAt), "d MMM yyyy", {
                          locale: fr,
                        })}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settle.isPending}
                      onClick={() => settle.mutate(e.id)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Solder
                    </Button>
                  </div>
                ))}
              </div>
            ) : !showAvoir ? (
              <p className="text-sm text-muted-foreground">Aucun avoir ouvert.</p>
            ) : null}
          </section>

          {history.length ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Historique soldé</h3>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {history.map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {format(new Date(e.createdAt), "d MMM", { locale: fr })}{" "}
                      · {e.kind === "ECHEANCE" ? "Avoir" : "Dette"}{" "}
                      {e.forfaitName ? `· ${e.forfaitName}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span>{e.amount.toFixed(1)} DT</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VisitCard({
  visit,
  highlight,
  onPay,
  paying,
}: {
  visit: MemberAccountVisit;
  highlight?: boolean;
  onPay: () => void;
  paying: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        visit.isPayed
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-rose-200 bg-rose-50/70",
        highlight && "ring-1 ring-black/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{visit.forfait || "Forfait"}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(visit.registredTime), "EEEE d MMM · HH:mm", {
              locale: fr,
            })}
            {visit.isOpen ? " · en cours" : visit.leaveTime ? " · parti" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{visit.amount.toFixed(1)} DT</p>
          <Badge
            variant={visit.isPayed ? "default" : "secondary"}
            className={cn(
              "mt-0.5",
              visit.isPayed
                ? "bg-emerald-600 hover:bg-emerald-600"
                : "bg-rose-600 text-white hover:bg-rose-600"
            )}
          >
            {visit.isPayed ? "Payé" : "Non payé"}
          </Badge>
        </div>
      </div>
      {!visit.isPayed ? (
        <Button
          size="sm"
          className="mt-3"
          variant="outline"
          disabled={paying}
          onClick={onPay}
        >
          Marquer ce forfait payé
        </Button>
      ) : (
        <p className="mt-2 text-xs text-emerald-800">
          Encaissé. S’il n’a pas consommé sa journée, enregistrez un avoir
          ci-dessous.
        </p>
      )}
    </div>
  );
}
