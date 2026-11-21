/**
 * Finance › Clients: one French message drafted by Claude from the client's real facts.
 * A suggestion only — staff edit it before sending.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ADVISOR_MODEL } from '../advisor/advisor-claude';

export type DraftFacts = {
  place: string;
  firstName: string;
  /** Why we write (e.g. « Message de retour ») */
  goal: string;
  /** Group and why (e.g. « À risque — Venait 5 fois en 30 jours, absent depuis 12 jours ») */
  situation: string;
  lastVisit: string | null;
  visits30: number;
  abonnement: string | null;
  /** Active promotion picked by staff, or null: then no offer at all */
  offer: string | null;
  /** The message shown now, to write a different one */
  previous: string | null;
};

const SYSTEM = `Tu écris des messages WhatsApp courts pour un espace de coworking en Tunisie, envoyés par l'équipe à un client.
Règles :
- Français naturel, chaleureux et professionnel, vouvoiement. 2 à 4 phrases, 450 caractères au plus. Un emoji au plus.
- Jamais pressant ni désespéré : pas de « dernière chance », pas de « vous nous manquez tellement », pas de culpabilité pour une absence.
- Utilise seulement les faits donnés. N'invente ni chiffre, ni date, ni service, ni offre.
- Si une offre est donnée, cite-la telle quelle une seule fois. Sans offre, ne propose aucune réduction ni cadeau.
- Commence par « Bonjour <prénom> » (ou « Bonjour » sans prénom).
Réponds avec le message seul, sans guillemets ni commentaire.`;

export async function draftClientMessage(client: Anthropic, f: DraftFacts) {
  const facts = [
    `Espace : ${f.place}`,
    `Prénom : ${f.firstName || '(inconnu)'}`,
    `But du message : ${f.goal}`,
    `Situation : ${f.situation}`,
    `Dernière visite : ${f.lastVisit || 'aucune'}`,
    `Visites ces 30 jours : ${f.visits30}`,
    `Abonnement : ${f.abonnement || 'aucun'}`,
    `Offre : ${f.offer || 'aucune'}`,
  ].join('\n');
  const ask = f.previous
    ? `${facts}\n\nVoici la version actuelle. Écris une version différente (autre tournure, même règles) :\n${f.previous}`
    : facts;
  const message = await client.beta.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: ask }],
  });
  if (message.stop_reason === 'refusal') throw new Error("L'IA n'a pas pu écrire ce message.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
    .replace(/^["«]\s*|\s*["»]$/g, '');
  if (!text) throw new Error("L'IA n'a rien renvoyé. Réessayez.");
  return text.slice(0, 1000);
}
