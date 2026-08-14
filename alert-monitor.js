// Alert monitoring service - Per-user location-based alerts
// Checks weather conditions for each user's specific location and sends personalized notifications
import { getAllSubscriptions, updateLastAlertSent } from './subscriptions-db.js';
import { sendPushNotification } from './server.js';
import { getLatest } from './db.js';

const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';
const MIN_ALERT_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Fetch weather data for a specific location from NWS
async function fetchWeatherForLocation(lat, lon) {
  try {
    // Get gridpoint data from NWS
    const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!pointsRes.ok) {
      throw new Error(`NWS points API failed: ${pointsRes.status}`);
    }

    const pointsData = await pointsRes.json();
    const observationStations = pointsData.properties.observationStations;

    // Get nearest observation station
    const stationsRes = await fetch(observationStations, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!stationsRes.ok) {
      throw new Error(`NWS stations API failed: ${stationsRes.status}`);
    }

    const stationsData = await stationsRes.json();
    const nearestStation = stationsData.features && stationsData.features[0]?.id;

    if (!nearestStation) {
      throw new Error('No observation station found');
    }

    // Get latest observation from nearest station
    const obsRes = await fetch(`${nearestStation}/observations/latest`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!obsRes.ok) {
      throw new Error(`NWS observation API failed: ${obsRes.status}`);
    }

    const obsData = await obsRes.json();
    const props = obsData.properties;

    // Convert to our format
    const tempC = props.temperature?.value;
    const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;

    const windSpeedKmh = props.windSpeed?.value;
    const windSpeedMph = windSpeedKmh != null ? Math.round(windSpeedKmh * 0.621371) : null;

    // Note: NWS doesn't provide hourly rainfall directly, so we approximate
    const precipLastHour = props.precipitationLastHour?.value; // mm
    const precipInches = precipLastHour != null ? precipLastHour * 0.0393701 : null;

    return {
      tempf: tempF,
      windspeedmph: windSpeedMph,
      hourlyrainin: precipInches,
      available: true
    };
  } catch (err) {
    console.warn(`[alert-monitor] Could not fetch weather for ${lat}, ${lon}:`, err.message);
    return { available: false };
  }
}

// Fetch alerts for a specific location from NWS
async function fetchAlertsForLocation(lat, lon) {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!res.ok) {
      throw new Error(`NWS alerts API failed: ${res.status}`);
    }

    const data = await res.json();
    const alerts = data.features || [];

    return alerts.map(feature => ({
      event: feature.properties.event,
      headline: feature.properties.headline,
      description: feature.properties.description
    }));
  } catch (err) {
    console.warn(`[alert-monitor] Could not fetch alerts for ${lat}, ${lon}:`, err.message);
    return [];
  }
}

