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
      console.log('[startup] Database has data. Latest reading:', latest.dateutc);
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
