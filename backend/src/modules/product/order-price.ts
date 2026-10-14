/** Price charged per unit on a café order: the promotion price when one applied, else the product price. */
export function orderUnitPrice(o: {
  unitPrice?: number | null;
  product?: { sellingPrice?: number | null } | null;
}) {
  return o.unitPrice ?? o.product?.sellingPrice ?? 0;
}
