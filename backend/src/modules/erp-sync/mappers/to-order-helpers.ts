/** Shared helpers for the Journal/Abonnement/DailyProduct → Order mappers. */

/** Order line items need a non-empty sku; co-admin tariffs/products don't have one. */
export function slugSku(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'SERVICE';
}
