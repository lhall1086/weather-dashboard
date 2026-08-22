// Pollen / allergy forecast from Tomorrow.io.
// Free tier is email-only (no billing/credit card) — sign up at
// https://app.tomorrow.io/development/keys and set POLLEN_API_KEY in .env.
// If the key (or LAT/LON) is missing, or the plan doesn't include pollen data,
// this returns { available: false } and the frontend simply hides the tile.
import 'dotenv/config';

const { LAT, LON, POLLEN_API_KEY } = process.env;

let cache = { at: 0, data: null };
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3h — pollen indices only update a few times a day

// Tomorrow.io pollen indices are on a 0–5 scale. Map to a label/color/advice.
const POLLEN_LEVELS = [
  { max: 0, label: 'None', color: '#9e9e9e', textColor: '#fff' },
  { max: 1, label: 'Very Low', color: '#00e400', textColor: '#000' },
  { max: 2, label: 'Low', color: '#a8e05f', textColor: '#000' },
  { max: 3, label: 'Moderate', color: '#ffff00', textColor: '#000' },
  { max: 4, label: 'High', color: '#ff7e00', textColor: '#000' },
  { max: 5, label: 'Very High', color: '#ff0000', textColor: '#fff' },
];

function levelFor(index) {
  if (index == null) return null;
  return POLLEN_LEVELS.find((l) => index <= l.max) || POLLEN_LEVELS[POLLEN_LEVELS.length - 1];
}

function makeType(key, label, index) {
  const lvl = levelFor(index);
  if (!lvl) return null;
  return { key, label, index, category: lvl.label, color: lvl.color, textColor: lvl.textColor };
}

// Fetch current tree/grass/weed pollen indices for the station location.
// Graceful degradation: returns { available: false } on any failure.
export async function fetchPollen() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL) return cache.data;

  if (!POLLEN_API_KEY || !LAT || !LON) {
    console.warn('[pollen] POLLEN_API_KEY, LAT, or LON not set — pollen forecast unavailable. Free key: https://app.tomorrow.io/development/keys');
    return { available: false };
  }

  try {
    const fields = 'treeIndex,grassIndex,weedIndex';
    const url = `https://api.tomorrow.io/v4/weather/realtime?location=${LAT},${LON}&fields=${fields}&units=imperial&apikey=${POLLEN_API_KEY}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) throw new Error(`Tomorrow.io API failed: ${res.status}`);

    const json = await res.json();
    const v = json?.data?.values || {};
    const tree = v.treeIndex ?? null;
    const grass = v.grassIndex ?? null;
    const weed = v.weedIndex ?? null;

    if (tree == null && grass == null && weed == null) {
      console.warn('[pollen] No pollen indices returned (your Tomorrow.io plan may not include pollen data)');
      return { available: false };
    }

    const types = [
      makeType('tree', 'Tree', tree),
      makeType('grass', 'Grass', grass),
      makeType('weed', 'Weed', weed),
    ].filter(Boolean);

    // Overall level = the worst of the individual indices.
    const overallIndex = Math.max(...types.map((t) => t.index));
    const overallLvl = levelFor(overallIndex);

    const result = {
      available: true,
      overall: {
        index: overallIndex,
        category: overallLvl.label,
        color: overallLvl.color,
        textColor: overallLvl.textColor,
      },
      types,
      timestamp: json?.data?.time || new Date().toISOString(),
    };

    cache = { at: now, data: result };
    return result;
  } catch (err) {
    console.warn('[pollen] fetch failed:', err.message);
    return { available: false, error: err.message };
  }
}
