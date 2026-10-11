/** Café menu items that count as a drink (energy boost suggestions). */
const DRINK_RE =
  /caf[eé]|coffee|espresso|express|latte|cappuccino|capucin|nespresso|th[eé]\b|tea|infusion|boisson|jus|juice|soda|cola|energy|red ?bull|smoothie|chocolat|milkshake|citronnade|limonade|eau|water/;

export function isDrink(name: string, description?: string | null) {
  return DRINK_RE.test(`${name} ${description || ""}`.toLowerCase());
}
