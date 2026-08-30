"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { membersApi } from "@/lib/api/resources";
import type { LedgerKind } from "@/lib/types";

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
  const [kind, setKind] = useState<LedgerKind>("CREDIT");
  const [amount, setAmount] = useState(
    defaultAmount != null ? String(defaultAmount) : ""
  );
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data } = useQuery({
    queryKey: ["member-ledger", memberId],
    queryFn: () => membersApi.ledger(memberId),
    enabled: dialogOpen && !!memberId,
  });

  const save = useMutation({
    mutationFn: () =>
      membersApi.addLedger(memberId, {
        kind,
        amount: Number(amount),
        note,
        dueDate: dueDate || undefined,
        source,
        journalId,
        abonnementId,
      }),
    onSuccess: () => {
      toast.success(kind === "CREDIT" ? "Crédit enregistré" : "Échéance enregistrée");
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["member-ledger", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: (id: string) => membersApi.settleLedger(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-ledger", memberId] });
    },
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : open === undefined ? (
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline">
            <Wallet className="mr-1.5 h-4 w-4" />
            Crédit / échéance
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crédit & échéance</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {memberName || "Membre"}
          {data ? (
            <>
              {" · "}reste dû {data.owedByMember.toFixed(1)} DT · nous devons{" "}
              {data.owedToMember.toFixed(1)} DT
            </>
          ) : null}
        </p>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm">
          {(
            [
              ["CREDIT", "Crédit (nous doit)"],
              ["ECHEANCE", "Échéance (nous devons)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={
                kind === k
                  ? "flex-1 rounded-full bg-white py-1.5 font-medium shadow-sm"
                  : "flex-1 rounded-full py-1.5 text-slate-500"
              }
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Montant (DT)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Échéance (optionnel)</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Note</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. acompte, solde, avoir…"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={save.isPending || !Number(amount)}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </DialogFooter>
        {data?.entries?.length ? (
          <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
            {data.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-2 rounded-lg border px-2 py-1.5"
              >
                <div>
                  <p className="font-medium">
                    {e.kind === "CREDIT" ? "Crédit" : "Échéance"} · {e.amount} DT
                    {e.settled ? " · soldé" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.createdAt), "dd MMM yyyy", { locale: fr })}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                {!e.settled ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => settle.mutate(e.id)}
                  >
                    Solder
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
