/** Which DB record a staff request touches, so it can be snapshotted / reverted. */
export type EntityType =
  | 'journal'
  | 'abonnement'
  | 'memberLedger'
  | 'seatBooking'
  | 'bookingRequest'
  | 'member'
  | 'other';

/** Rows that support "hide" (soft delete waiting for admin review). */
export const HIDEABLE: EntityType[] = ['journal', 'abonnement', 'memberLedger'];

/** Prisma model names filtered for staff when hidden. */
export const HIDEABLE_MODELS = new Set(['Journal', 'Abonnement', 'MemberLedger']);

const UUID = '([0-9a-f-]{36})';

const ROUTES: Array<{ re: RegExp; type: EntityType; idGroup?: number }> = [
  { re: new RegExp(`^/journal/${UUID}`), type: 'journal', idGroup: 1 },
  { re: /^\/journal$/, type: 'journal' },
  { re: new RegExp(`^/mobile/session/${UUID}`), type: 'journal', idGroup: 1 },
  { re: new RegExp(`^/abonnements/${UUID}`), type: 'abonnement', idGroup: 1 },
  { re: /^\/abonnements$/, type: 'abonnement' },
  { re: new RegExp(`^/members/ledger/${UUID}`), type: 'memberLedger', idGroup: 1 },
  { re: new RegExp(`^/members/${UUID}/ledger$`), type: 'memberLedger' },
  { re: new RegExp(`^/booking/${UUID}`), type: 'seatBooking', idGroup: 1 },
  { re: /^\/booking$/, type: 'seatBooking' },
  { re: new RegExp(`^/mobile/admin/booking-requests/${UUID}`), type: 'bookingRequest', idGroup: 1 },
  { re: /^\/members$/, type: 'member' },
];

export function resolveTarget(path: string): { type: EntityType; id?: string } {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) return { type: r.type, id: r.idGroup ? m[r.idGroup] : undefined };
  }
  return { type: 'other' };
}

export const ENTITY_LABEL: Record<EntityType, string> = {
  journal: 'Visite (journal)',
  abonnement: 'Abonnement',
  memberLedger: 'Dette / avoir',
  seatBooking: 'Réservation de place',
  bookingRequest: 'Demande de réservation',
  member: 'Membre',
  other: 'Opération',
};

/** Make a value JSON-safe for the audit log (Dates → ISO, drop functions). */
export function toJson(value: unknown): any {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}
