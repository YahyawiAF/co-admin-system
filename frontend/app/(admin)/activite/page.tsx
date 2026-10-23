"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Check, ChevronDown, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { staffApi } from "@/lib/api/resources";
import { useAdminOrg } from "@/lib/admin-org-context";
import { STAFF_MODULES, useStaffAccess } from "@/lib/staff-access";
import { cn } from "@/lib/utils";
import type { StaffActionRow } from "@/lib/types";

type StatusFilter = "PENDING" | "CONFIRMED" | "REVERTED" | "ALL";

const ACTION_META: Record<
  StaffActionRow["action"],
  { label: string; icon: typeof Plus; cls: string }
> = {
  CREATE: { label: "Ajout", icon: Plus, cls: "bg-emerald-100 text-emerald-800" },
  UPDATE: { label: "Modification", icon: Pencil, cls: "bg-sky-100 text-sky-800" },
  DELETE: { label: "Suppression", icon: Trash2, cls: "bg-red-100 text-red-800" },
  HIDE: { label: "Masqué", icon: EyeOff, cls: "bg-amber-100 text-amber-800" },
};

const FIELD_LABELS: Record<string, string> = {
  isPayed: "Payé",
  payedAmount: "Montant dû",
  paidAmount: "Montant encaissé",
  amountDue: "Reste à payer",
  amount: "Montant",
  registredTime: "Arrivée",
  leaveTime: "Départ",
  registredDate: "Début",
  leaveDate: "Fin",
  serviceName: "Service",
  guestName: "Visiteur",
  spaceName: "Espace",
  seatLabel: "Place",
  reservedSeatLabel: "Place réservée",
  settled: "Réglé",
  note: "Note",
  status: "Statut",
  paidAt: "Payé le",
  paymentRemindAt: "Relance le",
  kind: "Type",
  isBooked: "Réservée",
};

/** Readable label for operations that are not a plain journal/abonnement edit. */
function operationLabel(a: StaffActionRow) {
  const p = a.path;
  if (/\/checkout$/.test(p)) return "Check-out";
  if (/\/payment$/.test(p)) return "Paiement";
  if (/fix-tariff/.test(p)) return "Tarif fixé";
  if (/quick-checkin|scan/.test(p)) return "Check-in";
  if (/booking-requests\/[^/]+\/approve/.test(p)) return "Demande de réservation acceptée";
  if (/booking-requests\/[^/]+\/reject/.test(p)) return "Demande de réservation refusée";
  if (/visit-requests\/[^/]+\/approve/.test(p)) return "Demande de visite acceptée";
  if (/visit-requests\/[^/]+\/reject/.test(p)) return "Demande de visite refusée";
  if (/orders/.test(p)) return "Commande café / produit";
  if (/staff-message/.test(p)) return "Message envoyé au visiteur";
  if (/book-space|move-seat/.test(p)) return "Place attribuée / déplacée";
  return null;
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return format(new Date(v), "d MMM HH:mm", { locale: fr });
  }
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

function changes(a: StaffActionRow) {
  const before = a.before || {};
  const after = a.after || {};
  const keys = Object.keys(FIELD_LABELS);
  if (a.action === "UPDATE") {
    return keys
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => ({ k, from: before[k], to: after[k] }));
  }
  const src = a.action === "CREATE" ? after : before;
  return keys
    .filter((k) => src[k] !== undefined && src[k] !== null && src[k] !== "")
    .map((k) => ({ k, from: undefined, to: src[k] }));
}

