/** Modules a STAFF user can be given access to. */
export const STAFF_MODULES = [
  'journal',
  'reservations',
  'impayes',
  'abonnements',
] as const;
export type StaffModule = (typeof STAFF_MODULES)[number];

/** none = cannot delete · hide = row disappears for the staff, admin decides · delete = real delete (logged) */
export type DeleteMode = 'none' | 'hide' | 'delete';

export type ModulePermission = {
  read: boolean;
  write: boolean;
  delete: DeleteMode;
};
export type StaffPermissions = Record<StaffModule, ModulePermission>;

export type StaffAction = 'read' | 'write' | 'delete';

const NO_ACCESS: ModulePermission = { read: false, write: false, delete: 'none' };

/** Coerce anything stored in the DB into a full, consistent permission set. */
export function normalizePermissions(raw: unknown): StaffPermissions {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    Partial<ModulePermission> | undefined
  >;
  const out = {} as StaffPermissions;
  for (const m of STAFF_MODULES) {
    const p = src[m] || {};
    const del: DeleteMode =
      p.delete === 'hide' || p.delete === 'delete' ? p.delete : 'none';
    const write = !!p.write;
    // Writing or deleting without seeing the data makes no sense.
    const read = !!p.read || write || del !== 'none';
    out[m] = read || write || del !== 'none' ? { read, write, delete: del } : { ...NO_ACCESS };
  }
  return out;
}

export function hasAnyAccess(perms: StaffPermissions): boolean {
  return STAFF_MODULES.some((m) => perms[m].read);
}

type Rule = {
  pattern: RegExp;
  methods?: string[];
};

const ALL = undefined;
const GET = ['GET', 'HEAD'];
const WRITE = ['POST', 'PATCH', 'PUT'];
const UUID = '[0-9a-f-]{36}';

/**
 * Endpoints each module needs. A request is allowed when at least one module
 * the staff member has the right action on lists a matching rule.
 * Paths are lower-cased and have no global prefix / query string.
 */
const MODULE_RULES: Record<StaffModule, Rule[]> = {
  journal: [
    { pattern: /^\/journal(\/|$)/, methods: ALL },
    { pattern: /^\/mobile\/admin\/(?!booking-requests)/, methods: ALL },
    { pattern: /^\/mobile\/session\//, methods: ALL },
    { pattern: /^\/mobile\//, methods: GET },
    { pattern: /^\/ops-events(\/|$)/, methods: GET },
    { pattern: /^\/booking(\/|$)/, methods: GET },
    { pattern: /^\/products\/daily(\/|$)/, methods: GET },
    { pattern: /^\/expenses\/daily(\/|$)/, methods: GET },
    // The journal shows who is a subscriber — list only, no edits.
    { pattern: /^\/abonnements(\/all)?$/, methods: GET },
    { pattern: /^\/members$/, methods: ['POST'] },
    { pattern: new RegExp(`^/members/${UUID}/ledger$`), methods: ['POST'] },
  ],
  reservations: [
    { pattern: /^\/mobile\/admin\/booking-requests(\/|$)/, methods: ALL },
    { pattern: /^\/mobile\/admin\/(book-space|move-seat)$/, methods: ALL },
    { pattern: /^\/booking(\/|$)/, methods: ALL },
    { pattern: /^\/journal$/, methods: ['POST'] },
    { pattern: /^\/members$/, methods: ['POST'] },
  ],
  impayes: [
    { pattern: /^\/members\/debtors$/, methods: GET },
    { pattern: /^\/members\/ledger\//, methods: ALL },
    { pattern: new RegExp(`^/members/${UUID}/ledger$`), methods: ALL },
    { pattern: new RegExp(`^/journal/${UUID}$`), methods: ['PATCH', 'DELETE'] },
    { pattern: new RegExp(`^/abonnements/${UUID}$`), methods: ['PATCH', 'DELETE'] },
    { pattern: new RegExp(`^/mobile/session/${UUID}/payment$`), methods: WRITE },
  ],
  abonnements: [
    { pattern: /^\/abonnements(\/|$)/, methods: ALL },
    { pattern: /^\/members$/, methods: ['POST'] },
  ],
};

/** Reference data every staff member with at least one module can read. */
const SHARED_READS: RegExp[] = [
  /^\/prices(\/|$)/,
  /^\/members(\/|$)(?!debtors)/,
  /^\/facilities(\/|$)/,
  /^\/products(\/|$)/,
  /^\/groups(\/|$)/,
  /^\/organizations(\/|$)/,
  /^\/analytics\/(performance\/)?offers/,
  /^\/promotions(\/|$)/,
];

/** Always reachable by a logged-in staff member. */
const ALWAYS: RegExp[] = [/^\/auth\//, /^\/staff\/me$/];

export function methodToAction(method: string): StaffAction {
  const m = method.toUpperCase();
  if (m === 'DELETE') return 'delete';
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'read';
  return 'write';
}

function grants(p: ModulePermission, action: StaffAction) {
  if (action === 'read') return p.read;
  if (action === 'write') return p.write;
  return p.delete !== 'none';
}

export type AccessDecision =
  | { allowed: true; module?: StaffModule; deleteMode?: DeleteMode }
  | { allowed: false; reason: string };

export function authorize(
  perms: StaffPermissions,
  method: string,
  path: string,
  hint?: string | null,
): AccessDecision {
  if (method.toUpperCase() === 'OPTIONS') return { allowed: true };
  if (ALWAYS.some((r) => r.test(path))) return { allowed: true };

  const action = methodToAction(method);
  const upper = method.toUpperCase();

  const matching = STAFF_MODULES.filter((m) =>
    MODULE_RULES[m].some(
      (r) => r.pattern.test(path) && (!r.methods || r.methods.includes(upper)),
    ),
  );
  const granted = matching.filter((m) => grants(perms[m], action));

  if (granted.length) {
    const module =
      hint && (granted as string[]).includes(hint)
        ? (hint as StaffModule)
        : granted[0];
    return { allowed: true, module, deleteMode: perms[module].delete };
  }

  if (action === 'read' && hasAnyAccess(perms) && SHARED_READS.some((r) => r.test(path))) {
    return { allowed: true };
  }

  if (matching.length) {
    const verb =
      action === 'read' ? 'consulter' : action === 'write' ? 'modifier' : 'supprimer';
    return {
      allowed: false,
      reason: `Vous n'avez pas le droit de ${verb} ici. Demandez l'accès à l'administrateur.`,
    };
  }
  return { allowed: false, reason: 'Accès réservé à l’administrateur.' };
}

/** Strip the optional global prefix and the query string, lower-case. */
export function normalizePath(url: string): string {
  let path = (url || '/').split('?')[0].toLowerCase();
  const prefix = (process.env.GLOBAL_PREFIX || '').replace(/^\/|\/$/g, '').toLowerCase();
  if (prefix && (path === `/${prefix}` || path.startsWith(`/${prefix}/`))) {
    path = path.slice(prefix.length + 1) || '/';
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path;
}
