"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isIosDevice, isStandalonePwa } from "@/lib/visitor-notify";
import {
  ANDROID_INSTALL_STEPS,
  IOS_INSTALL_STEPS,
} from "@/components/visitor/installSteps";

type BeforeInstall = Event & { prompt: () => Promise<void> };

function isIosSafari() {
  if (!isIosDevice()) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(navigator.userAgent);
}

export function InstallAppButton({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(true);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (isStandalonePwa()) {
      setHidden(true);
      return;
    }
    setIos(isIosDevice());
    setSafari(isIosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  const steps = ios ? IOS_INSTALL_STEPS : ANDROID_INSTALL_STEPS;
  const current = steps[step]!;
  const last = step === steps.length - 1;

  const onClick = async () => {
    setStep(0);
    if (deferred && !ios) {
      await deferred.prompt();
      setDeferred(null);
      return;
    }
    setOpen(true);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setStep(0);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
    touchX.current = null;
    const swipedLeft = dx < -48;
    const swipedRight = dx > 48;
    if (swipedLeft && step + 1 < steps.length) {
      setStep((s) => s + 1);
    }
    if (swipedRight && step > 0) {
      setStep((s) => s - 1);
    }
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

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="gap-0 border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
        >
          <div className="mx-auto max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-background shadow-[0_-8px_32px_rgba(15,23,42,0.18)]">
            <div className="flex justify-center pb-1 pt-2.5">
              <div className="h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
            </div>

          <SheetHeader className="space-y-1 px-5 pb-3 text-left">
            <SheetTitle className="text-[17px] leading-tight">
              {ios ? "Ajouter à l’écran d’accueil" : "Installer l’application"}
            </SheetTitle>
            <SheetDescription className="text-[13px]">
              {ios
                ? "Safari uniquement — 3 gestes, environ 20 secondes."
                : "Chrome — menu ⋮ puis Installer l’application."}
            </SheetDescription>
          </SheetHeader>

          {ios && !safari ? (
            <p className="mx-5 mb-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900">
              Sur iPhone, ouvrez cette page dans <strong>Safari</strong> (pas
              Chrome) pour installer l’app.
            </p>
          ) : null}

          <div
            className="px-5"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.src}
                alt={current.alt}
                className="mx-auto max-h-[46vh] w-full object-contain"
              />
            </div>
            <p className="mt-3 text-center text-[15px] font-semibold text-slate-900">
              {step + 1}. {current.title}
            </p>
            <p className="mt-0.5 text-center text-[13px] text-slate-500">
              {current.hint}
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-3">
            {steps.map((item, i) => (
              <button
                key={item.src}
                type="button"
                aria-label={`Étape ${i + 1}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn(
                  "h-2.5 min-w-[10px] rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : "w-2.5 bg-slate-300"
                )}
              />
            ))}
          </div>

          <div className="flex gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 min-h-12 flex-1 rounded-full text-base"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft />
                Retour
              </Button>
            ) : null}
            {last ? (
              <Button
                type="button"
                className="h-12 min-h-12 flex-1 rounded-full text-base"
                onClick={() => setOpen(false)}
              >
                Compris
              </Button>
            ) : (
              <Button
                type="button"
                className="h-12 min-h-12 flex-1 rounded-full text-base"
                onClick={() => setStep((s) => s + 1)}
              >
                Suivant
                <ChevronRight />
              </Button>
            )}
          </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
