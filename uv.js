// UV Index from OpenUV API (free tier: 50 requests/day)
// Sign up at https://www.openuv.io/ for a free API key
import 'dotenv/config';

const { LAT, LON, UV_API_KEY } = process.env;

// UV Index levels and recommendations
const UV_LEVELS = [
  { min: 0, max: 2, level: 'Low', color: '#558B2F', textColor: 'white', icon: '🟢', protection: 'Minimal protection needed' },
  { min: 3, max: 5, level: 'Moderate', color: '#F9A825', textColor: 'white', icon: '🟡', protection: 'Seek shade during midday hours' },
  { min: 6, max: 7, level: 'High', color: '#EF6C00', textColor: 'white', icon: '🟠', protection: 'Protection essential - hat, sunscreen, shade' },
  { min: 8, max: 10, level: 'Very High', color: '#B71C1C', textColor: 'white', icon: '🔴', protection: 'Extra protection required - avoid sun 10am-4pm' },
  { min: 11, max: 99, level: 'Extreme', color: '#4A148C', textColor: 'white', icon: '🟣', protection: 'Avoid sun exposure - take all precautions' },
];

function getUVLevel(uv) {
  return UV_LEVELS.find(l => uv >= l.min && uv <= l.max) || UV_LEVELS[0];
}

let cache = { at: 0, data: null };
const CACHE_TTL = 30 * 60 * 1000; // 30 min (UV changes slowly)

export async function fetchUVIndex() {
  // Return cached data if fresh
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL) return cache.data;

  // If no API key configured, return null (graceful degradation)
  if (!UV_API_KEY || !LAT || !LON) {
    console.warn('[uv] UV_API_KEY, LAT, or LON not configured - UV index unavailable');
    return { available: false };
  }

  try {
    const url = `https://api.openuv.io/api/v1/uv?lat=${LAT}&lng=${LON}`;
    const res = await fetch(url, {
      headers: {
        'x-access-token': UV_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`OpenUV API failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const result = data.result;

    // Current UV index
    const uv = Math.round(result.uv * 10) / 10; // Round to 1 decimal
    const uvMax = Math.round(result.uv_max * 10) / 10;
    const level = getUVLevel(uv);

    const uvData = {
      available: true,
      uv: uv,
      uvMax: uvMax,
      level: level.level,
      color: level.color,
      textColor: level.textColor,
      icon: level.icon,
      protection: level.protection,
      uvTime: result.uv_time,
      uvMaxTime: result.uv_max_time,
      ozone: result.ozone,
      safeExposureTime: result.safe_exposure_time,
    };

    cache = { at: now, data: uvData };
    return uvData;
  } catch (err) {
    console.error('[uv] Failed to fetch UV index:', err.message);
    return { available: false, error: err.message };
  }
}
