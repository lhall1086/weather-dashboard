// Shared SQLite setup + the list of fields we persist.
// Both collector.js and server.js import from here so the schema stays in one place.
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use persistent disk on Render (survives restarts), fall back to local path for development
const DB_PATH = process.env.RENDER
  ? '/app/data/weather.db'
  : join(__dirname, 'weather.db');

// Ensure the data directory exists on Render
if (process.env.RENDER) {
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export const db = new Database(DB_PATH);
console.log(`[db] Using database at: ${DB_PATH}`);
db.pragma('journal_mode = WAL'); // better concurrency: collector writes while server reads

// The AWN fields we care about. Keys are AWN's field names (imperial by default).
// `dateutc` is epoch milliseconds UTC from AWN; we store it as the primary key so
// re-inserting the same reading is a harmless no-op.
export const FIELDS = [
  'tempf', 'feelsLike', 'dewPoint', 'humidity',
  'windspeedmph', 'windgustmph', 'winddir',
  'baromrelin', 'baromabsin',
  'hourlyrainin', 'dailyrainin', 'weeklyrainin', 'monthlyrainin',
  'solarradiation', 'uv',
  'tempinf', 'humidityin',
];

// Build the table: dateutc + one REAL column per field.
const columnDefs = FIELDS.map((f) => `"${f}" REAL`).join(',\n  ');
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    dateutc INTEGER PRIMARY KEY,
    ${columnDefs}
  );
  CREATE INDEX IF NOT EXISTS idx_readings_dateutc ON readings(dateutc);
`);

// Prepared insert reused on every collection tick.
const placeholders = ['@dateutc', ...FIELDS.map((f) => `@${f}`)].join(', ');
const insertStmt = db.prepare(
  `INSERT OR REPLACE INTO readings (dateutc, ${FIELDS.map((f) => `"${f}"`).join(', ')})
   VALUES (${placeholders})`
);

// Insert one AWN `lastData` object. Missing fields are stored as NULL.
export function insertReading(lastData) {
  const row = { dateutc: lastData.dateutc };
  for (const f of FIELDS) {
    row[f] = lastData[f] ?? null;
  }
  insertStmt.run(row);
  return row.dateutc;
}

// Pull readings newer than `sinceMs` (epoch ms), oldest first — ready for charting.
export function getHistory(sinceMs) {
  return db
    .prepare('SELECT * FROM readings WHERE dateutc >= ? ORDER BY dateutc ASC')
    .all(sinceMs);
}

// Most recent stored reading (fallback when a live AWN call fails).
export function getLatest() {
  return db.prepare('SELECT * FROM readings ORDER BY dateutc DESC LIMIT 1').get();
}

// 3-hour pressure tendency (inHg/3h) for short-term forecasting.
// Classic meteorology rule: falling fast (< -0.06 inHg/3h) → deteriorating weather;
// rising fast (> +0.06 inHg/3h) → clearing. Steady = no near-term change.
// Returns { current, threeHoursAgo, delta, trend: 'falling' | 'rising' | 'steady' }.
export function getPressureTendency() {
  const now = Date.now();
  const threeHoursAgo = now - 3 * 3600e3;
  const current = db
    .prepare('SELECT dateutc, baromrelin FROM readings WHERE dateutc >= ? ORDER BY dateutc DESC LIMIT 1')
    .get(threeHoursAgo);
  const past = db
    .prepare('SELECT dateutc, baromrelin FROM readings WHERE dateutc <= ? ORDER BY dateutc DESC LIMIT 1')
    .get(threeHoursAgo);

  if (!current?.baromrelin || !past?.baromrelin) return null;

  const delta = current.baromrelin - past.baromrelin;
  let trend = 'steady';
  if (delta < -0.06) trend = 'falling';
  else if (delta > 0.06) trend = 'rising';

  return { current: current.baromrelin, threeHoursAgo: past.baromrelin, delta, trend };
}
