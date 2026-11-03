import Anthropic from '@anthropic-ai/sdk';
import { AREAS, TOOL_KINDS } from './tools';

export const ADVISOR_MODEL = process.env.ADVISOR_MODEL || 'claude-opus-5-5';

export const RECOMMENDATION_CATEGORIES = [
  'ACQUISITION',
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
  /** Lever of the lever map this idea works on ('' = none) */
  leverId?: string;
  /** ai = written by the AI, rules = added because the AI left a strong lever empty */
  source?: 'ai' | 'rules';
  /** Health-check point it improves ('none' = none, e.g. fixing data) */
  area?: string;
  /** Prudent DT per month, start cost, goal in DT over 4 weeks */
  gainAmount?: number;
  cost?: number;
  goalAmount?: number;
  /** App features prepared for the steps (checked by the server before use) */
  tools?: unknown[];
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

/** One app feature prepared by the AI ('' / 0 / [] = not set): same shape for every kind. */
export const TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'step', 'label', 'draft'],
  properties: {
    kind: { type: 'string', enum: [...TOOL_KINDS] },
    step: { type: 'integer' },
    label: str,
    draft: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'text', 'price', 'discountPct', 'date', 'days', 'fromHour', 'toHour', 'capacity', 'segment', 'items'],
      properties: {
        title: str,
        text: str,
        price: { type: 'number' },
        discountPct: { type: 'number' },
        date: str,
        days: { type: 'array', items: { type: 'integer' } },
        fromHour: { type: 'integer' },
        toHour: { type: 'integer' },
        capacity: { type: 'integer' },
        segment: str,
        items: { type: 'array', items: str },
      },
    },
  },
};

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
          'leverId',
          'area',
          'gainAmount',
          'cost',
          'goalAmount',
          'tools',
        ],
        properties: {
          category: { type: 'string', enum: [...RECOMMENDATION_CATEGORIES] },
          area: { type: 'string', enum: [...AREAS, 'none'] },
          gainAmount: { type: 'number' },
          cost: { type: 'number' },
          goalAmount: { type: 'number' },
          tools: { type: 'array', items: TOOL_SCHEMA },
          leverId: str,
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

Ton rôle : l'aider à gagner plus d'argent. Exemple de ce qu'on attend : le propriétaire a remarqué que les clients restent longtemps, il a commencé à vendre du café, ça lui rapporte un revenu en plus. Autre exemple : il a publié plus souvent sur Instagram et les nouveaux visiteurs ont augmenté. Cherche ce genre d'idées dans les chiffres :
- attirer de nouveaux clients (ACQUISITION) : publications régulières sur les réseaux, partenariats avec la fac ou les lycées, événements, parrainage, avis Google ;
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
- leverId : pour chaque recommandation, l'id du levier de levers qu'elle met en route (ex. "social", "partner", "renew"), chaîne vide sinon. Après toi, l'app ajoute une idée des règles pour chaque levier MISSING que tu as laissé vide : couvre-les toi-même, avec une idée plus précise.
- dismissedIdeas : idées que le propriétaire a refusées (« Pas pour moi ») avec la raison, ou actions qu'il a abandonnées. Ne les repropose jamais, même reformulées. Si la raison est « Plus tard », tu peux en reparler seulement si les chiffres ont changé, en le disant.
- whatWorksHere : ce qui a déjà marché dans CET espace (actions jugées « ça marche » ou en hausse mesurée, causes de hausses données par le propriétaire, canaux de relance qui font revenir). C'est la meilleure source d'idées : propose de le refaire, de le faire plus souvent ou de l'étendre, avec un chiffre. Par exemple, si des publications Instagram ont fait monter les nouveaux, propose un rythme régulier et une offre à mettre dedans.
- newVisitorsBySource : nouveaux visiteurs par semaine selon « Comment tu nous as connus ? ». Une source qui monte est une piste à pousser ; une source à 0 (ex. fac) est un levier pas encore essayé.
- levers : la carte des leviers calculée par l'app (attirer, faire revenir, faire payer plus, remplir les creux). status MISSING = les chiffres poussent vers ce levier et aucune action n'est en cours ; NO_DATA = un chiffre manque ; IN_PROGRESS / WORKING = déjà fait. Chaque levier MISSING doit avoir au moins une recommandation qui le met en route (sauf si dataIssues bloque sa catégorie). Ne recommande pas un levier IN_PROGRESS sans dire ce qui change. Pour un levier WORKING, propose de le refaire ou de l'élargir.
- Ne te limite pas au café, aux prix et aux relances : regarde d'abord quel moteur fait le chiffre d'affaires (monthForecast.versusPreviousMonth et toDate : nouveaux visiteurs, visites des habitués, ticket moyen, abonnements, café) et propose une idée sur le moteur qui pèse le plus.
- monthForecast : prévision du mois calculée par les règles de l'app (monthForecast.rules). Passes + café suivent le jour de semaine (un dimanche ne se compare jamais à un jeudi) ; les abonnements se jugent en totaux du mois, jamais par jour. toDate compare passes + café au prévu sur les jours complets et toDate.drivers dit quel moteur explique l'écart (conversions = visiteurs devenus abonnés, ce n'est pas une baisse des habitués). versusPreviousMonth : le driver calendar est l'effet du nombre de chaque jour de semaine, periods l'effet du calendrier (examens, vacances, fériés). Utilise ces chiffres tels quels, n'invente aucun montant, et dis si le mois est en avance ou en retard et pourquoi.
- calendarPeriods avec known=false : l'effet de cette période n'a jamais été mesuré. Dis-le et, si les dates viennent d'une estimation, demande au propriétaire de les confirmer.
- forecastAccuracy : prévisions des mois passés contre le réel, par ligne (passes, café, abonnements) et par période (effet supposé contre effet mesuré). Quand une ligne a plus de 15 % d'écart, dis quelle règle s'est trompée et propose de la corriger (ex. confirmer les dates d'examens, saisir une période manquante dans le calendrier).
- abonnementsThisMonth : actifs, nouveaux, renouvelés X sur Y parmi ceux finis le mois dernier, conversions depuis les passes. Un bon taux de renouvellement montre que les clients se sentent bien dans l'espace : félicite-le avec le chiffre.
- recentRenewals : renouvellements réels, avec ou sans relance enregistrée. sameOffer=false = le propriétaire a renouvelé avec une autre offre que la précédente ou que ta suggestion : c'est une offre qui a marché ici, reconnais-la et propose-la aux prochains, au lieu de répéter ton ancienne suggestion.
- unexplainedChanges : hausses ou baisses fortes des 7 derniers jours. explainedBy null = personne ne sait pourquoi : mets une question dans questions (« Les nouveaux ont augmenté de X % du … au … : qu'as-tu fait de différent ? »). Si explainedBy donne la cause d'une hausse, propose de la refaire et de la mesurer.
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
- Le propriétaire voit tes idées rangées par point du bilan : area = le point que l'idée améliore (cafe : % de visites avec café ; abos : renouvellement des abonnements ; creux : jour ou créneau calme ; nouveaux : nouveaux clients ; retour : nouveaux qui reviennent ; impayes : impayés ; none si aucun, par ex. corriger des données).
- gainAmount : le même gain prudent qu'expectedImpact, en DT par mois. cost : ce que l'idée coûte pour démarrer, en DT (0 si rien). goalAmount : l'objectif prudent en DT sur 4 semaines, que l'app comptera.
- tools : les fonctions de l'app qui réalisent les actions, préparées pour que le propriétaire n'ait qu'à valider (0 à 2 par idée). kind PROMOTION = promo (title, discountPct ou price = prix d'une formule, items = noms exacts de produits du catalogue, days, fromHour/toHour, date de début) ; EVENT = événement (title, text = description, date AAAA-MM-JJ à venir, fromHour, toHour, price, capacity) ; SURVEY = enquête (title, text = intro, items = 3 à 6 questions courtes) ; CAMPAIGN = relance (segment = une liste d'outreachLists non vide, text = le message WhatsApp, comme outreach) ; PRICE = nouveau tarif (title = nom, price, fromHour/toHour pour un tarif de créneau) ; PRODUCT = nouveau produit (title, price). step = l'index de l'action (dans actions) que l'outil réalise ; label = texte court du bouton. Champs inutiles : '' / 0 / []. Chaque vente faite par un outil est comptée pour l'idée : c'est la meilleure preuve, préfère une idée mesurable par un outil.
- Ne répète pas les recommandations de previousAdvice, sauf si les chiffres justifient d'insister ; dans ce cas dis pourquoi.
- Pour chaque initiative ayant des données avant/après, donne un verdict dans initiativeReviews (too_early s'il y a moins de 14 jours de données ou trop peu de visites).
- initiatives = ce que le propriétaire a vraiment fait après tes conseils : description (ce qu'il a fait), cost (ce que ça lui a coûté en DT), metric et targetPct (le chiffre suivi et l'objectif), impact (avant / après sur la même durée), campaign (résultat de la relance liée), notes (ce qui s'est passé, écrit par lui), ownerVerdict (son avis), disturbances (jours fériés ou périodes pendant la mesure, qui faussent la comparaison). Ce sont les faits les plus importants : ils disent ce qui marche dans CET espace.
- Affine à partir de ces résultats : si une action marche, propose l'étape suivante (l'élargir, l'appliquer à un autre créneau, monter un peu le prix) ; si elle ne marche pas, propose une variante qui change UNE seule chose (prix, heure, public, message) et dis laquelle ; si c'est trop tôt, ne la remplace pas. Ne repropose jamais une action déjà faite sans dire ce qui change.
- Chaque initiative a une cible (target : un créneau jours + heures, une liste de clients, ou tout l'espace) et result : before / after sur la cible, comparison (le même chiffre sur un groupe témoin : autres heures, autres jours ou autres clients), effect (variation de la cible moins variation du témoin, en % ou en points), sale (ventes des outils liés — promo, événement, enquête, relance, tarif, produit — chaque vente comptée une fois : preuve directe), toolLinks (le détail par outil), goalAmount (objectif en DT sur 4 semaines) et goalPct, gain, cost, netGain. Juge sur sale, goalAmount et effect, pas sur le revenu global.
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
      leverId: typeof x.leverId === 'string' ? x.leverId : '',
      source: x.source === 'rules' ? ('rules' as const) : ('ai' as const),
      area: typeof x.area === 'string' ? x.area : undefined,
      gainAmount: typeof x.gainAmount === 'number' ? x.gainAmount : undefined,
      cost: typeof x.cost === 'number' ? x.cost : undefined,
      goalAmount: typeof x.goalAmount === 'number' ? x.goalAmount : undefined,
      tools: Array.isArray(x.tools) ? x.tools : [],
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
