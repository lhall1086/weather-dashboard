// Startup script - starts server immediately, runs backfill in background if needed
import { getLatest } from './db.js';

async function startup() {
  console.log('[startup] Checking database...');

  let needsBackfill = false;

  try {
    const latest = getLatest();

    if (!latest) {
      console.log('[startup] Database is empty. Will run backfill in background after server starts.');
      needsBackfill = true;
    } else {
      console.log('[startup] Database has data. Latest reading:', new Date(latest.dateutc).toISOString());

      // Check if we need historical backfill (less than 30 days of data)
      const { db } = await import('./db.js');
      const span = db.prepare('SELECT MIN(dateutc) as oldest, MAX(dateutc) as newest, COUNT(*) as count FROM readings').get();
      const spanDays = span.count ? Math.floor((span.newest - span.oldest) / (24 * 3600e3)) : 0;

      console.log(`[startup] Database span: ${spanDays} days (${span.count} readings)`);

      if (spanDays < 30) {
        console.log('[startup] Less than 30 days of data. Will run backfill to populate history.');
        needsBackfill = true;
      } else {
        console.log('[startup] Sufficient historical data. Skipping backfill.');
      }
    }
  } catch (err) {
    console.warn('[startup] Could not check database:', err.message);
  }

  // Start the main server FIRST (so Render sees open port)
  console.log('[startup] Starting server...');
  import('./server.js');

  // Run backfill in background if needed (doesn't block server)
  if (needsBackfill) {
    console.log('[startup] Will start background backfill in 30 seconds...');
    console.log('[startup] (Waiting to let realtime WebSocket establish connection first)');

    // Wait 30s before starting backfill to let realtime connect and start populating data.
    // This avoids rate limit conflicts between backfill and realtime at startup.
    setTimeout(() => {
      console.log('[startup] Starting background backfill...');

      // Import and run backfill directly instead of exec (better error handling)
      import('./backfill.js').then(({ backfillYear }) => {
        backfillYear()
          .then(() => console.log('[startup] Background backfill complete!'))
          .catch((err) => console.error('[startup] Backfill failed:', err.message));
      }).catch((err) => console.error('[startup] Failed to load backfill module:', err.message));
    }, 30000);
  }
}

startup();
