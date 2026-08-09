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
import { fetchObservations, fetchNationwideObservations } from './observations.js';
import { getYoYComparison, getMonthlyComparison } from './analytics.js';
import { getHistory, getLatest, insertReading, getPressureTendency } from './db.js';
import { startCollector } from './collector.js';
import { startRealtime, realtime } from './awn-realtime.js';

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

// Observation stations with current temps (for map overlay).
app.get('/api/observations', async (req, res) => {
  try {
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

// NWS active alerts GeoJSON for map display (nationwide, filtered for severe alerts only).
app.get('/api/alerts/geojson', async (req, res) => {
  try {
    const alertsRes = await fetch('https://api.weather.gov/alerts/active', {
      headers: { 'User-Agent': 'local-weather-dashboard (contact: you@example.com)' }
    });

    if (!alertsRes.ok) {
      throw new Error(`NWS alerts failed: ${alertsRes.status}`);
    }

    const data = await alertsRes.json();

    // Filter for only the alert types we want to display
    const alertTypes = [
      'Tornado Watch',
      'Tornado Warning',
      'Severe Thunderstorm Watch',
      'Severe Thunderstorm Warning',
      'Flood Watch',
      'Flood Warning'
    ];

    const filtered = {
      type: 'FeatureCollection',
      features: data.features.filter(f => {
        const event = f.properties?.event;
        return event && alertTypes.includes(event);
      })
    };

    res.json(filtered);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Serve the dashboard.
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Weather dashboard on http://localhost:${PORT}`);
  startRealtime();  // live pushes -> cache, DB, and SSE
  startCollector(); // periodic REST backstop, in case realtime drops
});
