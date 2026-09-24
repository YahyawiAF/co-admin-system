import { Gift, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MemberRewards = {
  points?: number | null;
  appInstallPromoClaimedAt?: string | Date | null;
};

type Props = {
  member?: MemberRewards | null;
  /** Show promo claimed / not claimed (default true) */
  showPromo?: boolean;
  className?: string;
};

/** Compact admin badges: points + app-install promo status */
export function MemberRewardsBadges({
  member,
  showPromo = true,
  className,
}: Props) {
  if (!member) return null;

  const points = Number(member.points ?? 0);
  const claimed = !!member.appInstallPromoClaimedAt;
  const showPoints = Number.isFinite(points);
  if (!showPoints && !showPromo) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {showPoints ? (
        <Badge
          variant="secondary"
          className="h-5 gap-0.5 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-50"
          title="Solde points (100 pts = 1 DT)"
        >
          <Sparkles className="h-3 w-3" />
          {points.toLocaleString("fr-FR")} pts
        </Badge>
      ) : null}
      {showPromo ? (
        claimed ? (
          <Badge
            className="h-5 gap-0.5 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600"
            title="Promo installation déjà utilisée"
          >
            <Gift className="h-3 w-3" />
            Promo ✓
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="h-5 gap-0.5 border-indigo-200 px-1.5 text-[10px] text-indigo-700"
            title="Promo installation pas encore utilisée"
          >
            <Gift className="h-3 w-3" />
            Promo
          </Badge>
        )
      ) : null}
    </span>
  );
}
