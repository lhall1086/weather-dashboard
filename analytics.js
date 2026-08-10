// Historical analytics: compare recent periods across all KPIs.
// Supports both year-over-year (if data available) and month-over-month.
import { db } from './db.js';

// Get date ranges for comparison. Falls back to month-over-month if no year data.
function getComparisonRanges() {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400e3;
  const sixtyDaysAgo = now - 60 * 86400e3;

  // Check if we have data from last year
  const oldestRecord = db.prepare('SELECT MIN(dateutc) as oldest FROM readings').get();
  const hasYearData = oldestRecord?.oldest && (now - oldestRecord.oldest) >= 335 * 86400e3; // ~11 months

  if (hasYearData) {
    // Year-over-year comparison
    const thisYearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const lastYearStart = new Date(new Date().getFullYear() - 1, 0, 1).getTime();
    const lastYearEnd = new Date(new Date().getFullYear() - 1, 11, 31, 23, 59, 59).getTime();

    return {
      type: 'year',
      current: { start: thisYearStart, end: now, label: 'This Year', shortLabel: 'This Year' },
      previous: { start: lastYearStart, end: lastYearEnd, label: 'Last Year', shortLabel: 'Last Year' },
    };
  } else {
    // Month-over-month comparison. "Recent" = the most recent 30 days (days 0–30);
    // "Prior" = the 30 days before that (days 31–60), used as the baseline to compare against.
    return {
      type: 'month',
      current: { start: thirtyDaysAgo, end: now, label: 'Recent 30 Days', shortLabel: 'Recent 30 Days' },
      previous: { start: sixtyDaysAgo, end: thirtyDaysAgo, label: 'Prior 30 Days (31–60 days ago)', shortLabel: 'Prior 30 Days' },
    };
  }
}

// Aggregate KPIs for a date range.
// For rain: AWN's dailyrainin resets at midnight, so we sum the MAX dailyrainin per day.
function aggregateKPIs(startMs, endMs) {
  const rows = db
    .prepare(
      `SELECT
        AVG(tempf) as avgTemp,
        MAX(tempf) as maxTemp,
        MIN(tempf) as minTemp,
        AVG(humidity) as avgHumidity,
        AVG(baromrelin) as avgPressure,
        AVG(windspeedmph) as avgWind,
        MAX(windgustmph) as maxGust,
        COUNT(*) as recordCount
      FROM readings
      WHERE dateutc >= ? AND dateutc <= ?`
    )
    .get(startMs, endMs);

  // Calculate total rainfall: sum of max daily rain for each day in range
  // dailyrainin resets at midnight, so MAX per day gives us actual daily total
  const rainfall = db
    .prepare(
      `SELECT SUM(daily_max) as totalRain
       FROM (
         SELECT DATE(dateutc / 1000, 'unixepoch') as day,
                MAX(dailyrainin) as daily_max
         FROM readings
         WHERE dateutc >= ? AND dateutc <= ?
         GROUP BY day
       )`
    )
    .get(startMs, endMs);

  return { ...rows, totalRain: rainfall?.totalRain || 0 };
}

// Period-over-period comparison summary (year-over-year or month-over-month).
export function getYoYComparison() {
  const ranges = getComparisonRanges();
  const current = aggregateKPIs(ranges.current.start, ranges.current.end);
  const previous = aggregateKPIs(ranges.previous.start, ranges.previous.end);

  if (!current || !previous || current.recordCount === 0 || previous.recordCount === 0) {
    return { available: false };
  }

  const compare = (currentVal, prevVal) => {
    if (currentVal == null || prevVal == null) return null;
    const delta = currentVal - prevVal;
    const pct = ((delta / prevVal) * 100).toFixed(1);
    return { current: currentVal, previous: prevVal, delta, pctChange: parseFloat(pct) };
  };

  return {
    available: true,
    comparisonType: ranges.type,
    currentLabel: ranges.current.label,
    previousLabel: ranges.previous.label,
    currentShortLabel: ranges.current.shortLabel,
    previousShortLabel: ranges.previous.shortLabel,
    avgTemp: compare(current.avgTemp, previous.avgTemp),
    maxTemp: compare(current.maxTemp, previous.maxTemp),
    minTemp: compare(current.minTemp, previous.minTemp),
    avgHumidity: compare(current.avgHumidity, previous.avgHumidity),
    avgPressure: compare(current.avgPressure, previous.avgPressure),
    totalRain: compare(current.totalRain, previous.totalRain),
    avgWind: compare(current.avgWind, previous.avgWind),
    maxGust: compare(current.maxGust, previous.maxGust),
    recordsCurrent: current.recordCount,
    recordsPrevious: previous.recordCount,
  };
}

// Time-series comparison for charting (adapts based on available data).
export function getMonthlyComparison() {
  const ranges = getComparisonRanges();

  if (ranges.type === 'year') {
    // Year-over-year monthly breakdown
    const thisYearData = [];
    const lastYearData = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    for (let month = 0; month <= currentMonth; month++) {
      const thisYearStart = new Date(currentYear, month, 1).getTime();
      const thisYearEnd = new Date(currentYear, month + 1, 0, 23, 59, 59).getTime();
      const lastYearStart = new Date(currentYear - 1, month, 1).getTime();
      const lastYearEnd = new Date(currentYear - 1, month + 1, 0, 23, 59, 59).getTime();

      const thisMonth = aggregateKPIs(thisYearStart, Math.min(thisYearEnd, Date.now()));
      const lastMonth = aggregateKPIs(lastYearStart, lastYearEnd);

      thisYearData.push({ month, avgTemp: thisMonth?.avgTemp, totalRain: thisMonth?.totalRain });
      lastYearData.push({ month, avgTemp: lastMonth?.avgTemp, totalRain: lastMonth?.totalRain });
    }

    return {
      type: 'year',
      current: thisYearData,
      previous: lastYearData,
      currentLabel: ranges.current.shortLabel,
      previousLabel: ranges.previous.shortLabel,
    };
  } else {
    // Month-over-month: break each 30-day period into weekly buckets
    const currentData = [];
    const previousData = [];

    for (let week = 0; week < 4; week++) {
      const currentStart = ranges.current.start + (week * 7 * 86400e3);
      const currentEnd = currentStart + (7 * 86400e3);
      const prevStart = ranges.previous.start + (week * 7 * 86400e3);
      const prevEnd = prevStart + (7 * 86400e3);

      const currentWeek = aggregateKPIs(currentStart, Math.min(currentEnd, Date.now()));
      const prevWeek = aggregateKPIs(prevStart, prevEnd);

      currentData.push({ week, avgTemp: currentWeek?.avgTemp, totalRain: currentWeek?.totalRain });
      previousData.push({ week, avgTemp: prevWeek?.avgTemp, totalRain: prevWeek?.totalRain });
    }

    return {
      type: 'month',
      current: currentData,
      previous: previousData,
      currentLabel: ranges.current.shortLabel,
      previousLabel: ranges.previous.shortLabel,
    };
  }
}
