/**
 * Money-drop alert: the last 7 full days against the same weekdays of the 4 weeks before.
 * Any day-based business works: money = sales of the day, clients = visits or orders.
 */
export type AlertDay = { key: string; visits: number; revenueVisits: number; products: number };

const DAY = 86_400_000;
const round = (n: number) => Math.round(n);

export type DropAlert = {
  /** Last 7 full days, per day */
  moneyNow: number;
  moneyBefore: number;
  clientsNow: number;
  clientsBefore: number;
  moneyPct: number;
  clientsPct: number;
  status: 'red' | 'orange' | null;
  from: string;
  to: string;
  /** First day of the 7 at 25 % or more under its usual level */
  startedOn: string | null;
};

/**
 * Last 7 full days against the same weekdays of the 4 weeks before (a Monday is only
 * compared with Mondays). Money = passes + café, clients = check-ins.
 */
export function dropAlert(facts: AlertDay[], today: Date): DropAlert | null {
  const byKey = new Map(facts.map((d) => [d.key, d]));
  const key = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const money = (d?: AlertDay) => (d ? d.revenueVisits + d.products : 0);
  let mNow = 0;
  let mBefore = 0;
  let cNow = 0;
  let cBefore = 0;
  let startedOn: string | null = null;
  let seen = 0;
  for (let i = 7; i >= 1; i--) {
    const t = noon - i * DAY;
    const day = byKey.get(key(t));
    const past = [1, 2, 3, 4].map((w) => byKey.get(key(t - w * 7 * DAY))).filter((d): d is AlertDay => !!d);
    if (!past.length) continue;
    seen += 1;
    const usualMoney = past.reduce((a, d) => a + money(d), 0) / past.length;
    const usualClients = past.reduce((a, d) => a + d.visits, 0) / past.length;
    mNow += money(day);
    cNow += day?.visits ?? 0;
    mBefore += usualMoney;
    cBefore += usualClients;
    if (!startedOn && usualMoney > 0 && money(day) <= usualMoney * 0.75) startedOn = key(t);
  }
  if (seen < 5 || mBefore <= 0) return null;
  const moneyPct = round(((mNow - mBefore) / mBefore) * 100);
  const clientsPct = cBefore > 0 ? round(((cNow - cBefore) / cBefore) * 100) : 0;
  return {
    moneyNow: round(mNow / seen),
    moneyBefore: round(mBefore / seen),
    clientsNow: round(cNow / seen),
    clientsBefore: round(cBefore / seen),
    moneyPct,
    clientsPct,
    status: moneyPct <= -25 ? 'red' : moneyPct <= -10 ? 'orange' : null,
    from: key(noon - 7 * DAY),
    to: key(noon - DAY),
    startedOn: moneyPct <= -10 ? startedOn : null,
  };
}
