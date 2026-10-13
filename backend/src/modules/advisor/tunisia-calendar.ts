/**
 * Tunisian public holidays and religious periods, used to pre-fill the advisor calendar.
 * Fixed-date holidays are certain; lunar dates are astronomical estimates (±1 day,
 * officially set by the Mufti), so they are created unconfirmed and the owner is asked
 * to check them.
 */
export type CalendarPreset = {
  key: string;
  kind: 'HOLIDAY' | 'PERIOD';
  tag?: string;
  title: string;
  start: string;
  end?: string;
  confirmed: boolean;
};

const FIXED: Array<[string, string, string]> = [
  ['01-01', 'new-year', 'Jour de l’An'],
  ['03-20', 'independence', 'Fête de l’Indépendance'],
  ['04-09', 'martyrs', 'Journée des Martyrs'],
  ['05-01', 'labour', 'Fête du Travail'],
  ['07-25', 'republic', 'Fête de la République'],
  ['08-13', 'women', 'Fête de la Femme'],
  ['10-15', 'evacuation', 'Fête de l’Évacuation'],
  ['12-17', 'revolution', 'Fête de la Révolution'],
];

/** Estimated lunar dates by Gregorian year. */
const LUNAR: Record<
  number,
  { ramadan: [string, string]; fitr: string; adha: string; hijri: string; mouled: string }
> = {
  2026: {
    ramadan: ['2026-02-18', '2026-03-19'],
    fitr: '2026-03-20',
    adha: '2026-05-27',
    hijri: '2026-06-16',
    mouled: '2026-08-25',
  },
  2027: {
    ramadan: ['2027-02-08', '2027-03-09'],
    fitr: '2027-03-10',
    adha: '2027-05-16',
    hijri: '2027-06-06',
    mouled: '2027-08-15',
  },
  2028: {
    ramadan: ['2028-01-28', '2028-02-26'],
    fitr: '2028-02-27',
    adha: '2028-05-05',
    hijri: '2028-05-25',
    mouled: '2028-08-03',
  },
};

const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

export function tunisiaCalendar(year: number): CalendarPreset[] {
  const out: CalendarPreset[] = FIXED.map(([md, key, title]) => ({
    key: `tn:${year}:${key}`,
    kind: 'HOLIDAY',
    title,
    start: `${year}-${md}`,
    confirmed: true,
  }));
  const l = LUNAR[year];
  if (l) {
    out.push(
      {
        key: `tn:${year}:ramadan`,
        kind: 'PERIOD',
        tag: 'ramadan',
        title: 'Ramadan',
        start: l.ramadan[0],
        end: l.ramadan[1],
        confirmed: false,
      },
      {
        key: `tn:${year}:aid-fitr`,
        kind: 'HOLIDAY',
        title: 'Aïd el-Fitr',
        start: l.fitr,
        end: addDaysKey(l.fitr, 1),
        confirmed: false,
      },
      {
        key: `tn:${year}:aid-adha`,
        kind: 'HOLIDAY',
        title: 'Aïd el-Idha',
        start: l.adha,
        end: addDaysKey(l.adha, 1),
        confirmed: false,
      },
      {
        key: `tn:${year}:hijri`,
        kind: 'HOLIDAY',
        title: 'Ras el Am el Hijri',
        start: l.hijri,
        confirmed: false,
      },
      {
        key: `tn:${year}:mouled`,
        kind: 'HOLIDAY',
        title: 'Mouled',
        start: l.mouled,
        confirmed: false,
      },
    );
  }
  return out;
}

export const presetYears = () => Object.keys(LUNAR).map(Number);
