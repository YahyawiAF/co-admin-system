"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { Abonnement, Journal } from "@/lib/types";

export type JournalAlertsData = {
  rows: Journal[];
  subByMember: Map<string, Abonnement>;
  tomorrowReservations: Journal[];
  now: number;
};

export type JournalAlertsActions = {
  onFocusRow?: (row: Journal) => void;
  onFilterOverstay?: () => void;
  onFilterLeavingSoon?: () => void;
  onViewTomorrow?: () => void;
};

/** @deprecated use JournalAlertsData */
export type JournalAlertsPayload = JournalAlertsData & JournalAlertsActions;

type Ctx = {
  data: JournalAlertsData | null;
  setData: (d: JournalAlertsData | null) => void;
  actionsRef: MutableRefObject<JournalAlertsActions>;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const JournalAlertsContext = createContext<Ctx | null>(null);

export function JournalAlertsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<JournalAlertsData | null>(null);
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<JournalAlertsActions>({});

  const value = useMemo(
    () => ({ data, setData, actionsRef, open, setOpen }),
    [data, open],
  );

  return (
    <JournalAlertsContext.Provider value={value}>
      {children}
    </JournalAlertsContext.Provider>
  );
}

export function useJournalAlerts() {
  const ctx = useContext(JournalAlertsContext);
  if (!ctx) {
    throw new Error("useJournalAlerts must be used within JournalAlertsProvider");
  }
  return ctx;
}

/** Register journal alert data (stable deps only — callbacks go via actionsRef). */
export function useJournalAlertsDataEffect(data: JournalAlertsData | null) {
  const { setData } = useJournalAlerts();

  useEffect(() => {
    setData(data);
    return () => setData(null);
  }, [data, setData]);
}
