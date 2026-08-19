// Visitor tracking database
// NOTE: This is a non-critical feature. All operations are wrapped so that a
// failure here can NEVER crash the main server (which would stop weather alerts).
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use the same persistent disk on Render that the main weather DB uses, so
// visitor stats survive restarts and are written to a known-writable location.
const VISITS_DB_PATH = process.env.RENDER
  ? '/app/data/visits.db'
  : join(__dirname, 'visits.db');

let db = null;

try {
  // Ensure the data directory exists on Render
  if (process.env.RENDER) {
    const dataDir = dirname(VISITS_DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  db = new Database(VISITS_DB_PATH);

  // Initialize visits table
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      userAgent TEXT,
      path TEXT,
      referrer TEXT,
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL
    )
  `);

  // Create index for faster queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip)`);

  console.log(`[visits-db] Visitor tracking database initialized at: ${VISITS_DB_PATH}`);
} catch (err) {
  // Visitor tracking is non-essential — degrade gracefully instead of crashing.
  console.error('[visits-db] Failed to initialize visitor tracking (feature disabled):', err.message);
  db = null;
}

/**
 * Log a page visit
 */
export function logVisit(ip, userAgent, path, referrer) {
  if (!db) return;
  try {
    const timestamp = Date.now();
    const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD

    const stmt = db.prepare(`
      INSERT INTO visits (ip, userAgent, path, referrer, timestamp, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(ip, userAgent, path, referrer, timestamp, date);
  } catch (err) {
    console.warn('[visits-db] logVisit failed:', err.message);
  }
}

/**
 * Get total page views in the last N days
 */
export function getPageViewsLastNDays(days = 7) {
  if (!db) return 0;
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM visits
      WHERE timestamp >= ?
    `);

    const result = stmt.get(cutoff);
    return result.count || 0;
  } catch (err) {
    console.warn('[visits-db] getPageViewsLastNDays failed:', err.message);
    return 0;
  }
}

/**
 * Get unique visitors in the last N days
 */
export function getUniqueVisitorsLastNDays(days = 7) {
  if (!db) return 0;
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      SELECT COUNT(DISTINCT ip) as count
      FROM visits
      WHERE timestamp >= ?
    `);

    const result = stmt.get(cutoff);
    return result.count || 0;
  } catch (err) {
    console.warn('[visits-db] getUniqueVisitorsLastNDays failed:', err.message);
    return 0;
  }
}

/**
 * Get daily breakdown for the last N days
 */
export function getDailyBreakdown(days = 7) {
  if (!db) return [];
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      SELECT
        date,
        COUNT(*) as pageViews,
        COUNT(DISTINCT ip) as uniqueVisitors
      FROM visits
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date DESC
    `);

    return stmt.all(cutoff);
  } catch (err) {
    console.warn('[visits-db] getDailyBreakdown failed:', err.message);
    return [];
  }
}

/**
 * Clean up old visits (keep last 90 days only)
 */
export function cleanupOldVisits() {
  if (!db) return;
  try {
    const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      DELETE FROM visits
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoff);
    console.log(`[visits-db] Cleaned up ${result.changes} old visit records`);
  } catch (err) {
    console.warn('[visits-db] cleanupOldVisits failed:', err.message);
  }
}

// Clean up old visits once per day (only if the DB initialized)
if (db) {
  setInterval(cleanupOldVisits, 24 * 60 * 60 * 1000);
}
