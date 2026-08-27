"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { membersApi, mobileApi } from "@/lib/api/resources";
import type { Member } from "@/lib/types";

type Props = {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberDetailSheet({ member, open, onOpenChange }: Props) {
  const [message, setMessage] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["member-insights", member?.id],
    queryFn: () => membersApi.insights(member!.id),
    enabled: open && !!member?.id,
  });

  const send = useMutation({
    mutationFn: () =>
      mobileApi.sendStaffMessage({ memberId: member!.id, text: message }),
    onSuccess: () => {
      toast.success("Message envoyé sur mobile");
      setMessage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const m = {
    ...member,
    ...data?.member,
    group: member?.group || data?.member?.group,
  };
  const name =
    [m?.firstName, m?.lastName].filter(Boolean).join(" ") ||
    m?.firstName ||
    "Visiteur";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Fiche membre</SheetTitle>
        </SheetHeader>
        {!m ? null : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <VisitorAvatar name={name} src={m.avatarUrl} className="h-16 w-16" />
              <div>
                <p className="text-lg font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.phone || "—"}
                  {m.visitorNumber ? ` · #${m.visitorNumber}` : ""}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {m.plan === "Membership" ? "Abonné" : "Visiteur"}
                </Badge>
                {m.group?.name ? (
                  <Badge className="ml-1 mt-1">{m.group.name}</Badge>
                ) : null}
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : data ? (
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Vue</TabsTrigger>
                  <TabsTrigger value="weekly">Semaines</TabsTrigger>
                  <TabsTrigger value="history">Histo</TabsTrigger>
                  <TabsTrigger value="message">Msg</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Visites", value: String(data.totals.visits) },
                      { label: "Heures", value: `${data.totals.hours} h` },
                      {
                        label: "Total dépensé",
                        value: `${data.totals.spendTotal.toFixed(1)} DT`,
                      },
                      {
                        label: "Café",
                        value: `${data.totals.spendCafe.toFixed(1)} DT`,
                      },
                    ].map((k) => (
                      <Card key={k.label}>
                        <CardHeader className="pb-1 pt-3">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            {k.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 text-xl font-bold">
                          {k.value}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">Routine coworking</p>
                    <p className="mt-1 text-muted-foreground">
                      Jours :{" "}
                      {data.routine.typicalDays.length
                        ? data.routine.typicalDays
                            .slice(0, 3)
                            .map((d) => `${d.label} (${d.count})`)
                            .join(", ")
                        : "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Arrivée typique :{" "}
                      {data.routine.typicalArrivalHour != null
                        ? `${String(data.routine.typicalArrivalHour).padStart(2, "0")}h`
                        : "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Durée moyenne :{" "}
                      {data.routine.typicalDurationMin != null
                        ? `${data.routine.typicalDurationMin} min`
                        : "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Place habituelle : {data.routine.favoriteSeat || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Forfait habituel : {data.routine.favoriteForfait || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Café habituel : {data.routine.favoriteProduct || "—"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Visites {data.totals.spendVisits.toFixed(1)} DT · Abonnements{" "}
                    {data.totals.spendSubscriptions.toFixed(1)} DT
                  </p>
                </TabsContent>

                <TabsContent value="weekly" className="space-y-2">
                  {data.weekly.map((w) => (
                    <div
                      key={w.weekStart}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">Sem. {w.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.visits} visites · {w.hours} h
                        </p>
                      </div>
                      <p className="font-semibold">{w.spend.toFixed(1)} DT</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="history" className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Visites
                  </p>
                  {data.recentVisits.map((v) => (
                    <div
                      key={v.id}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {format(new Date(v.registredTime), "dd MMM", {
                          locale: fr,
                        })}{" "}
                        · {v.forfait || "—"}
                      </span>
                      <span>{v.payedAmount} DT</span>
                    </div>
                  ))}
                  <p className="pt-2 text-xs font-semibold uppercase text-muted-foreground">
                    Café
                  </p>
                  {data.recentOrders.map((o) => (
                    <div key={o.id} className="flex justify-between text-sm">
                      <span>
                        {o.quantity}× {o.productName}
                      </span>
                      <span>{o.amount.toFixed(1)} DT</span>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="message" className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Le visiteur verra ce message en popup sur son téléphone.
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="Ex. Votre place est prête, bienvenue !"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    disabled={!message.trim() || send.isPending}
                    onClick={() => send.mutate()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer sur mobile
                  </Button>
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
