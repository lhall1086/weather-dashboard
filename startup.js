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
    console.log('[startup] Starting background backfill for last 30 days...');
    console.log('[startup] Server is running, data will populate in 1-2 minutes.');

    // Run in background - don't wait for it to finish
    exec('node backfill.js', (error, stdout, stderr) => {
      if (error) {
        console.error('[startup] Backfill error:', error.message);
        return;
      }
      if (stdout) console.log('[backfill]', stdout);
      if (stderr) console.error('[backfill]', stderr);
      console.log('[startup] Background backfill complete!');
    });
  }
}

startup();
