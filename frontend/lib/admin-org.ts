const ADMIN_ORG_KEY = "admin_organization_id";

export function getAdminOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_ORG_KEY);
}

export function setAdminOrganizationId(id: string | null) {
  if (typeof window === "undefined") return;
  if (!id) localStorage.removeItem(ADMIN_ORG_KEY);
  else localStorage.setItem(ADMIN_ORG_KEY, id);
}

export function withOrgQuery(url: string, organizationId?: string | null) {
  const orgId = organizationId ?? getAdminOrganizationId();
  if (!orgId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}organizationId=${encodeURIComponent(orgId)}`;
}
