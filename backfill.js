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
  console.log('[backfill] Starting historical import...');

  // Check existing data span.
  const span = db.prepare('SELECT MIN(dateutc) as oldest, MAX(dateutc) as newest, COUNT(*) as count FROM readings').get();

  if (!span || !span.count) {
    console.log('[backfill] Database is empty, importing last 365 days...');
  } else {
    const ageMs = Date.now() - span.oldest;
    const ageDays = Math.floor(ageMs / ONE_DAY);
    console.log(`[backfill] Database has ${span.count} readings spanning ${ageDays} days (oldest: ${new Date(span.oldest).toISOString().split('T')[0]})`);

    // If we already have 300+ days of data, skip backfill entirely.
    if (ageDays >= 300) {
      console.log('[backfill] Already have 300+ days of data, skipping backfill.');
      return;
    }
  }

  // Find the oldest reading we already have.
  const oldest = span?.oldest ? span.oldest - ONE_DAY : Date.now() - 365 * ONE_DAY;
  const startFrom = oldest;

  let date = Date.now();
  let imported = 0;
  let skipped = 0;
  let consecutiveSkips = 0;

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

      let dayImported = 0;
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
        dayImported++;
      }

      console.log(`[backfill]   → ${records.length} records (${dayImported} new, ${records.length - dayImported} skipped)`);

      // If we skipped an entire day (already have all that data), track it.
      if (dayImported === 0) {
        consecutiveSkips++;
        // If we've skipped 5 consecutive days, we've reached already-imported territory.
        if (consecutiveSkips >= 5) {
          console.log('[backfill] 5 consecutive days already in DB, stopping early.');
          break;
        }
      } else {
        consecutiveSkips = 0;
      }

      // Move back one day.
      date -= ONE_DAY;

      // Conservative rate limit: 1.5s between requests (safer than 1.1s).
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`[backfill] Error at ${endDate}:`, err.message);

      // If we hit rate limit, back off significantly.
      if (err.message.includes('429')) {
        console.log('[backfill] Rate limit hit, pausing 30s...');
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.log('[backfill] Pausing 5s before retry...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
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
