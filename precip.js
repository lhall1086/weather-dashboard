// Precipitation analysis: storm totals, hourly intensity, and rain event tracking.
//
// AWN field semantics (critical):
//   - `hourlyrainin`  is a RATE (in/hr) at the moment of the reading — NOT accumulation.
//                     Summing it across readings multiplies rain by the number of readings.
//   - `dailyrainin`   is CUMULATIVE since midnight and RESETS to 0 at midnight.
//
// To measure real accumulation over any window we sum the positive change in `dailyrainin`
// between consecutive readings (a "delta" method), handling the midnight reset. This is the
// only method that neither inflates (rate summing) nor loses multi-day totals (single-day max).
import { db } from './db.js';

const HOUR_MS = 3600e3;
const DRY_GAP_MS = 3 * HOUR_MS; // >3h with no measurable rain ends a storm

// Sum real rainfall accumulation (inches) across ordered readings via dailyrainin deltas.
//   normal step:                add (curr - prev)
//   midnight reset (curr < prev): add curr  (the new day's accumulation so far)
// The first row is a baseline (rain before the window is excluded).
function accumulateRain(rows) {
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].dailyrainin || 0;
    const curr = rows[i].dailyrainin || 0;
    total += curr >= prev ? curr - prev : curr; // reset => the small new value is the increment
  }
  return Math.max(0, total);
}

// Storm total: accumulation since the last dry period (>3h with no measurable rain).
// Returns { total, startTime, durationHours } or null if there's no active storm.
export function getStormTotal() {
  // Most recent reading that actually recorded rain.
  const latest = db
    .prepare('SELECT dateutc FROM readings WHERE hourlyrainin > 0 ORDER BY dateutc DESC LIMIT 1')
    .get();

  if (!latest) return null; // no rain in recorded history

  // If the last measurable rain was >3h ago, there's no active storm right now.
  if (Date.now() - latest.dateutc > DRY_GAP_MS) return null;

  // Walk backward through the RAINY readings only, newest first. The storm's continuous
  // start is the earliest rainy reading reachable without a gap of >3h between rain events.
  const rainyRows = db
    .prepare('SELECT dateutc FROM readings WHERE hourlyrainin > 0 AND dateutc <= ? ORDER BY dateutc DESC')
    .all(latest.dateutc);

  let stormStart = latest.dateutc;
  for (const r of rainyRows) {
    // Gap between this rainy reading and the next-later rainy reading we accepted.
    if (stormStart - r.dateutc > DRY_GAP_MS) break; // >3h dry stretch => storm boundary
    stormStart = r.dateutc;
  }

  // Accumulate real inches over the storm window using the dailyrainin delta method.
  const windowRows = db
    .prepare('SELECT dateutc, dailyrainin FROM readings WHERE dateutc >= ? AND dateutc <= ? ORDER BY dateutc ASC')
    .all(stormStart, latest.dateutc);

  const total = accumulateRain(windowRows);
  const durationHours = (latest.dateutc - stormStart) / HOUR_MS;

  return {
    total: Math.round(total * 100) / 100, // inches, 2 decimals
    startTime: stormStart,
    durationHours: Math.round(durationHours * 10) / 10,
  };
}

// Hourly rainfall intensity over the last N hours.
// Returns array of { time (epoch ms), rate (in/h) } — hourlyrainin IS a rate, so it's used directly.
export function getHourlyIntensity(hours = 24) {
  const since = Date.now() - hours * HOUR_MS;
  const rows = db
    .prepare('SELECT dateutc, hourlyrainin FROM readings WHERE dateutc >= ? ORDER BY dateutc ASC')
    .all(since);

  return rows.map((r) => ({
    time: r.dateutc,
    rate: r.hourlyrainin || 0,
  }));
}

// Recent rainfall summary: real accumulation over the last hour, 6h, and 24h.
// Uses the dailyrainin delta method (NOT SUM(hourlyrainin), which inflates by ~#readings).
export function getRecentRainfall() {
  const now = Date.now();

  const windowTotal = (ms) => {
    const rows = db
      .prepare('SELECT dateutc, dailyrainin FROM readings WHERE dateutc >= ? ORDER BY dateutc ASC')
      .all(now - ms);
    return Math.round(accumulateRain(rows) * 100) / 100;
  };

  return {
    last1h: windowTotal(HOUR_MS),
    last6h: windowTotal(6 * HOUR_MS),
    last24h: windowTotal(24 * HOUR_MS),
  };
}
