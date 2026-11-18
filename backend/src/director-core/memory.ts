/** The director's memory notes: kinds, corner ids and the « date | type | coin | texte » import. */

export const ENTRY_KINDS = ['DECISION', 'FACT', 'LESSON', 'TEST'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const KIND_LABEL: Record<EntryKind, string> = { DECISION: 'Décision', FACT: 'Fait', LESSON: 'Leçon', TEST: 'Test' };

export function cornerId(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'autre'
  );
}

export type ImportedEntry = { date: string; kind: EntryKind; corner: string; text: string; detail: string | null };

const KIND_WORDS: Record<string, EntryKind> = {
  decision: 'DECISION',
  fait: 'FACT',
  fact: 'FACT',
  lecon: 'LESSON',
  lesson: 'LESSON',
  test: 'TEST',
};

/**
 * Lines « 2026-11-10 | Décision | Prix & offres | Tarif 1h supprimé | détail » (detail optional).
 * Unknown corners become the owner's own corners. Returns the entries and the lines it could not read.
 */
export function parseImport(text: string, known: Array<{ id: string; name: string }>) {
  const entries: ImportedEntry[] = [];
  const skipped: string[] = [];
  const newCorners: Array<{ id: string; name: string }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|').map((p) => p.trim());
    const [date, kindWord, cornerName, body, detail] = parts;
    const kind = KIND_WORDS[cornerId(kindWord ?? '').replace(/-/g, '')];
    if (parts.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !kind || !cornerName || !body) {
      skipped.push(line);
      continue;
    }
    const id = cornerId(cornerName);
    const match = [...known, ...newCorners].find((c) => c.id === id || cornerId(c.name) === id);
    if (!match) newCorners.push({ id, name: cornerName });
    entries.push({ date, kind, corner: match?.id ?? id, text: body.slice(0, 300), detail: detail ? detail.slice(0, 500) : null });
  }
  return { entries, skipped, newCorners };
}
