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
  rememberVisitor,
  saveVisitorCache,
  setActiveOrg,
} from "@/lib/visitorCache";
import { restoreVisitor } from "@/lib/visitor-remember";
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
    // A storage/crypto failure must never leave the visitor on "Chargement…"
    let cache: ReturnType<typeof loadVisitorCache> = null;
    try {
      setActiveOrg(orgSlug);
      ensureAnonId(orgSlug);
      cache = loadVisitorCache(orgSlug);
    } catch {
      cache = null;
    }
    if (cache?.memberId) {
      setOnboarded(true);
      setMemberId(cache.memberId);
      setReady(true);
      // Keep the long-lived cookie fresh (also gives it to visitors logged in before it existed)
      rememberVisitor(orgSlug, cache.memberId);
      return;
    }
    // iPhone Safari may have wiped localStorage: get the visitor back from the cookie
    void restoreVisitor(orgSlug).then((id) => {
      setOnboarded(!!id);
      setMemberId(id);
      setReady(true);
    });
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
