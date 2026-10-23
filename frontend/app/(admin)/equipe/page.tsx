"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { History, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { emptyPermissions, STAFF_MODULES, useStaffAccess } from "@/lib/staff-access";
import { cn } from "@/lib/utils";
import type {
  StaffDeleteMode,
  StaffMember,
  StaffModule,
  StaffPermissions,
} from "@/lib/types";

const DELETE_MODES: Array<{ id: StaffDeleteMode; label: string; hint: string }> = [
  { id: "none", label: "Interdit", hint: "Ne peut rien supprimer" },
  { id: "hide", label: "Masquer", hint: "Disparaît pour lui, vous décidez ensuite" },
  { id: "delete", label: "Supprimer", hint: "Suppression réelle (restaurable depuis l’activité)" },
];

function permissionSummary(p: StaffPermissions) {
  return STAFF_MODULES.filter((m) => p[m.key].read).map((m) => {
    const r = p[m.key];
    const bits = [r.write ? "écriture" : "lecture"];
    if (r.delete === "hide") bits.push("masque");
    if (r.delete === "delete") bits.push("supprime");
    return { key: m.key, label: m.label, detail: bits.join(" · ") };
  });
}

/** Read / write / delete-mode grid for the 4 modules. */
function PermissionMatrix({
  value,
  onChange,
}: {
  value: StaffPermissions;
  onChange: (next: StaffPermissions) => void;
}) {
  const set = (key: StaffModule, patch: Partial<StaffPermissions[StaffModule]>) => {
    const cur = { ...value[key], ...patch };
    // Keep it coherent: no write/delete without read, no read → nothing else.
    if (patch.read === false) {
      cur.write = false;
      cur.delete = "none";
    }
    if (patch.write || (patch.delete && patch.delete !== "none")) cur.read = true;
    onChange({ ...value, [key]: cur });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[1fr_70px_70px_minmax(0,230px)] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>Module</span>
        <span className="text-center">Lecture</span>
        <span className="text-center">Écriture</span>
        <span>Suppression</span>
      </div>
      {STAFF_MODULES.map((m) => {
        const p = value[m.key];
        return (
          <div
            key={m.key}
            className={cn(
              "grid grid-cols-2 items-center gap-2 border-b px-3 py-2.5 transition-colors duration-200 last:border-b-0 sm:grid-cols-[1fr_70px_70px_minmax(0,230px)]",
              p.read ? "bg-background" : "bg-muted/20"
            )}
          >
            <span className="col-span-2 text-sm font-medium sm:col-span-1">{m.label}</span>
            <label className="flex items-center gap-2 text-xs sm:justify-center">
              <Switch checked={p.read} onCheckedChange={(v) => set(m.key, { read: v })} />
              <span className="sm:hidden">Lecture</span>
            </label>
            <label className="flex items-center gap-2 text-xs sm:justify-center">
              <Switch checked={p.write} onCheckedChange={(v) => set(m.key, { write: v })} />
              <span className="sm:hidden">Écriture</span>
            </label>
            <div className="col-span-2 inline-flex rounded-md border bg-muted/40 p-0.5 sm:col-span-1">
              {DELETE_MODES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  title={d.hint}
                  onClick={() => set(m.key, { delete: d.id })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors duration-200",
                    p.delete === d.id
                      ? d.id === "delete"
                        ? "bg-red-600 text-white shadow-sm"
                        : d.id === "hide"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FormState = {
  id?: string;
  fullname: string;
  identifier: string;
  password: string;
  permissions: StaffPermissions;
};

export default function EquipePage() {
  const queryClient = useQueryClient();
  const { organizationId, organization } = useAdminOrg();
  const { isStaff } = useStaffAccess();
  const [form, setForm] = useState<FormState | null>(null);
  const [toRemove, setToRemove] = useState<StaffMember | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", organizationId],
    queryFn: () => staffApi.list(),
    enabled: !!organizationId && !isStaff,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const save = useMutation({
    mutationFn: (f: FormState) =>
      f.id
        ? staffApi.update(f.id, {
            fullname: f.fullname,
            permissions: f.permissions,
            ...(f.password ? { password: f.password } : {}),
          })
        : staffApi.create({
            fullname: f.fullname,
            identifier: f.identifier,
            password: f.password,
            permissions: f.permissions,
          }),
    onSuccess: (_, f) => {
      toast.success(f.id ? "Droits mis à jour" : "Employé ajouté");
      setForm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (s: StaffMember) => staffApi.update(s.id, { isActive: !s.isActive }),
    onSuccess: (_, s) => {
      toast.success(s.isActive ? "Compte suspendu — déconnecté" : "Compte réactivé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (s: StaffMember) => staffApi.remove(s.id),
    onSuccess: () => {
      toast.success("Employé retiré");
      setToRemove(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isStaff) return null;

  const openCreate = () =>
    setForm({
      fullname: "",
      identifier: "",
      password: "",
      permissions: {
        ...emptyPermissions(),
        journal: { read: true, write: true, delete: "hide" },
      },
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Équipe</h1>
          <p className="text-sm text-muted-foreground">
            Donnez accès à vos employés{organization ? ` sur ${organization.name}` : ""} et
            choisissez ce qu’ils peuvent voir, modifier ou supprimer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/activite">
              <History className="mr-2 h-4 w-4" />
              Activité
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un employé
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <UserCog className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun employé pour l’instant. Ajoutez-en un : il se connecte avec son email
              ou téléphone sur la même page de connexion.
            </p>
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un employé
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {staff.map((s, i) => (
            <Card
              key={s.id}
              className={cn("staff-row-in transition-opacity duration-300", !s.isActive && "opacity-60")}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{s.fullname || "Sans nom"}</p>
                      {!s.isActive ? <Badge variant="secondary">Suspendu</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.email || s.phoneNumber}
                      {s.lastActionAt
                        ? ` · actif ${formatDistanceToNow(new Date(s.lastActionAt), { locale: fr, addSuffix: true })}`
                        : ""}
                    </p>
                  </div>
                  {s.pendingActions ? (
                    <Link
                      href={`/activite?user=${s.id}`}
                      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200"
                    >
                      {s.pendingActions} à vérifier
                    </Link>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {permissionSummary(s.permissions).length ? (
                    permissionSummary(s.permissions).map((p) => (
                      <span
                        key={p.key}
                        className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                      >
                        <span className="font-medium">{p.label}</span>{" "}
                        <span className="text-muted-foreground">{p.detail}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucun accès</span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={s.isActive}
                      disabled={toggleActive.isPending}
                      onCheckedChange={() => toggleActive.mutate(s)}
                    />
                    {s.isActive ? "Compte actif" : "Compte suspendu"}
                  </label>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          id: s.id,
                          fullname: s.fullname || "",
                          identifier: s.email || s.phoneNumber || "",
                          password: "",
                          permissions: s.permissions,
                        })
                      }
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Droits
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setToRemove(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {form ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <DialogHeader>
                <DialogTitle>{form.id ? "Modifier l’employé" : "Nouvel employé"}</DialogTitle>
                <DialogDescription>
                  Chaque modification qu’il fait est enregistrée : vous la validez ou
                  l’annulez depuis « Activité staff ».
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-name">Nom</Label>
                  <Input
                    id="staff-name"
                    required
                    value={form.fullname}
                    onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-id">Email ou téléphone</Label>
                  <Input
                    id="staff-id"
                    required
                    disabled={!!form.id}
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="staff-pass">
                    {form.id ? "Nouveau mot de passe (laisser vide pour garder)" : "Mot de passe"}
                  </Label>
                  <Input
                    id="staff-pass"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required={!form.id}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Droits</Label>
                <PermissionMatrix
                  value={form.permissions}
                  onChange={(permissions) => setForm({ ...form, permissions })}
                />
                <p className="text-xs text-muted-foreground">
                  <b>Masquer</b> : l’élément disparaît pour l’employé mais reste chez vous,
                  signalé, jusqu’à ce que vous confirmiez la suppression ou le restauriez.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Enregistrement…" : form.id ? "Enregistrer" : "Créer le compte"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {toRemove?.fullname} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il perd l’accès à cette organisation et est déconnecté. L’historique de ses
              actions est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => toRemove && remove.mutate(toRemove)}
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
