"use client";

import { useEffect, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import {
  clearInstallNudgePending,
  hasSkippedInstall,
  peekInstallNudgePending,
  skipInstall,
} from "@/lib/visitorCache";
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

/** First-visit install guide with how-to images. Skippable. */
export function InstallAppNudge() {
  const { org, slug } = useOrg();
  const { memberId } = useVisitorSession();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(true);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    if (isStandalonePwa()) return;
    const forced = memberId ? peekInstallNudgePending(slug, memberId) : false;
    if (!forced && hasSkippedInstall(slug)) return;
    setIos(isIosDevice());
    setSafari(isIosSafari());
    setOpen(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [memberId, slug]);

  const dismiss = () => {
    skipInstall(slug);
    if (memberId) clearInstallNudgePending(slug, memberId);
    setOpen(false);
  };

  const onNativeInstall = async () => {
    if (deferred && !ios) {
      await deferred.prompt();
      setDeferred(null);
      dismiss();
    }
  };

  if (!open) return null;

  const steps = ios ? IOS_INSTALL_STEPS : ANDROID_INSTALL_STEPS;
  const current = steps[step]!;
  const last = step === steps.length - 1;

  const onTouchStart = (e: TouchEvent) => {
    setTouchX(e.touches[0]?.clientX ?? null);
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX;
    setTouchX(null);
    if (dx < -48 && step + 1 < steps.length) setStep((s) => s + 1);
    if (dx > 48 && step > 0) setStep((s) => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-xl sm:rounded-[28px]">
        <div className="flex justify-center pb-1 pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
        </div>
        <div className="px-5 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Installer l&apos;app
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {org.name} sur votre téléphone
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {ios
              ? "Safari — 3 gestes pour l’ajouter à l’écran d’accueil."
              : "Chrome — menu ⋮ puis Installer l’application."}
          </p>
        </div>

        {ios && !safari ? (
          <p className="mx-5 mb-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900">
            Sur iPhone, ouvrez cette page dans <strong>Safari</strong> (pas
            Chrome) pour installer l’app.
          </p>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              className="mx-auto max-h-[42vh] w-full object-contain"
            />
          </div>
          <p className="mt-3 text-center text-[15px] font-semibold text-slate-900">
            {step + 1}. {current.title}
          </p>
          <p className="mt-0.5 text-center text-[13px] text-slate-500">
            {current.hint}
          </p>
          <div className="flex items-center justify-center gap-1.5 py-3">
            {steps.map((item, i) => (
              <button
                key={item.src}
                type="button"
                aria-label={`Étape ${i + 1}`}
                onClick={() => setStep(i)}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : "w-2.5 bg-slate-300"
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-full text-base"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft />
                Retour
              </Button>
            ) : null}
            {last ? (
              deferred && !ios ? (
                <Button
                  type="button"
                  className="h-12 flex-1 rounded-full text-base"
                  onClick={() => void onNativeInstall()}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Installer
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-12 flex-1 rounded-full text-base"
                  onClick={dismiss}
                >
                  C’est fait
                </Button>
              )
            ) : (
              <Button
                type="button"
                className="h-12 flex-1 rounded-full text-base"
                onClick={() => setStep((s) => s + 1)}
              >
                Suivant
                <ChevronRight />
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full text-slate-500"
            onClick={dismiss}
          >
            Plus tard — continuer dans le navigateur
          </Button>
        </div>
      </div>
    </div>
  );
}
