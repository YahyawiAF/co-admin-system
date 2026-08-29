"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { organizationsApi } from "@/lib/api/resources";
import { useAdminOrg } from "@/lib/admin-org-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { Role } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setOrganizationId, isSuperAdmin } = useAdminOrg();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (
      user &&
      user.role !== Role.SUPER_ADMIN &&
      user.role !== Role.ADMIN
    ) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["organizations-crm"],
    queryFn: () => organizationsApi.listCrm(),
    enabled: isSuperAdmin,
  });

  const create = useMutation({
    mutationFn: () =>
      organizationsApi.create({
        name: name.trim(),
        slug: slug.trim() || name.trim(),
      }),
    onSuccess: () => {
      toast.success("Organisation créée");
      setCreateOpen(false);
      setName("");
      setSlug("");
      void queryClient.invalidateQueries({ queryKey: ["organizations-crm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      organizationsApi.setActivation(payload.id, {
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      void queryClient.invalidateQueries({ queryKey: ["organizations-crm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Organisations (CRM)
          </h1>
          <p className="text-sm text-muted-foreground">
            Activation, compteurs et accès super-admin.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle organisation
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Membres</TableHead>
                <TableHead>Espaces</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {o.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{o.slug}</TableCell>
                  <TableCell>{o.memberCount ?? "—"}</TableCell>
                  <TableCell>{o.facilityCount ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={o.isActive === false ? "secondary" : "default"}>
                      {o.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.createdAt
                      ? format(new Date(o.createdAt), "dd MMM yyyy", {
                          locale: fr,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOrganizationId(o.id);
                        router.push("/dashboard");
                      }}
                    >
                      Ouvrir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggle.isPending}
                      onClick={() =>
                        toggle.mutate({
                          id: o.id,
                          isActive: o.isActive === false,
                        })
                      }
                    >
                      <Power className="mr-1 h-3.5 w-3.5" />
                      {o.isActive === false ? "Activer" : "Désactiver"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom</Label>
              <Input
                className="mt-1"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
              />
            </div>
            <div>
              <Label>Slug URL (/m/…)</Label>
              <Input
                className="mt-1 font-mono"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || !slug.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
