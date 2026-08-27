import { Suspense } from "react";
import JournalPage from "./JournalClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground">Chargement du journal…</div>
      }
    >
      <JournalPage />
    </Suspense>
  );
}
