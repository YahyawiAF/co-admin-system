"use client";

import { createContext, useContext } from "react";

/**
 * While something must be read first (the space rules), other popups wait:
 * the shared Dialog / Sheet stay closed and open right after.
 * Default: nothing waits (admin and everywhere outside the visitor app).
 */
export const ModalGateContext = createContext<{ blocked: boolean }>({ blocked: false });

export function useModalGate() {
  return useContext(ModalGateContext).blocked;
}
