// Startup script - starts server immediately, runs backfill in background if needed
import { getLatest } from './db.js';
import { exec } from 'child_process';

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
      exec('node backfill.js', (error, stdout, stderr) => {
        if (error) {
          console.error('[startup] Backfill error:', error.message);
          return;
        }
        if (stdout) console.log('[backfill]', stdout);
        if (stderr) console.error('[backfill]', stderr);
        console.log('[startup] Background backfill complete!');
      });
    }, 30000);
  }
}

startup();
