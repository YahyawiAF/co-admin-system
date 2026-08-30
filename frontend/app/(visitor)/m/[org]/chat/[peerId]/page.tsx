"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { mobileApi } from "@/lib/api/resources";
import { PeerChat } from "@/components/visitor/PeerChat";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";

export default function PeerChatPage() {
  const params = useParams<{ org: string; peerId: string }>();
  const { href } = useOrg();
  const { memberId } = useVisitorSession();
  const peerId = params.peerId;

  const { data } = useQuery({
    queryKey: ["community-member", peerId, memberId],
    queryFn: () => mobileApi.communityMember(peerId, memberId || undefined),
    enabled: !!peerId,
  });

  const peer = data?.member;
  const name =
    [peer?.firstName, peer?.lastName].filter(Boolean).join(" ") ||
    peer?.firstName ||
    "Membre";

  if (!memberId) {
    return (
      <p className="px-4 pt-8 text-sm text-slate-500">
        Connectez-vous pour écrire.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef4fb]">
      <header className="flex shrink-0 items-center gap-2 border-b bg-white px-2 py-2.5">
        <Link
          href={href("/community")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
          aria-label="Messages"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <Link href={href(`/u/${peerId}`)} className="flex min-w-0 flex-1 items-center gap-2">
          <VisitorAvatar
            name={name}
            src={peer?.avatarUrl}
            className="h-10 w-10"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-xs text-slate-500">
              {peer?.isPresent
                ? "Présent"
                : peer?.functionality || "Voir le profil"}
            </p>
          </div>
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <PeerChat memberId={memberId} peerId={peerId} className="h-full" />
      </div>
    </div>
  );
}
