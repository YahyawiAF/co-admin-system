import Anthropic from '@anthropic-ai/sdk';

export const ADVISOR_MODEL = process.env.ADVISOR_MODEL || 'claude-opus-5-5';

export const RECOMMENDATION_CATEGORIES = [
  'NEW_REVENUE',
  'PROMO',
  'PRICING',
  'CAFE',
  'RETENTION',
  'OPERATIONS',
] as const;

export type AdvisorRecommendation = {
  category: (typeof RECOMMENDATION_CATEGORIES)[number];
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  title: string;
  evidence: string;
  actions: string[];
  expectedImpact: string;
  measure: string;
};

export type AdvisorResult = {
  summary: string;
  highlights: Array<{ trend: 'up' | 'down' | 'flat'; title: string; detail: string }>;
  recommendations: AdvisorRecommendation[];
  initiativeReviews: Array<{
    initiativeId: string;
    verdict: 'working' | 'not_working' | 'too_early';
    detail: string;
  }>;
  questions: string[];
};

const str = { type: 'string' };
export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'recommendations', 'initiativeReviews', 'questions'],
  properties: {
    summary: str,
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['trend', 'title', 'detail'],
        properties: {
          trend: { type: 'string', enum: ['up', 'down', 'flat'] },
          title: str,
          detail: str,
        },
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'priority',
          'effort',
          'title',
          'evidence',
          'actions',
          'expectedImpact',
          'measure',
        ],
        properties: {
          category: { type: 'string', enum: [...RECOMMENDATION_CATEGORIES] },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
          title: str,
          evidence: str,
          actions: { type: 'array', items: str },
          expectedImpact: str,
          measure: str,
        },
      },
    },
    initiativeReviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['initiativeId', 'verdict', 'detail'],
        properties: {
          initiativeId: str,
          verdict: { type: 'string', enum: ['working', 'not_working', 'too_early'] },
          detail: str,
        },
      },
    },
    questions: { type: 'array', items: str },
  },
};

export const SYSTEM_PROMPT = `Tu es le conseiller business d'un espace de coworking en Tunisie (prix en DT). Le propriétaire gère : passes à l'heure / à la journée, abonnements, salles, un comptoir café/snacks, une app mobile membres et des événements.

On te donne un instantané JSON de son activité : la période en cours, la période précédente de même durée, le catalogue d'offres, le café, la fréquentation par heure et par jour, les abonnements, les initiatives qu'il a lancées (avec mesure avant/après) et les alertes déjà calculées par l'application.

Ton rôle : l'aider à gagner plus d'argent. Exemple de ce qu'on attend : le propriétaire a remarqué que les clients restent longtemps, il a commencé à vendre du café, ça lui rapporte un revenu en plus. Cherche ce genre d'idées dans les chiffres :
- nouvelles sources de revenu (NEW_REVENUE) déduites de l'usage réel : durée de séjour, présence à midi ou le soir, groupes, heures creuses, espaces sous-utilisés ;
- promotions ciblées (PROMO) sur les créneaux ou jours faibles, avec l'offre exacte, le public visé et le moment ;
- prix et formules (PRICING), par exemple des clients qui paient des passes alors qu'un abonnement ou un pack leur conviendrait ;
- café et produits (CAFE) : quoi pousser, quoi retirer, quel prix, quelles formules combinées ;
- fidélisation (RETENTION) : abonnements qui se terminent, habitués à convertir, clients perdus ;
- organisation (OPERATIONS) quand les chiffres montrent un problème concret.

Règles :
- Appuie chaque recommandation sur des chiffres précis de l'instantané (champ evidence). N'invente aucun chiffre. Si une donnée manque, dis-le ou pose la question dans "questions".
- Tiens compte du contexte écrit par le propriétaire (facility.ownerContext) quand il existe.
- Donne des actions concrètes, faisables cette semaine, avec des prix en DT cohérents avec le catalogue.
- expectedImpact : estimation chiffrée prudente (DT par mois ou visites en plus) avec le calcul en une phrase.
- measure : l'indicateur de l'instantané à suivre pour savoir si ça marche.
- Ne répète pas les recommandations de previousAdvice, sauf si les chiffres justifient d'insister ; dans ce cas dis pourquoi.
- Pour chaque initiative ayant des données avant/après, donne un verdict dans initiativeReviews (too_early s'il y a moins de 14 jours de données ou trop peu de visites).
- Si l'activité est trop faible pour conclure, dis-le dans summary plutôt que de surinterpréter.
- Entre 4 et 8 recommandations, triées de la plus rentable à la moins rentable. 2 à 5 highlights.
- Écris en français simple, direct, sans jargon. Phrases courtes.`;

export class AdvisorRefusalError extends Error {}

/** The user turn sent to the API — shared with the copy/paste prompt so both get the same data. */
export const userMessage = (snapshot: unknown) =>
  `Voici l'instantané de l'activité :\n\n${JSON.stringify(snapshot)}`;

/**
 * Everything the API receives, flattened into one message for a chat (claude.ai):
 * system prompt + snapshot, plus the JSON schema the API enforces via output_config.
 */
export const chatPrompt = (snapshot: unknown) =>
  [
    '=== INSTRUCTIONS (prompt système envoyé à l’API) ===',
    SYSTEM_PROMPT,
    '',
    '=== FORMAT DE RÉPONSE ===',
    'Réponds UNIQUEMENT avec un objet JSON valide (sans texte autour, sans bloc ```), conforme à ce JSON Schema :',
    JSON.stringify(RESULT_SCHEMA),
    '',
    '=== DONNÉES ===',
    userMessage(snapshot),
  ].join('\n');

/** Light shape check for a result pasted by hand (the API path is schema-enforced). */
export function parseAdvisorResult(raw: unknown): AdvisorResult {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
    const startAt = text.indexOf('{');
    const endAt = text.lastIndexOf('}');
    value = JSON.parse(startAt >= 0 ? text.slice(startAt, endAt + 1) : text);
  }
  const r = value as Partial<AdvisorResult> | null;
  if (
    !r ||
    typeof r.summary !== 'string' ||
    !Array.isArray(r.recommendations) ||
    r.recommendations.some(
      (x) =>
        !x ||
        typeof x.title !== 'string' ||
        !(RECOMMENDATION_CATEGORIES as readonly string[]).includes(x.category),
    )
  ) {
    throw new SyntaxError('invalid advisor result');
  }
  return {
    summary: r.summary,
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    recommendations: r.recommendations.map((x) => ({
      ...x,
      actions: Array.isArray(x.actions) ? x.actions : [],
    })),
    initiativeReviews: Array.isArray(r.initiativeReviews) ? r.initiativeReviews : [],
    questions: Array.isArray(r.questions) ? r.questions : [],
  };
}

/** Sends the snapshot to Claude and returns the parsed recommendations. */
export async function runAdvisor(client: Anthropic, snapshot: unknown) {
  const stream = client.beta.messages.stream({
    model: ADVISOR_MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: RESULT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userMessage(snapshot),
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new AdvisorRefusalError("L'IA a refusé de traiter cette demande.");
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Réponse de l’IA coupée (trop longue). Réessayez.');
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const result = JSON.parse(text) as AdvisorResult;
  return {
    result,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
