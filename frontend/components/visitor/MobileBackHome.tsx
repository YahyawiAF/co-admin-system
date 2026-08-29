"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

/** Mobile: return to org home (/m/{slug}). */
export function MobileBackHome({
  className,
  label = "Accueil",
}: {
  className?: string;
  label?: string;
}) {
  const { href } = useOrg();
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn("-ml-2 mb-2 h-9 gap-1.5 px-2 text-slate-600", className)}
    >
      <Link href={href()}>
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
