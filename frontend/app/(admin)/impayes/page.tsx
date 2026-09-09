"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  abonnementsApi,
  journalApi,
  membersApi,
  mobileApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { DebtorItem, DebtorSource } from "@/lib/types";

type Filter = "OPEN" | "VISIT" | "ABONNEMENT" | "LEDGER" | "HISTORY";

export default function ImpayesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [toDelete, setToDelete] = useState<DebtorItem | null>(null);

  const { data: openData } = useQuery({
    queryKey: [...queryKeys.debtors, "open"],
    queryFn: () => membersApi.debtors(false),
  });
  const { data: histData } = useQuery({
    queryKey: [...queryKeys.debtors, "history"],
    queryFn: () => membersApi.debtors(true),
    enabled: filter === "HISTORY",
  });

  const members = openData?.members || [];
  const histMembers = histData?.members || [];

  const openItems = useMemo(
    () => members.flatMap((m) => m.items.filter((i) => !i.settled)),
    [members]
  );
  const historyItems = useMemo(
    () =>
      histMembers
        .flatMap((m) => m.items)
        .filter((i) => i.settled)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
    [histMembers]
  );

  const rows = useMemo(() => {
    if (filter === "HISTORY") return historyItems;
    if (filter === "VISIT")
      return openItems.filter((i) => i.source === "VISIT");
    if (filter === "ABONNEMENT")
      return openItems.filter((i) => i.source === "ABONNEMENT");
    if (filter === "LEDGER")
      return openItems.filter((i) => i.source === "LEDGER");
    return openItems.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filter, openItems, historyItems]);

  const totalOpen = members.reduce((s, m) => s + m.net, 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.abonnements });
    queryClient.invalidateQueries({ queryKey: queryKeys.debtors });
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-month"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
  };

  const settle = useMutation({
    mutationFn: async (item: DebtorItem) => {
      if (item.source === "VISIT" && item.journalId) {
        await mobileApi.setPayment(item.journalId, true);
        return;
      }
      if (item.source === "ABONNEMENT" && item.abonnementId) {
        await abonnementsApi.update(item.abonnementId, { isPayed: true });
        return;
      }
      if (item.source === "LEDGER" && item.ledgerId) {
        await membersApi.settleLedger(item.ledgerId, true);
      }
    },
    onSuccess: () => {
      toast.success("Marqué payé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (item: DebtorItem) => {
      if (item.source === "VISIT" && item.journalId) {
        await journalApi.remove(item.journalId);
        return;
      }
      if (item.source === "ABONNEMENT" && item.abonnementId) {
        await abonnementsApi.remove(item.abonnementId);
        return;
      }
      if (item.source === "LEDGER" && item.ledgerId) {
        await membersApi.removeLedger(item.ledgerId);
        return;
      }
      throw new Error("Impossible de supprimer cette écriture");
    },
    onSuccess: () => {
      toast.success("Impayé supprimé — hors revenu");
      setToDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "OPEN", label: "Ouvert", count: openItems.length },
    {
      id: "VISIT",
      label: "Visites",
      count: openItems.filter((i) => i.source === "VISIT").length,
    },
    {
      id: "ABONNEMENT",
      label: "Abonnements",
      count: openItems.filter((i) => i.source === "ABONNEMENT").length,
    },
    {
      id: "LEDGER",
      label: "Crédit ledger",
      count: openItems.filter((i) => i.source === "LEDGER").length,
    },
    { id: "HISTORY", label: "Historique", count: historyItems.length },
  ];

  const canDelete = (item: DebtorItem) =>
    (item.source === "VISIT" && !!item.journalId) ||
    (item.source === "ABONNEMENT" && !!item.abonnementId) ||
    (item.source === "LEDGER" && !!item.ledgerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impayés</h1>
        <p className="text-sm text-muted-foreground">
          Visites, abonnements et crédits encore dus — historique des
          règlements. Supprimer retire l&apos;écriture (et le CA si
          abonnement).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde ouvert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpen.toFixed(1)} DT</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visiteurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Écritures ouvertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openItems.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === chip.id
                ? "border-rose-500 bg-rose-600 text-white"
                : "border-rose-200 bg-rose-50 text-rose-900"
            )}
          >
            {chip.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                filter === chip.id ? "bg-white/25" : "bg-black/5"
              )}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Visiteur</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Détail</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow
                  key={`${item.source}-${item.id}`}
                  className={cn(!item.settled && "bg-rose-50/70")}
                >
                  <TableCell>
                    {item.visitorNumber != null
                      ? `#${item.visitorNumber}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.memberName}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={item.source} settled={item.settled} />
                  </TableCell>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>
                    {format(new Date(item.date), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>{item.amount.toFixed(1)} DT</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!item.settled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={settle.isPending}
                          onClick={() => settle.mutate(item)}
                        >
                          Marquer payé
                        </Button>
                      ) : (
                        <Badge variant="secondary">Réglé</Badge>
                      )}
                      {canDelete(item) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={remove.isPending}
                          onClick={() => setToDelete(item)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Supprimer
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/members?memberId=${item.memberId}`}>
                          Fiche
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <Wallet className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Rien à afficher.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet impayé ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.memberName || "Cette écriture"} — {toDelete?.label} (
              {toDelete?.amount.toFixed(1)} DT).
              {toDelete?.source === "ABONNEMENT"
                ? " L’abonnement est effacé et sort du chiffre d’affaires."
                : toDelete?.source === "VISIT"
                  ? " La visite journal est effacée."
                  : " L’écriture ledger est effacée."}{" "}
              Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SourceBadge({
  source,
  settled,
}: {
  source: DebtorSource;
  settled: boolean;
}) {
  const label =
    source === "VISIT"
      ? "Visite"
      : source === "ABONNEMENT"
        ? "Abonnement"
        : "Crédit";
  return (
    <Badge variant={settled ? "secondary" : "outline"} className="text-[10px]">
      {label}
    </Badge>
  );
}
