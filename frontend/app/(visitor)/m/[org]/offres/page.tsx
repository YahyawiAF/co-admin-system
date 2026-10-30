"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { memberOnboardingApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { InstallAppButton } from "@/components/visitor/InstallAppButton";
import { cn } from "@/lib/utils";
import type { MemberOffer } from "@/lib/types";

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** "Jeu., ven., sam. · 10 h – 17 h" from the promo schedule; "" when always on. */
function scheduleLabel(o: MemberOffer) {
  const parts: string[] = [];
  const days = o.daysOfWeek ?? [];
  if (days.length && days.length < 7) {
    const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
    const txt = order.map((d) => DAYS[d]).join(", ");
    parts.push(txt.charAt(0).toUpperCase() + txt.slice(1));
  }
  if (o.fromHour != null && o.toHour != null) parts.push(`${o.fromHour} h – ${o.toHour % 24} h`);
  if (o.endsAt) {
    parts.push(
      `jusqu’au ${new Date(o.endsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
    );
  }
  return parts.join(" · ");
}

const STATUS: Record<MemberOffer["status"], { text: string; cls: string }> = {
  LIVE: { text: "Active maintenant", cls: "bg-emerald-100 text-emerald-800" },
  TO_USE: { text: "À utiliser", cls: "bg-emerald-100 text-emerald-800" },
  ACTIVE: { text: "Toujours active", cls: "bg-indigo-100 text-indigo-800" },
  NEEDS_APP: { text: "Installe l’app pour l’activer", cls: "bg-amber-100 text-amber-900" },
  LATER: { text: "Plus tard", cls: "bg-slate-100 text-slate-600" },
  USED: { text: "Déjà utilisée", cls: "bg-slate-100 text-slate-500" },
};

const TILE: Record<MemberOffer["style"], string> = {
  VIOLET: "from-indigo-600 to-violet-600 text-white",
  GOLD: "from-amber-400 to-orange-500 text-amber-950",
  GREEN: "from-emerald-600 to-teal-500 text-white",
};

export default function MesOffresPage() {
  const { slug } = useOrg();
  const { memberId } = useVisitorSession();
  const { data: offers, isLoading } = useQuery({
    queryKey: ["member-offers", slug, memberId],
    queryFn: () => memberOnboardingApi.offers(slug, memberId!),
    enabled: !!memberId,
  });
  const usable = (offers ?? []).filter((o) => o.status !== "USED");
  const needsApp = usable.some((o) => o.status === "NEEDS_APP");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mes offres</h1>
        <p className="text-sm text-slate-500">
          {isLoading || !memberId
            ? "Tes remises et promos, au même endroit."
            : usable.length
              ? `${usable.length} offre${usable.length > 1 ? "s" : ""} pour toi`
              : "Pas d’offre pour l’instant"}
        </p>
      </div>

      {needsApp ? (
        <div className="v-rise flex items-center gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <Gift className="h-5 w-5 shrink-0 text-amber-700" />
          <p className="min-w-0 flex-1 text-[13px] text-amber-900">Une offre attend l’app installée.</p>
          <InstallAppButton variant="pill" />
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {(offers ?? []).map((o, i) => {
          const when = o.kind === "PROMO" ? scheduleLabel(o) : "";
          const st = STATUS[o.status];
          return (
            <li
              key={o.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className={cn(
                "v-rise flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition-opacity duration-300",
                o.status === "USED" && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "flex h-12 min-w-[60px] items-center justify-center rounded-xl bg-gradient-to-br px-2 text-base font-black tabular-nums",
                  TILE[o.style]
                )}
              >
                {o.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-slate-900">{o.title}</span>
                <span className="block text-xs text-slate-600">
                  {[o.detail, when].filter(Boolean).join(" · ")}
                </span>
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", st.cls)}>
                  {st.text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {!isLoading && memberId && offers && !offers.length ? (
        <p className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
          Les remises et promos de l’espace apparaîtront ici.
        </p>
      ) : null}
    </div>
  );
}
