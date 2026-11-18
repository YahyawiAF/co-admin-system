/**
 * The app's eyes and legs, as the brain sees them. The host app fills the catalogue;
 * the brain (Claude) only names eyes and legs from it. Plain types, no host words.
 */

/** One parameter an eye accepts. `values` = the only allowed values; none = free text or number. */
export type EyeParam = {
  name: string;
  label: string;
  values?: string[];
  /** 'hour' = 0–24, 'text' = up to 80 characters */
  type?: 'text' | 'hour';
};

/**
 * Something the app can measure by itself, day by day.
 * sum: the days add up (money, sales). ratio: value ÷ base over the period, in % (e.g. visits with a coffee).
 * mean: value ÷ base over the period, as is (e.g. hours per visit).
 */
export type EyeSpec = {
  id: string;
  label: string;
  unit: string;
  aggregate: 'sum' | 'ratio' | 'mean';
  params: EyeParam[];
  /** What the split keys mean (e.g. « canal »), when the eye splits its days */
  splitBy?: string;
  help: string;
};

/** One day of an eye. For a ratio or mean eye, value = numerator and base = denominator. */
export type EyeDay = {
  day: string;
  value: number;
  base?: number;
  split?: Record<string, number>;
};

export type EyeParams = Record<string, string | number>;

/** An action the app can take. `needsOk` = waits for the owner before anything changes. */
export type LegSpec = {
  kind: string;
  label: string;
  needsOk: boolean;
  /** Draft fields the brain fills (same shape for every kind keeps the format simple) */
  fields: string;
};

/**
 * Keeps only the params an eye knows, with allowed values. Returns null when a
 * param has a value outside its list (the brain asked for something the app can't see).
 */
export function checkParams(spec: EyeSpec, raw: unknown): EyeParams | null {
  const out: EyeParams = {};
  const x = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (const p of spec.params) {
    const v = x[p.name];
    if (v === undefined || v === null || v === '') continue;
    if (p.values) {
      if (typeof v !== 'string' || !p.values.includes(v)) return null;
      out[p.name] = v;
    } else if (p.type === 'hour') {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < 0 || n > 24) return null;
      out[p.name] = n;
    } else {
      if (typeof v !== 'string' && typeof v !== 'number') return null;
      const s = String(v).trim().slice(0, 80);
      if (s) out[p.name] = s;
    }
  }
  return out;
}

/** « Ventes café · canal app · 8h–12h »: what a watch or a look reads, for people. */
export function eyeLabel(spec: EyeSpec, params: EyeParams) {
  const parts = spec.params
    .filter((p) => params[p.name] !== undefined)
    .map((p) => (p.type === 'hour' ? `${p.label} ${params[p.name]}h` : `${p.label} ${params[p.name]}`));
  return [spec.label, ...parts].join(' · ');
}
