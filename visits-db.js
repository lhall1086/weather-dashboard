// Visitor tracking database
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'visits.db'));

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

console.log('[visits-db] Visitor tracking database initialized');

/**
 * Log a page visit
 */
export function logVisit(ip, userAgent, path, referrer) {
  const timestamp = Date.now();
  const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD

  const stmt = db.prepare(`
    INSERT INTO visits (ip, userAgent, path, referrer, timestamp, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(ip, userAgent, path, referrer, timestamp, date);
}

/**
 * Get total page views in the last N days
 */
export function getPageViewsLastNDays(days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM visits
    WHERE timestamp >= ?
  `);

  const result = stmt.get(cutoff);
  return result.count || 0;
}

/**
 * Get unique visitors in the last N days
 */
export function getUniqueVisitorsLastNDays(days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT ip) as count
    FROM visits
    WHERE timestamp >= ?
  `);

  const result = stmt.get(cutoff);
  return result.count || 0;
}

/**
 * Get daily breakdown for the last N days
 */
export function getDailyBreakdown(days = 7) {
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
}

/**
 * Clean up old visits (keep last 90 days only)
 */
export function cleanupOldVisits() {
  const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    DELETE FROM visits
    WHERE timestamp < ?
  `);

  const result = stmt.run(cutoff);
  console.log(`[visits-db] Cleaned up ${result.changes} old visit records`);
}

// Clean up old visits once per day
setInterval(cleanupOldVisits, 24 * 60 * 60 * 1000);
