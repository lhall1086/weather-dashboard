// NWS observation stations for nearby towns/cities.
// Returns current temp for display on the map.
import 'dotenv/config';

const { LAT, LON } = process.env;
const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';

// Major towns/cities in Tallapoosa County + surrounding counties with known NWS stations.
const STATIONS = [
  { id: 'KALX', name: 'Alexander City', lat: 32.9147, lon: -85.9630, county: 'Tallapoosa' },
  { id: 'KMGM', name: 'Montgomery', lat: 32.3007, lon: -86.3940, county: 'Montgomery' },
  { id: 'KOPN', name: 'Opelika', lat: 32.6674, lon: -85.4307, county: 'Lee' },
  { id: 'KAUO', name: 'Auburn', lat: 32.6160, lon: -85.4340, county: 'Lee' },
  { id: 'KTLH', name: 'Tallassee', lat: 32.5410, lon: -85.8996, county: 'Tallapoosa' }, // closest proxy
];

let cache = { at: 0, data: [] };
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function nwsGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } });
  if (!res.ok) throw new Error(`NWS ${url} failed: ${res.status}`);
  return res.json();
}

// Fetch current observations for all stations.
export async function fetchObservations() {
  const now = Date.now();
  if (cache.data.length && now - cache.at < CACHE_TTL) return cache.data;

  const results = await Promise.allSettled(
    STATIONS.map(async (station) => {
      try {
        const obs = await nwsGet(`https://api.weather.gov/stations/${station.id}/observations/latest`);
        const props = obs.properties;
        const tempC = props.temperature?.value;
        const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;

        return {
          ...station,
          temp: tempF,
          conditions: props.textDescription || 'N/A',
          timestamp: props.timestamp,
        };
      } catch (err) {
        console.warn(`[observations] ${station.id} failed:`, err.message);
        return { ...station, temp: null, conditions: 'Unavailable' };
      }
    })
  );

  cache.data = results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason));
  cache.at = now;
  return cache.data;
}

