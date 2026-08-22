// Records & Almanac — built entirely from our own stored station history
// (the `readings` table in weather.db). No external API.
//
// Everything is keyed off the calendar date. Readings store `dateutc` (epoch
// milliseconds, UTC); we derive the calendar day / month-day / year with
// SQLite's strftime on the unix epoch. That uses UTC day boundaries — the same
// convention analytics.js already uses — which for a daily high/low almanac is
// immaterial (the station's sub-day offset doesn't change a day's max/min).
//
// IMPORTANT: with only a limited backfill of history, "records" and "normals"
// are approximate — a "record" may reflect just one prior year. We return
// `yearsObserved` / `historyStart` so the UI can label them honestly.
import { db } from './db.js';

// One row per calendar day: that day's high, low, rainfall total and peak gust.
// AWN's dailyrainin resets at midnight, so MAX(dailyrainin) per day is the daily
// total. Exposed columns: ymd (YYYY-MM-DD), md (MM-DD), yr (YYYY), mm (MM),
// dom (day-of-month int), hi, lo, rain, gust.
const DAILY_AGG = `
  SELECT
    strftime('%Y-%m-%d', dateutc/1000, 'unixepoch')            AS ymd,
    strftime('%m-%d',    dateutc/1000, 'unixepoch')            AS md,
    strftime('%Y',       dateutc/1000, 'unixepoch')            AS yr,
    strftime('%m',       dateutc/1000, 'unixepoch')            AS mm,
    CAST(strftime('%d',  dateutc/1000, 'unixepoch') AS INTEGER) AS dom,
    MAX(tempf)       AS hi,
    MIN(tempf)       AS lo,
    MAX(dailyrainin) AS rain,
    MAX(windgustmph) AS gust
  FROM readings
  WHERE tempf IS NOT NULL
  GROUP BY ymd
`;

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// The calendar-date parts for "today" in the station's timezone (Central),
// regardless of what timezone the server runs in (Render is UTC).
function centralDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return { year, month, day, md: `${month}-${day}`, ymd: `${year}-${month}-${day}` };
}

// Month-to-date rainfall this year vs the average of prior years' same-window.
function getMonthToDateRain(today) {
  const cur = db
    .prepare(
      `SELECT SUM(rain) AS total FROM (${DAILY_AGG})
       WHERE mm = ? AND dom <= ? AND yr = ?`
    )
    .get(today.month, Number(today.day), today.year);

  const norm = db
    .prepare(
      `SELECT AVG(yr_total) AS normal, COUNT(*) AS years FROM (
         SELECT yr, SUM(rain) AS yr_total FROM (${DAILY_AGG})
         WHERE mm = ? AND dom <= ? AND yr < ?
         GROUP BY yr
       )`
    )
    .get(today.month, Number(today.day), today.year);

  return {
    current: round2(cur?.total ?? 0),
    normal: norm && norm.years > 0 ? round2(norm.normal) : null,
    normalYears: norm?.years || 0,
  };
}

function extreme(row, rounder) {
  if (!row || row.v == null) return null;
  return { value: rounder(row.v), date: row.ymd };
}

// The full almanac payload for a given day (defaults to today).
export function getAlmanac() {
  const span = db
    .prepare(`SELECT MIN(dateutc) AS oldest, MAX(dateutc) AS newest, COUNT(*) AS n FROM readings WHERE tempf IS NOT NULL`)
    .get();

  if (!span || !span.n) return { available: false };

  const today = centralDateParts();
  const md = today.md;

  // Daily rows for THIS calendar date across every year we have.
  const dateRows = db
    .prepare(`SELECT ymd, yr, hi, lo, rain FROM (${DAILY_AGG}) WHERE md = ? ORDER BY yr`)
    .all(md);

  // Record + normal high/low for this date.
  let recordHigh = null;
  let recordLow = null;
  let normalHigh = null;
  let normalLow = null;
  if (dateRows.length) {
    let rh = null;
    let rl = null;
    let sumHi = 0;
    let cntHi = 0;
    let sumLo = 0;
    let cntLo = 0;
    for (const r of dateRows) {
      if (r.hi != null) {
        if (rh == null || r.hi > rh.hi) rh = r;
        sumHi += r.hi;
        cntHi++;
      }
      if (r.lo != null) {
        if (rl == null || r.lo < rl.lo) rl = r;
        sumLo += r.lo;
        cntLo++;
      }
    }
    recordHigh = rh ? { value: round1(rh.hi), year: rh.yr } : null;
    recordLow = rl ? { value: round1(rl.lo), year: rl.yr } : null;
    normalHigh = cntHi ? round1(sumHi / cntHi) : null;
    normalLow = cntLo ? round1(sumLo / cntLo) : null;
  }

  // Today so far (this year's row for today).
  const todayRow = db.prepare(`SELECT hi, lo, rain FROM (${DAILY_AGG}) WHERE ymd = ?`).get(today.ymd);
  const todaySoFar = todayRow
    ? { high: round1(todayRow.hi), low: round1(todayRow.lo), rain: round2(todayRow.rain) }
    : null;

  // On this day, last year.
  const lastYear = String(Number(today.year) - 1);
  const lyRow = dateRows.find((r) => r.yr === lastYear);
  const onThisDayLastYear = lyRow
    ? { year: lastYear, high: round1(lyRow.hi), low: round1(lyRow.lo) }
    : null;

  // All-time extremes over the whole record.
  const hottest = db.prepare(`SELECT ymd, hi AS v FROM (${DAILY_AGG}) WHERE hi IS NOT NULL ORDER BY hi DESC LIMIT 1`).get();
  const coldest = db.prepare(`SELECT ymd, lo AS v FROM (${DAILY_AGG}) WHERE lo IS NOT NULL ORDER BY lo ASC LIMIT 1`).get();
  const wettest = db.prepare(`SELECT ymd, rain AS v FROM (${DAILY_AGG}) WHERE rain IS NOT NULL ORDER BY rain DESC LIMIT 1`).get();
  const windiest = db.prepare(`SELECT ymd, gust AS v FROM (${DAILY_AGG}) WHERE gust IS NOT NULL ORDER BY gust DESC LIMIT 1`).get();

  const historyDays = Math.max(1, Math.round((span.newest - span.oldest) / 86400000));

  return {
    available: true,
    date: today.ymd,
    monthDay: md,
    historyStart: span.oldest,
    historyDays,
    todaySoFar,
    records: {
      high: recordHigh,
      low: recordLow,
      normalHigh,
      normalLow,
      yearsObserved: dateRows.length,
    },
    onThisDayLastYear,
    extremes: {
      hottest: extreme(hottest, round1),
      coldest: extreme(coldest, round1),
      wettest: extreme(wettest, round2),
      windiest: extreme(windiest, round1),
    },
    monthToDate: getMonthToDateRain(today),
  };
}
