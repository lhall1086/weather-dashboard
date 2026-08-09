// Runs on a schedule and logs one AWN reading to SQLite each tick.
// This is what gives you history independent of AWN's rate limits and retention.
//
// Run it standalone:  node collector.js
// (server.js also starts it automatically, so you usually don't need to.)
import 'dotenv/config';
import cron from 'node-cron';
import { fetchCurrent } from './awn.js';
import { insertReading } from './db.js';

async function collectOnce() {
  try {
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

export function startCollector() {
  const schedule = process.env.COLLECT_CRON || '*/5 * * * *';
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid COLLECT_CRON: "${schedule}"`);
  }
  collectOnce(); // grab one immediately on startup
  cron.schedule(schedule, collectOnce);
  console.log(`[collector] scheduled: "${schedule}"`);
}

// If run directly (node collector.js), start the loop.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  startCollector();
}
