// Daily weather summary notifications
// Sends morning weather briefing to subscribed users
import { getAllSubscriptions, updateLastAlertSent } from './subscriptions-db.js';
import { sendPushNotification } from './server.js';
import { fetch7Day } from './nws.js';
import { getLatest } from './db.js';

// Send daily summaries to all subscribed users
export async function sendDailySummaries() {
  console.log('[daily-summary] Sending morning weather briefings...');

  try {
    // Get current conditions and forecast
    const current = getLatest();
    const forecast = await fetch7Day();
    const today = forecast && forecast[0];

    if (!current || !today) {
      console.warn('[daily-summary] Missing weather data');
      return;
    }

    // Get all subscriptions
    const subscriptions = getAllSubscriptions();
    console.log(`[daily-summary] Sending to ${subscriptions.length} subscription(s)`);

    let sentCount = 0;

    for (const sub of subscriptions) {
      const { subscription, preferences, id } = sub;

      // Only send if user has enabled daily summaries
      if (!preferences.dailySummary) {
        continue;
      }

      const message = {
        title: '🌤️ Good Morning! Today\'s Weather',
        body: `${today.name}: ${today.shortForecast}. High: ${today.highTemp}°F, Low: ${today.lowTemp}°F. Currently ${Math.round(current.tempf)}°F`,
        icon: '/local-weather-lab-logo.png',
        badge: '/local-weather-lab-logo.png',
        tag: 'daily-summary',
        data: { type: 'daily-summary', url: '/' }
      };

      const sent = await sendPushNotification(subscription, message);

      if (sent) {
        updateLastAlertSent(id);
        sentCount++;
      }
    }

    console.log(`[daily-summary] Sent ${sentCount} morning briefing(s)`);
  } catch (err) {
    console.error('[daily-summary] Error:', err.message);
  }
}

// Schedule daily summary at 7:00 AM local time
export function scheduleDailySummary() {
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(7, 0, 0, 0);

  // If already past 7 AM today, schedule for tomorrow
  if (now > scheduled) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  const timeUntil = scheduled - now;
  const hours = Math.floor(timeUntil / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));

  console.log(`[daily-summary] Next briefing scheduled in ${hours}h ${minutes}m at 7:00 AM`);

  setTimeout(() => {
    sendDailySummaries();

    // Reschedule for next day (24 hours from now)
    setInterval(sendDailySummaries, 24 * 60 * 60 * 1000);
  }, timeUntil);
}
