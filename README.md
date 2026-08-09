# Local Weather Labs

A self-hosted weather dashboard fed by your **Ambient Weather Network** station, with
**SQLite history**, **Chart.js** trends, and a free **NWS forecast**. Units are imperial.

```
AWN realtime (WebSocket) ─┐  push
AWN REST (poll, backstop) ─┼─► Node/Express proxy ─► SQLite (history)
NWS API ──────────────────┘        │
                                    ├─► /api/stream (SSE) ─┐
                                    └─► static dashboard ──┴─► Chart.js (live)
```

The browser only ever talks to your own server — your AWN keys stay in `.env` on the box.

## Forecasting features (NWS + SPC + your station)

Phase 1 extended forecasting answers: **"How's today/tomorrow?"** and **"Severe weather in next 7 days? How severe?"**

### Today / Tomorrow Briefing

Hero cards at the top show quick summaries:
- **Today:** High/low temps, conditions, precip %, **detailed forecast text**, severe weather flag (if keywords detected)
- **Tomorrow:** Same breakdown with full forecast narrative

Auto-updates hourly. Designed for a quick glance before you head out — now includes the full NWS forecast discussion for context.

### 7-Day Extended Forecast

Daily cards showing:
- High/low temps
- Day/night conditions
- Precipitation probability
- **⚠ Severe weather flag** — keywords like "tornado," "severe," "damaging winds," "large hail," "flooding" trigger an orange border + badge

Answers: "Which days this week have storms? How bad?"

### SPC Severe Weather Outlook (Day 1-3)

**Storm Prediction Center** categorical risk timeline with **clickable cards**:
- **Day 1, 2, 3** risk levels: None → General Thunderstorms → Marginal → Slight → Enhanced → Moderate → High
- Color-coded borders (green → yellow → orange → red → purple)
- Based on your exact lat/lon (point-in-polygon check against SPC's GeoJSON outlooks)
- **Click any day** to view the full detailed SPC outlook for that day

This is **the authoritative severe weather forecast** meteorologists use. A "Moderate" risk 2 days out means: stay weather-aware, have a plan.

Refreshed every 30 min (SPC issues new outlooks ~5 times/day).

---

## Phase 2: Meteorological Depth

### Derived Meteorological Indices

Raw temp and humidity are useful, but meteorologists rely on **derived indices** for decision-making. The dashboard now computes and displays:

| Index | What it measures | When shown |
|---|---|---|
| **Heat Index** | Apparent temp when hot/humid (NWS Rothfusz regression) | Temp ≥ 80°F, RH ≥ 40% |
| **Wind Chill** | Apparent temp when cold/windy (NWS formula) | Temp ≤ 50°F, wind ≥ 3 mph |
| **Dewpoint Depression** | Temp − dewpoint; fog/stratus indicator | Always |
| **Wet Bulb Temperature** | True heat-stress metric (Stull approximation) | Always |
| **Vapor Pressure Deficit (VPD)** | Evapotranspiration demand (kPa) | Always |

**Key thresholds:**
- Heat Index > 103°F → Heat Advisory criteria
- Wind Chill < 0°F → Frostbite risk increases
- Dewpoint Depression < 3°F → Fog imminent, < 5°F → Fog likely
- Wet Bulb ≥ 88°F → Dangerous heat stress (even for healthy people)

Tiles auto-hide when conditions don't warrant them (e.g., no heat index in winter).

### Precipitation Analysis

Fixes AWN's `dailyrainin` blind spot (resets at midnight, so a 2-day storm's total is invisible):

- **Storm total** — accumulation since rain started (>3h dry gap = storm ended)
- **Recent totals** — last 1h, 6h, 24h
- **Start time & duration** — when did this rain event begin?

Answers: "How much has it rained *this storm*?" (not just "today").

Auto-updates every 60s with new station data.

### Year-over-Year Historical Analytics

**Compare this year vs last year across all KPIs:**

- **KPI Summary Cards** — side-by-side comparison with % change:
  - Avg/Max/Min Temperature
  - Total Rainfall
  - Avg Wind / Max Gust
  - Color-coded deltas (🟠 up, 🔵 down)

- **Monthly Trend Charts:**
  - **Temperature chart** — Line graph showing avg temp by month (this year vs last year)
  - **Rainfall chart** — Bar graph showing monthly precip totals

**How to populate historical data:**

Run the backfill script once to import the last year from AWN:

```bash
cd weather-dashboard
node backfill.js
```

This fetches AWN's historical records (up to 365 days, respecting the 1 req/sec rate limit). Progress is saved — safe to restart if interrupted. Takes ~6-7 minutes to complete.

