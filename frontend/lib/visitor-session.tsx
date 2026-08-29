"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearVisitorCache,
  ensureAnonId,
  loadVisitorCache,
  saveVisitorCache,
  setActiveOrg,
} from "@/lib/visitorCache";
import type { Member } from "@/lib/types";

type VisitorSessionValue = {
  ready: boolean;
  onboarded: boolean;
  memberId: string | null;
  confirm: (member: Member, accessToken?: string) => void;
  logout: () => void;
  refresh: () => void;
};

const VisitorSessionContext = createContext<VisitorSessionValue | null>(null);

export function VisitorSessionProvider({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);

  const refresh = () => {
    setActiveOrg(orgSlug);
    ensureAnonId(orgSlug);
    const cache = loadVisitorCache(orgSlug);
    setOnboarded(!!cache?.memberId);
    setMemberId(cache?.memberId || null);
    setReady(true);
  };

  useLayoutEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  const confirm = (member: Member, accessToken?: string) => {
    saveVisitorCache(
      {
        id: member.id,
        phone: member.phone,
        firstName: member.firstName,
        lastName: member.lastName,
        visitorNumber: member.visitorNumber,
      },
      accessToken,
      orgSlug
    );
    setOnboarded(true);
    setMemberId(member.id);
  };

  const logout = () => {
    clearVisitorCache(orgSlug);
    setOnboarded(false);
    setMemberId(null);
  };

  return (
    <VisitorSessionContext.Provider
      value={{ ready, onboarded, memberId, confirm, logout, refresh }}
    >
      {children}
    </VisitorSessionContext.Provider>
  );
}

export function useVisitorSession() {
  const ctx = useContext(VisitorSessionContext);
  if (!ctx) {
    throw new Error("useVisitorSession must be used inside VisitorSessionProvider");
  }
  return ctx;
}
