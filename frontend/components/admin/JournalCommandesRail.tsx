"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CommandesBoard } from "@/components/admin/CommandesBoard";
import { mobileApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";

export function JournalCommandesRail({ date }: { date: Date }) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.adminOrders(dateKey),
    queryFn: () => mobileApi.adminOrders(dateKey),
    refetchInterval: 8_000,
  });
  const unpaidCount = orders.filter((o) => !o.isPayed).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg">
          <Coffee className="mr-2 h-4 w-4" />
          Commandes
          {unpaidCount ? (
            <Badge className="ml-2 bg-rose-600 hover:bg-rose-600">
              {unpaidCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[min(1100px,96vw)]"
      >
        <SheetHeader className="border-b px-6 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Commandes café
          </SheetTitle>
          <SheetDescription>
            {format(date, "EEEE d MMMM yyyy", { locale: fr })} · même jour que
            le journal
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 p-6">
          <CommandesBoard dateKey={dateKey} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