function ActionCard({
  a,
  index,
  busy,
  onConfirm,
  onRevert,
}: {
  a: StaffActionRow;
  index: number;
  busy: boolean;
  onConfirm: () => void;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(a.action === "HIDE" || a.action === "DELETE");
  const meta = ACTION_META[a.action];
  const Icon = meta.icon;
  const diff = changes(a);
  const op = operationLabel(a);
  const moduleLabel = STAFF_MODULES.find((m) => m.key === a.module)?.label ?? a.module;
  const who = a.user?.fullname || a.user?.email || a.user?.phoneNumber || "Employé";

  return (
    <Card
      className={cn(
        "staff-row-in transition-[opacity,border-color] duration-300",
        a.status !== "PENDING" && "opacity-70",
        a.status === "PENDING" && a.action === "HIDE" && "border-amber-300"
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              meta.cls
            )}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {op ? `${op} · ` : ""}
              {a.summary}
            </p>
            <p className="text-xs text-muted-foreground">
              {who} · {moduleLabel} ·{" "}
              {format(new Date(a.createdAt), "EEE d MMM, HH:mm", { locale: fr })}
            </p>
          </div>

          {a.status === "PENDING" ? (
            <div className="flex shrink-0 gap-2">
              {a.revertable ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={onRevert}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {a.action === "HIDE" || a.action === "DELETE" ? "Restaurer" : "Annuler"}
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={busy}
                onClick={onConfirm}
                className={a.action === "HIDE" ? "bg-red-600 hover:bg-red-700" : undefined}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {a.action === "HIDE" ? "Supprimer" : "Valider"}
              </Button>
            </div>
          ) : (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                a.status === "CONFIRMED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              {a.status === "CONFIRMED" ? "Validée" : "Annulée"}
              {a.reviewedAt ? ` · ${format(new Date(a.reviewedAt), "d MMM", { locale: fr })}` : ""}
            </span>
          )}
        </div>

        {diff.length ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
              />
              {a.action === "UPDATE" ? `${diff.length} champ(s) modifié(s)` : "Détails"}
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-2 grid gap-1 rounded-md bg-muted/40 p-2 text-xs sm:grid-cols-2">
                  {diff.map((d) => (
                    <div key={d.k} className="flex gap-2">
                      <span className="w-28 shrink-0 text-muted-foreground">{FIELD_LABELS[d.k]}</span>
                      {a.action === "UPDATE" ? (
                        <span>
                          <span className="text-muted-foreground line-through">{fmtValue(d.from)}</span>
                          {" → "}
                          <span className="font-medium">{fmtValue(d.to)}</span>
                        </span>
                      ) : (
                        <span className="font-medium">{fmtValue(d.to)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {a.status === "PENDING" && a.action === "HIDE" ? (
          <p className="mt-2 text-xs text-amber-700">
            L’employé ne voit plus cet élément. « Supprimer » le supprime vraiment, « Restaurer » le
            fait réapparaître pour lui.
          </p>
        ) : null}
        {a.status === "PENDING" && a.action === "DELETE" && a.revertable ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Supprimé définitivement par l’employé — une copie permet de le restaurer.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActiviteInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { organizationId } = useAdminOrg();
  const { isStaff } = useStaffAccess();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [userId, setUserId] = useState<string>(searchParams.get("user") || "");
  const [module, setModule] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pendingRevert, setPendingRevert] = useState<StaffActionRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffActionRow | null>(null);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", organizationId],
    queryFn: () => staffApi.list(),
    enabled: !!organizationId && !isStaff,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["staff-actions", organizationId, status, userId, module, page],
    queryFn: () => staffApi.actions({ status, userId, module, page }),
    enabled: !!organizationId && !isStaff,
    refetchInterval: 30_000,
  });
  const rows = data?.data ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-actions"] });
    queryClient.invalidateQueries({ queryKey: ["staff-actions-summary"] });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    // Restored / deleted rows show up in the other pages.
    queryClient.invalidateQueries({ queryKey: ["journals"] });
    queryClient.invalidateQueries({ queryKey: ["debtors"] });
    queryClient.invalidateQueries({ queryKey: ["abonnements"] });
  };

  const review = useMutation({
    mutationFn: ({ a, decision }: { a: StaffActionRow; decision: "confirm" | "revert" }) =>
      staffApi.review(a.id, decision),
    onSuccess: (_, { decision, a }) => {
      toast.success(
        decision === "revert"
          ? a.action === "HIDE" || a.action === "DELETE"
            ? "Élément restauré"
            : "Action annulée"
          : a.action === "HIDE"
            ? "Supprimé définitivement"
            : "Action validée"
      );
      setPendingRevert(null);
      setPendingDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (ids: string[]) => staffApi.confirmMany(ids),
    onSuccess: (r) => {
      toast.success(`${r.confirmed} action(s) validée(s)`);
      if (r.errors.length) toast.error(r.errors.join("\n"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk "validate" never deletes: hidden items need a one-by-one decision.
  const bulkIds = useMemo(
    () => rows.filter((r) => r.status === "PENDING" && r.action !== "HIDE").map((r) => r.id),
    [rows]
  );

  if (isStaff) return null;

  const chips: Array<{ id: StatusFilter; label: string }> = [
    { id: "PENDING", label: "À vérifier" },
    { id: "CONFIRMED", label: "Validées" },
    { id: "REVERTED", label: "Annulées" },
    { id: "ALL", label: "Tout" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activité du staff</h1>
          <p className="text-sm text-muted-foreground">
            Tout ce que vos employés ont ajouté, modifié, masqué ou supprimé. Validez ou annulez.
          </p>
        </div>
        {status === "PENDING" && bulkIds.length ? (
          <Button variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate(bulkIds)}>
            <Check className="mr-2 h-4 w-4" />
            Valider les {bulkIds.length} modifications affichées
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setStatus(c.id);
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
              status === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
            {c.id === "PENDING" && status === "PENDING" && data ? ` (${data.total})` : ""}
          </button>
        ))}
        <select
          className="ml-auto rounded-md border bg-background px-2 py-1.5 text-xs"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les employés</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullname || s.email || s.phoneNumber}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border bg-background px-2 py-1.5 text-xs"
          value={module}
          onChange={(e) => {
            setModule(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les modules</option>
          {STAFF_MODULES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {status === "PENDING" ? "Rien à vérifier." : "Aucune action."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" key={`${status}-${userId}-${module}-${page}`}>
          {rows.map((a, i) => (
            <ActionCard
              key={a.id}
              a={a}
              index={i}
              busy={review.isPending}
              onConfirm={() =>
                a.action === "HIDE" ? setPendingDelete(a) : review.mutate({ a, decision: "confirm" })
              }
              onRevert={() => setPendingRevert(a)}
            />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </Button>
        </div>
      ) : null}

      <AlertDialog open={!!pendingRevert} onOpenChange={(o) => !o && setPendingRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRevert?.action === "HIDE" || pendingRevert?.action === "DELETE"
                ? "Restaurer cet élément ?"
                : pendingRevert?.action === "CREATE"
                  ? "Supprimer ce que l’employé a ajouté ?"
                  : "Remettre les valeurs d’avant ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevert?.action === "UPDATE"
                ? "Seuls les champs changés par cette action reviennent à leur ancienne valeur."
                : pendingRevert?.summary}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRevert && review.mutate({ a: pendingRevert, decision: "revert" })}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.summary}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => pendingDelete && review.mutate({ a: pendingDelete, decision: "confirm" })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ActivitePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <ActiviteInner />
    </Suspense>
  );
}
