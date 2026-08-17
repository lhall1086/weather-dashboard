// Weekly analytics report generator
import { getAllSubscriptions, getNewSubscriptionsLastNDays } from './subscriptions-db.js';
import { getPageViewsLastNDays, getUniqueVisitorsLastNDays, getDailyBreakdown } from './visits-db.js';
import { sendWeeklyReport } from './email-service.js';

/**
 * Generate and send weekly analytics report
 */
export async function generateWeeklyReport() {
  console.log('[weekly-stats] Generating weekly analytics report...');

  try {
    const now = new Date();
    const endDate = now.toISOString();

    // Calculate start date (7 days ago)
    const startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();

    // Gather all statistics
    const totalSubscribers = getAllSubscriptions().length;
    const newSubscriptions = getNewSubscriptionsLastNDays(7);
    const uniqueVisitors = getUniqueVisitorsLastNDays(7);
    const totalPageViews = getPageViewsLastNDays(7);
    const avgViewsPerVisitor = uniqueVisitors > 0 ? (totalPageViews / uniqueVisitors).toFixed(1) : '0.0';
    const dailyBreakdown = getDailyBreakdown(7);

    const stats = {
      startDate,
      endDate,
      totalSubscribers,
      newSubscriptions,
      uniqueVisitors,
      totalPageViews,
      avgViewsPerVisitor,
      dailyBreakdown
    };

    console.log('[weekly-stats] Stats summary:', {
      totalSubscribers,
      newSubscriptions,
      uniqueVisitors,
      totalPageViews,
      avgViewsPerVisitor
    });

    // Send email report
    const sent = await sendWeeklyReport(stats);

    if (sent) {
      console.log('[weekly-stats] ✓ Weekly report sent successfully to localweatherlab@gmail.com');
    } else {
      console.log('[weekly-stats] ✗ Failed to send weekly report (check email configuration)');
    }

    return stats;
  } catch (err) {
    console.error('[weekly-stats] Error generating weekly report:', err.message);
    throw err;
  }
}

/**
 * Schedule weekly reports for every Monday at 7:00 AM CST
 */
export function scheduleWeeklyReports() {
  console.log('[weekly-stats] Scheduling weekly analytics reports...');

  // CST is UTC-6, so 7:00 AM CST = 13:00 UTC (1:00 PM UTC) during standard time
  // or 12:00 UTC during daylight saving time

  function getNextMonday7AM() {
    const now = new Date();

    // Convert to CST timezone
    const cstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    // Create next Monday at 7:00 AM CST
    const scheduled = new Date(cstNow);
    const dayOfWeek = scheduled.getDay(); // 0 = Sunday, 1 = Monday, ...

    // Calculate days until next Monday
    let daysUntilMonday;
    if (dayOfWeek === 1) {
      // Today is Monday
      const hour = scheduled.getHours();
      if (hour < 7) {
        // Before 7 AM today - schedule for today
        daysUntilMonday = 0;
      } else {
        // After 7 AM today - schedule for next Monday
        daysUntilMonday = 7;
      }
    } else if (dayOfWeek === 0) {
      // Sunday - next Monday is tomorrow
      daysUntilMonday = 1;
    } else {
      // Tuesday-Saturday - calculate days until next Monday
      daysUntilMonday = 8 - dayOfWeek;
    }

    scheduled.setDate(scheduled.getDate() + daysUntilMonday);
    scheduled.setHours(7, 0, 0, 0);

    // Convert back to server time
    const cstOffset = cstNow.getTime() - now.getTime();
    const scheduledServerTime = new Date(scheduled.getTime() - cstOffset);

    return scheduledServerTime;
  }

  function scheduleNext() {
    const nextMonday = getNextMonday7AM();
    const now = new Date();
    const timeUntil = nextMonday - now;

    const days = Math.floor(timeUntil / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));

    console.log(`[weekly-stats] Next report scheduled in ${days}d ${hours}h ${minutes}m`);
    console.log(`[weekly-stats] Will send on: ${nextMonday.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);

    setTimeout(async () => {
      // Send the report
      await generateWeeklyReport();

      // Schedule the next one (7 days later)
      scheduleNext();
    }, timeUntil);
  }

  // Start the schedule
  scheduleNext();
}
