import { checkClientRules, clientActivity, clientRules, DEFAULT_CLIENT_RULES } from './client-segments';

const now = new Date('2026-11-20T18:00:00');
const ago = (...days: number[]) => days.map((d) => new Date(now.getTime() - d * 86_400_000));
const seg = (days: number[]) => clientActivity(ago(...days), now)!.segment;

describe('client segments', () => {
  it('has no group without a visit', () => {
    expect(clientActivity([], now)).toBeNull();
  });

  it('Nouveau: first visit less than 7 days ago', () => {
    expect(seg([2])).toBe('NEW');
    expect(seg([6])).toBe('NEW');
    expect(seg([6, 3, 1])).toBe('NEW');
    expect(clientActivity(ago(2), now)!.why).toBe('1ʳᵉ visite il y a 2 jours');
    expect(clientActivity(ago(6), now)!.why).toBe('1ʳᵉ visite il y a 6 jours, pas revenu');
    // 7 days ago is no longer new: one visit in 30 days = occasional
    expect(seg([7])).toBe('OCCASIONAL');
  });

  it('counts visit days, not check-ins', () => {
    const a = clientActivity([...ago(20, 20, 20, 12, 12), ...ago(5)], now)!;
    expect(a).toMatchObject({ visitDays: 3, visits30: 3, segment: 'OCCASIONAL' });
  });

  it('Régulier: 4 visit days or more in 30 days, seen recently', () => {
    expect(seg([40, 25, 18, 11, 4])).toBe('REGULAR');
    expect(clientActivity(ago(40, 25, 18, 11, 4), now)!.why).toBe('4 visites en 30 jours');
    // 3 visits only: occasional
    expect(seg([40, 18, 11, 4])).toBe('OCCASIONAL');
  });

  it('À risque: was regular, absent 10 days or more (Sami: 5 times in October, nothing for 12 days)', () => {
    const sami = clientActivity(ago(40, 25, 20, 16, 12), now)!;
    expect(sami.segment).toBe('AT_RISK');
    expect(sami.why).toBe('Venait 5 fois en 30 jours, absent depuis 12 jours');
    // Same rhythm, absent 9 days: still regular
    expect(seg([37, 22, 17, 13, 9])).toBe('REGULAR');
    // Never regular, absent 15 days: occasional
    expect(seg([50, 15])).toBe('OCCASIONAL');
  });

  it('Inactif: no visit for 30 days or more, even a former regular', () => {
    expect(seg([60, 45])).toBe('INACTIVE');
    expect(seg([50, 45, 40, 35, 30])).toBe('INACTIVE');
    expect(clientActivity(ago(41), now)!.why).toBe('Pas venu depuis 41 jours');
    expect(seg([29, 40])).toBe('OCCASIONAL');
  });

  it('follows edited rules', () => {
    const r = { ...DEFAULT_CLIENT_RULES, regularVisits: 3, riskDays: 7 };
    expect(clientActivity(ago(25, 18, 11), now, r)!.segment).toBe('AT_RISK');
    expect(clientActivity(ago(18, 11, 4), now, r)!.segment).toBe('REGULAR');
  });

  it('reads saved rules safely', () => {
    expect(clientRules(null)).toEqual(DEFAULT_CLIENT_RULES);
    expect(clientRules({ newDays: 5, regularVisits: 'x', riskDays: 999 })).toEqual({ ...DEFAULT_CLIENT_RULES, newDays: 5 });
    expect(() => checkClientRules({ riskDays: 30 }, DEFAULT_CLIENT_RULES)).toThrow();
    expect(checkClientRules({ messageGapDays: 10 }, DEFAULT_CLIENT_RULES).messageGapDays).toBe(10);
  });
});
