const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /\/dashboard(\/|$)/,
  /\/journal(\/|$)/,
  /\/finance(\/|$)/,
  /\/analyse-jour(\/|$)/,
  /\/members(\/|$)/,
  /\/tarifs(\/|$)/,
  /\/abonnements(\/|$)/,
  /\/facility(\/|$)/,
  /\/products(\/|$)/,
  /\/expenses(\/|$)/,
];

export function isProtectedPath(pathname: string): boolean {
  if (!pathname) return false;
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}
