"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Medal, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { mobileApi } from "@/lib/api/resources";
import { isStandalonePwa } from "@/lib/visitor-notify";

/**
 * Streak + level — private by default, opt-in share.
 * Shown only on the member's own profile.
 */
export function AttendanceCard({
  memberId,
  className,
}: {
  memberId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const { data } = useQuery({
    queryKey: ["member-points", memberId, isPwa],
    queryFn: () => mobileApi.getPoints(memberId, isPwa),
    enabled: !!memberId,
    staleTime: 30_000,
  });

  const toggleShare = useMutation({
    mutationFn: (shareAttendance: boolean) =>
      mobileApi.updateProfile({ memberId, shareAttendance }),
    onSuccess: (_res, shared) => {
      toast.success(
        shared
          ? "Série et niveau visibles sur votre profil public"
          : "Série et niveau redevenus privés",
      );
      void queryClient.invalidateQueries({
        queryKey: ["member-points", memberId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["community-member", memberId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || data.streak === undefined) return null;

  const level = data.level;
  const streak = data.streak;

  const share = async () => {
    const text = `🔥 ${streak} jour${streak > 1 ? "s" : ""} d'affilée au coworking — niveau ${level.name} (${level.sessions} sessions) !`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copié — collez-le où vous voulez");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl bg-white px-3.5 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">
            {streak > 0 ? (
              <>
                {streak} jour{streak > 1 ? "s" : ""} d&apos;affilée
              </>
            ) : (
              "Pas de série en cours"
            )}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Medal className="h-3 w-3 text-indigo-500" />
            Niveau {level.name} · {level.sessions} sessions
          </p>
        </div>
        <button
          type="button"
          onClick={share}
          aria-label="Partager"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {level.next ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <span
              className="block h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${level.next.progress}%` }}
            />
          </span>
          <span className="text-[10px] text-slate-500">
            {level.name} → {level.next.name} · {level.sessions}/
            {level.next.target}
          </span>
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
        <p className="text-[11px] text-slate-500">
          {data.shareAttendance
            ? "Visible sur votre profil public"
            : "Privé — visible uniquement par vous"}
        </p>
        <Switch
          checked={data.shareAttendance}
          disabled={toggleShare.isPending}
          onCheckedChange={(v) => toggleShare.mutate(v)}
          aria-label="Afficher ma série et mon niveau sur mon profil public"
        />
      </div>
    </div>
  );
}
