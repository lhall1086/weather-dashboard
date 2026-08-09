// Historical data backfill from AWN.
// AWN's history API supports up to 288 records per call (one day at 5-min spacing).
// To backfill a full year, we need to make ~365 sequential calls.
//
// Run once: node backfill.js
// Progress saved — safe to restart if interrupted.
import 'dotenv/config';
import { fetchHistory } from './awn.js';
import { insertReading, db } from './db.js';

const ONE_DAY = 24 * 3600e3;

async function backfillYear() {
  console.log('[backfill] Starting historical import (last 365 days)...');

  // Find the oldest reading we already have.
  const oldest = db.prepare('SELECT MIN(dateutc) as oldest FROM readings').get();
  const startFrom = oldest?.oldest ? oldest.oldest - ONE_DAY : Date.now() - 365 * ONE_DAY;

  let date = Date.now();
  let imported = 0;
  let skipped = 0;

  while (date > startFrom) {
    const endDate = new Date(date).toISOString();
    console.log(`[backfill] Fetching day: ${endDate.split('T')[0]}...`);

    try {
      // AWN returns up to 288 records per call (one day at 5-min spacing).
      const records = await fetchHistory({ limit: 288, endDate });

      if (!records || records.length === 0) {
        console.log('[backfill] No records returned, stopping.');
        break;
      }

      for (const r of records) {
        if (!r.dateutc) continue;

        // Check if already exists.
        const exists = db.prepare('SELECT 1 FROM readings WHERE dateutc = ?').get(r.dateutc);
        if (exists) {
          skipped++;
          continue;
        }

        insertReading(r);
        imported++;
      }

      console.log(`[backfill]   → ${records.length} records (${imported} new, ${skipped} skipped)`);

      // Move back one day.
      date -= ONE_DAY;

      // Respect AWN rate limit (1 req/sec).
      await new Promise((resolve) => setTimeout(resolve, 1100));
    } catch (err) {
      console.error(`[backfill] Error at ${endDate}:`, err.message);
      console.log('[backfill] Pausing 5s before retry...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`[backfill] Complete. Imported ${imported} new records, skipped ${skipped} duplicates.`);
}

// Run if called directly.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  backfillYear().catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  });
}

export { backfillYear };
