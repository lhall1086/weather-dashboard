// Storm Prediction Center (SPC) severe weather outlook.
// SPC issues Day 1-3 categorical outlooks (and Day 4-8 general thunderstorm outlooks).
// Risk levels: TSTM (general), MRGL (Marginal), SLGT (Slight), ENH (Enhanced), MDT (Moderate), HIGH (High).
//
// Data: GeoJSON from https://www.spc.noaa.gov/products/outlook/
// Cached 30 min (outlooks are issued ~01:00, 06:00, 13:00, 16:30, 20:00 UTC).
import 'dotenv/config';

const { LAT, LON } = process.env;
const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';

const CACHE_TTL = 30 * 60 * 1000; // 30 min
const cache = { day1: null, day2: null, day3: null };

// SPC risk levels in severity order (higher number = more severe).
const RISK_LEVELS = {
  TSTM: { order: 1, label: 'General Thunderstorms', color: '#c1e8c1' },
  MRGL: { order: 2, label: 'Marginal Risk', color: '#66bb6a' },
  SLGT: { order: 3, label: 'Slight Risk', color: '#ffeb3b' },
  ENH: { order: 4, label: 'Enhanced Risk', color: '#ff9800' },
  MDT: { order: 5, label: 'Moderate Risk', color: '#f44336' },
  HIGH: { order: 6, label: 'High Risk', color: '#9c27b0' },
};

async function fetchGeoJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`SPC ${url} failed: ${res.status}`);
  return res.json();
}

// Point-in-polygon test using ray-casting algorithm.
// Polygon is an array of [lon, lat] pairs; last point must equal first (closed).
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check if a point is inside any polygon of a MultiPolygon geometry.
function pointInMultiPolygon(point, multiPolygon) {
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      if (pointInPolygon(point, ring)) return true;
    }
  }
  return false;
}

// Fetch one day's outlook and determine the risk at our lat/lon.
async function fetchDayOutlook(day) {
  const url = `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cat.lyr.geojson`;
  const geojson = await fetchGeoJSON(url);
  if (!LAT || !LON) return null;

  const point = [parseFloat(LON), parseFloat(LAT)]; // GeoJSON is [lon, lat]
  let highestRisk = null;

  for (const feature of geojson.features || []) {
    const label = feature.properties?.LABEL;
    if (!label || !RISK_LEVELS[label]) continue;
    if (feature.geometry?.type === 'MultiPolygon') {
      if (pointInMultiPolygon(point, feature.geometry.coordinates)) {
        if (!highestRisk || RISK_LEVELS[label].order > RISK_LEVELS[highestRisk.code].order) {
          highestRisk = {
            code: label,
            label: RISK_LEVELS[label].label,
            color: RISK_LEVELS[label].color,
            order: RISK_LEVELS[label].order,
            valid: feature.properties.VALID_ISO,
            expire: feature.properties.EXPIRE_ISO,
          };
        }
      }
    }
  }

  return highestRisk;
}

// Fetch Day 1, 2, 3 outlooks (cached 30 min).
export async function fetchOutlook() {
  const now = Date.now();
  if (cache.day1 && now - cache.day1.at < CACHE_TTL) {
    return { day1: cache.day1.risk, day2: cache.day2?.risk, day3: cache.day3?.risk };
  }

  try {
    const [day1, day2, day3] = await Promise.all([
      fetchDayOutlook(1),
      fetchDayOutlook(2),
      fetchDayOutlook(3),
    ]);

    cache.day1 = { at: now, risk: day1 };
    cache.day2 = { at: now, risk: day2 };
    cache.day3 = { at: now, risk: day3 };

    return { day1, day2, day3 };
  } catch (err) {
    console.error('[spc]', err.message);
    // Return stale cache on error if available.
    if (cache.day1) return { day1: cache.day1.risk, day2: cache.day2?.risk, day3: cache.day3?.risk };
    throw err;
  }
}

// ---- Mesoscale discussions (MDs) ----
// Short-term SPC discussions about developing severe weather, often issued
// ahead of a watch. The RSS feed carries each MD's full text, which ends with
// a "LAT...LON" outline of the area it covers. Cached 5 min.
const MD_FEED_URL = 'https://www.spc.noaa.gov/products/spcmdrss.xml';
const MD_CACHE_TTL = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
let mdCache = { at: 0, items: null };

// "29178211" -> [-82.11, 29.17] ([lon, lat]). Longitudes past 100°W drop the
// leading 1, so "31610908" is 31.61°N 109.08°W.
function decodeLatLon(token) {
  const lat = Number(token.slice(0, 4)) / 100;
  let lon = Number(token.slice(4)) / 100;
  if (lon < 50) lon += 100;
  return [-lon, lat];
}

// End of "Valid 092148Z - 092315Z" as a Date; month/year come from the issue
// time, and the period can run into the next month ("Valid 312348Z - 010115Z").
function validUntil(text, issued) {
  const m = text.match(/Valid \d{6}Z - (\d{2})(\d{2})(\d{2})Z/);
  if (!m || Number.isNaN(issued.getTime())) return null;
  const [day, hour, minute] = m.slice(1).map(Number);
  const end = new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth(), day, hour, minute));
  if (end.getTime() < issued.getTime() - DAY_MS) end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function parseMdFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const tag = (name) => (item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]?.trim() || '';
    const description = tag('description');
    // The MD text sits in a CDATA block, so it is already plain text.
    const text = ((description.match(/<pre>([\s\S]*?)<\/pre>/) || [])[1] || '').trim();

    // "Areas affected..." and "Concerning..." can wrap across lines; each is its own paragraph.
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim());
    const field = (label) => (paragraphs.find((p) => p.startsWith(`${label}...`)) || '').slice(label.length + 3);

    const latLon = (text.match(/LAT\.\.\.LON\s+([\d\s]+)/) || [])[1] || '';
    const issued = new Date(tag('pubDate'));
    const number = Number((tag('title').match(/\d+/) || [])[0]);

    return {
      id: `spc-md-${number}`,
      number,
      title: `Mesoscale Discussion ${number}`,
      concerning: field('Concerning'),
      areasAffected: field('Areas affected'),
      text,
      url: tag('link'),
      imageUrl: (description.match(/<img[^>]*\bsrc="([^"]+)"/) || [])[1] || null,
      issued: Number.isNaN(issued.getTime()) ? null : issued.toISOString(),
      validUntil: validUntil(text, issued)?.toISOString() ?? null,
      polygon: latLon.trim().split(/\s+/).filter((t) => /^\d{8}$/.test(t)).map(decodeLatLon),
    };
  });
}

// Active MDs whose area covers the point (default: station LAT/LON).
// On a feed outage, keeps using the last fetched feed if there is one.
export async function fetchDiscussions(lat = parseFloat(LAT), lon = parseFloat(LON)) {
  const now = Date.now();
  if (!mdCache.items || now - mdCache.at >= MD_CACHE_TTL) {
    try {
      const res = await fetch(MD_FEED_URL, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`SPC MD feed failed: ${res.status}`);
      mdCache = { at: now, items: parseMdFeed(await res.text()) };
    } catch (err) {
      console.error('[spc-md]', err.message);
      if (!mdCache.items) throw err;
    }
  }

  return mdCache.items
    .filter((md) => !md.validUntil || Date.parse(md.validUntil) > now)
    .filter((md) => md.polygon.length >= 3 && pointInPolygon([lon, lat], md.polygon))
    .map(({ polygon, ...md }) => md);
}
