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

  // Always go back 365 days from today to ensure we fetch all available historical data.
  // If the DB already has recent data (e.g., from realtime), we'll skip those duplicates
  // and import the older historical data that's missing.
  const startFrom = Date.now() - 365 * ONE_DAY;
  const oldestInDb = span?.oldest || Date.now();

  let date = Date.now();
  let imported = 0;
  let skipped = 0;
  let consecutiveSkips = 0;
  let passedOldestData = false; // Track when we've moved past existing data

  while (date > startFrom) {
    const endDate = new Date(date).toISOString();
    console.log(`[backfill] Fetching day: ${endDate.split('T')[0]}...`);

    try {
      // AWN returns up to 288 records per call (one day at 5-min spacing).
      const records = await fetchHistory({ limit: 288, endDate });

      if (!records || records.length === 0) {
        console.log('[backfill] No records returned for this day, continuing...');
        // Don't stop - the station might have been offline that day, keep checking older days
        date -= ONE_DAY;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
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

      // Check if we've moved past the oldest data in the DB (entering historical territory)
      if (!passedOldestData && date < oldestInDb) {
        passedOldestData = true;
        console.log('[backfill] Moved past existing data, now importing historical records...');
      }

      // If we skipped an entire day (already have all that data), track it.
      // BUT only stop early if we've already passed the existing DB data.
      // This prevents stopping when we encounter recent realtime data that's already in DB.
      if (dayImported === 0) {
        consecutiveSkips++;
        // Only apply early exit if we've passed existing data AND hit 5 consecutive skips
        if (passedOldestData && consecutiveSkips >= 5) {
          console.log('[backfill] 5 consecutive days with no new data in historical range, stopping.');
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
