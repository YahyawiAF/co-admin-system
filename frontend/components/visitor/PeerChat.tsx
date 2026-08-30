"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";

type Props = {
  memberId: string;
  peerId: string;
  className?: string;
};

export function PeerChat({ memberId, peerId, className }: Props) {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const poll = useVisibleInterval(20_000);

  const { data: thread = [] } = useQuery({
    queryKey: ["mobile-thread", memberId, peerId],
    queryFn: () => mobileApi.thread(memberId, peerId),
    enabled: !!memberId && !!peerId,
    refetchInterval: poll,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  useEffect(() => {
    if (!socket || !memberId) return;
    const onMsg = (payload: {
      toMemberId?: string;
      fromMemberId?: string;
    }) => {
      if (
        payload.toMemberId !== memberId &&
        payload.fromMemberId !== memberId
      ) {
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["mobile-thread", memberId, peerId],
      });
      queryClient.invalidateQueries({ queryKey: ["mobile-inbox", memberId] });
    };
    socket.on("community_message", onMsg);
    return () => {
      socket.off("community_message", onMsg);
    };
  }, [socket, memberId, peerId, queryClient]);

  const send = useMutation({
    mutationFn: () =>
      mobileApi.sendMessage({
        fromMemberId: memberId,
        toMemberId: peerId,
        text: draft,
      }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({
        queryKey: ["mobile-thread", memberId, peerId],
      });
      queryClient.invalidateQueries({ queryKey: ["mobile-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-[#eef4fb]", className)}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!thread.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Dites bonjour — présentez vos compétences.
          </p>
        ) : (
          thread.map((m) => {
            const mine = m.fromMemberId === memberId;
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
          placeholder="Message…"
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
