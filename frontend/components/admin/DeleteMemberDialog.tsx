"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Member } from "@/lib/types";

const CONFIRM_WORD = "DELETE";

export function DeleteMemberDialog({
  member,
  pending,
  onCancel,
  onConfirm,
}: {
  member: Member | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (member: Member) => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
  }, [member?.id]);

  const name =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.phone ||
    "ce membre";
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <AlertDialog
      open={!!member}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Supprimer {name} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Le membre sera retiré de la liste et ne pourra plus se connecter à
            l&apos;app. Son historique (sessions, paiements, abonnements) est
            conservé dans les rapports.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (member && matches && !pending) onConfirm(member);
          }}
        >
          <label htmlFor="confirm-delete" className="text-sm">
            Tapez <span className="font-mono font-bold">{CONFIRM_WORD}</span>{" "}
            pour confirmer
          </label>
          <Input
            id="confirm-delete"
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="font-mono uppercase"
          />

          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel type="button" disabled={pending}>
              Annuler
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || pending}
            >
              {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
