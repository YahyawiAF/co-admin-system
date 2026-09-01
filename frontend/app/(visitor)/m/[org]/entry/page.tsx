"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { markQrEntry } from "@/lib/visitorCache";

/** QR landing: mark entry intent then redirect to home for auto check-in. */
export default function VisitorEntryPage() {
  const params = useParams<{ org: string }>();
  const router = useRouter();
  const slug = params.org;

  useEffect(() => {
    if (!slug) return;
    markQrEntry(slug);
    router.replace(`/m/${slug}`);
  }, [slug, router]);

  return (
    <div className="mobile-shell mx-auto flex min-h-dvh max-w-[480px] items-center justify-center bg-[#f3f6fb] text-slate-500">
      Accueil…
    </div>
  );
}
