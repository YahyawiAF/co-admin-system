import type { InitiativeChannel } from "@/lib/types";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Non-HTTPS origins have no clipboard API: fall back to a hidden textarea
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

/** Where an event is announced. */
export const CHANNEL_UI: Record<InitiativeChannel, string> = {
  INSTAGRAM_POST: "Post Instagram",
  INSTAGRAM_STORY: "Story Instagram",
  WHATSAPP: "WhatsApp",
  APP: "App membres",
  PARTNER: "Partenaire",
  WALK_IN: "À l'accueil",
};
