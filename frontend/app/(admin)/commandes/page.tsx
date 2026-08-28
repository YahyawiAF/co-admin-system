"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Coffee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { JournalCommandesBody } from "@/components/admin/JournalCommandesRail";

export default function CommandesPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const selected = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coffee className="h-6 w-6" />
            Commandes café
          </h1>
          <p className="text-muted-foreground">
            Aussi disponible en colonne dans le journal du jour.
          </p>
        </div>
        <Input
          type="date"
          className="w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="flex h-[calc(100vh-11rem)] max-w-xl flex-col rounded-xl border bg-card p-3">
        <JournalCommandesBody date={selected} />
      </div>
    </div>
  );
}