// Major US cities with known NWS stations for nationwide coverage.
const US_MAJOR_STATIONS = [
  // Alabama
  { id: 'KBHM', name: 'Birmingham', lat: 33.5630, lon: -86.7533 },
  { id: 'KMGM', name: 'Montgomery', lat: 32.3007, lon: -86.3940 },
  // California
  { id: 'KLAX', name: 'Los Angeles', lat: 33.9380, lon: -118.3888 },
  { id: 'KSFO', name: 'San Francisco', lat: 37.6196, lon: -122.3647 },
  { id: 'KSAN', name: 'San Diego', lat: 32.7338, lon: -117.1933 },
  // Florida
  { id: 'KMIA', name: 'Miami', lat: 25.7959, lon: -80.2871 },
  { id: 'KTPA', name: 'Tampa', lat: 27.9753, lon: -82.5332 },
  { id: 'KJAX', name: 'Jacksonville', lat: 30.4941, lon: -81.6879 },
  // Texas
  { id: 'KDFW', name: 'Dallas', lat: 32.8968, lon: -97.0380 },
  { id: 'KIAH', name: 'Houston', lat: 29.9844, lon: -95.3414 },
  { id: 'KSAT', name: 'San Antonio', lat: 29.5337, lon: -98.4698 },
  { id: 'KAUS', name: 'Austin', lat: 30.1945, lon: -97.6699 },
  // New York
  { id: 'KJFK', name: 'New York', lat: 40.6413, lon: -73.7781 },
  { id: 'KBUF', name: 'Buffalo', lat: 42.9405, lon: -78.7322 },
  // Illinois
  { id: 'KORD', name: 'Chicago', lat: 41.9742, lon: -87.9073 },
  // Georgia
  { id: 'KATL', name: 'Atlanta', lat: 33.6407, lon: -84.4277 },
  // Colorado
  { id: 'KDEN', name: 'Denver', lat: 39.8561, lon: -104.6737 },
  // Washington
  { id: 'KSEA', name: 'Seattle', lat: 47.4502, lon: -122.3088 },
  // Arizona
  { id: 'KPHX', name: 'Phoenix', lat: 33.4342, lon: -112.0080 },
  // Nevada
  { id: 'KLAS', name: 'Las Vegas', lat: 36.0840, lon: -115.1537 },
  // Oregon
  { id: 'KPDX', name: 'Portland', lat: 45.5898, lon: -122.5951 },
  // Massachusetts
  { id: 'KBOS', name: 'Boston', lat: 42.3656, lon: -71.0096 },
  // Pennsylvania
  { id: 'KPHL', name: 'Philadelphia', lat: 39.8729, lon: -75.2437 },
  // Michigan
  { id: 'KDTW', name: 'Detroit', lat: 42.2124, lon: -83.3534 },
  // Minnesota
  { id: 'KMSP', name: 'Minneapolis', lat: 44.8820, lon: -93.2218 },
  // Missouri
  { id: 'KMCI', name: 'Kansas City', lat: 39.2976, lon: -94.7139 },
  { id: 'KSTL', name: 'St. Louis', lat: 38.7487, lon: -90.3700 },
  // Louisiana
  { id: 'KMSY', name: 'New Orleans', lat: 29.9934, lon: -90.2580 },
  // Tennessee
  { id: 'KBNA', name: 'Nashville', lat: 36.1245, lon: -86.6782 },
  { id: 'KMEM', name: 'Memphis', lat: 35.0421, lon: -89.9767 },
  // North Carolina
  { id: 'KCLT', name: 'Charlotte', lat: 35.2144, lon: -80.9473 },
  { id: 'KRDU', name: 'Raleigh', lat: 35.8776, lon: -78.7875 },
  // Ohio
  { id: 'KCLE', name: 'Cleveland', lat: 41.4117, lon: -81.8498 },
  { id: 'KCMH', name: 'Columbus', lat: 39.9980, lon: -82.8919 },
  // Wisconsin
  { id: 'KMKE', name: 'Milwaukee', lat: 42.9472, lon: -87.8966 },
  // Utah
  { id: 'KSLC', name: 'Salt Lake City', lat: 40.7899, lon: -111.9791 },
  // New Mexico
  { id: 'KABQ', name: 'Albuquerque', lat: 35.0402, lon: -106.6092 },
  // Oklahoma
  { id: 'KOKC', name: 'Oklahoma City', lat: 35.3931, lon: -97.6007 },
  // Virginia
  { id: 'KRIC', name: 'Richmond', lat: 37.5052, lon: -77.3197 },
  // South Carolina
  { id: 'KCHS', name: 'Charleston', lat: 32.8986, lon: -80.0405 },
  // Kentucky
  { id: 'KSDF', name: 'Louisville', lat: 38.1744, lon: -85.7360 },
  // Indiana
  { id: 'KIND', name: 'Indianapolis', lat: 39.7173, lon: -86.2944 },
  // Arkansas
  { id: 'KLIT', name: 'Little Rock', lat: 34.7294, lon: -92.2243 },
  // Mississippi
  { id: 'KJAN', name: 'Jackson', lat: 32.3112, lon: -90.0759 },
  // Kansas
  { id: 'KICT', name: 'Wichita', lat: 37.6499, lon: -97.4331 },
  // Nebraska
  { id: 'KOMA', name: 'Omaha', lat: 41.3032, lon: -95.8941 },
];

// Fetch observations for major US cities (for nationwide view).
export async function fetchNationwideObservations() {
  const observations = await Promise.allSettled(
    US_MAJOR_STATIONS.map(async (station) => {
      try {
        const obs = await nwsGet(`https://api.weather.gov/stations/${station.id}/observations/latest`);
        const tempC = obs.properties?.temperature?.value;
        const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;

        if (!tempF) return null;

        return {
          ...station,
          temp: tempF,
          conditions: obs.properties?.textDescription || '',
        };
      } catch (err) {
        console.warn(`[observations] ${station.id} failed:`, err.message);
        return null;
      }
    })
  );

  return observations
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
}
