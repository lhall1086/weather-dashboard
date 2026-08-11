// Runs on a schedule and logs one AWN reading to SQLite each tick.
// This is a BACKUP mechanism — only runs if the realtime WebSocket has failed.
// When realtime is working (which is 99% of the time), this stays idle to avoid
// hitting AWN's 1 req/sec rate limit.
//
// Run it standalone:  node collector.js
// (server.js also starts it automatically, so you usually don't need to.)
import 'dotenv/config';
import cron from 'node-cron';
import { fetchCurrent } from './awn.js';
import { insertReading } from './db.js';

let lastRealtimeAt = 0; // timestamp of last realtime reading
let isRealtimeHealthy = false;
let cronJob = null;

async function collectOnce() {
  try {
    // If realtime has pushed data in the last 10 minutes, skip REST polling.
    // This prevents rate limit abuse when the WebSocket is working fine.
    const timeSinceRealtime = Date.now() - lastRealtimeAt;
    if (isRealtimeHealthy && timeSinceRealtime < 10 * 60 * 1000) {
      console.log('[collector] skipped (realtime is healthy)');
      return;
    }

    // Realtime appears down/stale — fall back to REST polling.
    console.log('[collector] realtime stale, polling REST...');
    const lastData = await fetchCurrent();
    if (!lastData || !lastData.dateutc) {
      console.warn('[collector] no lastData in AWN response, skipping');
      return;
    }
    const ts = insertReading(lastData);
    console.log(`[collector] stored reading @ ${new Date(ts).toISOString()} (${lastData.tempf}°F)`);
  } catch (err) {
    console.error('[collector] error:', err.message);
  }
}

// Called by server.js whenever a realtime reading arrives — marks realtime as healthy.
export function markRealtimeHealthy() {
  lastRealtimeAt = Date.now();
  isRealtimeHealthy = true;
}

export function startCollector() {
  const schedule = process.env.COLLECT_CRON || '*/5 * * * *';
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid COLLECT_CRON: "${schedule}"`);
  }

  // Don't run immediately on startup if realtime might be connecting.
  // Let realtime have a chance to connect first (15s grace period).
  setTimeout(() => {
    if (!isRealtimeHealthy) {
      console.log('[collector] realtime not connected after 15s, running initial collection');
      collectOnce();
    }
  }, 15000);

  cronJob = cron.schedule(schedule, collectOnce);
  console.log(`[collector] scheduled: "${schedule}" (backup mode — only runs if realtime fails)`);
}

// If run directly (node collector.js), start the loop.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  startCollector();
}