// Check all subscriptions and send location-based alerts
export async function checkAndSendAlerts() {
  console.log('[alert-monitor] Checking weather conditions for all users...');

  try {
    // Get station weather data as fallback
    const stationWeather = getLatest();

    // Get all subscriptions
    const subscriptions = getAllSubscriptions();
    console.log(`[alert-monitor] Checking ${subscriptions.length} subscription(s)`);

    if (subscriptions.length === 0) {
      console.log('[alert-monitor] No active subscriptions');
      return;
    }

    let alertsSent = 0;

    for (const sub of subscriptions) {
      const { subscription, preferences, location, id, lastAlertSent } = sub;

      // Don't spam users - respect minimum interval
      if (Date.now() - lastAlertSent < MIN_ALERT_INTERVAL) {
        continue;
      }

      // Determine which weather data to use
      let currentWeather;
      let userAlerts = [];
      let locationName = 'your area';

      if (location && location.latitude && location.longitude) {
        // User has location - fetch personalized data
        locationName = location.name || `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
        console.log(`[alert-monitor] Checking ${locationName} for subscription #${id}`);

        currentWeather = await fetchWeatherForLocation(location.latitude, location.longitude);

        // Use station data as fallback if fetch failed
        if (!currentWeather.available) {
          console.log(`[alert-monitor] Using station data as fallback for subscription #${id}`);
          currentWeather = stationWeather;
        }

        // Fetch alerts for user's location
        if (preferences.severeWeather) {
          userAlerts = await fetchAlertsForLocation(location.latitude, location.longitude);
        }
      } else {
        // No location - use station data
        console.log(`[alert-monitor] Using station data for subscription #${id} (no user location)`);
        currentWeather = stationWeather;
        locationName = 'Montgomery, AL';

        // Use default station alerts
        if (preferences.severeWeather) {
          try {
            const { fetchAlerts } = await import('./nws.js');
            userAlerts = await fetchAlerts();
          } catch (err) {
            console.warn('[alert-monitor] Could not fetch station alerts:', err.message);
          }
        }
      }

      if (!currentWeather) {
        console.warn(`[alert-monitor] No weather data available for subscription #${id}`);
        continue;
      }

      const alerts = [];

      // 1. Check severe weather alerts
      if (preferences.severeWeather && userAlerts.length > 0) {
        const severeTypes = ['Tornado', 'Thunderstorm', 'Flood'];
        const severeAlerts = userAlerts.filter(alert =>
          severeTypes.some(type => alert.event && alert.event.includes(type))
        );

        if (severeAlerts.length > 0) {
          const firstAlert = severeAlerts[0];
          alerts.push({
            title: `⚠️ Severe Weather in ${locationName}`,
            body: `${firstAlert.event}: ${firstAlert.headline || 'Check for details'}`,
            tag: 'severe-weather',
            requireInteraction: true,
            data: { type: 'severe-weather', url: '/' }
          });
        }
      }

      // 2. Check temperature thresholds
      if (preferences.customAlerts && preferences.customAlerts.tempBelow && preferences.customAlerts.tempBelow.enabled) {
        if (currentWeather.tempf != null && currentWeather.tempf <= preferences.customAlerts.tempBelow.value) {
          alerts.push({
            title: `🥶 Temperature Alert - ${locationName}`,
            body: `Temperature: ${Math.round(currentWeather.tempf)}°F (threshold: ${preferences.customAlerts.tempBelow.value}°F)`,
            tag: 'temp-below',
            data: { type: 'temp-below', url: '/' }
          });
        }
      }

      if (preferences.customAlerts && preferences.customAlerts.tempAbove && preferences.customAlerts.tempAbove.enabled) {
        if (currentWeather.tempf != null && currentWeather.tempf >= preferences.customAlerts.tempAbove.value) {
          alerts.push({
            title: `🔥 Temperature Alert - ${locationName}`,
            body: `Temperature: ${Math.round(currentWeather.tempf)}°F (threshold: ${preferences.customAlerts.tempAbove.value}°F)`,
            tag: 'temp-above',
            data: { type: 'temp-above', url: '/' }
          });
        }
      }

      // 3. Check wind speed threshold
      if (preferences.customAlerts && preferences.customAlerts.windAbove && preferences.customAlerts.windAbove.enabled) {
        if (currentWeather.windspeedmph != null && currentWeather.windspeedmph >= preferences.customAlerts.windAbove.value) {
          alerts.push({
            title: `💨 Wind Alert - ${locationName}`,
            body: `Wind speed: ${Math.round(currentWeather.windspeedmph)} mph (threshold: ${preferences.customAlerts.windAbove.value} mph)`,
            tag: 'wind-above',
            data: { type: 'wind-above', url: '/' }
          });
        }
      }

      // 4. Check rainfall threshold
      if (preferences.customAlerts && preferences.customAlerts.rainAbove && preferences.customAlerts.rainAbove.enabled) {
        if (currentWeather.hourlyrainin != null && currentWeather.hourlyrainin >= preferences.customAlerts.rainAbove.value) {
          alerts.push({
            title: `🌧️ Rainfall Alert - ${locationName}`,
            body: `Rainfall: ${currentWeather.hourlyrainin.toFixed(2)}"/hour (threshold: ${preferences.customAlerts.rainAbove.value}")`,
            tag: 'rain-above',
            data: { type: 'rain-above', url: '/' }
          });
        }
      }

      // Send alerts if any conditions were met
      if (alerts.length > 0) {
        console.log(`[alert-monitor] Sending ${alerts.length} alert(s) to subscription #${id} (${locationName})`);

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
      console.log(`[alert-monitor] Sent ${alertsSent} alert(s) total across all locations`);
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
  console.log('[alert-monitor] Starting location-based alert monitoring service...');

  // Run immediately on startup
  setTimeout(() => {
    checkAndSendAlerts();
  }, 10000); // Wait 10 seconds after server start

  // Then check every 5 minutes
  const interval = 5 * 60 * 1000; // 5 minutes
  setInterval(checkAndSendAlerts, interval);

  console.log('[alert-monitor] Will check conditions for all user locations every 5 minutes');
}
