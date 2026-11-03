import { recentRenewals, renewalOf, byMember, subscriptionsOutlook, type AboRow } from './month-data';

let n = 0;
const abo = (memberID: string, from: string, to: string, priceId = 'month', price = 150, extra: Partial<AboRow> = {}): AboRow => ({
  id: `a${++n}`,
  memberID,
  registredDate: new Date(`${from}T09:00:00`),
  leaveDate: new Date(`${to}T23:00:00`),
  createdAt: new Date(`${from}T09:00:00`),
  payedAmount: price,
  listPrice: price,
  amountDue: price,
  terminatedAt: null,
  priceId,
  serviceName: priceId === 'month' ? 'Mois' : 'Semaine',
  priceName: priceId === 'month' ? 'Mois' : 'Semaine',
  memberName: memberID,
  ...extra,
});

describe('renewalOf', () => {
  it('counts a renewal with another offer (Ayen Bedoui case)', () => {
    const old = abo('ayen', '2026-10-01', '2026-10-31', 'month');
    const next = abo('ayen', '2026-11-01', '2026-11-07', 'week', 45);
    expect(renewalOf(old, byMember([old, next]))?.id).toBe(next.id);
    const r = recentRenewals([old, next], new Date('2026-10-20'));
    expect(r).toEqual([expect.objectContaining({ name: 'ayen', from: 'Mois', to: 'Semaine', sameOffer: false })]);
  });

  it('counts an early renewal and ignores one too late', () => {
    const old = abo('b', '2026-10-01', '2026-10-31');
    const early = abo('b', '2026-10-20', '2026-11-20');
    expect(renewalOf(old, byMember([old, early]))?.id).toBe(early.id);
    const late = abo('c', '2026-11-20', '2026-12-20');
    const ended = abo('c', '2026-10-01', '2026-10-31');
    expect(renewalOf(ended, byMember([ended, late]))).toBeNull();
  });
});

describe('subscriptionsOutlook', () => {
  it('uses the lower of last month and all history when few abonnements ended', () => {
    const rows: AboRow[] = [];
    // September: 4 ended, 1 renewed (25 %)
    for (const m of ['s1', 's2', 's3', 's4']) rows.push(abo(m, '2026-08-15', '2026-09-14'));
    rows.push(abo('s1', '2026-09-15', '2026-09-20', 'week', 45, { terminatedAt: new Date('2026-09-20T10:00:00') }));
    // October: 3 ended, all renewed (100 %)
    for (const m of ['o1', 'o2', 'o3']) {
      rows.push(abo(m, '2026-10-01', '2026-10-25'));
      rows.push(abo(m, '2026-10-26', '2026-11-25'));
    }
    rows.sort((a, b) => a.registredDate.getTime() - b.registredDate.getTime());
    const s = subscriptionsOutlook(rows, new Date(2026, 10, 1));
    expect(s.lastMonthRatePct).toBe(100);
    expect(s.historyRatePct).toBeLessThan(100);
    expect(s.renewalRateSource).toBe('CAREFUL');
    expect(s.renewalRatePct).toBe(s.historyRatePct);
  });
});
