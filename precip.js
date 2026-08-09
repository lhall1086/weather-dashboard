// Precipitation analysis: storm totals, hourly intensity, and rain event tracking.
//
// AWN's `dailyrainin` resets at midnight, so a 2-day storm's total is invisible.
// This module tracks "storm total" — accumulation since rain started — and
// computes hourly intensity from the history table.
import { db } from './db.js';

// Storm total: accumulation since the last dry period (>3h with no measurable rain).
// Returns { total, startTime, durationHours } or null if no active storm.
export function getStormTotal() {
  // Find the most recent reading with rain.
  const latest = db
    .prepare('SELECT dateutc, hourlyrainin FROM readings WHERE hourlyrainin > 0 ORDER BY dateutc DESC LIMIT 1')
    .get();

  if (!latest) return null; // no rain in recorded history

  const now = Date.now();
  const timeSinceRain = now - latest.dateutc;

  // If last rain was >3h ago, storm has ended.
  if (timeSinceRain > 3 * 3600e3) return null;

  // Walk backward from `latest.dateutc` to find the start of this storm (last dry period).
  const rows = db
    .prepare('SELECT dateutc, hourlyrainin FROM readings WHERE dateutc <= ? ORDER BY dateutc DESC')
    .all(latest.dateutc);

  let stormStart = latest.dateutc;
  let total = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    total += r.hourlyrainin || 0;

    // If this reading and the next are >3h apart with no rain, we've found the storm start.
    const next = rows[i + 1];
    if (next) {
      const gap = r.dateutc - next.dateutc;
      if (gap > 3 * 3600e3 && (r.hourlyrainin || 0) === 0) {
        stormStart = r.dateutc;
        break;
      }
    } else {
      // Reached the beginning of history.
      stormStart = r.dateutc;
    }
  }

  const durationHours = (latest.dateutc - stormStart) / 3600e3;

  return {
    total: Math.round(total * 100) / 100, // inches, 2 decimals
    startTime: stormStart,
    durationHours: Math.round(durationHours * 10) / 10,
  };
}

// Hourly rainfall intensity over the last N hours.
// Returns array of { time (epoch ms), rate (in/h) }.
export function getHourlyIntensity(hours = 24) {
  const since = Date.now() - hours * 3600e3;
  const rows = db
    .prepare('SELECT dateutc, hourlyrainin FROM readings WHERE dateutc >= ? ORDER BY dateutc ASC')
    .all(since);

  return rows.map((r) => ({
    time: r.dateutc,
    rate: r.hourlyrainin || 0,
  }));
}

// Recent rainfall summary: last hour, last 6h, last 24h totals.
export function getRecentRainfall() {
  const now = Date.now();
  const oneHourAgo = now - 3600e3;
  const sixHoursAgo = now - 6 * 3600e3;
  const oneDayAgo = now - 24 * 3600e3;

  const last1h = db
    .prepare('SELECT SUM(hourlyrainin) as total FROM readings WHERE dateutc >= ?')
    .get(oneHourAgo);
  const last6h = db
    .prepare('SELECT SUM(hourlyrainin) as total FROM readings WHERE dateutc >= ?')
    .get(sixHoursAgo);
  const last24h = db
    .prepare('SELECT SUM(hourlyrainin) as total FROM readings WHERE dateutc >= ?')
    .get(oneDayAgo);

  return {
    last1h: Math.round((last1h?.total || 0) * 100) / 100,
    last6h: Math.round((last6h?.total || 0) * 100) / 100,
    last24h: Math.round((last24h?.total || 0) * 100) / 100,
  };
}