Without historical data, the analytics section shows "Insufficient Data" message.

Auto-updates every 60s with new station data.

### Interactive Regional Map

**Nationwide weather map with intelligent zoom behavior:**

- **Base map:** Light grey CartoDB (optimized for overlay visibility)
- **Default view:** Starts at US-wide scale showing temperatures across the entire country
- **Clean interface:** No clutter - just the map, temperatures, and weather overlays

**Toggleable layers:**
  - **Temperatures** — Clean text-only labels with enhanced visibility:
    - **US-wide view (zoom <7):** 45+ major cities from coast to coast (LA, NYC, Miami, Seattle, etc.)
    - **Local view (zoom ≥7):** 5 regional NWS stations (Alexander City, Montgomery, Opelika, Auburn, Tallassee)
    - **Auto-switching:** Map intelligently reloads appropriate stations whenever zoom level changes
    - Click labels for station name, temp, conditions
    - Bold black text with bright white outline for visibility on any background
  - **Satellite** — GOES visible/IR composite (cloud cover) - 70% opacity
  - **Precipitation** — NWS NEXRAD national mosaic (rain/snow) - 85% opacity, nationwide coverage
  - **Active Alerts** — Live NWS warnings/watches as interactive polygons (sourced from NWS GeoJSON API)
    - **Alert types shown:** 
      - 🔴 Tornado Warning (red)
      - 🟡 Tornado Watch (yellow)
      - 🟠 Severe Thunderstorm Warning (orange)
      - 🟡 Severe Thunderstorm Watch (gold)
      - 🟢 Flood Warning (green)
      - 🟢 Flood Watch (light green)
    - **Interactive:** Click any alert polygon to see full details (headline, description, instructions)
    - **Auto-refresh:** Polls NWS API every 2 minutes for latest active alerts
    - **Full coverage:** Nationwide - shows all active alerts across the entire US
    - **Real-time data:** Directly from NWS API, not cached tiles

**Usage:**
- **Start nationwide:** Map opens showing US-wide view with temperatures across all major cities
- **Zoom in:** Automatically switches to local stations when you zoom to regional view
- **Zoom out:** Automatically loads nationwide stations when you zoom back out
- **Toggle layers:** Turn temperatures, satellite, precipitation, and warnings on/off independently
- **Layer visibility optimized:** Light grey base ensures radar, satellite, and warnings are clearly visible

**Nationwide coverage includes 45+ major cities:**
- West Coast: Los Angeles, San Francisco, San Diego, Seattle, Portland, Las Vegas, Phoenix
- Central: Dallas, Houston, San Antonio, Austin, Denver, Chicago, Kansas City, St. Louis
- South: Miami, Tampa, Jacksonville, New Orleans, Atlanta, Birmingham, Nashville, Memphis, Charlotte
- Northeast: New York, Boston, Philadelphia, Buffalo
- Midwest: Detroit, Minneapolis, Milwaukee, Cleveland, Columbus, Indianapolis, Omaha, Wichita

Built with Leaflet. Temps refresh every 5 min. Warnings auto-update every 2 min. All weather overlays work nationwide.

### Radar & Resource Links

Direct links to:
- **Local radar (KMXX)** — Maxwell AFB WSR-88D, your nearest radar (opens NWS loop)
- **Regional mosaic** — Southeast US composite radar
- **NWS Birmingham** — Your local forecast office (BMX)
- **Climate Prediction Center** — Long-range outlooks (6-14 day, monthly, seasonal)
- **National Hurricane Center** — Tropical storm and hurricane forecasts
- **Mesoscale Discussions** — SPC active MDs with short-term severe weather updates

All links open in a new tab.

---

## Additional forecasting features

Three more data products strengthen the dashboard:

1. **Active watches/warnings/advisories** — displayed as a banner at the top (hidden when none).
   Refreshed every 2 minutes. **Safety-critical** — a dashboard that misses a tornado warning
   is worse than no dashboard. Severity color-coded: Extreme (red) → Severe → Moderate → Minor.

2. **Hourly forecast** (next 24h) — NWS gridpoint hourly forecast: temp, precip %, humidity, wind.
   Denser near-term view than the 12h day/night periods. Refreshed hourly.

3. **3-hour barometric pressure tendency** — a **classic single-station forecasting technique**.
   The dashboard compares your station's *current* pressure to 3 hours ago; meteorologists use
   this as a standard short-term indicator:
   - **Falling fast** (< -0.06 inHg/3h) → weather deteriorating (storm approaching, frontal passage)
   - **Rising fast** (> +0.06 inHg/3h) → clearing
   - **Steady** → no near-term change

   The pressure tendency is computed from your own SQLite history, so it's a true *local* nowcast
   (not a model forecast). Requires 3h of logged history; "insufficient history" shows until then.

