// Express backend. Holds the API keys, talks to AWN + NWS, serves clean JSON and the static page.
// The browser only ever talks to THIS server — the keys never leave the box.
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchCurrent } from './awn.js';
import { fetchForecast, fetchHourly, fetchAlerts, getLocationLabel, fetch7Day } from './nws.js';
import { fetchOutlook } from './spc.js';
import { computeIndices } from './indices.js';
import { getStormTotal, getHourlyIntensity, getRecentRainfall } from './precip.js';
import { fetchObservations, fetchNationwideObservations, fetchObservationsByBounds } from './observations.js';
import { getYoYComparison, getMonthlyComparison } from './analytics.js';
import { getHistory, getLatest, insertReading, getPressureTendency } from './db.js';
import { startCollector, markRealtimeHealthy } from './collector.js';
import { startRealtime, realtime } from './awn-realtime.js';
import { getAstronomyData } from './astronomy.js';
import { fetchAQI } from './aqi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// --- tiny in-memory cache for the live "current" call (respects AWN's 1 req/sec limit) ---
let currentCache = { at: 0, data: null };
const CURRENT_TTL = 60 * 1000; // 60s

// --- Server-Sent Events: connected browsers that want live pushes ---
const sseClients = new Set();

// Every realtime push: freshen the cache, persist it (denser history), and fan out to browsers.
realtime.on('reading', (data) => {
  currentCache = { at: Date.now(), data };
  markRealtimeHealthy(); // tell collector to stay idle (realtime is working)
  if (data.dateutc) {
    try { insertReading(data); } catch (err) { console.error('[server] insert failed:', err.message); }
  }
  const payload = `data: ${JSON.stringify({ source: 'realtime', data })}\n\n`;
  for (const res of sseClients) res.write(payload);
});

