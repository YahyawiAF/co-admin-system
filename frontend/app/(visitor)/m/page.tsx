"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { organizationsApi } from "@/lib/api/resources";

export default function MobileIndexRedirect() {
  const router = useRouter();
  const { data, isError, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
    retry: false,
  });

  useEffect(() => {
    if (!data?.length) return;
    router.replace(`/m/${data[0].slug}`);
  }, [data, router]);

  if (isError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] items-center justify-center px-6 text-center text-slate-500">
        Impossible de charger l&apos;espace. Réessayez.
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] items-center justify-center bg-[#f3f6fb] text-slate-500">
      {isLoading ? "Chargement…" : "Redirection…"}
    </div>
  );
}
