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
  { value: 'english', label: 'Anglais (parler)' },
  { value: 'french', label: 'Français (parler)' },
  { value: 'programming', label: 'Informatique / programmation' },
  { value: 'maths', label: 'Maths et matières scolaires' },
  { value: 'tech', label: 'Compétences techniques' },
  { value: 'cv', label: 'CV et entretien' },
  { value: OTHER, label: 'Autre' },
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
      section: 'a',
      type: 'single',
      label: 'Tu veux plutôt…',
      required: true,
      tag: 'role',
      options: [
        { value: 'LEARN', label: 'Apprendre avec d’autres étudiants' },
        { value: 'SHARE', label: 'Partager ce que je sais' },
        { value: 'BOTH', label: 'Les deux' },
      ],
    },
    {
      id: 'learn_subjects',
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
      section: 'a',
      type: 'single',
      label: 'Ton niveau actuel ?',
      required: false,
      tag: 'level',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'beginner', label: 'Débutant' },
        { value: 'intermediate', label: 'Intermédiaire' },
        { value: 'advanced', label: 'Avancé' },
        { value: 'unsure', label: 'Je ne sais pas' },
      ],
    },
    {
      id: 'format',
      section: 'a',
      type: 'multi',
      label: 'Quel format préfères-tu ?',
      required: false,
      tag: 'format',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'small_group', label: 'Petit groupe' },
        { value: 'conversation', label: 'Séance de conversation' },
        { value: 'workshop', label: 'Atelier pratique' },
        { value: 'study_group', label: 'Groupe d’étude' },
      ],
    },
    {
      id: 'days',
      section: 'a',
      type: 'multi',
      label: 'Quels jours t’arrangent ?',
      required: true,
      tag: 'days',
      options: [
        { value: 'weekdays', label: 'En semaine' },
        { value: 'saturday', label: 'Samedi' },
        { value: 'sunday', label: 'Dimanche' },
        { value: 'flexible', label: 'Flexible' },
      ],
    },
    {
      id: 'times',
      section: 'a',
      type: 'multi',
      label: 'Quels moments ?',
      required: true,
      tag: 'times',
      options: [
        { value: 'morning', label: 'Matin' },
        { value: 'afternoon', label: 'Après-midi' },
        { value: 'evening', label: 'Soir' },
      ],
    },
    {
      id: 'attend',
      section: 'a',
      type: 'single',
      label: 'Si une séance qui te convient est organisée, tu viendrais ?',
      required: true,
      tag: 'attend',
      showIf: { questionId: 'role', anyOf: ['LEARN', 'BOTH'] },
      options: [
        { value: 'yes', label: 'Oui, sûrement' },
        { value: 'maybe', label: 'Peut-être, selon l’horaire' },
        { value: 'exploring', label: 'Je regarde juste' },
      ],
    },
    {
      id: 'teach_subjects',
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
      section: 'b',
      type: 'long',
      label: 'Ton expérience en quelques mots',
      help: 'Ex. : « 3e année info, je code en Python depuis 2 ans ».',
      required: false,
      showIf: SHARE,
    },
    {
      id: 'teach_time',
      section: 'b',
      type: 'single',
      label: 'Combien de temps peux-tu donner ?',
      required: true,
      tag: 'teachTime',
      showIf: SHARE,
      options: [
        { value: 'once', label: 'Une séance pour essayer' },
        { value: 'monthly', label: '1 à 2 heures par mois' },
        { value: 'weekly', label: '1 à 2 heures par semaine' },
        { value: 'more', label: 'Plus' },
      ],
    },
    {
      id: 'teach_slots',
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
      section: 'b',
      type: 'single',
      label: 'Animer une séance gratuite à Collabora Hub t’intéresse ?',
      help: 'Les volontaires peuvent recevoir une offre coworking (ex. une semaine offerte) après la séance convenue.',
      required: true,
      tag: 'host',
      showIf: SHARE,
      options: [
        { value: 'yes', label: 'Oui' },
        { value: 'maybe', label: 'Peut-être, j’aimerais en savoir plus' },
        { value: 'no', label: 'Pas pour l’instant' },
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
