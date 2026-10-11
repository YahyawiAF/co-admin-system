"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";

export function ReviewPromptCard({ memberId }: { memberId: string }) {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const key = ["review-prompt", memberId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => mobileApi.reviewPrompt(memberId),
    staleTime: 10 * 60_000,
  });
  const mark = useMutation({
    mutationFn: (action: "click" | "dismiss") => mobileApi.markReview(memberId, action),
    onSettled: () => queryClient.setQueryData(key, { show: false, url: null, visits: 0 }),
  });

  if (!data?.show || !data.url) return null;

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-yellow-50 to-amber-100 p-4 shadow-sm">
      <button
        type="button"
        aria-label="Plus tard"
        className="absolute right-3 top-3 rounded-full p-1 text-amber-700/70 hover:bg-white/60"
        onClick={() => mark.mutate("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-0.5 text-amber-500">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <p className="mt-2 pr-6 font-semibold text-slate-900">
        Déjà {data.visits} visites, merci !
      </p>
      <p className="mt-0.5 text-sm text-slate-600">
        Vous aimez {org?.name || "l'espace"} ? Un avis Google (30 secondes) aide
        beaucoup les autres à nous trouver.
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="h-10 flex-1 rounded-full" asChild>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => mark.mutate("click")}
          >
            Laisser un avis
          </a>
        </Button>
        <Button
          variant="ghost"
          className="h-10 rounded-full text-slate-600"
          onClick={() => mark.mutate("dismiss")}
        >
          Plus tard
        </Button>
      </div>
    </div>
  );
}
