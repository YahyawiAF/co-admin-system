"use client";

/**
 * PIN is no longer forced on PWA open.
 * Light visitors stay without PIN; upgrade via AccountUpgradeCard on Profil.
 * Kept as a no-op so existing imports do not break.
 */
export function PinSetupGate() {
  return null;
}
