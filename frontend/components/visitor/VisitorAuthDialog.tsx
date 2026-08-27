"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mobileApi } from "@/lib/api/resources";
import { saveVisitorCache } from "@/lib/visitorCache";
import type { Member } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to go after auth (e.g. /m/choose?mode=subscription) */
  redirectTo?: string;
  title?: string;
  onSuccess?: (member: Member) => void;
};

export function VisitorAuthDialog({
  open,
  onOpenChange,
  redirectTo,
  title = "Connexion visiteur",
  onSuccess,
}: Props) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");

  const finish = (member: Member, accessToken: string) => {
    saveVisitorCache(member, accessToken);
    sessionStorage.setItem("memberId", member.id);
    toast.success(tab === "login" ? "Connecté" : "Compte créé");
    onOpenChange(false);
    setPhone("");
    setPassword("");
    setFirstName("");
    if (onSuccess) {
      onSuccess(member);
      return;
    }
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  const login = useMutation({
    mutationFn: () =>
      mobileApi.login({
        phone,
        password: password || undefined,
      }),
    onSuccess: (res) => finish(res.member, res.accessToken),
    onError: (e: Error) => toast.error(e.message),
  });

  const signup = useMutation({
    mutationFn: () =>
      mobileApi.register({
        phone,
        firstName: firstName || undefined,
        requirePassword: false,
      }),
    onSuccess: (res) => finish(res.member, res.accessToken),
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = login.isPending || signup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe (si compte existant)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optionnel pour visite du jour"
              />
            </div>
            {login.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {(login.error as Error).message}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="w-full"
              disabled={!phone || busy}
              onClick={() => login.mutate()}
            >
              Se connecter
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Prénom</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
            {signup.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {(signup.error as Error).message}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="w-full"
              disabled={!phone || busy}
              onClick={() => signup.mutate()}
            >
              Créer mon profil
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
