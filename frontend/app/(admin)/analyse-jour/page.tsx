import { Suspense } from "react";
import DayAnalysisClient from "./DayAnalysisClient";

export default function Page() {
  return (
    <Suspense
      fallback={<div className="text-muted-foreground">Chargement…</div>}
    >
      <DayAnalysisClient />
    </Suspense>
  );
}
