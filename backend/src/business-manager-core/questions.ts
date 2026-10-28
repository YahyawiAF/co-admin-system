import type { AnswerRecord, Choice, MoneyFacts, MoneyKey, Question } from './types';

export const dt = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ')} DT`;
export const dayLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const DAY_MS = 86_400_000;

/** Ranges: money you have counts at the low end, costs at the high end (prudence). */
const low = (from: number, to: number | null): Choice => ({
  label: to == null ? `Plus de ${dt(from)}` : from === 0 ? `Moins de ${dt(to)}` : `${dt(from).replace(' DT', '')} – ${dt(to)}`,
  value: from,
  note: from === 0 ? 'compté 0 DT (bas de la fourchette)' : `compté ${dt(from)} (bas de la fourchette)`,
});
const high = (from: number, to: number): Choice => ({
  label: from === 0 ? `Moins de ${dt(to)}` : `${dt(from).replace(' DT', '')} – ${dt(to)}`,
  value: to,
  note: `compté ${dt(to)} (haut de la fourchette, par prudence)`,
});

type Def = {
  key: MoneyKey;
  short: string;
  /** Order of the questions: how much the answer changes "how much can I invest". */
  weight: number;
  /** After this many days the answer is asked again (null = never). */
  maxAgeDays: number | null;
  /** The app already knows it: never ask. */
  known: (f: MoneyFacts) => boolean;
  build: (f: MoneyFacts, prev?: AnswerRecord) => Omit<Question, 'key' | 'short' | 'reason' | 'priority'>;
};

const DEFS: Def[] = [
  {
    key: 'bank',
    short: 'Banque',
    weight: 100,
    maxAgeDays: 30,
    known: (f) => !!f.bank,
    build: (_f, prev) => ({
      title:
        prev && !prev.unknown && prev.value != null
          ? `Le compte bancaire était à ${dt(prev.value)} le ${dayLabel(prev.answeredAt)}. Et aujourd'hui ?`
          : "Combien il y a sur le compte bancaire de l'espace aujourd'hui ?",
      why: "L'app ne voit pas la banque. Sans ce chiffre, je ne peux pas dire combien investir.",
      choices: [low(0, 3000), low(3000, 8000), low(8000, 15000), low(15000, null), { label: 'Pas de compte pro', value: 0, note: '0 DT' }],
      exactLabel: 'Montant exact :',
      unknownLabel: 'Je dois vérifier',
    }),
  },
  {
    key: 'safe',
    short: 'Coffre',
    weight: 90,
    maxAgeDays: 30,
    known: (f) => f.safe.hasMovements,
    build: (f) => ({
      title: `L'app indique ${dt(f.safe.amount)} dans le coffre. C'est juste ?`,
      why: "Aucun mouvement de coffre n'est enregistré, je préfère vérifier.",
      choices: [{ label: `Oui, ${dt(f.safe.amount)}`, value: f.safe.amount, note: 'confirmé' }],
      exactLabel: 'Non, il y a :',
      unknownLabel: 'Je ne sais pas',
    }),
  },
  {
    key: 'charges',
    short: 'Charges fixes / mois',
    weight: 80,
    maxAgeDays: 180,
    known: (f) => !!f.fixedCharges?.count,
    build: (f) => ({
      title: "Vos charges fixes par mois (loyer, STEG, SONEDE, internet…), c'est environ ?",
      why: "Aucune charge n'est saisie dans l'app. C'est la base de la réserve.",
      choices: [high(0, 2000), high(2000, 4000), high(4000, 6000)],
      exactLabel: 'Montant exact :',
      unknownLabel: 'Je ne sais pas',
      more: f.links?.fixedCharges ? { label: 'Les saisir une par une', href: f.links.fixedCharges } : undefined,
    }),
  },
  {
    key: 'payroll',
    short: 'Salaires + CNSS / mois',
    weight: 70,
    maxAgeDays: 180,
    known: (f) => !!f.payroll,
    build: () => ({
      title: 'Salaires + CNSS payés chaque mois, au total ?',
      why: "C'est de l'argent à garder avant tout investissement.",
      choices: [{ label: 'Aucun salarié', value: 0, note: '0 DT' }, high(0, 1000), high(1000, 2000)],
      exactLabel: 'Montant exact :',
      unknownLabel: 'Je ne sais pas',
    }),
  },
  {
    key: 'taxes',
    short: 'Impôts / TVA (3 mois)',
    weight: 60,
    maxAgeDays: 90,
    known: () => false,
    build: () => ({
      title: 'Impôts ou TVA à payer dans les 3 prochains mois ?',
      why: "Cet argent n'est pas à vous : je le mets de côté.",
      choices: [{ label: 'Rien', value: 0, note: '0 DT' }, high(0, 500), high(500, 1500)],
      exactLabel: 'Montant exact :',
      unknownLabel: 'Je ne sais pas, je demande au comptable',
    }),
  },
  {
    key: 'promised',
    short: 'Déjà promis (30 j)',
    weight: 50,
    maxAgeDays: 30,
    known: () => false,
    build: () => ({
      title: 'Des achats ou dettes déjà promis pour les 30 prochains jours ?',
      why: 'Pour ne pas compter deux fois le même argent.',
      choices: [{ label: 'Non, rien', value: 0, note: '0 DT' }],
      exactLabel: 'Oui, environ :',
      unknownLabel: 'Je ne sais pas',
    }),
  },
  {
    key: 'reserve',
    short: 'Réserve',
    weight: 40,
    maxAgeDays: null,
    known: () => false,
    build: () => ({
      title: 'Combien de mois de charges voulez-vous garder de côté ?',
      why: "Si un mois est mauvais, l'espace tient quand même.",
      choices: [
        { label: '1 mois', value: 1 },
        { label: '2 mois', value: 2, recommended: true },
        { label: '3 mois', value: 3 },
      ],
    }),
  },
];

