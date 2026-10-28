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

/** Figures measured before / after an action (same keys as the initiative impact). */
export const ADVICE_METRICS = [
  'revenuePerDay',
  'visitsPerDay',
  'revenueCafe',
  'cafeAttachRatePct',
  'avgStayHours',
  'newMembers',
  'revenueSubscriptions',
  'avgOccupancyPct',
] as const;
export type AdviceMetric = (typeof ADVICE_METRICS)[number];

export const OUTREACH_SEGMENTS = [
  'NONE',
  'ABO_EXPIRING',
  'ABO_ENDED',
  'INACTIVE',
  'TOP_UP',
  'CONVERT',
  'UNPAID',
  'RECENT_30',
  'ALL',
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
  /** Figure the app measures before / after when the owner does it. */
  metric?: AdviceMetric;
  /** Expected change of that figure, in % (prudent). */
  targetPct?: number;
  /** Who it aims at: a slot (days 0 = Sunday, hours [from, to), 0/0 = all day), a client list (outreach.segment) or the whole space. */
  target?: { kind: 'ALL' | 'SLOT' | 'LIST'; days: number[]; fromHour: number; toHour: number };
  /** Clients to contact for this idea and the ready-to-send message (segment NONE = no relance). */
  outreach?: { segment: (typeof OUTREACH_SEGMENTS)[number]; message: string };
};

