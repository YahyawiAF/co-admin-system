"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosDevice, isStandalonePwa } from "@/lib/visitor-notify";

type BeforeInstall = Event & { prompt: () => Promise<void> };

export function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setIosHint(isIosDevice() && !isStandalonePwa());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (isStandalonePwa()) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
      return;
    }
    setIosHint(true);
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-full border-primary/20 bg-sky-50 text-primary"
        onClick={() => void onClick()}
      >
        <Download className="mr-1.5 h-4 w-4" />
        Installer l’app
      </Button>
      {iosHint && !deferred ? (
        <p className="mt-1.5 text-center text-[11px] text-slate-500">
          iPhone : Partager → Sur l’écran d’accueil
        </p>
      ) : null}
    </div>
  );
}
