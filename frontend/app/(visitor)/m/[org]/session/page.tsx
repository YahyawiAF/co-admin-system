"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org";

/** Session lives on Accueil — keep this route as a redirect. */
export default function SessionPage() {
  const router = useRouter();
  const { href } = useOrg();
  useEffect(() => {
    router.replace(href());
  }, [href, router]);
  return <p className="text-slate-500">Chargement de la session…</p>;
}
