"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { memberName } from "@/lib/traffic-utils";

const MEDALS = ["text-amber-500", "text-slate-400", "text-orange-700"];

export function FinanceTopPoints() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analyticsTopPoints,
    queryFn: () => analyticsApi.topPoints(10),
  });
  const members = data?.members ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 10 points fidélité</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : members.length ? (
          <ol className="space-y-1.5">
            {members.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <span className="w-5 text-center font-semibold text-muted-foreground">
                  {i < 3 ? (
                    <Trophy className={cn("mx-auto h-4 w-4", MEDALS[i])} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {memberName(m)}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {m.level.name} · {m.sessions} visites
                </Badge>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {m.points.toLocaleString("fr-FR")} pts
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun membre n&apos;a encore de points
          </p>
        )}
      </CardContent>
    </Card>
  );
}
