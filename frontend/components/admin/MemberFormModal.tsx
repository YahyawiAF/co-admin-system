"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { membersApi, groupsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Member, MemberGroup } from "@/lib/types";
import { MemberInviteShare } from "@/components/admin/MemberInviteShare";

const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().min(4, "Téléphone requis"),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().optional(),
  groupId: z.string().optional(),
  discountForfait: z.string().optional(),
  discountSalle: z.string().optional(),
  discountOpenSpace: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  member?: Member | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (member: Member) => void;
};

export function MemberFormModal({
  member,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inviteMember, setInviteMember] = useState<Member | null>(null);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const queryClient = useQueryClient();
  const isEdit = !!member?.id;

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => groupsApi.list(),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      password: "",
      groupId: "",
      discountForfait: "",
      discountSalle: "",
      discountOpenSpace: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      firstName: member?.firstName || "",
      lastName: member?.lastName || "",
      phone: member?.phone || "",
      email: member?.email || "",
      password: "",
      groupId: member?.groupId || "",
      discountForfait:
        member?.discountForfait != null ? String(member.discountForfait) : "",
      discountSalle:
        member?.discountSalle != null ? String(member.discountSalle) : "",
      discountOpenSpace:
        member?.discountOpenSpace != null
          ? String(member.discountOpenSpace)
          : "",
    });
  }, [member, open, form]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const num = (v?: string) =>
        v === undefined || v.trim() === "" ? null : Number(v);
      const payload = {
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        phone: values.phone,
        email: values.email || undefined,
        password: values.password || undefined,
        groupId: values.groupId || null,
        discountForfait: num(values.discountForfait),
        discountSalle: num(values.discountSalle),
        discountOpenSpace: num(values.discountOpenSpace),
      };
      if (isEdit) return membersApi.update(member!.id, payload);
      return membersApi.create(payload);
    },
    onSuccess: (res) => {
      toast.success(isEdit ? "Membre mis à jour" : "Membre créé");
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      setOpen(false);
      onSaved?.(res);
      if (!isEdit) setInviteMember(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le membre" : "Nouveau membre"}
          </DialogTitle>
          <DialogDescription>
            Téléphone obligatoire. Mot de passe seulement si abonnement mobile.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prénom</Label>
              <Input {...form.register("firstName")} autoFocus={!isEdit} />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input {...form.register("lastName")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Téléphone *</Label>
            <Input {...form.register("phone")} inputMode="tel" />
            {form.formState.errors.phone ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe (optionnel)</Label>
            <Input type="password" {...form.register("password")} />
          </div>
          <div className="space-y-2">
            <Label>Groupe</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("groupId")}
            >
              <option value="">Aucun</option>
              {groups.map((g: MemberGroup) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members?.length || 0}/{g.maxMembers})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Remise forfait %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="groupe"
                {...form.register("discountForfait")}
              />
            </div>
            <div className="space-y-2">
              <Label>Remise salle %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="groupe"
                {...form.register("discountSalle")}
              />
            </div>
            <div className="space-y-2">
              <Label>Remise open %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="groupe"
                {...form.register("discountOpenSpace")}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Laisser vide = utiliser la remise du groupe (sinon 0).
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      <Dialog
        open={!!inviteMember}
        onOpenChange={(o) => {
          if (!o) setInviteMember(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lien à envoyer</DialogTitle>
            <DialogDescription>
              Envoyez ce lien WhatsApp. Le visiteur confirme uniquement son
              numéro.
            </DialogDescription>
          </DialogHeader>
          {inviteMember ? (
            <MemberInviteShare
              memberId={inviteMember.id}
              memberName={
                [inviteMember.firstName, inviteMember.lastName]
                  .filter(Boolean)
                  .join(" ") || "bonjour"
              }
              phone={inviteMember.phone}
              autoIssue
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
