// Startup script - runs backfill if database is empty, then starts server
import { getLatest } from './db.js';
import { execSync } from 'child_process';

async function startup() {
  console.log('[startup] Checking database...');

  try {
    const latest = getLatest();

    if (!latest) {
      console.log('[startup] Database is empty. Running backfill for last 30 days...');
      console.log('[startup] This will take 1-2 minutes. Please wait...');

      // Run backfill synchronously (blocks until complete)
      execSync('node backfill.js', { stdio: 'inherit' });

      console.log('[startup] Backfill complete! Starting server...');
    } else {
      console.log('[startup] Database has data. Latest reading:', latest.dateutc);
      console.log('[startup] Starting server...');
    }
  } catch (err) {
    console.warn('[startup] Could not check database:', err.message);
    console.log('[startup] Starting server anyway...');
  }

  // Start the main server
  import('./server.js');
}

startup();
