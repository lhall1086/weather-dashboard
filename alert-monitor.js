// Alert monitoring service
// Checks weather conditions against user preferences and sends push notifications
import { getAllSubscriptions, updateLastAlertSent } from './subscriptions-db.js';
import { sendPushNotification } from './server.js';
import { getLatest } from './db.js';
import { fetchAlerts } from './nws.js';

// Minimum time between alerts to same user (15 minutes)
const MIN_ALERT_INTERVAL = 15 * 60 * 1000;

// Check all subscriptions and send alerts if conditions are met
export async function checkAndSendAlerts() {
  console.log('[alert-monitor] Checking weather conditions...');

  try {
    // Get current weather data
    const current = getLatest();
    if (!current) {
      console.warn('[alert-monitor] No current weather data available');
      return;
    }

    // Get active NWS alerts
    let nwsAlerts = [];
    try {
      nwsAlerts = await fetchAlerts();
    } catch (err) {
      console.warn('[alert-monitor] Could not fetch NWS alerts:', err.message);
    }

    // Get all subscriptions
    const subscriptions = getAllSubscriptions();
    console.log(`[alert-monitor] Checking ${subscriptions.length} subscription(s)`);

    if (subscriptions.length === 0) {
      console.log('[alert-monitor] No active subscriptions');
      return;
    }

    let alertsSent = 0;

    for (const sub of subscriptions) {
      const { subscription, preferences, id, lastAlertSent } = sub;

      // Don't spam users - respect minimum interval
      if (Date.now() - lastAlertSent < MIN_ALERT_INTERVAL) {
        continue;
      }

      const alerts = [];

      // 1. Check severe weather alerts
      if (preferences.severeWeather && nwsAlerts.length > 0) {
        const severeTypes = ['Tornado', 'Thunderstorm', 'Flood'];
        const severeAlerts = nwsAlerts.filter(alert =>
          severeTypes.some(type => alert.event && alert.event.includes(type))
        );

        if (severeAlerts.length > 0) {
          const firstAlert = severeAlerts[0];
          alerts.push({
            title: '⚠️ Severe Weather Alert',
            body: `${firstAlert.event}: ${firstAlert.headline || 'Check for details'}`,
            tag: 'severe-weather',
            requireInteraction: true,
            data: { type: 'severe-weather', url: '/' }
          });
        }
      }

      // 2. Check custom temperature thresholds
      if (preferences.customAlerts && preferences.customAlerts.tempBelow && preferences.customAlerts.tempBelow.enabled) {
        if (current.tempf != null && current.tempf <= preferences.customAlerts.tempBelow.value) {
          alerts.push({
            title: '🥶 Temperature Alert',
            body: `Temperature has dropped to ${Math.round(current.tempf)}°F (threshold: ${preferences.customAlerts.tempBelow.value}°F)`,
            tag: 'temp-below',
            data: { type: 'temp-below', url: '/' }
          });
        }
      }

      if (preferences.customAlerts && preferences.customAlerts.tempAbove && preferences.customAlerts.tempAbove.enabled) {
        if (current.tempf != null && current.tempf >= preferences.customAlerts.tempAbove.value) {
          alerts.push({
            title: '🔥 Temperature Alert',
            body: `Temperature has risen to ${Math.round(current.tempf)}°F (threshold: ${preferences.customAlerts.tempAbove.value}°F)`,
            tag: 'temp-above',
            data: { type: 'temp-above', url: '/' }
          });
        }
      }

      // 3. Check wind speed threshold
      if (preferences.customAlerts && preferences.customAlerts.windAbove && preferences.customAlerts.windAbove.enabled) {
        if (current.windspeedmph != null && current.windspeedmph >= preferences.customAlerts.windAbove.value) {
          alerts.push({
            title: '💨 Wind Speed Alert',
            body: `Wind speed is ${Math.round(current.windspeedmph)} mph (threshold: ${preferences.customAlerts.windAbove.value} mph)`,
            tag: 'wind-above',
            data: { type: 'wind-above', url: '/' }
          });
        }
      }

      // 4. Check rainfall threshold (hourly)
      if (preferences.customAlerts && preferences.customAlerts.rainAbove && preferences.customAlerts.rainAbove.enabled) {
        if (current.hourlyrainin != null && current.hourlyrainin >= preferences.customAlerts.rainAbove.value) {
          alerts.push({
            title: '🌧️ Rainfall Alert',
            body: `Rainfall is ${current.hourlyrainin.toFixed(2)}" per hour (threshold: ${preferences.customAlerts.rainAbove.value}")`,
            tag: 'rain-above',
            data: { type: 'rain-above', url: '/' }
          });
        }
      }

      // Send alerts if any conditions were met
      if (alerts.length > 0) {
        console.log(`[alert-monitor] Sending ${alerts.length} alert(s) to subscription #${id}`);

        for (const alert of alerts) {
          const payload = {
            title: alert.title,
            body: alert.body,
            icon: '/local-weather-lab-logo.png',
            badge: '/local-weather-lab-logo.png',
            tag: alert.tag,
            requireInteraction: alert.requireInteraction || false,
            data: alert.data,
            url: alert.data.url
          };

          const sent = await sendPushNotification(subscription, payload);

          if (sent) {
            updateLastAlertSent(id);
            alertsSent++;
          }
        }
      }
    }

    if (alertsSent > 0) {
      console.log(`[alert-monitor] Sent ${alertsSent} alert(s) total`);
    } else {
      console.log('[alert-monitor] No alerts to send');
    }

    console.log('[alert-monitor] Check complete ✓');
  } catch (err) {
    console.error('[alert-monitor] Error during check:', err.message);
  }
}

// Start the alert monitor (checks every 5 minutes)
export function startAlertMonitor() {
  console.log('[alert-monitor] Starting alert monitoring service...');

  // Run immediately on startup
  setTimeout(() => {
    checkAndSendAlerts();
  }, 10000); // Wait 10 seconds after server start

  // Then check every 5 minutes
  const interval = 5 * 60 * 1000; // 5 minutes
  setInterval(checkAndSendAlerts, interval);

  console.log('[alert-monitor] Will check conditions every 5 minutes');
}
