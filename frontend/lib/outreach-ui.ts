import { BellRing, Camera, MessageCircle, Phone, UserRound, Users, X } from "lucide-react";
import type { OutreachChannel } from "@/lib/types";

/** How a member was reached: label for lists, short verb for buttons, icon. */
export const CHANNEL_UI: Record<OutreachChannel, { label: string; button: string; icon: typeof Phone }> = {
  WHATSAPP: { label: "WhatsApp", button: "WhatsApp", icon: MessageCircle },
  PERSON: { label: "en personne", button: "Dit en personne", icon: UserRound },
  CALL: { label: "appel", button: "J'ai appelé", icon: Phone },
  INSTAGRAM: { label: "Instagram", button: "Instagram DM", icon: Camera },
  GROUP: { label: "groupe / statut", button: "Groupe / statut WhatsApp", icon: Users },
  PUSH: { label: "notification", button: "Notification app", icon: BellRing },
  SKIP: { label: "ignoré", button: "Ignorer", icon: X },
};

/** Ways the staff can say "I contacted them" (WhatsApp and push also have their own send buttons). */
export const MANUAL_CHANNELS: OutreachChannel[] = ["PERSON", "CALL", "WHATSAPP", "INSTAGRAM", "GROUP"];

export const channelLabel = (c: string) => CHANNEL_UI[c as OutreachChannel]?.label ?? c;
