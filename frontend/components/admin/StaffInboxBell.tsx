"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
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
import { cn } from "@/lib/utils";
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

  const unreadCount = inbox.filter((m) => m.unread).length;

  useEffect(() => {
    if (!socket) return;
    const onMsg = (payload: StaffMessage & { direction?: string }) => {
      if (payload.direction !== "TO_STAFF") return;
      const who = payload.memberName || "Visiteur";
      toast.message("Nouveau message", {
        description:
          payload.text?.length > 80
            ? `${who} · ${payload.text.slice(0, 80)}…`
            : `${who} · ${payload.text || "Message reçu"}`,
      });
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
      queryClient.invalidateQueries({
        queryKey: ["staff-thread-admin", memberId],
      });
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
        title="Messagerie visiteurs"
        onClick={() => {
          setActive(inbox[0] || null);
          setOpen(true);
        }}
      >
        <MessageSquare className="h-5 w-5" />
        {unreadCount ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {unreadCount}
          </Badge>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Messagerie visiteurs
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Conversations avec les personnes présentes ou inscrites
            </p>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 md:grid-cols-[180px_1fr]">
            <aside className="max-h-[28vh] overflow-y-auto border-b bg-muted/30 p-2 md:max-h-none md:border-b-0 md:border-r">
              {inbox.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Aucune conversation
                </p>
              ) : (
                <ul className="space-y-1">
                  {inbox.map((m) => {
                    const selected = m.memberId === memberId;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActive(m);
                            setReply("");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                            selected
                              ? "bg-background shadow-sm ring-1 ring-border"
                              : "hover:bg-background/70"
                          )}
                        >
                          <VisitorAvatar
                            name={m.memberName}
                            src={m.avatarUrl}
                            className="h-8 w-8 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1">
                              <span className="truncate text-xs font-medium">
                                {m.memberName || "Visiteur"}
                              </span>
                              {m.unread ? (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              ) : null}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {m.text || "—"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <div className="flex min-h-0 flex-col">
              {active ? (
                <>
                  <div className="flex items-center gap-3 border-b px-4 py-3">
                    <VisitorAvatar
                      name={active.memberName}
                      src={active.avatarUrl}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {active.memberName || "Visiteur"}
                        {active.visitorNumber
                          ? ` · #${active.visitorNumber}`
                          : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {active.phone || "Sans téléphone"}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[40vh] min-h-[180px] flex-1 space-y-2.5 overflow-y-auto bg-[#f7f8fa] px-4 py-3">
                    {thread.length === 0 ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">
                        Démarrez la conversation
                      </p>
                    ) : (
                      thread.map((m) => {
                        const fromStaff = m.direction !== "TO_STAFF";
                        return (
                          <div
                            key={m.id}
                            className={fromStaff ? "text-right" : "text-left"}
                          >
                            <div
                              className={cn(
                                "inline-block max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                                fromStaff
                                  ? "rounded-br-md bg-primary text-primary-foreground"
                                  : "rounded-bl-md border bg-white text-foreground"
                              )}
                            >
                              <p className="whitespace-pre-wrap text-left">
                                {m.text}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 text-[10px] tabular-nums",
                                  fromStaff
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                                )}
                              >
                                {format(new Date(m.createdAt), "HH:mm", {
                                  locale: fr,
                                })}
                                {fromStaff ? " · Accueil" : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t bg-background p-3">
                    <div className="flex gap-2">
                      <Textarea
                        rows={2}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Écrire une réponse…"
                        className="min-h-[64px] resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            if (reply.trim() && !send.isPending) send.mutate();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-auto w-11 shrink-0"
                        disabled={!reply.trim() || send.isPending}
                        onClick={() => send.mutate()}
                        title="Envoyer"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Ctrl+Entrée pour envoyer
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Sélectionnez une conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Les messages des visiteurs apparaîtront ici.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
