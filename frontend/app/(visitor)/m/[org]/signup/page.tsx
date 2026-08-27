"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VisitorAuthDialog } from "@/components/visitor/VisitorAuthDialog";
import { useOrg } from "@/lib/org";

function SignupInner() {
  const router = useRouter();
  const { href } = useOrg();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as string) || "day";
  const [open, setOpen] = useState(true);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">
        {mode === "subscription" ? "Abonnement" : "Visite du jour"}
      </h1>
      <VisitorAuthDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) router.push(href());
        }}
        redirectTo={href(`/choose?mode=${mode}`)}
        title={
          mode === "subscription"
            ? "Connexion pour abonnement"
            : "Connexion visiteur"
        }
      />
      <Button variant="link" onClick={() => setOpen(true)}>
        Ouvrir connexion / inscription
      </Button>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}
