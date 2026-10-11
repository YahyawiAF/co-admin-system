"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { pointsToDt } from "@/lib/points-catalog";

const storageKey = (slug: string) => `referral-code:${slug}`;

function referralLink(slug: string, code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/m/${slug}/signup?ref=${encodeURIComponent(code)}`;
}

/** Keeps `?ref=CODE` from the invite link and attaches it once the visitor has a profile. */
export function ReferralCapture() {
  const { slug } = useOrg();
  const { memberId, onboarded } = useVisitorSession();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) window.localStorage.setItem(storageKey(slug), ref.trim().toUpperCase());
  }, [slug]);

  useEffect(() => {
    if (!memberId || !onboarded || typeof window === "undefined") return;
    const code = window.localStorage.getItem(storageKey(slug));
    if (!code) return;
    mobileApi
      .claimReferral(memberId, code)
      .then((res) => {
        if (!res.already && res.sponsorFirstName) {
          toast.success(`Parrainé par ${res.sponsorFirstName} : vos points arrivent après votre 1re visite`);
        }
      })
      .catch(() => null)
      .finally(() => window.localStorage.removeItem(storageKey(slug)));
  }, [memberId, onboarded, slug]);

  return null;
}

export function ReferralCard({ memberId }: { memberId: string }) {
  const { slug, org } = useOrg();
  const { data } = useQuery({
    queryKey: ["referral", memberId],
    queryFn: () => mobileApi.referral(memberId),
    staleTime: 60_000,
  });
  if (!data || data.pointsEach <= 0) return null;

  const link = referralLink(slug, data.code);
  const dt = pointsToDt(data.pointsEach);
  const message = `Je travaille chez ${org?.name || "notre espace"} : viens tester ! Avec mon lien, on gagne chacun ${data.pointsEach} points (${dt} DT) après ta première visite : ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Parrainez un ami</p>
          <p className="text-xs text-slate-500">
            {data.pointsEach} pts ({dt} DT) pour vous et pour lui après sa
            première visite payée.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <span className="font-mono text-sm font-semibold tracking-wider">
          {data.code}
        </span>
        <span className="text-xs text-slate-500">
          {data.invited} invité{data.invited > 1 ? "s" : ""} · {data.rewarded} validé
          {data.rewarded > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-10" onClick={copy}>
          <Copy className="mr-1.5 h-4 w-4" />
          Copier
        </Button>
        <Button className="h-10 bg-emerald-600 hover:bg-emerald-700" asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
