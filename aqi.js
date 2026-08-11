// Air Quality Index (AQI) data from WAQI (World Air Quality Index Project).
// Requires a free API token from https://aqicn.org/data-platform/token/
// Set WAQI_API_TOKEN in .env — if missing, this module returns null gracefully.
import 'dotenv/config';

const { LAT, LON, WAQI_API_TOKEN } = process.env;
const WAQI_BASE = 'https://api.waqi.info';

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

// Fetch current AQI by lat/lon from WAQI. Returns overall AQI and dominant pollutant.
// Falls back gracefully if API token is missing or API fails.
export async function fetchAQI() {
  if (!WAQI_API_TOKEN) {
    console.warn('[aqi] WAQI_API_TOKEN missing in .env — AQI unavailable. Get a free token at https://aqicn.org/data-platform/token/');
    return null;
  }

  const now = Date.now();
  if (aqiCache.data && now - aqiCache.at < AQI_TTL) return aqiCache.data;

  try {
    if (!LAT || !LON) throw new Error('Missing LAT/LON in .env');

    // WAQI API: finds the nearest station to the given coordinates
    const url = `${WAQI_BASE}/feed/geo:${LAT};${LON}/?token=${WAQI_API_TOKEN}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`WAQI API failed: ${res.status}`);
    const response = await res.json();

    if (response.status !== 'ok' || !response.data) {
      console.warn('[aqi] No AQI data returned:', response.data || 'unknown error');
      return null;
    }

    const data = response.data;
    const aqi = data.aqi;

    if (aqi === '-' || aqi == null) {
      console.warn('[aqi] AQI value unavailable for this location');
      return null;
    }

    const level = getAQILevel(aqi);

    // Determine dominant pollutant from iaqi (individual pollutant readings)
    let dominantPollutant = 'PM2.5'; // default
    if (data.dominentpol) {
      dominantPollutant = data.dominentpol.toUpperCase();
    } else if (data.iaqi) {
      // Find the pollutant with highest individual AQI
      let maxVal = 0;
      for (const [pollutant, reading] of Object.entries(data.iaqi)) {
        if (reading.v > maxVal) {
          maxVal = reading.v;
          dominantPollutant = pollutant.toUpperCase();
        }
      }
    }

    const result = {
      available: true,
      aqi: aqi,
      category: level.label,
      pollutant: dominantPollutant,
      level: level.label,
      color: level.color,
      textColor: level.textColor,
      stationName: data.city?.name || 'Unknown Station',
      timestamp: data.time?.s || new Date().toISOString(),
      location: data.city?.geo ? `${data.city.geo[0]}, ${data.city.geo[1]}` : null,
    };

    aqiCache = { at: now, data: result };
    return result;
  } catch (err) {
    console.warn('[aqi] fetch failed:', err.message);
    return null;
  }
}
