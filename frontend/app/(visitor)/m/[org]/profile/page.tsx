"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  CreditCard,
  History,
  LogOut,
  Pencil,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { readImageAsDataUrl } from "@/components/admin/ImageUpload";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { TagInput } from "@/components/visitor/TagInput";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { href, slug } = useOrg();
  const { memberId, onboarded, logout, ready } = useVisitorSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    functionality: "",
    bio: "",
    avatarUrl: "",
    skills: [] as string[],
    services: [] as string[],
    linkedinUrl: "",
    openToCollaboration: true,
    showInDirectory: true,
  });

  const { data, isLoading } = useMobileStatus({
    enabled: !!memberId && onboarded,
    intervalMs: false,
  });

  const member = data?.member;
  const subscribed = !!(data?.hasActiveSubscription || member?.isSubscribed);
  const displayName =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.firstName ||
    "Visiteur";

  const openEdit = () => {
    setForm({
      firstName: member?.firstName || "",
      lastName: member?.lastName || "",
      functionality: member?.functionality || "",
      bio: member?.bio || "",
      avatarUrl: member?.avatarUrl || "",
      skills: member?.skills || [],
      services: member?.services || [],
      linkedinUrl: member?.linkedinUrl || "",
      openToCollaboration: member?.openToCollaboration !== false,
      showInDirectory: member?.showInDirectory !== false,
    });
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      mobileApi.updateProfile({
        memberId: memberId!,
        firstName: form.firstName,
        lastName: form.lastName,
        functionality: form.functionality,
        bio: form.bio,
        avatarUrl: form.avatarUrl || undefined,
        skills: form.skills,
        services: form.services,
        linkedinUrl: form.linkedinUrl,
        openToCollaboration: form.openToCollaboration,
        showInDirectory: form.showInDirectory,
      }),
    onSuccess: (updated) => {
      toast.success("Profil enregistré");
      saveVisitorCache(
        {
          id: updated.id,
          phone: updated.phone,
          firstName: updated.firstName,
          lastName: updated.lastName,
          visitorNumber: updated.visitorNumber,
        },
        undefined,
        slug
      );
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-community"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const url = await readImageAsDataUrl(file);
      setForm((f) => ({ ...f, avatarUrl: url }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!ready) return <p className="text-slate-500">Chargement…</p>;

  if (!onboarded) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="mb-2 text-lg font-semibold">Votre profil</p>
        <p className="mb-4 text-sm text-slate-500">
          Indiquez votre nom et votre téléphone tunisien à l&apos;accueil pour
          débloquer l&apos;espace.
        </p>
        <Button className="h-11 rounded-full" onClick={() => router.push(href())}>
          Commencer
        </Button>
      </div>
    );
  }

  if (isLoading) return <p className="text-slate-500">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-br from-primary to-sky-400" />
        <div className="-mt-10 px-5 pb-5">
          <button
            type="button"
            className="relative"
            onClick={openEdit}
            aria-label="Changer la photo"
          >
            <VisitorAvatar
              name={displayName}
              src={member?.avatarUrl}
              className="h-20 w-20 border-4 border-white shadow"
            />
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="mt-2 flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-sm text-slate-500">
                {member?.functionality || "Ajouter un métier"}
              </p>
              {member?.visitorNumber ? (
                <p className="text-xs text-slate-400">#{member.visitorNumber}</p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Modifier
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge className={subscribed ? "bg-emerald-600" : ""}>
              {subscribed ? "Abonné" : "Visiteur du jour"}
            </Badge>
            {data?.hasOpenSession ? (
              <Badge variant="secondary">Session en cours</Badge>
            ) : null}
            {member?.showInDirectory ? (
              <Badge variant="outline">Annuaire</Badge>
            ) : null}
            {member?.openToCollaboration ? (
              <Badge variant="outline">Ouvert à la collaboration</Badge>
            ) : null}
          </div>
          {(member?.skills || []).length ? (
            <p className="mt-3 text-sm text-slate-600">
              {(member?.skills || []).join(" • ")}
            </p>
          ) : member?.bio ? (
            <p className="mt-3 text-sm text-slate-600">{member.bio}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Ajoutez vos compétences pour apparaître dans l&apos;annuaire.
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {[
          {
            href: href("/tarifs"),
            label: "Tarifs",
            hint: "Forfaits et packs",
            icon: Tags,
          },
          {
            href: href("/history"),
            label: "Historique",
            hint: "Vos visites",
            icon: History,
          },
          {
            href: href("/subscription"),
            label: "Abonnement",
            hint: subscribed ? "Actif" : "Aucun abonnement",
            icon: CreditCard,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-slate-500">{item.hint}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
      </div>

      <Button
        variant="outline"
        className="h-12 w-full gap-2 bg-white text-slate-600"
        onClick={() => {
          logout();
          router.push(href());
          router.refresh();
        }}
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Votre profil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-center">
              <button
                type="button"
                className="relative"
                onClick={() => fileRef.current?.click()}
              >
                <VisitorAvatar
                  name={form.firstName}
                  src={form.avatarUrl}
                  className="h-24 w-24"
                />
                <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                  <Camera className="h-4 w-4" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Prénom</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Métier / entreprise</Label>
              <Input
                placeholder="Ex. Designer, Fondateur…"
                value={form.functionality}
                onChange={(e) =>
                  setForm((f) => ({ ...f, functionality: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Compétences</Label>
              <TagInput
                value={form.skills}
                onChange={(skills) => setForm((f) => ({ ...f, skills }))}
                placeholder="React, Node.js…"
              />
            </div>
            <div className="space-y-1">
              <Label>Services</Label>
              <TagInput
                value={form.services}
                onChange={(services) => setForm((f) => ({ ...f, services }))}
                placeholder="Audit, formation…"
              />
            </div>
            <div className="space-y-1">
              <Label>LinkedIn / portfolio</Label>
              <Input
                placeholder="https://…"
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Bio</Label>
              <Textarea
                placeholder="Présentez-vous en quelques mots"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
              />
            </div>
            <label className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <span>
                <span className="block text-sm font-medium">
                  Ouvert à la collaboration
                </span>
                <span className="text-xs text-slate-500">
                  Affiché sur votre carte si l&apos;annuaire est activé.
                </span>
              </span>
              <Switch
                checked={form.openToCollaboration}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, openToCollaboration: v }))
                }
              />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <span>
                <span className="block text-sm font-medium">
                  Afficher mon profil dans l&apos;annuaire
                </span>
                <span className="text-xs text-slate-500">
                  Les autres membres verront uniquement les champs que vous avez
                  remplis.
                </span>
              </span>
              <Switch
                checked={form.showInDirectory}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, showInDirectory: v }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
