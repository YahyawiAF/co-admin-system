"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { StaffMessage } from "@/lib/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function StaffInboxBell() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<StaffMessage | null>(null);
  const [reply, setReply] = useState("");

  const { data: inbox = [] } = useQuery({
    queryKey: ["staff-inbox"],
    queryFn: () => mobileApi.staffInbox(),
    refetchInterval: 8000,
  });

  const memberId = active?.memberId || "";
  const { data: thread = [] } = useQuery({
    queryKey: ["staff-thread-admin", memberId],
    queryFn: () => mobileApi.staffMessages(memberId, false),
    enabled: !!memberId && open,
    refetchInterval: open ? 4000 : false,
  });

  useEffect(() => {
    if (!socket) return;
    const onMsg = (payload: StaffMessage & { direction?: string }) => {
      if (payload.direction !== "TO_STAFF") return;
      toast.message(
        payload.memberName
          ? `${payload.memberName} : ${payload.text}`
          : "Message visiteur"
      );
      queryClient.invalidateQueries({ queryKey: ["staff-inbox"] });
      setActive(payload);
      setOpen(true);
    };
    socket.on("staff_message", onMsg);
    return () => {
      socket.off("staff_message", onMsg);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (!memberId || !open) return;
    void mobileApi.markStaffThreadRead(memberId, "staff").then(() => {
      queryClient.invalidateQueries({ queryKey: ["staff-inbox"] });
    });
  }, [memberId, open, thread.length, queryClient]);

  const send = useMutation({
    mutationFn: () =>
      mobileApi.sendStaffMessage({ memberId, text: reply }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["staff-thread-admin", memberId] });
      toast.success("Réponse envoyée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          if (inbox[0]) {
            setActive(inbox[0]);
            setOpen(true);
          } else {
            toast.message("Aucun message visiteur en attente");
          }
        }}
      >
        <MessageSquare className="h-5 w-5" />
        {inbox.length ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {inbox.length}
          </Badge>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Messages visiteurs</DialogTitle>
          </DialogHeader>
          {inbox.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {inbox.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={m.memberId === memberId ? "default" : "outline"}
                  onClick={() => setActive(m)}
                >
                  {m.memberName || "Visiteur"}
                </Button>
              ))}
            </div>
          ) : null}
          {active ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <VisitorAvatar
                  name={active.memberName}
                  src={active.avatarUrl}
                  className="h-12 w-12"
                />
                <div>
                  <p className="font-semibold">
                    {active.memberName || "Visiteur"}
                    {active.visitorNumber ? ` #${active.visitorNumber}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {active.phone || "—"}
                  </p>
                </div>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                {thread.map((m) => {
                  const fromStaff = m.direction !== "TO_STAFF";
                  return (
                    <div
                      key={m.id}
                      className={
                        fromStaff ? "text-right" : "text-left"
                      }
                    >
                      <div
                        className={
                          fromStaff
                            ? "ml-auto inline-block max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                            : "inline-block max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm shadow-sm"
                        }
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <p className="mt-1 text-[10px] opacity-70">
                          {format(new Date(m.createdAt), "HH:mm", {
                            locale: fr,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Répondre au visiteur…"
              />
              <Button
                className="w-full"
                disabled={!reply.trim() || send.isPending}
                onClick={() => send.mutate()}
              >
                Envoyer
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
