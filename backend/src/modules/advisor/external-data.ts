/**
 * Free, key-less public data for the advisor:
 * - weather: Open-Meteo (archive + forecast)
 * - neighbourhood: OpenStreetMap via the Overpass API
 * Only the facility coordinates are sent; never member data.
 */

const USER_AGENT = 'co-admin-system/advisor (coworking management)';
const TIMEOUT_MS = 15_000;
const CACHE_MS = 6 * 3_600_000;

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

export type WeatherDay = {
  date: string;
  tempMax: number | null;
  precipitationMm: number | null;
  code: number | null;
};

type OpenMeteoDaily = {
  daily?: {
    time: string[];
    weather_code: Array<number | null>;
    temperature_2m_max: Array<number | null>;
    precipitation_sum: Array<number | null>;
  };
};

const DAILY = 'weather_code,temperature_2m_max,precipitation_sum';

function toDays(r: OpenMeteoDaily): WeatherDay[] {
  const d = r.daily;
  if (!d) return [];
  return d.time.map((date, i) => ({
    date,
    tempMax: d.temperature_2m_max[i],
    precipitationMm: d.precipitation_sum[i],
    code: d.weather_code[i],
  }));
}

/**
 * Daily weather from `from` to `to` (yyyy-MM-dd) plus the next 7 days.
 * The archive lags a few days behind, so recent days come from the forecast endpoint.
 */
export async function weatherDays(lat: number, lon: number, from: string, to: string) {
  const loc = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=Africa%2FTunis`;
  return cached(`wx:${lat.toFixed(3)},${lon.toFixed(3)}:${from}:${to}`, async () => {
    const [archive, recent] = await Promise.all([
      getJson<OpenMeteoDaily>(
        `https://archive-api.open-meteo.com/v1/archive?${loc}&start_date=${from}&end_date=${to}&daily=${DAILY}`,
      ).catch(() => ({}) as OpenMeteoDaily),
      getJson<OpenMeteoDaily>(
        `https://api.open-meteo.com/v1/forecast?${loc}&past_days=10&forecast_days=7&daily=${DAILY}`,
      ),
    ]);
    const byDate = new Map<string, WeatherDay>();
    for (const d of toDays(archive)) if (d.tempMax != null) byDate.set(d.date, d);
    for (const d of toDays(recent)) if (d.tempMax != null) byDate.set(d.date, d);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  });
}

/** WMO weather code → short French label. */
export function weatherLabel(code: number | null, precipitationMm: number | null) {
  if (code == null) return null;
  if (code >= 95) return 'orage';
  if (code >= 71 && code <= 77) return 'neige';
  if (code >= 51 || (precipitationMm ?? 0) >= 1) return 'pluie';
  if (code === 45 || code === 48) return 'brouillard';
  if (code >= 2) return 'nuageux';
  return 'ensoleillé';
}

export type NearbyPlace = {
  externalId: string;
  name: string;
  tag: string;
  kind: string;
  distanceM: number;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const AMENITY_TAG: Record<string, string> = {
  restaurant: 'restaurant',
  fast_food: 'restaurant',
  cafe: 'cafe',
  university: 'university',
  college: 'university',
  school: 'school',
  library: 'school',
  dormitory: 'dorm',
  coworking_space: 'competitor',
};

const UNNAMED: Record<string, string> = {
  dorm: 'Foyer',
  university: 'Faculté',
  school: 'École',
};

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}

/** Named places around the facility, nearest first. */
export async function nearbyPlaces(lat: number, lon: number, radiusM = 700) {
  const around = `around:${radiusM},${lat},${lon}`;
  const query = `[out:json][timeout:20];(
    nwr(${around})[amenity~"^(restaurant|fast_food|cafe|university|college|school|library|dormitory|coworking_space)$"];
    nwr(${around})[building=dormitory];
    nwr(${around})[shop][name];
    nwr(${around})[office][name];
  );out center tags 150;`;
  return cached(`osm:${lat.toFixed(4)},${lon.toFixed(4)}:${radiusM}`, async () => {
    const r = await getJson<{ elements: OverpassElement[] }>(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      },
    );
    const places: NearbyPlace[] = [];
    for (const e of r.elements) {
      const t = e.tags || {};
      const pLat = e.lat ?? e.center?.lat;
      const pLon = e.lon ?? e.center?.lon;
      if (pLat == null || pLon == null) continue;
      let tag = 'other';
      let kind = t.amenity || t.shop || t.office || t.building || '';
      if (t.amenity && AMENITY_TAG[t.amenity]) tag = AMENITY_TAG[t.amenity];
      else if (t.building === 'dormitory') {
        tag = 'dorm';
        kind = 'dormitory';
      } else if (t.shop) tag = 'shop';
      else if (t.office) tag = 'office';
      const name = t.name || t['name:fr'] || t['name:ar'] || t['name:en'];
      if (!name && tag !== 'dorm' && tag !== 'university' && tag !== 'school') continue;
      places.push({
        externalId: `osm:${e.type}/${e.id}`,
        name: name || `${UNNAMED[tag] || kind} (sans nom)`,
        tag,
        kind,
        distanceM: distanceM(lat, lon, pLat, pLon),
      });
    }
    return places.sort((a, b) => a.distanceM - b.distanceM).slice(0, 80);
  });
}

const COORDS = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/, // .../@36.72,10.21,17z
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // place data
  /[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i,
  /^\s*(-?\d+\.\d+)\s*[,; ]\s*(-?\d+\.\d+)\s*$/, // "36.72, 10.21"
];

function matchCoords(text: string) {
  for (const re of COORDS) {
    const m = re.exec(text);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

/** Coordinates from "lat, lon" or a Google Maps link (short links are followed). */
export async function parseLocation(input: string) {
  const direct = matchCoords(input);
  if (direct) return direct;
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(input.trim())) {
    const res = await fetch(input.trim(), {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const fromUrl = matchCoords(decodeURIComponent(res.url));
    if (fromUrl) return fromUrl;
    const html = await res.text();
    return matchCoords(html.slice(0, 200_000));
  }
  return null;
}
