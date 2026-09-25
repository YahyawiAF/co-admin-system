"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ActiveSessionPanel } from "@/components/visitor/ActiveSessionPanel";
import { PointsCard } from "@/components/visitor/PointsCard";
import { ProfileMissionEntry } from "@/components/visitor/ProfileMissionEntry";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import { mobileApi } from "@/lib/api/resources";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";
import { spacesForPrice } from "@/lib/space-occupy";

export default function SessionPage() {
  const router = useRouter();
  const { href, slug } = useOrg();
  const { memberId, onboarded, ready } = useVisitorSession();
  const { data: status, isLoading } = useMobileStatus({
    enabled: !!memberId && onboarded,
  });

  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug, memberId],
    queryFn: async () => {
      const data = await mobileApi.floorPlan(slug, memberId ?? undefined);
      writeLocalCache("floor-plan", data, slug);
      return data;
    },
    staleTime: 5 * 60_000,
    enabled: !!memberId && onboarded,
    placeholderData: () => readLocalCache("floor-plan", slug) ?? undefined,
  });

  if (!ready) return <p className="text-slate-500">Chargement…</p>;

  if (!onboarded || !memberId) {
    return (
      <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          Connectez-vous pour voir votre session.
        </p>
        <Button
          className="mt-4 h-11 rounded-full"
          onClick={() => router.push(href())}
        >
          Accueil
        </Button>
      </div>
    );
  }

  if (isLoading && !status) {
    return <p className="text-slate-500">Chargement de la session…</p>;
  }

  const session = status?.session;
  if (!session) {
    return (
      <div className="space-y-3">
        {memberId ? <PointsCard memberId={memberId} /> : null}
        <ProfileMissionEntry hideWhenComplete />
        <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Aucune session en cours
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            Scannez le QR ou choisissez un forfait depuis l&apos;accueil.
          </p>
          <Button
            className="mt-4 h-11 w-full rounded-full bg-indigo-600 hover:bg-indigo-700"
            asChild
          >
            <Link href={href()}>Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  const subKind =
    (session as { subscriptionKind?: string | null }).subscriptionKind ||
    (status?.subscription as { kind?: string } | null)?.kind ||
    null;
  const sessionPrice = session.prices || session.price || null;
  const allowedSpaceIds =
    sessionPrice && layout?.spaces
      ? spacesForPrice(layout.spaces, sessionPrice).map((s) => s.id)
      : undefined;

  return (
    <div className="space-y-3">
      {memberId ? <PointsCard memberId={memberId} /> : null}
      <ProfileMissionEntry hideWhenComplete />
      <ActiveSessionPanel
        memberId={memberId}
        session={session}
        seat={status?.seat ?? session.seat}
        seatSettings={status?.seatSettings}
        hasActiveSubscription={!!status?.hasActiveSubscription}
        subscriptionKind={subKind}
        allowedSpaceIds={allowedSpaceIds}
        promos={
          status?.member?.appInstallPromoEligible === false ||
          status?.member?.appInstallPromoClaimedAt ||
          layout?.facility?.appInstallPromoEligible === false
            ? null
            : layout?.facility?.appInstallPromos ?? null
        }
        globalPromo={
          status?.member?.appInstallPromoEligible === false ||
          status?.member?.appInstallPromoClaimedAt ||
          layout?.facility?.appInstallPromoEligible === false
            ? null
            : layout?.facility?.appInstallGlobalPromo ?? null
        }
      />
    </div>
  );
}
