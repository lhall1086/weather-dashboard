// Daily weather summary notifications - Per-user location-based
// Sends personalized morning weather briefing to each user's location
import { getAllSubscriptions, updateLastAlertSent } from './subscriptions-db.js';
import { sendPushNotification } from './server.js';
import { fetch7Day } from './nws.js';
import { getLatest } from './db.js';

const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';

// Fetch 7-day forecast for a specific location
async function fetchForecastForLocation(lat, lon) {
  try {
    // Get gridpoint data
    const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!pointsRes.ok) throw new Error(`NWS points failed: ${pointsRes.status}`);

    const pointsData = await pointsRes.json();
    const forecastUrl = pointsData.properties.forecast;

    // Get forecast
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!forecastRes.ok) throw new Error(`NWS forecast failed: ${forecastRes.status}`);

    const forecastData = await forecastRes.json();
    const periods = forecastData.properties.periods || [];

    // Convert to our 7-day format (group day/night periods)
    const days = [];
    for (let i = 0; i < periods.length; i += 2) {
      const day = periods[i];
      const night = periods[i + 1];

      days.push({
        name: day.name,
        shortForecast: day.shortForecast,
        highTemp: day.temperature,
        lowTemp: night ? night.temperature : null
      });

      if (days.length >= 7) break;
    }

    return days;
  } catch (err) {
    console.warn(`[daily-summary] Could not fetch forecast for ${lat}, ${lon}:`, err.message);
    return null;
  }
}

// Fetch current temperature for a location
async function fetchCurrentTempForLocation(lat, lon) {
  try {
    const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!pointsRes.ok) throw new Error(`NWS points failed`);

    const pointsData = await pointsRes.json();
    const observationStations = pointsData.properties.observationStations;

    const stationsRes = await fetch(observationStations, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!stationsRes.ok) throw new Error(`NWS stations failed`);

    const stationsData = await stationsRes.json();
    const nearestStation = stationsData.features && stationsData.features[0]?.id;

    if (!nearestStation) throw new Error('No station found');

    const obsRes = await fetch(`${nearestStation}/observations/latest`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' }
    });

    if (!obsRes.ok) throw new Error(`NWS observation failed`);

    const obsData = await obsRes.json();
    const tempC = obsData.properties?.temperature?.value;
    const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;

    return tempF;
  } catch (err) {
    return null;
  }
}

// Send personalized daily summaries to all subscribed users
export async function sendDailySummaries() {
  console.log('[daily-summary] Sending personalized morning weather briefings...');

  try {
    // Get station data as fallback
    const stationCurrent = getLatest();
    const stationForecast = await fetch7Day();

    // Get all subscriptions
    const subscriptions = getAllSubscriptions();
    console.log(`[daily-summary] Preparing summaries for ${subscriptions.length} subscription(s)`);

    let sentCount = 0;

    for (const sub of subscriptions) {
      const { subscription, preferences, location, id } = sub;

      // Only send if user has enabled daily summaries
      if (!preferences.dailySummary) {
        continue;
      }

      let forecast, currentTemp, locationName;

      if (location && location.latitude && location.longitude) {
        // Fetch personalized forecast for user's location
        locationName = location.name || `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
        console.log(`[daily-summary] Fetching forecast for ${locationName}`);

        forecast = await fetchForecastForLocation(location.latitude, location.longitude);
        currentTemp = await fetchCurrentTempForLocation(location.latitude, location.longitude);

        // Use station data as fallback if fetch failed
        if (!forecast && stationForecast) {
          forecast = stationForecast;
          currentTemp = stationCurrent?.tempf;
          locationName = 'Montgomery, AL';
        }
      } else {
        // Use station data
        forecast = stationForecast;
        currentTemp = stationCurrent?.tempf;
        locationName = 'Montgomery, AL';
      }

      if (!forecast || !forecast[0]) {
        console.warn(`[daily-summary] No forecast available for subscription #${id}`);
        continue;
      }

      const today = forecast[0];
      const currentTempStr = currentTemp != null ? `, currently ${currentTemp}°F` : '';

      const message = {
        title: `🌤️ Good Morning! Weather for ${locationName}`,
        body: `${today.name}: ${today.shortForecast}. High: ${today.highTemp}°F${today.lowTemp ? `, Low: ${today.lowTemp}°F` : ''}${currentTempStr}`,
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

    console.log(`[daily-summary] Sent ${sentCount} personalized morning briefing(s)`);
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
