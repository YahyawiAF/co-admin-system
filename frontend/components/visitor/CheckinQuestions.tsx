"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Briefcase,
  Gift,
  GraduationCap,
  HelpCircle,
  Instagram,
  MapPin,
  School,
  Smartphone,
  Users,
} from "lucide-react";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { QuestOption } from "@/components/visitor/quest/QuestOption";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { memberOnboardingApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { isStandalonePwa } from "@/lib/visitor-notify";
import type { HeardFrom, MemberProfileType } from "@/lib/types";

const PROFILES: { value: MemberProfileType; title: string; hint: string; icon: typeof GraduationCap }[] = [
  { value: "STUDENT", title: "Étudiant(e)", hint: "Université, école", icon: GraduationCap },
  { value: "PUPIL", title: "Élève", hint: "Lycée, bac", icon: BookOpen },
  { value: "PRO", title: "Professionnel(le)", hint: "Freelance, salarié, entrepreneur", icon: Briefcase },
];

const SOURCES: { value: HeardFrom; title: string; icon: typeof Users }[] = [
  { value: "INSTAGRAM", title: "Instagram / Facebook", icon: Instagram },
  { value: "FRIEND", title: "Un ami", icon: Users },
  { value: "SCHOOL", title: "Ma fac / mon école", icon: School },
  { value: "WALK_BY", title: "Je suis passé(e) devant", icon: MapPin },
  { value: "OTHER", title: "Autre", icon: HelpCircle },
];

type Step = "profile" | "install" | "source";

/**
 * After a fresh check-in (once the welcome / reward closes): 1 tap for the profile
 * when missing, the app install with the welcome gift on the first visit, and
 * "how did you find us" from the 2nd visit (once, skippable).
 */
export function CheckinQuestions({ memberId, active }: { memberId: string; active: boolean }) {
  const { slug } = useOrg();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Step[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ["member-onboarding", memberId],
    queryFn: () => memberOnboardingApi.status(memberId),
    enabled: active && !!memberId,
    staleTime: 60_000,
  });
  const { data: offers = [] } = useQuery({
    queryKey: ["member-offers", slug, memberId],
    queryFn: () => memberOnboardingApi.offers(slug, memberId),
    enabled: active && !!memberId && !!status?.firstVisit,
    staleTime: 60_000,
  });
  const welcome = useMemo(
    () => offers.find((o) => o.kind === "PROMO" && o.firstVisitOnly && o.status !== "USED") ?? null,
    [offers]
  );
  /** The welcome gift only works once the app is installed */
  const giftNeedsApp = welcome?.status === "NEEDS_APP";

  // Build the queue once, when the questions become relevant
  useEffect(() => {
    if (!active || !status || queue) return;
    const steps: Step[] = [];
    if (status.askProfile) steps.push("profile");
    if (status.firstVisit && !status.hasApp && !isStandalonePwa()) steps.push("install");
    if (status.askSource) steps.push("source");
    setQueue(steps);
  }, [active, status, queue]);

  const step = queue?.[0] ?? null;
  const next = () => {
    setPicked(null);
    // let the sheet slide out before the next one
    setTimeout(() => setQueue((q) => (q ? q.slice(1) : q)), 250);
  };

  const save = useMutation({
    mutationFn: memberOnboardingApi.save,
    onSuccess: (s) => queryClient.setQueryData(["member-onboarding", memberId], s),
  });

  const choose = (data: Parameters<typeof memberOnboardingApi.save>[0], value: string) => {
    setPicked(value);
    save.mutate(data);
    setTimeout(next, 280);
  };

  return (
    <>
      <QuestSheet
        open={step === "profile"}
        onOpenChange={(o) => !o && next()}
        tone="brand"
        eyebrow="Mission · Profil"
        title="Tu es…"
        subtitle="Pour te proposer les bonnes offres. 1 tap."
      >
        <div className="space-y-2 pb-1">
          {PROFILES.map((p) => (
            <QuestOption
              key={p.value}
              selected={picked === p.value}
              onClick={() => choose({ memberId, profileType: p.value }, p.value)}
              icon={<p.icon className="h-5 w-5" />}
              title={p.title}
              hint={p.hint}
            />
          ))}
        </div>
      </QuestSheet>

      <QuestSheet
        open={step === "install"}
        onOpenChange={(o) => !o && next()}
        tone="gold"
        eyebrow={welcome ? "Cadeau de bienvenue" : "Garde ta place"}
        icon={welcome ? <Gift className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        title={welcome ? welcome.title : "Installe l’app"}
        subtitle={
          giftNeedsApp
            ? "Installe l’app maintenant pour l’activer sur cette visite."
            : welcome
              ? "Offert sur cette visite. Avec l’app, tes prochains check-in se font en 1 tap."
              : "Check-in en 1 tap, tes offres et ta place, sans chercher le lien."
        }
        reward={welcome ? { label: "Ton cadeau", value: welcome.label } : null}
        footer={
          <div className="space-y-1">
            <InstallAppButton className="w-full" />
            <button
              type="button"
              onClick={next}
              className="h-10 w-full rounded-full text-sm font-semibold text-slate-500"
            >
              {giftNeedsApp ? "Plus tard (sans le cadeau)" : "Plus tard"}
            </button>
          </div>
        }
      >
        <ol className="space-y-2 pb-1 text-sm text-slate-700">
          {["Touche « Installer l’app »", "Ouvre Collabora depuis ton écran d’accueil", giftNeedsApp ? "Le cadeau s’applique tout seul au paiement" : "Tes prochains check-in se font en 1 tap"].map(
            (t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                  {i + 1}
                </span>
                {t}
              </li>
            )
          )}
        </ol>
      </QuestSheet>

      <QuestSheet
        open={step === "source"}
        onOpenChange={(o) => {
          if (o) return;
          if (!picked) save.mutate({ memberId, skipSource: true });
          next();
        }}
        tone="violet"
        eyebrow="Content de te revoir"
        title="Comment tu nous as connus ?"
        footer={
          <button
            type="button"
            onClick={() => {
              save.mutate({ memberId, skipSource: true });
              next();
            }}
            className="h-10 w-full rounded-full text-sm font-semibold text-slate-500"
          >
            Passer
          </button>
        }
      >
        <div className="space-y-2 pb-1">
          {SOURCES.map((s) => (
            <QuestOption
              key={s.value}
              tone="violet"
              selected={picked === s.value}
              onClick={() => choose({ memberId, heardFrom: s.value }, s.value)}
              icon={<s.icon className="h-5 w-5" />}
              title={s.title}
            />
          ))}
        </div>
      </QuestSheet>
    </>
  );
}
