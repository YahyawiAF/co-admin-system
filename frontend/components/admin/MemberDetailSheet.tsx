"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Copy, KeyRound, Send } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { visitorMobileUrl } from "@/components/admin/VisitorQrCard";
import { membersApi, mobileApi, organizationsApi } from "@/lib/api/resources";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { subscriptionExpiryLabel } from "@/lib/subscription-utils";

function StaffAdminThread({ memberId }: { memberId: string }) {
  const { data: thread = [] } = useQuery({
    queryKey: ["staff-thread-admin", memberId],
    queryFn: () => mobileApi.staffMessages(memberId, false),
    refetchInterval: 5000,
  });
  return (
    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2">
      {!thread.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Aucun message encore
        </p>
      ) : (
        thread.map((m) => {
          const fromStaff = m.direction !== "TO_STAFF";
          return (
            <div
              key={m.id}
              className={cn(fromStaff ? "text-right" : "text-left")}
            >
              <div
                className={cn(
                  "inline-block max-w-[90%] rounded-2xl px-2.5 py-1.5 text-xs",
                  fromStaff
                    ? "bg-primary text-primary-foreground"
                    : "bg-white shadow-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-0.5 opacity-70">
                  {format(new Date(m.createdAt), "dd MMM HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MemberAdminPin({
  memberId,
  hasPin: initialHasPin,
}: {
  memberId: string;
  hasPin: boolean;
}) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHasPin(initialHasPin);
    setPin("");
    setPin2("");
    setOpen(false);
  }, [memberId, initialHasPin]);

  const save = useMutation({
    mutationFn: () => mobileApi.setPin({ memberId, pin }),
    onSuccess: () => {
      setHasPin(true);
      setPin("");
      setPin2("");
      setOpen(false);
      toast.success(hasPin ? "PIN mis à jour" : "PIN défini pour le visiteur");
      void queryClient.invalidateQueries({
        queryKey: ["member-insights", memberId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pinOk = /^\d{4}$/.test(pin) && pin === pin2;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Code PIN mobile</p>
          <p className="text-xs text-muted-foreground">
            {hasPin
              ? "Le visiteur a déjà un PIN — vous pouvez le réinitialiser."
              : "Aucun PIN — définissez-en un pour qu’il se connecte."}
          </p>
        </div>
        <Badge variant={hasPin ? "default" : "secondary"}>
          {hasPin ? "PIN OK" : "Sans PIN"}
        </Badge>
      </div>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          {hasPin ? "Réinitialiser le PIN" : "Définir un PIN"}
        </Button>
      ) : (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nouveau PIN (4 chiffres)</Label>
            <Input
              className="mt-1 h-10 text-center text-lg tracking-[0.35em]"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
            />
          </div>
          <div>
            <Label className="text-xs">Confirmer</Label>
            <Input
              className="mt-1 h-10 text-center text-lg tracking-[0.35em]"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) =>
                setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
            />
          </div>
          {pin2 && pin !== pin2 ? (
            <p className="text-xs text-destructive">Les codes ne correspondent pas</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={!pinOk || save.isPending}
              onClick={() => save.mutate()}
            >
              Enregistrer
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setPin("");
                setPin2("");
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberLoginRecovery({
  memberId,
  memberName,
  phone,
}: {
  memberId: string;
  memberName: string;
  phone?: string | null;
}) {
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });
  const orgSlug = organizations[0]?.slug || "collabora-hub";
  const [issued, setIssued] = useState<{
    token: string;
    shortCode: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    setIssued(null);
  }, [memberId]);

  const create = useMutation({
    mutationFn: () => mobileApi.createMemberLoginToken(memberId),
    onSuccess: (res) => {
      setIssued({
        token: res.token,
        shortCode: res.shortCode,
        expiresAt: String(res.expiresAt),
      });
      toast.success("Lien de récupération créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const magicUrl = useMemo(() => {
    if (!issued) return "";
    return `${visitorMobileUrl(orgSlug)}/recover?token=${issued.token}`;
  }, [issued, orgSlug]);

  const qrSrc = useMemo(() => {
    if (!magicUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      magicUrl
    )}`;
  }, [magicUrl]);

  const waText = useMemo(() => {
    if (!issued) return "";
    const lines = [
      `Bonjour ${memberName},`,
      ``,
      `Voici votre accès Collabora :`,
      `Lien : ${magicUrl}`,
      ``,
      `Ou dans l'icône Collabora : code ${issued.shortCode}`,
      phone ? `avec votre téléphone ${phone}` : "",
      ``,
      `Valable 48 h.`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [issued, magicUrl, memberName, phone]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Récupération mobile</p>
          <p className="text-xs text-muted-foreground">
            Lien WhatsApp + QR + code 6 chiffres pour l&apos;icône Accueil.
          </p>
        </div>
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={create.isPending}
        onClick={() => create.mutate()}
      >
        {issued ? "Générer un nouveau lien" : "Générer lien / code"}
      </Button>
      {issued ? (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">
              Code (icône Collabora)
            </p>
            <p className="font-mono text-3xl font-bold tracking-[0.25em]">
              {issued.shortCode}
            </p>
            <p className="text-xs text-muted-foreground">
              Expire{" "}
              {format(new Date(issued.expiresAt), "dd MMM HH:mm", {
                locale: fr,
              })}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="QR récupération"
            className="mx-auto rounded-lg border bg-white p-2"
            width={160}
            height={160}
            src={qrSrc}
          />
          <p className="break-all font-mono text-[10px] text-muted-foreground">
            {magicUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(magicUrl, "Lien")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Lien
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(issued.shortCode, "Code")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Code
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(waText, "Message WhatsApp")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              WhatsApp
            </Button>
            {phone ? (
              <Button type="button" size="sm" asChild>
                <a
                  href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberDetailSheet({ member, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
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
      void queryClient.invalidateQueries({
        queryKey: ["staff-thread-admin", member!.id],
      });
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
  const hasPin = !!(
    m?.hasPin ||
    (data?.member as Member & { pinHash?: string | null })?.pinHash
  );

  const subscriptionSplit = useMemo(() => {
    const subs = [...(data?.subscriptions || [])].sort(
      (a, b) =>
        new Date(b.registredDate).getTime() -
        new Date(a.registredDate).getTime(),
    );
    const isActive = (s: (typeof subs)[0]) =>
      !s.leaveDate ||
      new Date(s.leaveDate) >= new Date(new Date().toDateString());
    const current = subs.find(isActive) || null;
    const history = subs.filter((s) => s.id !== current?.id);
    return { current, history };
  }, [data?.subscriptions]);

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

            {member?.id ? (
              <>
                <MemberAdminPin memberId={member.id} hasPin={hasPin} />
                <MemberLoginRecovery
                  memberId={member.id}
                  memberName={name}
                  phone={m.phone}
                />
              </>
            ) : null}

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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Abonnements
                      </p>
                      {member?.id ? (
                        <Link
                          href={`/abonnements?memberId=${member.id}`}
                          className="text-xs text-primary underline"
                        >
                          Gérer
                        </Link>
                      ) : null}
                    </div>
                    {subscriptionSplit.current ? (
                      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/20">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {subscriptionSplit.current.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(
                                new Date(subscriptionSplit.current.registredDate),
                                "dd MMM yyyy",
                                { locale: fr },
                              )}
                              {subscriptionSplit.current.leaveDate
                                ? ` → ${format(
                                    new Date(subscriptionSplit.current.leaveDate),
                                    "dd MMM yyyy",
                                    { locale: fr },
                                  )}`
                                : ""}
                            </p>
                          </div>
                          <Badge className="bg-violet-600 hover:bg-violet-600">
                            Actuel
                          </Badge>
                        </div>
                        {subscriptionSplit.current.leaveDate ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {subscriptionExpiryLabel(
                              differenceInCalendarDays(
                                new Date(subscriptionSplit.current.leaveDate),
                                new Date(),
                              ),
                            )}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucun abonnement actif.
                      </p>
                    )}
                    {subscriptionSplit.history.length > 0 ? (
                      <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-dashed p-2">
                        {subscriptionSplit.history.map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between text-xs text-muted-foreground"
                          >
                            <span>
                              {s.name} ·{" "}
                              {format(new Date(s.registredDate), "dd/MM/yy")}
                            </span>
                            <span>{s.payedAmount} DT</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                  <StaffAdminThread memberId={member!.id} />
                  <p className="text-sm text-muted-foreground">
                    Répondez ici — le visiteur reçoit une notification.
                  </p>
                  <Textarea
                    rows={3}
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
                    Envoyer
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
