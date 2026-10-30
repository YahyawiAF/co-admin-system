"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  CreditCard,
  LogOut,
  Palette,
  Pencil,
  Tags,
  Gift,
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
import { mobileApi, memberOnboardingApi } from "@/lib/api/resources";
import { readImageAsDataUrl } from "@/components/admin/ImageUpload";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { TagInput } from "@/components/visitor/TagInput";
import { AccountUpgradeCard } from "@/components/visitor/AccountUpgradeCard";
import { ProfileHero } from "@/components/visitor/ProfileHero";
import { TrophyGrid } from "@/components/visitor/TrophyGrid";
import { ThemeSheet } from "@/components/visitor/ThemeSheet";
import { MemberHistory } from "@/components/visitor/MemberHistory";
import { ReferralCard } from "@/components/visitor/ReferralCard";
import { dispatchPointsAward } from "@/components/visitor/PointsCard";
import {
  ProfileMissionEntry,
  isProfileAvatarDone,
  isProfileDetailsDone,
} from "@/components/visitor/ProfileMissionEntry";
import { TrophyReveal } from "@/components/visitor/TrophyReveal";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import {
  LOOKING_FOR_SUGGESTIONS,
  OFFER_SUGGESTIONS,
  PROFESSION_SUGGESTIONS,
  SKILL_SUGGESTIONS,
} from "@/lib/directory-suggestions";
import { AVAILABILITY } from "@/lib/community";
import type { MemberAvailability } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PROFILE_AVATAR_POINTS,
  PROFILE_COMPLETE_TROPHY_ID,
  PROFILE_MISSION_TOTAL,
} from "@/lib/points-catalog";

function ProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showUpgrade = searchParams.get("upgrade") === "1";
  const wantEdit = searchParams.get("edit") === "1";
  const queryClient = useQueryClient();
  const { href, slug } = useOrg();
  const { memberId, onboarded, logout, ready } = useVisitorSession();
  const { data: myOffers } = useQuery({
    queryKey: ["member-offers", slug, memberId],
    queryFn: () => memberOnboardingApi.offers(slug, memberId!),
    enabled: !!memberId,
    staleTime: 60_000,
  });
  const offerCount = (myOffers ?? []).filter((o) => o.status !== "USED").length;
  const offersHint = offerCount
    ? `${offerCount} offre${offerCount > 1 ? "s" : ""} pour toi`
    : "Remises et promos";
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const editOpenedRef = useRef(false);
  const [reveal, setReveal] = useState<{
    points: number;
    title: string;
  } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    functionality: "",
    bio: "",
    avatarUrl: "",
    skills: [] as string[],
    services: [] as string[],
    lookingFor: [] as string[],
    availability: null as MemberAvailability | null,
    linkedinUrl: "",
    openToCollaboration: true,
    showInDirectory: true,
  });

  const { data, isLoading } = useMobileStatus({
    enabled: !!memberId && onboarded,
    intervalMs: false,
  });

  const member = data?.member;
  const hasAccount = !!member?.hasPin;
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
      lookingFor: member?.lookingFor || [],
      availability: member?.availability ?? null,
      linkedinUrl: member?.linkedinUrl || "",
      openToCollaboration: member?.openToCollaboration !== false,
      showInDirectory: member?.showInDirectory !== false,
    });
    setEditOpen(true);
  };

  useEffect(() => {
    if (!wantEdit || !member || !hasAccount || editOpenedRef.current) return;
    editOpenedRef.current = true;
    openEdit();
    router.replace(href("/profile"), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantEdit, member?.id, hasAccount]);

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
        lookingFor: form.lookingFor,
        availability: form.availability,
        linkedinUrl: form.linkedinUrl,
        openToCollaboration: form.openToCollaboration,
        showInDirectory: form.showInDirectory,
      }),
    onSuccess: (updated) => {
      const awarded = updated.pointsAwarded ?? 0;
      const newTrophies = updated.newTrophies ?? [];
      const unlockedComplete = newTrophies.includes(PROFILE_COMPLETE_TROPHY_ID);

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
      queryClient.invalidateQueries({ queryKey: ["member-points", memberId] });
      setEditOpen(false);

      if (awarded > 0) {
        dispatchPointsAward({
          amount: awarded,
          credited: true,
          pending: false,
          points: updated.points ?? awarded,
          flash: true,
          newTrophies,
          message: `+${awarded} pts`,
        });
      }

      if (unlockedComplete || awarded >= PROFILE_MISSION_TOTAL) {
        setReveal({
          points: PROFILE_MISSION_TOTAL,
          title: "Profil complet",
        });
      } else if (awarded > 0) {
        toast.success(`Profil enregistré · +${awarded} pts`);
      } else {
        toast.success("Profil enregistré");
      }
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
          Indiquez votre nom et votre téléphone pour commencer.
        </p>
        <Button className="h-11 rounded-full" onClick={() => router.push(href())}>
          Commencer
        </Button>
      </div>
    );
  }

  if (isLoading) return <p className="text-slate-500">Chargement…</p>;

  // Light visitor: name + phone + upgrade CTA
  if (!hasAccount) {
    return (
      <div className="space-y-4">
        {memberId ? (
          <>
            <ProfileHero
              memberId={memberId}
              name={displayName}
              subtitle={[member?.phone, member?.visitorNumber ? `#${member.visitorNumber}` : null]
                .filter(Boolean)
                .join(" · ")}
              avatarUrl={member?.avatarUrl}
            />
            <TrophyGrid memberId={memberId} />
            <ReferralCard memberId={memberId} />
          </>
        ) : null}

        <AccountUpgradeCard
          title={
            showUpgrade
              ? "Compte requis"
              : "Créer un compte ou télécharger l’app"
          }
          description={
            showUpgrade
              ? "Communauté et abonnement sont réservés aux comptes avec PIN (app installée)."
              : "Même profil — ajoutez un PIN dans l’app pour l’abonnement, la communauté et les cadeaux."
          }
        />

        {memberId ? <MemberHistory memberId={memberId} /> : null}

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <Link
            href={href("/tarifs")}
            className="flex items-center gap-3 px-4 py-3.5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Tags className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Tarifs</span>
              <span className="block text-xs text-slate-500">Pass du jour</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
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
          Oublier ce profil sur cet appareil
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {memberId ? (
        <ProfileHero
          memberId={memberId}
          name={displayName}
          subtitle={[
            member?.functionality || null,
            member?.visitorNumber ? `#${member.visitorNumber}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Ajouter un métier"}
          avatarUrl={member?.avatarUrl}
          onEdit={openEdit}
        />
      ) : null}

      <div className="rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
            <Badge className={subscribed ? "bg-emerald-600" : ""}>
              {subscribed ? "Abonné" : "Compte"}
            </Badge>
            {data?.hasOpenSession ? (
              <Badge variant="secondary">Session en cours</Badge>
            ) : null}
            {member?.showInDirectory ? (
              <Badge variant="outline">Annuaire</Badge>
            ) : null}
            </div>
            <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full" onClick={openEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Modifier
            </Button>
          </div>
          {(member?.skills || []).length ? (
            <p className="mt-3 text-sm text-slate-600">
              {(member?.skills || []).join(" • ")}
            </p>
          ) : member?.bio ? (
            <p className="mt-3 text-sm text-slate-600">{member.bio}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Ajoutez vos compétences pour apparaître dans l&apos;annuaire.
            </p>
          )}
        </div>
      </div>

      <ProfileMissionEntry onEdit={openEdit} />

      {memberId ? (
        <>
          <TrophyGrid memberId={memberId} />
          <ReferralCard memberId={memberId} />
          <MemberHistory memberId={memberId} />
        </>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {[
          ...(memberId
            ? [
                {
                  href: href("/offres"),
                  label: "Mes offres",
                  hint: offersHint,
                  icon: Gift,
                },
              ]
            : []),
          {
            href: href("/tarifs"),
            label: "Tarifs",
            hint: "Pass et abonnements",
            icon: Tags,
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
        {memberId ? (
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="flex w-full items-center gap-3 border-t px-4 py-3.5 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Palette className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Mon thème</span>
              <span className="block text-xs text-slate-600">Couleurs de votre app · à débloquer</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ) : null}
      </div>
      {memberId ? (
        <ThemeSheet open={themeOpen} onOpenChange={setThemeOpen} memberId={memberId} />
      ) : null}

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
            {!isProfileAvatarDone(form) ? (
              <p className="text-center text-[11px] text-amber-700">
                Photo · +{PROFILE_AVATAR_POINTS} pts mission
              </p>
            ) : null}
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
              <div className="flex flex-wrap gap-1">
                {PROFESSION_SUGGESTIONS.filter(
                  (p) =>
                    p.toLowerCase() !== form.functionality.trim().toLowerCase()
                )
                  .slice(0, 12)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600"
                      onClick={() =>
                        setForm((f) => ({ ...f, functionality: p }))
                      }
                    >
                      {p}
                    </button>
                  ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Compétences</Label>
              <TagInput
                value={form.skills}
                onChange={(skills) => setForm((f) => ({ ...f, skills }))}
                suggestions={SKILL_SUGGESTIONS}
                placeholder="Ajouter…"
              />
            </div>
            <div className="space-y-1">
              <Label>Je propose</Label>
              <TagInput
                value={form.services}
                onChange={(services) => setForm((f) => ({ ...f, services }))}
                suggestions={OFFER_SUGGESTIONS}
                placeholder="Services que vous offrez…"
                maxTags={12}
              />
            </div>
            <div className="space-y-1">
              <Label>Je recherche</Label>
              <TagInput
                value={form.lookingFor}
                onChange={(lookingFor) => setForm((f) => ({ ...f, lookingFor }))}
                suggestions={LOOKING_FOR_SUGGESTIONS}
                placeholder="Profils, clients, associé…"
                maxTags={12}
              />
            </div>
            <div className="space-y-1">
              <Label>Statut sur place</Label>
              <div className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
                {(
                  [
                    { id: null, label: "Aucun", icon: null },
                    ...(Object.keys(AVAILABILITY) as MemberAvailability[]).map(
                      (k) => ({
                        id: k,
                        label: AVAILABILITY[k].short,
                        icon: AVAILABILITY[k].icon,
                      })
                    ),
                  ] as const
                ).map((opt) => {
                  const active = form.availability === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id ?? "none"}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, availability: opt.id }))
                      }
                      className={cn(
                        "flex h-8 items-center justify-center gap-1 rounded-full text-xs font-semibold transition",
                        active
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500"
                      )}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>LinkedIn</Label>
              <Input
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Visible dans l&apos;annuaire</Label>
              <Switch
                checked={form.showInDirectory}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, showInDirectory: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Ouvert à la collaboration</Label>
              <Switch
                checked={form.openToCollaboration}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, openToCollaboration: v }))
                }
              />
            </div>
            {!isProfileDetailsDone(form) ? (
              <p className="rounded-xl bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                Remplissez prénom, nom, métier et compétences (ou bio) pour{" "}
                <strong>+800 pts</strong>. Avec la photo : trophée or{" "}
                <strong>+1000</strong>.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              className="w-full rounded-full"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrophyReveal
        open={!!reveal}
        points={reveal?.points}
        title={reveal?.title}
        onClose={() => setReveal(null)}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
      <ProfileInner />
    </Suspense>
  );
}