export type AdvisorResult = {
  summary: string;
  highlights: Array<{ trend: 'up' | 'down' | 'flat'; title: string; detail: string }>;
  recommendations: AdvisorRecommendation[];
  initiativeReviews: Array<{
    initiativeId: string;
    verdict: 'working' | 'not_working' | 'too_early' | 'not_tested';
    detail: string;
    /** The planned step not done, or the funnel stage where it breaks; '' if none */
    brokenStep: string;
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
          'metric',
          'targetPct',
          'target',
          'outreach',
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
          metric: { type: 'string', enum: [...ADVICE_METRICS] },
          targetPct: { type: 'number' },
          target: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'days', 'fromHour', 'toHour'],
            properties: {
              kind: { type: 'string', enum: ['ALL', 'SLOT', 'LIST'] },
              days: { type: 'array', items: { type: 'integer' } },
              fromHour: { type: 'integer' },
              toHour: { type: 'integer' },
            },
          },
          outreach: {
            type: 'object',
            additionalProperties: false,
            required: ['segment', 'message'],
            properties: {
              segment: { type: 'string', enum: [...OUTREACH_SEGMENTS] },
              message: str,
            },
          },
        },
      },
    },
    initiativeReviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['initiativeId', 'verdict', 'detail', 'brokenStep'],
        properties: {
          initiativeId: str,
          verdict: { type: 'string', enum: ['working', 'not_working', 'too_early', 'not_tested'] },
          detail: str,
          brokenStep: str,
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

Le contexte autour des chiffres :
- calendar : jours fériés, périodes (Ramadan, examens, vacances) et événements locaux. inAnalysedWindow compare les visites de ces jours aux mêmes jours de semaine habituels ; next45Days liste ce qui arrive. confirmedDate=false veut dire date estimée.
- weather : visites moyennes les jours de pluie / secs / chauds sur la période, et la météo des 7 prochains jours (Open-Meteo).
- neighbors : lieux autour de l'espace (restaurants, magasins, foyers, facultés, concurrents) avec la distance en mètres.
- audiences : les types de clients décrits par le propriétaire, parfois mesurés par un groupe de membres (visites, montant payé).
- ownerAnswers : réponses du propriétaire à tes questions précédentes. openQuestions : questions encore sans réponse. missingInfo : ce que le propriétaire n'a pas encore renseigné.
- weekdays[].hourlyAvgPresent : présence moyenne par heure depuis firstHour ; quietHours : heures creuses (moins de 30 % du pic). recentDaysVsUsual : les 7 derniers jours complets comparés à la moyenne des 4 mêmes jours précédents (usualVisits, usualRevenue — visites + abonnements, sans café).

Règles :
- Explique une baisse ou une hausse par un jour férié, une période ou la météo quand calendar ou weather le montrent, au lieu d'y voir une tendance.
- Explique les jours de recentDaysVsUsual qui s'écartent de plus de 15 % de l'habituel : moins de visites, panier plus bas ou séjours plus courts ? Croise avec calendar et weather avant de conclure.
- Pour les heures creuses répétées (quietHours sur plusieurs jours), propose une offre précise sur ce créneau (prix en DT, public visé) et la mesure à suivre.
- Prépare les jours qui arrivent dans next45Days (ex. offre révisions pendant les examens, horaires adaptés pendant le Ramadan, promo un jour férié) et utilise next7Days de la météo pour les actions de la semaine.
- Propose des partenariats concrets avec les voisins (neighbors) quand c'est pertinent : livraison ou réduction chez un restaurant, promo croisée avec un magasin, offre pour un foyer ou une faculté proche.
- Adapte les offres et les prix au budget de chaque public décrit dans audiences ; si un public vient peu parce que c'est trop cher, propose une formule abordable sans casser les prix des autres clients, et dis comment la mesurer.
- Utilise ownerAnswers comme des faits. Ne repose pas une question déjà répondue. Ne pose une nouvelle question que si la réponse changerait une recommandation.
- Si une donnée de missingInfo t'empêche de conclure sur un point important, demande-la dans questions.
- outreach : si l'idée passe par un message aux clients, choisis la liste à contacter (outreachLists donne leur taille : ABO_EXPIRING abonnement qui finit, ABO_ENDED pas renouvelé, INACTIVE habitué absent, TOP_UP a déjà payé la moitié d'un abonnement en passes, CONVERT passes au rythme d'un abonnement, UNPAID impayé, RECENT_30 venus ces 30 jours, ALL tous les membres) et écris le message WhatsApp prêt à envoyer : commence par « Bonjour {prenom}, », 2 à 4 phrases, l'offre exacte avec le prix en DT, tutoiement interdit. Sinon segment NONE et message vide. N'utilise pas une liste vide.
- campaigns : relances déjà faites et leur résultat (contacted, won, revenue). Tiens-en compte pour ne pas relancer les mêmes personnes trop tôt et pour juger ce qui marche.
- Appuie chaque recommandation sur des chiffres précis de l'instantané (champ evidence). N'invente aucun chiffre. Si une donnée manque, dis-le ou pose la question dans "questions".
- Tiens compte du contexte écrit par le propriétaire (facility.ownerContext) quand il existe.
- Donne des actions concrètes, faisables cette semaine, avec des prix en DT cohérents avec le catalogue.
- expectedImpact : estimation chiffrée prudente, courte, qui commence par le chiffre (ex. « +120 DT/mois : 4 clients × 30 DT »). 80 caractères max.
- measure : l'indicateur à suivre en quelques mots (ex. « visites du mardi après-midi »).
- metric : le chiffre que l'app mesurera avant / après (revenuePerDay revenu par jour, visitsPerDay visites par jour, revenueCafe café, cafeAttachRatePct % de visites avec café, avgStayHours durée moyenne, newMembers nouveaux membres, revenueSubscriptions revenu abonnements, avgOccupancyPct occupation). targetPct : la hausse attendue de ce chiffre, prudente (ex. 15) : en points pour cafeAttachRatePct et avgOccupancyPct, en % pour les autres. L'app la mesure sur la cible, comparée au reste.
- target : qui est visé, pour ne mesurer que ça. SLOT = un créneau : days (0 = dimanche … 6 = samedi, vide = tous les jours), fromHour et toHour (ex. 18 et 24 ; 0 et 0 = toute la journée). LIST = les clients de outreach.segment. ALL = tout l'espace, seulement si l'action touche vraiment tout le monde.
- Ne répète pas les recommandations de previousAdvice, sauf si les chiffres justifient d'insister ; dans ce cas dis pourquoi.
- Pour chaque initiative ayant des données avant/après, donne un verdict dans initiativeReviews (too_early s'il y a moins de 14 jours de données ou trop peu de visites).
- initiatives = ce que le propriétaire a vraiment fait après tes conseils : description (ce qu'il a fait), cost (ce que ça lui a coûté en DT), metric et targetPct (le chiffre suivi et l'objectif), impact (avant / après sur la même durée), campaign (résultat de la relance liée), notes (ce qui s'est passé, écrit par lui), ownerVerdict (son avis), disturbances (jours fériés ou périodes pendant la mesure, qui faussent la comparaison). Ce sont les faits les plus importants : ils disent ce qui marche dans CET espace.
- Affine à partir de ces résultats : si une action marche, propose l'étape suivante (l'élargir, l'appliquer à un autre créneau, monter un peu le prix) ; si elle ne marche pas, propose une variante qui change UNE seule chose (prix, heure, public, message) et dis laquelle ; si c'est trop tôt, ne la remplace pas. Ne repropose jamais une action déjà faite sans dire ce qui change.
- Chaque initiative a une cible (target : un créneau jours + heures, une liste de clients, ou tout l'espace) et result : before / after sur la cible, comparison (le même chiffre sur un groupe témoin : autres heures, autres jours ou autres clients), effect (variation de la cible moins variation du témoin, en % ou en points), sale (ventes de l'offre, du produit ou de la promo liée : preuve directe), gain, cost, netGain. Juge sur effect et sale, pas sur le revenu global.
- dataIssues : problèmes dans les données (prix aberrant, sorties non pointées, impayés, charges absentes). Ne bâtis aucun conseil sur un chiffre touché. Si un problème bloque une catégorie (blocksCategories), mets en premier une recommandation OPERATIONS pour le corriger et n'en fais pas dans cette catégorie.
- Dans initiativeReviews, compare au targetPct quand il existe et tiens compte du coût (gain net = gain − coût) et des disturbances.
- Chaque initiative a aussi : objective (le but), hypothesis (pourquoi le propriétaire pense que ça marche), channels (où il en parle), steps (les étapes prévues, done = fait ou pas), funnel (l'entonnoir : seen vues Instagram saisies, opened ouvertures du lien suivi, registered inscrits, paid payés, came venus, contacted / won pour une relance ; value null = inconnu, pending = pas encore possible) et diagnosis (calculé par l'app : status NOT_TESTED / MISSING_DATA / TOO_EARLY / BOTTLENECK / ON_TRACK, stage, brokenStep, known, unproven, next). Prends diagnosis comme un fait.
- Diagnostique l'étape cassée avant de juger l'idée. Si diagnosis.status = NOT_TESTED, le verdict est not_tested, jamais not_working : une étape prévue n'a pas été faite, le test n'a pas eu lieu. Ne propose ni d'abandonner l'idée ni de changer le prix : propose de faire l'étape manquante (brokenStep).
- Si status = BOTTLENECK, nomme l'étape (stage) dans brokenStep et propose de changer UNE chose à cette étape seulement. Si MISSING_DATA, demande le chiffre dans questions. Sépare ce qui est su (known) de ce qui n'est pas prouvé (unproven) : n'affirme jamais qu'un prix, une date ou un format ne plaît pas tant que l'entonnoir ne l'a pas montré.
- Des abonnés en plus ne prouvent pas que les gens paieront : juge un événement sur inscrits, payés et venus.
- brokenStep : l'étape pas faite ou l'étape de l'entonnoir qui bloque, en quelques mots ; chaîne vide s'il n'y en a pas.
- Si l'activité est trop faible pour conclure, dis-le dans summary plutôt que de surinterpréter.
- Entre 4 et 8 recommandations, triées de la plus rentable à la moins rentable. 2 à 5 highlights.
- Écris en français simple, direct, sans jargon. Phrases courtes.
- Format court, le propriétaire lit sur son téléphone :
  - title : l'action à faire, 8 mots max (ex. « Pack café + 4h à 7 DT le soir »).
  - evidence : UNE phrase, 20 mots max, avec le chiffre clé (ex. « 58 % des clients sont encore là après 18h, mais 2 % prennent un café »).
  - actions : 1 à 3 étapes, 12 mots max chacune, la première faisable aujourd'hui.
  - summary : 2 phrases max. highlights : title 6 mots max, detail 15 mots max.
  - Pas de paragraphe, pas de répétition entre les champs.`;

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
  const segments = OUTREACH_SEGMENTS as readonly string[];
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
      metric: (ADVICE_METRICS as readonly string[]).includes(x.metric as string) ? x.metric : undefined,
      targetPct: typeof x.targetPct === 'number' ? x.targetPct : undefined,
      target:
        x.target && ['ALL', 'SLOT', 'LIST'].includes(x.target.kind)
          ? {
              kind: x.target.kind,
              days: Array.isArray(x.target.days) ? x.target.days.filter((d) => d >= 0 && d <= 6) : [],
              fromHour: Number(x.target.fromHour) || 0,
              toHour: Number(x.target.toHour) || 0,
            }
          : undefined,
      outreach:
        x.outreach && segments.includes(x.outreach.segment) && typeof x.outreach.message === 'string'
          ? x.outreach
          : { segment: 'NONE' as const, message: '' },
    })),
    initiativeReviews: Array.isArray(r.initiativeReviews)
      ? r.initiativeReviews.map((x) => ({ ...x, brokenStep: typeof x?.brokenStep === 'string' ? x.brokenStep : '' }))
      : [],
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
