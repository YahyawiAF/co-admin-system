import { AsyncLocalStorage } from 'async_hooks';
import type { DeleteMode, StaffModule } from '../src/modules/staff/permissions';

/**
 * Per-request data shared with code that has no access to the request
 * (Prisma middleware). Filled by StaffAccessGuard for STAFF users only.
 */
export type RequestContextStore = {
  isStaff?: boolean;
  userId?: string;
  organizationId?: string | null;
  module?: StaffModule;
  deleteMode?: DeleteMode;
  path?: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export const RequestContext = {
  run<T>(fn: () => T): T {
    return storage.run({}, fn);
  },
  get(): RequestContextStore | undefined {
    return storage.getStore();
  },
};
