import { clientGroups, clientRow } from './client-groups';

const now = new Date('2026-11-18T18:00:00');
const ago = (...days: number[]) => days.map((d) => new Date(now.getTime() - d * 86_400_000));
const c = (visits: Date[], extra: Partial<{ subscribed: boolean; hasPhone: boolean }> = {}) => ({
  memberId: 'm',
  visits,
  subscribed: false,
  hasPhone: true,
  heardFrom: null,
  ...extra,
});

describe('client groups', () => {
  it('puts each client in one group', () => {
    expect(clientRow(c(ago(3)), now)!.group).toBe('NEW');
    expect(clientRow(c(ago(30)), now)!.group).toBe('ONCE');
    expect(clientRow(c(ago(30, 20)), now)!.group).toBe('TWICE');
    expect(clientRow(c(ago(90, 80, 70)), now)!.group).toBe('LOST');
    expect(clientRow(c(ago(2), { subscribed: true }), now)!.group).toBe('SUBSCRIBER');
  });

  it('judges the rhythm on visit days, not check-ins', () => {
    expect(clientRow(c(ago(21, 14, 7, 7, 2)), now)!).toMatchObject({ group: 'REGULAR', visitDays: 4, usualGap: 7 });
    expect(clientRow(c(ago(45, 30, 15, 3)), now)!.group).toBe('SOMETIMES');
    // Comes every 15 days, last seen 25 days ago: late
    expect(clientRow(c(ago(55, 40, 25)), now)!.group).toBe('LATE');
    // Comes every week, last seen 10 days ago: within 7 + 4 days, not late yet
    expect(clientRow(c(ago(24, 17, 10)), now)!.group).toBe('REGULAR');
  });

  it('counts new clients by week and who came back within 14 days', () => {
    const x = clientGroups(
      [
        { ...c(ago(30, 25)), memberId: 'a', heardFrom: 'INSTAGRAM' },
        { ...c(ago(30)), memberId: 'b', heardFrom: 'INSTAGRAM' },
      ],
      now,
    );
    const week = x.newByWeek.find((w) => w.newClients === 2)!;
    expect(week).toMatchObject({ judged: 2, cameBack: 1, heardFrom: { INSTAGRAM: 2 } });
    expect(x.groups.find((g) => g.group === 'ONCE')!.count).toBe(1);
  });
});
