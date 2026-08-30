"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils";
import type { StaffMessage } from "@/lib/types";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";

type Props = {
  memberId: string;
  className?: string;
  compact?: boolean;
  fullScreen?: boolean;
};

export function AdminStaffChat({
  memberId,
  className,
  compact,
  fullScreen,
}: Props) {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const poll = useVisibleInterval(20_000);

  const { data: thread = [] } = useQuery({
    queryKey: ["staff-thread", memberId],
    queryFn: () => mobileApi.staffMessages(memberId, false),
    enabled: !!memberId,
    staleTime: 10_000,
    refetchInterval: poll,
  });

  useEffect(() => {
    if (!memberId) return;
    void mobileApi.markStaffThreadRead(memberId, "member");
  }, [memberId, thread.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  useEffect(() => {
    if (!socket || !memberId) return;
    const onMsg = (payload: StaffMessage) => {
      if (payload.memberId && payload.memberId !== memberId) return;
      if (payload.toMemberId && payload.toMemberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["staff-thread", memberId] });
      queryClient.invalidateQueries({ queryKey: ["staff-messages", memberId] });
    };
    socket.on("staff_message", onMsg);
    return () => {
      socket.off("staff_message", onMsg);
    };
  }, [socket, memberId, queryClient]);

  const send = useMutation({
    mutationFn: () =>
      mobileApi.sendVisitorStaffMessage({ memberId, text: draft }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["staff-thread", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className={cn(
        "flex flex-col bg-[#eef4fb]",
        fullScreen ? "h-full min-h-0" : "rounded-2xl bg-white shadow-sm",
        className
      )}
    >
      {!fullScreen ? (
        <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Administration</p>
            <p className="text-xs text-slate-500">Accueil · Collabora</p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3",
          fullScreen
            ? ""
            : compact
              ? "max-h-56"
              : "max-h-[50vh] min-h-[220px]"
        )}
      >
        {!thread.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Écrivez à l’accueil — votre conversation est enregistrée ici.
          </p>
        ) : (
          thread.map((m) => {
            const mine = m.direction === "TO_STAFF";
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[22px] px-3.5 py-2 text-[15px] leading-snug",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "bg-white text-slate-900 shadow-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      mine ? "text-white/70" : "text-slate-400"
                    )}
                  >
                    {format(new Date(m.createdAt), "HH:mm · dd MMM", {
                      locale: fr,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          send.mutate();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message à l’accueil…"
          className="h-11 rounded-full"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!draft.trim() || send.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
