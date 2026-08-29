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
import { showVisitorNotification, unlockVisitorAudio } from "@/lib/visitor-notify";

export function StaffMessageModal() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [current, setCurrent] = useState<StaffMessage | null>(null);

  useEffect(() => {
    setMemberId(loadVisitorCache()?.memberId || sessionStorage.getItem("memberId"));
  }, []);

  const { data: unread = [] } = useQuery({
    queryKey: ["staff-messages", memberId],
    queryFn: () => mobileApi.staffMessages(memberId!, true),
    enabled: !!memberId,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!current && unread.length) {
      setCurrent(unread[0]);
      showVisitorNotification({
        title: "Message de l’accueil",
        body: unread[0].text,
        tag: `staff-${unread[0].id}`,
        sound: "message",
      });
    }
  }, [unread, current]);

  useEffect(() => {
    if (!socket || !memberId) return;
    const onMsg = (payload: StaffMessage) => {
      if (payload.memberId && payload.memberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["staff-messages", memberId] });
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
