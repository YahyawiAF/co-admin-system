import type { AnswerRecord, MoneyFacts } from './types';

/**
 * The manager asks for a tool when it keeps asking the owner for a figure the app could record.
 * It only drafts the request: the owner approves it, a developer builds it. Nothing changes by itself.
 */
export type FeatureIdea = {
  key: string;
  title: string;
  problem: string;
  capability: string;
  test: string;
};

type Rule = FeatureIdea & { when: (f: MoneyFacts, a: Map<string, AnswerRecord>) => boolean };

const answered = (a: Map<string, AnswerRecord>, k: string) => {
  const r = a.get(k);
  return !!r && !r.unknown && r.value != null;
};

const RULES: Rule[] = [
  {
    key: 'bank-balance-at-close',
    title: 'Saisir le solde banque à la clôture de caisse',
    problem: "Je ne vois pas la banque, je dois vous la demander chaque mois.",
    capability: "Un champ « Solde banque » (facultatif) à la clôture de caisse, gardé avec sa date.",
    test: "Clôturer la caisse avec un solde : l'onglet Argent se calcule sans poser la question de la banque.",
    when: (f, a) => !f.bank && answered(a, 'bank'),
  },
  {
    key: 'payroll-in-app',
    title: "Enregistrer les salaires et la CNSS dans l'app",
    problem: 'Je ne vois pas les salaires, je dois vous les demander.',
    capability: 'Une charge « Salaires + CNSS » par mois, avec le jour de paiement.',
    test: "Saisir les salaires du mois : la question disparaît et l'onglet Argent les utilise.",
    when: (f, a) => !f.payroll && answered(a, 'payroll') && (a.get('payroll')!.value ?? 0) > 0,
  },
];

export function featureIdeas(facts: MoneyFacts, answers: Map<string, AnswerRecord>): FeatureIdea[] {
  return RULES.filter((r) => r.when(facts, answers)).map(({ when: _when, ...idea }) => idea);
}

/** The ticket handed to a developer (or Claude Code) once the owner approves. */
export function ticketMarkdown(idea: FeatureIdea, approvedAt: Date) {
  return [
    `# ${idea.title}`,
    '',
    `Approuvé par le propriétaire le ${approvedAt.toISOString().slice(0, 10)}.`,
    '',
    '## Problème',
    idea.problem,
    '',
    '## Ce qu\'il faut ajouter',
    idea.capability,
    '',
    '## Test d\'acceptation',
    `- ${idea.test}`,
    '- Les calculs existants donnent le même résultat quand le nouveau champ est vide.',
    '',
    '## Règles',
    '- Pas de migration destructive ; colonnes nouvelles seulement.',
    '- Tests ajoutés pour le calcul ; revue humaine avant mise en production.',
  ].join('\n');
}
