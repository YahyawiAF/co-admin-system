import Anthropic from '@anthropic-ai/sdk';
import { ADVISOR_MODEL, AdvisorRefusalError, TOOL_SCHEMA } from './advisor-claude';
import { type RawTool, sanitizeTool, type ToolDraft } from './tools';

/** A solution as the page shows it, and what the owner wants changed. */
export type AdaptInput = {
  solution?: {
    title?: string;
    why?: string;
    steps?: string[];
    gain?: number;
    cost?: number;
    goalAmount?: number;
    tools?: unknown[];
  };
  instruction?: string;
};

export type AdaptedSolution = {
  title: string;
  why: string;
  steps: string[];
  gain: number;
  cost: number;
  goalAmount: number;
  tools: ToolDraft[];
};

const str = { type: 'string' };
const ADAPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'why', 'steps', 'gainAmount', 'cost', 'goalAmount', 'tools'],
  properties: {
    title: str,
    why: str,
    steps: { type: 'array', items: str },
    gainAmount: { type: 'number' },
    cost: { type: 'number' },
    goalAmount: { type: 'number' },
    tools: { type: 'array', items: TOOL_SCHEMA },
  },
};

const ADAPT_PROMPT = `Tu es le conseiller business d'un espace de coworking en Tunisie (prix en DT).
Le propriétaire veut adapter UNE idée à sa façon. On te donne l'idée actuelle (JSON) et sa demande en une phrase.

Règles :
- Change seulement ce que la demande touche ; garde le reste tel quel.
- title : l'action, 8 mots max. why : UNE phrase, 20 mots max, sans inventer de chiffre (garde ceux de l'idée).
- steps : 1 à 4 étapes, 12 mots max chacune, la première faisable aujourd'hui.
- gainAmount : gain prudent en DT par mois ; cost : coût de départ en DT ; goalAmount : objectif prudent en DT sur 4 semaines. Ajuste-les seulement si la demande change le prix, le public ou le créneau.
- tools : les fonctions de l'app qui réalisent les étapes (PROMOTION, EVENT, SURVEY, CAMPAIGN, PRICE, PRODUCT), préparées pour que le propriétaire n'ait qu'à valider. step = index de l'étape réalisée. Champs inutiles : '' / 0 / []. Pour PROMOTION, items = noms exacts de produits du catalogue fourni. Pour CAMPAIGN, text = message WhatsApp qui commence par « Bonjour {prenom}, », 2 à 4 phrases, vouvoiement.
- Français simple, phrases courtes.`;

/** Rewrites one solution with Claude, then checks the tools like any AI output. */
export async function adaptSolution(
  client: Anthropic,
  input: AdaptInput & { products: Array<{ id: string; name: string }>; facilityId: string },
): Promise<AdaptedSolution> {
  const instruction = (input.instruction ?? '').trim().slice(0, 500);
  if (!instruction) throw new Error('Dites en une phrase ce que vous voulez changer.');
  const solution = input.solution ?? {};
  const stream = client.beta.messages.stream({
    model: ADVISOR_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ADAPT_SCHEMA } },
    system: ADAPT_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          idee: {
            title: solution.title ?? '',
            why: solution.why ?? '',
            steps: solution.steps ?? [],
            gainAmount: solution.gain ?? 0,
            cost: solution.cost ?? 0,
            goalAmount: solution.goalAmount ?? 0,
            tools: solution.tools ?? [],
          },
          demande: instruction,
          aujourdhui: new Date().toISOString().slice(0, 10),
          catalogue: input.products.map((p) => p.name),
        }),
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new AdvisorRefusalError("L'IA a refusé de traiter cette demande.");
  if (message.stop_reason === 'max_tokens') throw new Error('Réponse de l’IA coupée. Réessayez.');
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const out = JSON.parse(text) as {
    title: string;
    why: string;
    steps: string[];
    gainAmount: number;
    cost: number;
    goalAmount: number;
    tools: RawTool[];
  };
  const steps = (out.steps ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 6);
  return {
    title: String(out.title ?? '').trim().slice(0, 200) || solution.title || 'Solution',
    why: String(out.why ?? '').trim().slice(0, 300),
    steps,
    gain: Math.max(0, Math.round(Number(out.gainAmount) || 0)),
    cost: Math.max(0, Math.round(Number(out.cost) || 0)),
    goalAmount: Math.max(10, Math.round(Number(out.goalAmount) || solution.goalAmount || 50)),
    tools: (out.tools ?? [])
      .map((t) => sanitizeTool(t, { steps: steps.length, now: new Date(), products: input.products }))
      .filter((t): t is ToolDraft => !!t)
      .slice(0, 3),
  };
}
