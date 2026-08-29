"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mobileApi } from "@/lib/api/resources";
import { PriceCategory } from "@/lib/types";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";

export default function MobileTarifsPage() {
  const { data: tarifs = [] } = useQuery({
    queryKey: ["mobile-tarifs"],
    queryFn: () => mobileApi.tarifs(),
  });

  const groups = useMemo(() => {
    const order = [
      PriceCategory.JOURNEE,
      PriceCategory.SALLE,
      PriceCategory.OPEN_SPACE,
      PriceCategory.ABONNEMENT,
    ];
    return order.map((cat) => ({
      cat,
      items: tarifs.filter((t) => t.category === cat),
    }));
  }, [tarifs]);

  return (
    <div>
      <MobileBackHome />
      <h1 className="mb-2 text-2xl font-bold">Tarifs</h1>
      <p className="mb-4 text-sm text-slate-500">
        En cas de dépassement, le prix du forfait reste affiché ; l&apos;accueil
        peut ajuster.
      </p>
      <div className="space-y-6">
        {groups.map(({ cat, items }) =>
          items.length ? (
            <div key={cat}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {cat.replace("_", " ")}
              </h2>
              <div className="space-y-2">
                {items.map((p) => (
                  <Card key={p.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <span className="font-bold text-primary">{p.price} DT</span>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="flex gap-1">
                        {p.durationHours ? (
                          <Badge variant="secondary">{p.durationHours}h</Badge>
                        ) : null}
                        {p.periodDays ? (
                          <Badge variant="secondary">{p.periodDays}j</Badge>
                        ) : null}
                        {p.billingUnit ? (
                          <Badge variant="outline">{p.billingUnit}</Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
