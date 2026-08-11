// Air Quality Index (AQI) data from EPA's AirNow API.
// Requires a free API key from https://docs.airnowapi.org/account/request/
// Set AIRNOW_API_KEY in .env — if missing, this module returns null gracefully.
import 'dotenv/config';

const { LAT, LON, AIRNOW_API_KEY } = process.env;
const AIRNOW_BASE = 'https://www.airnowapi.org/aq';

let aqiCache = { at: 0, data: null };
const AQI_TTL = 60 * 60 * 1000; // 1h (AQI updates hourly)

// AQI breakpoints and colors (EPA standard).
const AQI_LEVELS = [
  { max: 50, label: 'Good', color: '#00e400', textColor: '#000' },
  { max: 100, label: 'Moderate', color: '#ffff00', textColor: '#000' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#ff7e00', textColor: '#000' },
  { max: 200, label: 'Unhealthy', color: '#ff0000', textColor: '#fff' },
  { max: 300, label: 'Very Unhealthy', color: '#8f3f97', textColor: '#fff' },
  { max: Infinity, label: 'Hazardous', color: '#7e0023', textColor: '#fff' },
];

function getAQILevel(aqi) {
  return AQI_LEVELS.find((lvl) => aqi <= lvl.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

// Fetch current AQI by lat/lon. Returns the worst (highest) pollutant's AQI.
// Falls back gracefully if API key is missing or API fails.
export async function fetchAQI() {
  if (!AIRNOW_API_KEY) {
    console.warn('[aqi] AIRNOW_API_KEY missing in .env — AQI unavailable. Get a free key at https://docs.airnowapi.org/account/request/');
    return null;
  }

  const now = Date.now();
  if (aqiCache.data && now - aqiCache.at < AQI_TTL) return aqiCache.data;

  try {
    if (!LAT || !LON) throw new Error('Missing LAT/LON in .env');
    const url = `${AIRNOW_BASE}/observation/latLong/current/?format=application/json&latitude=${LAT}&longitude=${LON}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`AirNow API failed: ${res.status}`);
    const data = await res.json();

    // AirNow returns an array of observations (one per pollutant: PM2.5, PM10, O3, etc.).
    // We take the worst (highest AQI) as the overall air quality.
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[aqi] No AQI data returned for this location');
      return null;
    }

    const worst = data.reduce((max, obs) => (obs.AQI > max.AQI ? obs : max), data[0]);
    const level = getAQILevel(worst.AQI);

    const result = {
      aqi: worst.AQI,
      category: worst.Category.Name,
      pollutant: worst.ParameterName, // e.g. "PM2.5", "OZONE"
      level: level.label,
      color: level.color,
      textColor: level.textColor,
      reportingArea: worst.ReportingArea,
      stateCode: worst.StateCode,
      timestamp: worst.DateObserved + ' ' + worst.HourObserved + ':00',
    };

    aqiCache = { at: now, data: result };
    return result;
  } catch (err) {
    console.warn('[aqi] fetch failed:', err.message);
    return null;
  }
}
