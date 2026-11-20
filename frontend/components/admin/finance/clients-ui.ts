import type { ClientSegment, OutreachReason } from "@/lib/types";

/**
 * Finance › Clients: one colour per group (ring chart, dots, badges).
 * Chart colours checked for colour-blind readers; badges always carry the label too.
 */
export const SEGMENT_UI: Record<ClientSegment, { label: string; color: string; badge: string }> = {
  NEW: {
    label: "Nouveau",
    color: "#2a78d6",
    badge: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200",
  },
  OCCASIONAL: {
    label: "Occasionnel",
    color: "#eda100",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  },
  REGULAR: {
    label: "Régulier",
    color: "#1baf7a",
    badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  AT_RISK: {
    label: "À risque",
    color: "#e34948",
    badge: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
  },
  INACTIVE: {
    label: "Inactif",
    color: "#94a3b8",
    badge: "bg-slate-200 text-slate-900 dark:bg-slate-500/25 dark:text-slate-200",
  },
};

export const SEGMENT_ORDER: ClientSegment[] = ["NEW", "OCCASIONAL", "REGULAR", "AT_RISK", "INACTIVE"];

export const HEARD_FROM_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FRIEND: "Un ami",
  SCHOOL: "École / université",
  WALK_BY: "Passage devant",
  OTHER: "Autre",
};

/** Reason logged when staff write to a client without a suggested action. */
export const DEFAULT_REASON: Record<ClientSegment, OutreachReason> = {
  NEW: "WELCOME",
  OCCASIONAL: "NEWS",
  REGULAR: "NEWS",
  AT_RISK: "INACTIVE",
  INACTIVE: "WINBACK",
};

/** Campaign message to start from, per group ({…} filled for each client). */
export const CAMPAIGN_TEMPLATE: Record<ClientSegment, string> = {
  NEW: "Bonjour {prenom}, merci d'être passé(e) chez {espace} ! Votre place vous attend quand vous voulez.",
  OCCASIONAL: "Bonjour {prenom}, petite nouvelle de {espace} : on serait ravis de vous revoir bientôt.",
  REGULAR: "Bonjour {prenom}, merci pour vos {visites} visites ce mois-ci chez {espace} !",
  AT_RISK:
    "Bonjour {prenom}, on ne vous a pas vu depuis le {derniere_visite}. J'espère que tout va bien ! Votre coin vous attend chez {espace}.",
  INACTIVE: "Bonjour {prenom}, il y a du nouveau chez {espace} depuis votre dernière visite. Au plaisir de vous revoir.",
};

export const nf = (n: number) => n.toLocaleString("fr-FR");