## Live updates (realtime)

The dashboard uses **two** AWN data paths:

- **Realtime WebSocket** (`awn-realtime.js`) — AWN *pushes* each new reading the moment your
  station uploads it. The server stores it to SQLite, refreshes the live cache, and streams it
  to the browser over **Server-Sent Events** (`/api/stream`). Tiles update with no polling delay;
  the source badge shows a green ● **realtime**.
- **REST collector** (`collector.js`) — a periodic backstop that keeps logging history if the
  socket ever drops. The browser also auto-falls-back to polling `/api/current` if the stream errors.

## Setup

1. **Install Node.js 18+** (needs the built-in `fetch`).
2. **Install dependencies:**
   ```bash
   cd weather-dashboard
   npm install
   ```
3. **Add your credentials:** copy `.env.example` to `.env` and fill in:
   - `AWN_API_KEY` and `AWN_APP_KEY` — from your AWN account page (**Account → API Keys**). You need *both*.
   - `AWN_MAC` — your station's MAC address (in the AWN dashboard).
   - `LAT` / `LON` — your station's coordinates (for the NWS forecast).
4. **Run it:**
   ```bash
   npm start
   ```
   Open http://localhost:3000.

The collector starts automatically with the server and logs a reading every 5 minutes
(change with `COLLECT_CRON` in `.env`). History fills in over time — charts get richer
the longer it runs.

## API endpoints (served by your proxy)

| Endpoint | Returns |
|---|---|
| `GET /api/current` | Latest conditions (live, cached 60s, or DB fallback) |
| `GET /api/stream` | Live SSE stream — each new reading pushed instantly |
| `GET /api/history?range=24h\|7d\|30d` | Stored readings for charting |
| `GET /api/pressure-tendency` | 3h pressure tendency (local nowcast indicator) |
| `GET /api/briefing` | Today + tomorrow summary cards (high/low/conditions/precip/severe flag) |
| `GET /api/spc/outlook` | SPC Day 1-3 categorical severe weather outlook for your location |
| `GET /api/forecast/7day` | 7-day extended forecast (daily summaries with severe keyword detection) |
| `GET /api/indices` | Derived meteorological indices (heat index, wind chill, dewpoint depression, wet bulb, VPD) |
| `GET /api/precip` | Precipitation analysis (storm total, recent totals, hourly intensity) |
| `GET /api/observations` | Nearby NWS observation stations with current temps (for map temperature overlay) |
| `GET /api/analytics/yoy` | Year-over-year KPI comparison summary (this year vs last year) |
| `GET /api/analytics/monthly` | Monthly trend data for charting (this year vs last year by month) |
| `GET /api/forecast` | NWS 12h day/night forecast (cached 1h) |
| `GET /api/forecast/hourly?limit=24` | NWS hourly forecast (cached 1h) |
| `GET /api/alerts` | Active watches/warnings/advisories (cached 2 min) |

## Notes & gotchas

- **AWN rate limit is 1 request/second** per API key. The server caches `/api/current`
  for 60s so a busy dashboard won't trip it. The realtime WebSocket doesn't count against
  this — it's a push connection, so live updates are effectively free.
- **Realtime uses a different host and an old Socket.IO protocol.** It connects to
  `api.ambientweather.net` (not the `rt.` REST host) and the server speaks the **Socket.IO v2**
  protocol — that's why `package.json` pins `socket.io-client@^2`. A v3/v4 client will not
  complete the handshake. (Verified against Ambient's official client source.)
- **Data freshness is capped by your station's upload interval** (typically ~60s), not by the
  API. Realtime removes *polling* delay, but you still can't see data newer than the station sent.
  A paid AWN subscription mainly affects the AWN app's retention/graphing — it does not speed
  up the station's uploads.
- **Never expose the keys client-side.** They live only in `.env` and are used server-side.
- **NWS is US-only** and requires a `User-Agent` — edit the contact string in `nws.js`.
- **Backfill:** this logs history going forward. `awn.js` also has `fetchHistory()` if you
  want to write a one-off script to import AWN's recent records into SQLite.

## Running it as a service

To keep it running, use `pm2` (`npm i -g pm2 && pm2 start server.js --name weather`) or a
systemd unit / Windows Task Scheduler entry, so the collector keeps logging across reboots.
