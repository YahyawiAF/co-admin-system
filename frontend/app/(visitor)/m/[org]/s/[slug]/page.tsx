"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Share2 } from "lucide-react";
import { surveysApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import {
  answeredAt,
  campaignParams,
  clearDraft,
  clearIdempotencyKey,
  firstOpen,
  idempotencyKey,
  readDraft,
  rememberResponse,
  saveDraft,
  visitorKey,
} from "@/lib/survey-attribution";
import { SurveyForm, type SubmitError, type SubmitPayload, type SurveyDraftState } from "@/components/visitor/survey/SurveyForm";

/** Public Learn & Share survey: opens straight away, no account, no app install. */
export default function PublicSurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const { org, slug: orgSlug, href } = useOrg();
  const { ready, memberId } = useVisitorSession();
  const visited = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const params = useMemo(
    () => (mounted ? campaignParams(orgSlug, slug, new URLSearchParams(search.toString())) : {}),
    [mounted, orgSlug, slug, search]
  );
  const key = useMemo(() => (mounted ? visitorKey(orgSlug) : ""), [mounted, orgSlug]);

  const { data: survey, isLoading, isError } = useQuery({
    queryKey: ["public-survey", orgSlug, slug],
    queryFn: () => surveysApi.publicGet(orgSlug, slug),
    retry: 1,
    staleTime: 60_000,
  });

  // Record where this browser came from (server keeps the first source)
  useEffect(() => {
    if (!survey?.open || !key || visited.current) return;
    visited.current = true;
    surveysApi
      .publicVisit(orgSlug, slug, { visitorKey: key, ...params, firstOpen: firstOpen(params.c) })
      .catch(() => {
        // Not blocking: the answer re-sends the same values
      });
  }, [survey?.open, key, orgSlug, slug, params]);

  const draft = useMemo(() => (mounted ? readDraft(orgSlug, slug) : null), [mounted, orgSlug, slug]);
  const already = useMemo(() => (mounted ? answeredAt(orgSlug, slug) : null), [mounted, orgSlug, slug]);

  const onDraft = useCallback((d: SurveyDraftState) => saveDraft(orgSlug, slug, d), [orgSlug, slug]);
  const onStart = useCallback(() => {
    if (key) surveysApi.publicStart(orgSlug, slug, key).catch(() => undefined);
  }, [key, orgSlug, slug]);

  const onSubmit = useCallback(
    async (p: SubmitPayload) => {
      try {
        const res = await surveysApi.publicSubmit(orgSlug, slug, {
          visitorKey: key,
          idempotencyKey: idempotencyKey(orgSlug, slug),
          ...params,
          answers: p.answers,
          ...(p.contact && { contact: p.contact }),
          ...(memberId && { memberId }),
          hp: p.hp,
          elapsedMs: p.elapsedMs,
        });
        clearIdempotencyKey(orgSlug, slug);
        clearDraft(orgSlug, slug);
        rememberResponse(orgSlug, slug, res.id);
        return res;
      } catch (e) {
        // fetch rejects with a TypeError when the network drops: keep the key so a retry is not counted twice
        if (e instanceof TypeError) {
          const err = new Error("network") as SubmitError;
          err.network = true;
          throw err;
        }
        throw e;
      }
    },
    [orgSlug, slug, key, params, memberId]
  );

  if (isLoading || !mounted || !ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-slate-500" aria-live="polite">Chargement…</div>;
  }
  if (isError || !survey) {
    return (
      <Notice title="Sondage introuvable" text="Le lien est peut-être incomplet. Vérifie l’adresse ou le QR code.">
        <Link href={href("/events")} className={LINK}>
          <CalendarDays className="h-4 w-4" /> Voir les séances
        </Link>
      </Notice>
    );
  }
  if (!survey.open) {
    return (
      <Notice title="Ce sondage est fermé" text="Merci de ton intérêt. Les séances organisées sont dans l’app.">
        <Link href={href("/events")} className={LINK}>
          <CalendarDays className="h-4 w-4" /> Voir les séances
        </Link>
      </Notice>
    );
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const shareText = `${survey.title} : 2 minutes, sans compte. ${shareUrl}`;

  return (
    <SurveyForm
      survey={survey}
      orgName={org.name}
      knownMember={!!memberId}
      alreadyAnsweredAt={already}
      initialDraft={draft}
      onStart={onStart}
      onDraft={onDraft}
      onSubmit={onSubmit}
      doneActions={
        <>
          <Link href={href("/events")} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-base font-bold text-white transition-[filter] hover:brightness-110">
            <CalendarDays className="h-5 w-5" /> Voir les séances
          </Link>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager le sondage sur WhatsApp"
            className="flex h-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 px-5 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Share2 className="h-5 w-5" />
          </a>
        </>
      }
    />
  );
}

const LINK = "inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white";

function Notice({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="ls-enter flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-[34ch] text-sm text-slate-500">{text}</p>
      {children}
    </div>
  );
}
