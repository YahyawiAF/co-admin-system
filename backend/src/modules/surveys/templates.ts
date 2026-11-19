import {
  DEFAULT_SETTINGS,
  OTHER,
  type SurveyQuestion,
  type SurveySettings,
} from './survey-schema';

export type SurveyTemplate = {
  code: string;
  name: string;
  slug: string;
  title: string;
  intro: string;
  description: string;
  purpose: string;
  audience: string;
  questions: SurveyQuestion[];
  settings: SurveySettings;
};

const SUBJECTS = [
  { value: 'english', label: 'Anglais (parler)', emoji: '🇬🇧' },
  { value: 'french', label: 'Français (parler)', emoji: '🇫🇷' },
  { value: 'programming', label: 'Informatique / programmation', emoji: '💻' },
  { value: 'maths', label: 'Maths et matières scolaires', emoji: '📐' },
  { value: 'tech', label: 'Compétences techniques', emoji: '🛠️' },
  { value: 'cv', label: 'CV et entretien', emoji: '💼' },
  { value: OTHER, label: 'Autre', emoji: '✨' },
];

const SHARE = { questionId: 'role', anyOf: ['SHARE', 'BOTH'] };

/** First template: Collabora Learn & Share (students helping students, for free). */
const LEARN_SHARE: SurveyTemplate = {
  code: 'learn_share',
  name: 'Collabora Learn & Share',
  slug: 'learn-and-share',
  title: 'Learn & Share — apprendre et partager entre étudiants',
  intro:
    'Collabora Hub organise des séances gratuites où des étudiants s’entraident : langues, informatique, maths… Dis-nous ce que tu veux apprendre ou partager. 2 minutes, sans compte.',
  description: 'Séances gratuites entre étudiants à Collabora Hub.',
  purpose:
    'Valider la demande et trouver des volontaires pour des séances d’apprentissage entre pairs.',
  audience: 'Étudiants (université, lycée), jeunes professionnels',
  settings: {
    ...DEFAULT_SETTINGS,
    sections: [
      {
        id: 'a',
        title: 'Vos envies',
        description: 'Ce que tu aimerais apprendre, et quand tu es libre.',
      },
      {
        id: 'b',
        title: 'Partager tes connaissances',
        description:
          'Aucun diplôme requis : on parle d’entraide entre étudiants, pas de cours magistral.',
      },
    ],
    successMessage:
      'Merci ! Nous organisons les premières séances selon les réponses. Si tu as laissé ton WhatsApp, on te prévient.',
  },
  questions: [
    {
      id: 'role',
      say: 'Salut ! On commence facile 😄',
      section: 'a',
      type: 'single',
      label: 'Tu veux plutôt…',
      required: true,
      tag: 'role',
      options: [
        { value: 'LEARN', label: 'Apprendre avec d’autres étudiants', emoji: '📚' },
        { value: 'SHARE', label: 'Partager ce que je sais', emoji: '🤝' },
        { value: 'BOTH', label: 'Les deux', emoji: '🔁' },
      ],
    },
    {
      id: 'learn_subjects',
      say: 'Choisis tout ce qui te fait envie !',
      section: 'a',
      type: 'multi',
      label: 'Qu’aimerais-tu apprendre ?',
      help: 'Plusieurs choix possibles.',
      required: true,
      allowOther: true,
      tag: 'learnSubjects',
      options: SUBJECTS,
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
    },
    {
      id: 'level',
      say: 'Pas de honte, on est tous passés par là 😉',
      section: 'a',
      type: 'single',
      label: 'Ton niveau actuel ?',
      required: false,
      tag: 'level',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'beginner', label: 'Débutant', emoji: '🐣' },
        { value: 'intermediate', label: 'Intermédiaire', emoji: '🚀' },
        { value: 'advanced', label: 'Avancé', emoji: '🧠' },
        { value: 'unsure', label: 'Je ne sais pas', emoji: '🤷' },
      ],
    },
    {
      id: 'format',
      say: 'Comment tu apprends le mieux ?',
      section: 'a',
      type: 'multi',
      label: 'Quel format préfères-tu ?',
      required: false,
      tag: 'format',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'small_group', label: 'Petit groupe', emoji: '👥' },
        { value: 'conversation', label: 'Séance de conversation', emoji: '💬' },
        { value: 'workshop', label: 'Atelier pratique', emoji: '🧪' },
        { value: 'study_group', label: 'Groupe d’étude', emoji: '📖' },
      ],
    },
    {
      id: 'days',
      say: 'Plus que quelques-unes, tu gères 💪',
      section: 'a',
      type: 'multi',
      label: 'Quels jours t’arrangent ?',
      required: true,
      tag: 'days',
      options: [
        { value: 'weekdays', label: 'En semaine', emoji: '📅' },
        { value: 'saturday', label: 'Samedi', emoji: '🎉' },
        { value: 'sunday', label: 'Dimanche', emoji: '☕' },
        { value: 'flexible', label: 'Flexible', emoji: '🌀' },
      ],
    },
    {
      id: 'times',
      say: 'Lève-tôt ou couche-tard ? 🦉',
      section: 'a',
      type: 'multi',
      label: 'Quels moments ?',
      required: true,
      tag: 'times',
      options: [
        { value: 'morning', label: 'Matin', emoji: '🌅' },
        { value: 'afternoon', label: 'Après-midi', emoji: '☀️' },
        { value: 'evening', label: 'Soir', emoji: '🌙' },
      ],
    },
    {
      id: 'attend',
      say: 'Question piège… non je rigole 😆',
      section: 'a',
      type: 'single',
      label: 'Si une séance qui te convient est organisée, tu viendrais ?',
      required: true,
      tag: 'attend',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'yes', label: 'Oui, sûrement', emoji: '🙋' },
        { value: 'maybe', label: 'Peut-être, selon l’horaire', emoji: '🤔' },
        { value: 'exploring', label: 'Je regarde juste', emoji: '👀' },
      ],
    },
    {
      id: 'teach_subjects',
      say: 'À toi de briller ✨',
      section: 'b',
      type: 'multi',
      label: 'Dans quoi peux-tu aider les autres ?',
      required: true,
      allowOther: true,
      tag: 'teachSubjects',
      options: SUBJECTS,
      showIf: SHARE,
    },
    {
      id: 'teach_experience',
      say: 'Deux lignes suffisent, promis ✍️',
      section: 'b',
      type: 'long',
      label: 'Ton expérience en quelques mots',
      help: 'Ex. : « 3e année info, je code en Python depuis 2 ans ».',
      required: false,
      showIf: SHARE,
    },
    {
      id: 'teach_time',
      say: 'Même une seule séance, c’est top 🙌',
      section: 'b',
      type: 'single',
      label: 'Combien de temps peux-tu donner ?',
      required: true,
      tag: 'teachTime',
      showIf: SHARE,
      options: [
        { value: 'once', label: 'Une séance pour essayer', emoji: '🎯' },
        { value: 'monthly', label: '1 à 2 heures par mois', emoji: '🗓️' },
        { value: 'weekly', label: '1 à 2 heures par semaine', emoji: '⚡' },
        { value: 'more', label: 'Plus', emoji: '🏆' },
      ],
    },
    {
      id: 'teach_slots',
      say: 'Dernière ligne droite 🏁',
      section: 'b',
      type: 'availability',
      label: 'Quand es-tu disponible ?',
      help: 'Touche les cases qui t’arrangent.',
      required: false,
      tag: 'teachSlots',
      showIf: SHARE,
    },
    {
      id: 'host',
      say: 'Et si tu devenais le héros du samedi ? 🦸',
      section: 'b',
      type: 'single',
      label: 'Animer une séance gratuite à Collabora Hub t’intéresse ?',
      help: 'Les volontaires peuvent recevoir une offre coworking (ex. une semaine offerte) après la séance convenue.',
      required: true,
      tag: 'host',
      showIf: SHARE,
      options: [
        { value: 'yes', label: 'Oui', emoji: '🙋' },
        { value: 'maybe', label: 'Peut-être, j’aimerais en savoir plus', emoji: '🤔' },
        { value: 'no', label: 'Pas pour l’instant', emoji: '🙅' },
      ],
    },
  ],
};

export const SURVEY_TEMPLATES: SurveyTemplate[] = [LEARN_SHARE];

export function findTemplate(
  code: string | undefined,
): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES.find((t) => t.code === code);
}
