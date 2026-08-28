"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Coffee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CommandesBoard } from "@/components/admin/CommandesBoard";

export default function CommandesPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coffee className="h-6 w-6" />
            Commandes café
          </h1>
          <p className="text-muted-foreground">
            Encaissement séparé du journal — payé et non payé ne se mélangent
            pas.
          </p>
        </div>
        <Input
          type="date"
          className="w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <CommandesBoard dateKey={date} />
    </div>
  );
}
