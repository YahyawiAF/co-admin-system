/**
 * Where a survey respondent came from: pure rules, no Prisma.
 * A tracked link code (checked server-side) beats UTM parameters, which beat nothing.
 * The first known source is kept for `attributionDays`; a plain revisit never erases it.
 */

export type AttributionMethod = 'LINK' | 'UTM' | 'DIRECT';
export const DIRECT_SOURCE = 'direct_or_unknown';

export type Attribution = {
  linkId: string | null;
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  method: AttributionMethod;
};

export type UtmParams = {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
};

/** A survey link that passed the server check (right kind, right survey). */
export type TrackedLink = {
  id: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  channel: string;
};

export type StoredVisit = Attribution & { firstSeenAt: Date };

/** Lower-case token safe to store and group by; anything else is dropped. */
export function cleanToken(v: unknown, max = 40): string | null {
  if (typeof v !== 'string') return null;
  const t = v
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
  return t || null;
}

const DIRECT: Attribution = {
  linkId: null,
  source: DIRECT_SOURCE,
  medium: null,
  campaign: null,
  content: null,
  term: null,
  method: 'DIRECT',
};

/** What this single visit says, before looking at earlier visits. */
export function attributionFromVisit(
  link: TrackedLink | null,
  utm: UtmParams = {},
): Attribution {
  if (link) {
    return {
      linkId: link.id,
      source: cleanToken(link.source) || cleanToken(link.channel) || 'link',
      medium: cleanToken(link.medium),
      campaign: cleanToken(link.campaign, 80),
      // The link fixes source/medium/campaign; content/term may vary per post
      content: cleanToken(link.content, 80) || cleanToken(utm.utm_content, 80),
      term: cleanToken(link.term, 80) || cleanToken(utm.utm_term, 80),
      method: 'LINK',
    };
  }
  const source = cleanToken(utm.utm_source);
  if (!source) return { ...DIRECT };
  return {
    linkId: null,
    source,
    medium: cleanToken(utm.utm_medium),
    campaign: cleanToken(utm.utm_campaign, 80),
    content: cleanToken(utm.utm_content, 80),
    term: cleanToken(utm.utm_term, 80),
    method: 'UTM',
  };
}

/**
 * Merge this visit with what the server already knows about the browser.
 * - known source still inside the window → kept (first touch)
 * - nothing known yet, or the window expired → this visit's source
 */
export function resolveAttribution(
  incoming: Attribution,
  existing: StoredVisit | null,
  attributionDays: number,
  now = new Date(),
): { attribution: Attribution; replaced: boolean } {
  if (!existing) return { attribution: incoming, replaced: true };
  const ageMs = now.getTime() - existing.firstSeenAt.getTime();
  const inWindow = ageMs <= attributionDays * 24 * 3600 * 1000;
  const keep: Attribution = {
    linkId: existing.linkId,
    source: existing.source,
    medium: existing.medium,
    campaign: existing.campaign,
    content: existing.content,
    term: existing.term,
    method: existing.method,
  };
  if (existing.method !== 'DIRECT' && inWindow)
    return { attribution: keep, replaced: false };
  if (incoming.method !== 'DIRECT')
    return { attribution: incoming, replaced: true };
  // Plain visit: an expired campaign no longer gets the credit
  if (existing.method !== 'DIRECT' && !inWindow)
    return { attribution: { ...DIRECT }, replaced: true };
  return { attribution: keep, replaced: false };
}

/** Link presets offered in the admin, so nobody types UTM parameters by hand. */
export const LINK_PRESETS = {
  instagram_story: {
    label: 'Instagram — Story',
    channel: 'INSTAGRAM_STORY',
    source: 'instagram',
    medium: 'story',
  },
  instagram_bio: {
    label: 'Instagram — Lien en bio',
    channel: 'INSTAGRAM_POST',
    source: 'instagram',
    medium: 'bio',
  },
  instagram_post: {
    label: 'Instagram — Post / Reel',
    channel: 'INSTAGRAM_POST',
    source: 'instagram',
    medium: 'post',
  },
  whatsapp_community: {
    label: 'WhatsApp — Groupe',
    channel: 'WHATSAPP',
    source: 'whatsapp',
    medium: 'community',
  },
  whatsapp_message: {
    label: 'WhatsApp — Message',
    channel: 'WHATSAPP',
    source: 'whatsapp',
    medium: 'message',
  },
  facebook: {
    label: 'Facebook',
    channel: 'FACEBOOK',
    source: 'facebook',
    medium: 'post',
  },
  club: {
    label: 'Club universitaire',
    channel: 'PARTNER',
    source: 'club',
    medium: 'partner',
  },
  qr_poster: {
    label: 'Affiche QR',
    channel: 'QR',
    source: 'qr',
    medium: 'poster',
  },
  other: {
    label: 'Autre',
    channel: 'OTHER',
    source: 'other',
    medium: 'referral',
  },
} as const;
export type LinkPreset = keyof typeof LINK_PRESETS;
