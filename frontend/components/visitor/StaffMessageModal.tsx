"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { StaffMessage } from "@/lib/types";
import { unlockVisitorAudio } from "@/lib/visitor-notify";
import { useOrg } from "@/lib/org";
import { useRouter } from "next/navigation";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";

/** Popup for new staff→visitor messages (no duplicate sound/OS notify — push handles background). */
export function StaffMessageModal() {
  const queryClient = useQueryClient();
  const { href } = useOrg();
  const router = useRouter();
  const { socket } = useRealtime();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [current, setCurrent] = useState<StaffMessage | null>(null);
  const poll = useVisibleInterval(30_000);

  useEffect(() => {
    setMemberId(loadVisitorCache()?.memberId || sessionStorage.getItem("memberId"));
  }, []);

  const { data: unread = [] } = useQuery({
    queryKey: ["staff-messages", memberId],
    queryFn: () => mobileApi.staffMessages(memberId!, true),
    enabled: !!memberId,
    staleTime: 20_000,
    refetchInterval: poll,
  });

  useEffect(() => {
    if (!current && unread.length) setCurrent(unread[0]);
  }, [unread, current]);

  useEffect(() => {
    if (!socket || !memberId) return;
    const onMsg = (payload: StaffMessage) => {
      if (payload.direction === "TO_STAFF") return;
      if (payload.memberId && payload.memberId !== memberId) return;
      if (payload.toMemberId && payload.toMemberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["staff-messages", memberId] });
      queryClient.invalidateQueries({ queryKey: ["staff-thread", memberId] });
      setCurrent(payload);
    };
    socket.on("staff_message", onMsg);
    return () => {
      socket.off("staff_message", onMsg);
    };
  }, [socket, memberId, queryClient]);

  const ack = useMutation({
    mutationFn: () => mobileApi.markStaffMessageRead(current!.id),
    onSuccess: () => {
      const rest = unread.filter((m) => m.id !== current?.id);
      setCurrent(rest[0] || null);
      queryClient.invalidateQueries({ queryKey: ["staff-messages", memberId] });
      queryClient.invalidateQueries({ queryKey: ["staff-thread", memberId] });
    },
  });

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && current && ack.mutate()}>
      <DialogContent className="max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Message de l’accueil
          </DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-base leading-relaxed">
          {current?.text}
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={ack.isPending || !current}
            onClick={() => {
              void unlockVisitorAudio();
              ack.mutate();
            }}
          >
            OK, compris
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              ack.mutate();
              router.push(href("/community?peer=admin"));
            }}
          >
            Voir la conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
