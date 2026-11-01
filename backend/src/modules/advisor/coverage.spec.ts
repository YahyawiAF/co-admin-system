import { ensureCoverage, sameIdea } from './coverage';
import type { AdvisorResult } from './advisor-claude';

const rec = (title: string, leverId = '') => ({
  category: 'PROMO' as const,
  priority: 'medium' as const,
  effort: 'low' as const,
  title,
  evidence: '',
  actions: [],
  expectedImpact: '',
  measure: '',
  leverId,
});
const result = (titles: Array<[string, string?]>): AdvisorResult => ({
  summary: '',
  highlights: [],
  recommendations: titles.map(([t, l]) => rec(t, l)),
  initiativeReviews: [],
  questions: [],
});
const lever = (leverId: string, title: string) => ({
  leverId,
  title,
  why: 'parce que',
  steps: ['a', 'b'],
  estimatedGainPerMonth: 350,
  plan: { category: 'ACQUISITION', metric: 'newMembers', targetPct: 15 },
});

describe('ensureCoverage', () => {
  it('adds a rule idea for a strong lever the AI left empty', () => {
    const out = ensureCoverage(result([['Café au check-in', 'cafe']]), {
      missing: [lever('cafe', 'Proposer le café'), lever('social', 'Publier 3 fois par semaine')],
    });
    expect(out.recommendations.map((r) => [r.title, r.source])).toEqual([
      ['Café au check-in', 'ai'],
      ['Publier 3 fois par semaine', 'rules'],
    ]);
    expect(out.recommendations[1].category).toBe('ACQUISITION');
    expect(out.recommendations[1].metric).toBe('newMembers');
  });

  it('never brings back a dismissed idea, from the AI or the rules', () => {
    const out = ensureCoverage(result([['Tournoi d’échecs payant'], ['Mardi −20 %']]), {
      missing: [lever('partner', 'Partenariat fac')],
      dismissed: [{ title: "Tournoi d'échecs payant" }, { title: 'x', leverId: 'partner' }],
    });
    expect(out.recommendations.map((r) => r.title)).toEqual(['Mardi −20 %']);
  });
});

describe('sameIdea', () => {
  it('ignores accents, case and punctuation', () => {
    expect(sameIdea('Relancer les abonnés !', 'relancer les abonnes')).toBe(true);
    expect(sameIdea('Café', 'Mardi')).toBe(false);
  });
});