// Latest conditions. Falls back to the newest DB row if AWN is unreachable.
app.get('/api/current', async (req, res) => {
  try {
    const now = Date.now();
    if (currentCache.data && now - currentCache.at < CURRENT_TTL) {
      return res.json({ source: 'cache', data: currentCache.data });
    }
    const data = await fetchCurrent();
    currentCache = { at: now, data };
    res.json({ source: 'live', data });
  } catch (err) {
    const fallback = getLatest();
    if (fallback) return res.json({ source: 'db-fallback', data: fallback, error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// History for charts. ?range=24h | 7d | 30d
app.get('/api/history', (req, res) => {
  const ranges = { '24h': 24 * 3600e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
  const range = req.query.range || '24h';
  const span = ranges[range];
  if (!span) return res.status(400).json({ error: `bad range; use one of ${Object.keys(ranges).join(', ')}` });
  try {
    const rows = getHistory(Date.now() - span);
    res.json({ range, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3-hour barometric pressure tendency (local nowcast indicator).
app.get('/api/pressure-tendency', (req, res) => {
  try {
    const t = getPressureTendency();
    if (!t) return res.json({ available: false });
    res.json({ available: true, ...t });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7-day extended forecast (daily summaries from NWS 14 periods).
app.get('/api/forecast/7day', async (req, res) => {
  try {
    res.json({ days: await fetch7Day() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// SPC severe weather outlook (Day 1-3 categorical risk).
app.get('/api/spc/outlook', async (req, res) => {
  try {
    res.json(await fetchOutlook());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Today and tomorrow briefing (first two days from 7-day + current conditions).
app.get('/api/briefing', async (req, res) => {
  try {
    const days = await fetch7Day();
    const today = days[0];
    const tomorrow = days[1];
    res.json({ today, tomorrow });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Derived meteorological indices from current conditions.
app.get('/api/indices', async (req, res) => {
  try {
    const data = currentCache.data || getLatest();
    if (!data) return res.status(404).json({ error: 'No current data available' });
    res.json(computeIndices(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Precipitation analysis: storm total, hourly intensity, recent totals.
app.get('/api/precip', (req, res) => {
  try {
    const stormTotal = getStormTotal();
    const recent = getRecentRainfall();
    const hourlyIntensity = getHourlyIntensity(24);
    res.json({ stormTotal, recent, hourlyIntensity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Astronomy: sunrise/sunset, moon phase, moonrise/moonset.
// Times returned as epoch ms (UTC) — frontend converts to local display.
app.get('/api/astronomy', (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    res.json(getAstronomyData(date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Air Quality Index (AQI) from EPA AirNow. Requires AIRNOW_API_KEY in .env.
// Returns null if key is missing or API fails (graceful degradation).
app.get('/api/aqi', async (req, res) => {
  try {
    const aqi = await fetchAQI();
    res.json(aqi || { available: false });
  } catch (err) {
    res.status(500).json({ error: err.message, available: false });
  }
});

// Observation stations with current temps (for map overlay).
// Preferred: ?bbox=minLat,minLon,maxLat,maxLon returns every reporting station in
// the current map view (works at all zooms/regions). Falls back to the fixed lists.
app.get('/api/observations', async (req, res) => {
  try {
    if (req.query.bbox) {
      const parts = req.query.bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        return res.status(400).json({ error: 'bbox must be minLat,minLon,maxLat,maxLon' });
      }
      const [minLat, minLon, maxLat, maxLon] = parts;
      const stations = await fetchObservationsByBounds(minLat, minLon, maxLat, maxLon);
      return res.json({ stations });
    }

    // If nationwide requested, fetch major US cities
    if (req.query.nationwide === 'true') {
      const stations = await fetchNationwideObservations();
      return res.json({ stations });
    }

    // Otherwise return local stations
    res.json({ stations: await fetchObservations() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Year-over-year KPI comparison summary.
app.get('/api/analytics/yoy', (req, res) => {
  try {
    res.json(getYoYComparison());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly trends: this year vs last year (for charting).
app.get('/api/analytics/monthly', (req, res) => {
  try {
    res.json(getMonthlyComparison());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live stream of readings via Server-Sent Events. The browser opens this once and
// receives a push whenever the station uploads — no polling.
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 5000\n\n'); // tell the browser to reconnect after 5s if dropped

  // Send the latest known reading immediately so a fresh page isn't blank.
  if (currentCache.data) {
    res.write(`data: ${JSON.stringify({ source: 'cache', data: currentCache.data })}\n\n`);
  }

  sseClients.add(res);
  // Heartbeat comment keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// NWS 12h day/night forecast (cached 1h).
app.get('/api/forecast', async (req, res) => {
  try {
    res.json({ periods: await fetchForecast() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// NWS hourly forecast (next 24h, cached 1h).
app.get('/api/forecast/hourly', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 24;
    res.json({ periods: await fetchHourly(limit) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// NWS active alerts (watches/warnings/advisories, cached 2 min).
app.get('/api/alerts', async (req, res) => {
  try {
    res.json({ alerts: await fetchAlerts(), location: await getLocationLabel() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// The severe alert types we render on the map (matches NWS `event` values exactly).
const MAP_ALERT_TYPES = [
  'Tornado Watch',
  'Tornado Warning',
  'Severe Thunderstorm Watch',
  'Severe Thunderstorm Warning',
  'Flood Watch',
  'Flood Warning',
];
const NWS_HEADERS = { 'User-Agent': 'local-weather-dashboard (contact: you@example.com)', Accept: 'application/geo+json' };

// --- NWS zone geometry cache (zones are static; cache aggressively) ---
const zoneGeomCache = new Map(); // zoneUrl -> { at, geom }
const ZONE_TTL = 24 * 60 * 60 * 1000; // 24h

// Run async `fn` over `items` with at most `limit` in flight. NWS throttles bursts,
// so unbounded Promise.all over hundreds of zones stalls; a small pool stays fast.
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchZoneGeometry(zoneUrl) {
  const cached = zoneGeomCache.get(zoneUrl);
  if (cached && Date.now() - cached.at < ZONE_TTL) return cached.geom;
  try {
    const res = await fetch(zoneUrl, { headers: NWS_HEADERS });
    if (!res.ok) throw new Error(`zone ${res.status}`);
    const zone = await res.json();
    const geom = zone.geometry || null;
    zoneGeomCache.set(zoneUrl, { at: Date.now(), geom });
    return geom;
  } catch (err) {
    zoneGeomCache.set(zoneUrl, { at: Date.now(), geom: null });
    return null;
  }
}

// Assemble a MultiPolygon for a zone-based alert from an already-resolved zone map.
function geometryFromZoneMap(zoneUrls, resolved) {
  const polygons = [];
  for (const url of zoneUrls || []) {
    const g = resolved.get(url);
    if (!g) continue;
    if (g.type === 'Polygon') polygons.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polygons.push(...g.coordinates);
  }
  if (!polygons.length) return null;
  return { type: 'MultiPolygon', coordinates: polygons };
}

// --- assembled alerts cache (stale-while-revalidate) ---
let alertsCache = { at: 0, data: null };
let alertsBuilding = null; // in-flight build promise (dedupes concurrent builds)
const ALERTS_TTL = 2 * 60 * 1000; // consider cache fresh for 2 min

// Fetch active alerts, resolve zone-based ones (watches) into real geometry, and
// cache the assembled FeatureCollection. NWS warnings are storm-based (inline
// polygon); watches are zone-based (null geometry) — resolving zones is what makes
// tornado/thunderstorm/flood WATCHES appear, not just warnings.
async function buildAlertsGeoJSON() {
  const alertsRes = await fetch('https://api.weather.gov/alerts/active', { headers: NWS_HEADERS });
  if (!alertsRes.ok) throw new Error(`NWS alerts failed: ${alertsRes.status}`);
  const data = await alertsRes.json();

  const wanted = data.features.filter((f) => MAP_ALERT_TYPES.includes(f.properties?.event));

  // Dedup every zone URL across all zone-based alerts, then resolve once with a pool.
  const zoneSet = new Set();
  for (const f of wanted) {
    if (!f.geometry) for (const z of f.properties?.affectedZones || []) zoneSet.add(z);
  }
  const zoneUrls = [...zoneSet];
  const resolved = new Map();
  await mapPool(zoneUrls, 12, async (url) => {
    resolved.set(url, await fetchZoneGeometry(url));
  });

  const features = [];
  for (const f of wanted) {
    if (f.geometry) { features.push(f); continue; }
    const geom = geometryFromZoneMap(f.properties?.affectedZones, resolved);
    if (geom) features.push({ ...f, geometry: geom });
  }

  const counts = {};
  for (const f of features) counts[f.properties.event] = (counts[f.properties.event] || 0) + 1;

  const collection = { type: 'FeatureCollection', features, counts, generated: Date.now() };
  alertsCache = { at: Date.now(), data: collection };
  console.log('[alerts] built:', features.length, 'features', JSON.stringify(counts));
  return collection;
}

// Refresh guarded so only one build runs at a time.
function refreshAlerts() {
  if (alertsBuilding) return alertsBuilding;
  alertsBuilding = buildAlertsGeoJSON().finally(() => { alertsBuilding = null; });
  return alertsBuilding;
}

// NWS active alerts GeoJSON for the map. Always responds fast from cache; a stale
// cache triggers a background refresh. Only a cold start awaits the first build.
app.get('/api/alerts/geojson', async (req, res) => {
  try {
    const now = Date.now();
    if (!alertsCache.data) {
      await refreshAlerts(); // cold start
    } else if (now - alertsCache.at > ALERTS_TTL) {
      refreshAlerts(); // stale: refresh in background, serve current immediately
    }
    res.json(alertsCache.data || { type: 'FeatureCollection', features: [], counts: {} });
  } catch (err) {
    // If a build failed but we have older data, still serve it.
    if (alertsCache.data) return res.json(alertsCache.data);
    res.status(502).json({ error: err.message });
  }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Database status check (for debugging)
app.get('/api/db-status', (req, res) => {
  try {
    const { db } = require('./db.js');
    const latest = db.prepare('SELECT MAX(dateutc) as newest FROM readings').get();
    const span = db.prepare('SELECT MIN(dateutc) as oldest, MAX(dateutc) as newest, COUNT(*) as count FROM readings').get();
    const spanDays = span.count ? Math.floor((span.newest - span.oldest) / (24 * 3600e3)) : 0;

    res.json({
      count: span.count || 0,
      spanDays,
      oldest: span.oldest ? new Date(span.oldest).toISOString() : null,
      newest: span.newest ? new Date(span.newest).toISOString() : null,
      needsBackfill: spanDays < 30,
      message: spanDays < 30
        ? `Database has ${spanDays} days of data. Backfill should trigger automatically on next restart.`
        : `Database has ${spanDays} days of data. No backfill needed.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual backfill trigger (for debugging) - only works in development or with secret param
app.get('/api/backfill', async (req, res) => {
  // Require secret parameter in production to prevent abuse
  if (process.env.NODE_ENV === 'production' && req.query.secret !== process.env.BACKFILL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Import and run backfill
    const { backfillYear } = await import('./backfill.js');
    res.json({ status: 'started', message: 'Backfill started in background. Check logs for progress.' });

    // Run in background
    backfillYear()
      .then(() => console.log('[manual-backfill] Complete!'))
      .catch((err) => console.error('[manual-backfill] Error:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the dashboard.
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Weather dashboard on http://localhost:${PORT}`);
  startRealtime();  // live pushes -> cache, DB, and SSE
  startCollector(); // periodic REST backstop, in case realtime drops

  // Warm the alerts cache in the background (resolves zone geometry once up front),
  // then keep it warm so the map's Active Alerts always load instantly.
  refreshAlerts().catch((err) => console.warn('[alerts] initial build failed:', err.message));
  setInterval(() => refreshAlerts().catch(() => {}), ALERTS_TTL);
});