export const QUESTION_SHORT: Record<MoneyKey, string> = Object.fromEntries(DEFS.map((d) => [d.key, d.short])) as Record<
  MoneyKey,
  string
>;

/** Questions kept for the coming legal tab, shown in the queue only. */
export const LEGAL_PREVIEW = [
  { title: "Forme juridique de l'espace", detail: 'Personne physique, SUARL, SARL…' },
  { title: 'Régime fiscal', detail: 'Forfaitaire ou réel' },
  { title: "Déclaration d'existence faite ?", detail: "Avec le document si vous l'avez" },
];

export function isStale(key: MoneyKey, a: AnswerRecord, now: Date) {
  const def = DEFS.find((d) => d.key === key);
  return !!def?.maxAgeDays && now.getTime() - a.answeredAt.getTime() > def.maxAgeDays * DAY_MS;
}

/**
 * The questions still worth asking, most useful first.
 * Never asks what the app knows; asks again when an answer is too old.
 * An "I don't know" answer stays at the end of the queue (asked again, but after the rest).
 */
export function pendingQuestions(facts: MoneyFacts, answers: Map<string, AnswerRecord>): Question[] {
  const out: Question[] = [];
  for (const d of DEFS) {
    if (d.known(facts)) continue;
    const prev = answers.get(d.key);
    let reason: Question['reason'];
    if (!prev) reason = 'MISSING';
    else if (prev.unknown) reason = 'UNKNOWN';
    else if (isStale(d.key, prev, facts.asOf)) reason = 'STALE';
    else continue;
    const factor = reason === 'MISSING' ? 1 : reason === 'STALE' ? 0.6 : 0.3;
    out.push({ key: d.key, short: d.short, reason, priority: Math.round(d.weight * factor), ...d.build(facts, prev) });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/** Every question the app cannot answer itself, to change an answer already given. */
export function editableQuestions(facts: MoneyFacts, answers: Map<string, AnswerRecord>): Question[] {
  return DEFS.filter((d) => !d.known(facts)).map((d) => ({
    key: d.key,
    short: d.short,
    reason: answers.get(d.key)?.unknown ? ('UNKNOWN' as const) : ('MISSING' as const),
    priority: d.weight,
    ...d.build(facts),
  }));
}

/** How much the manager knows: money items covered by the app or a fresh answer, out of all items. */
export function knowledge(facts: MoneyFacts, answers: Map<string, AnswerRecord>) {
  const known = DEFS.filter((d) => {
    if (d.known(facts)) return true;
    const a = answers.get(d.key);
    return !!a && !a.unknown && !isStale(d.key, a, facts.asOf);
  }).length;
  return { known, total: DEFS.length + LEGAL_PREVIEW.length };
}

export function isMoneyKey(k: string): k is MoneyKey {
  return DEFS.some((d) => d.key === k);
}
