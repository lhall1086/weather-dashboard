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

    if (periods.length === 0) {
      throw new Error('No forecast periods available');
    }

    // Convert to our 7-day format (group day/night periods intelligently)
    const days = [];

    for (let i = 0; i < periods.length && days.length < 7; i++) {
      const period = periods[i];
      const nextPeriod = periods[i + 1];

      // Determine high and low based on whether this is a day or night period
      let highTemp, lowTemp, name, forecast;

      if (period.isDaytime) {
        // This is a daytime period (has the high temp)
        name = period.name;
        forecast = period.shortForecast;
        highTemp = period.temperature;
        lowTemp = nextPeriod && !nextPeriod.isDaytime ? nextPeriod.temperature : null;
        i++; // Skip the next period since we've already processed it
      } else {
        // This is a nighttime period (has the low temp)
        // Look for the next daytime period
        if (nextPeriod && nextPeriod.isDaytime) {
          name = nextPeriod.name;
          forecast = nextPeriod.shortForecast;
          highTemp = nextPeriod.temperature;
          lowTemp = period.temperature;
          i++; // Skip the next period since we've already processed it
        } else {
          // If no next daytime period, just use what we have
          name = period.name;
          forecast = period.shortForecast;
          highTemp = null;
          lowTemp = period.temperature;
        }
      }

      days.push({
        name: name,
        shortForecast: forecast,
        highTemp: highTemp,
        lowTemp: lowTemp
      });
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
        console.warn(`[daily-summary] No forecast available for subscription #${id}, skipping`);
        continue;
      }

      const today = forecast[0];

      // Log forecast data for debugging
      console.log(`[daily-summary] Forecast for ${locationName}: ${today.name}, High: ${today.highTemp}, Low: ${today.lowTemp}, Current: ${currentTemp}`);

      // Validate that we have at least some temperature data
      if (today.highTemp == null && today.lowTemp == null && currentTemp == null) {
        console.warn(`[daily-summary] No temperature data available for subscription #${id}, skipping`);
        continue;
      }

      // Build temperature string with proper null handling
      let tempStr = '';
      if (today.highTemp != null && today.lowTemp != null) {
        tempStr = `High: ${today.highTemp}°F, Low: ${today.lowTemp}°F`;
      } else if (today.highTemp != null) {
        tempStr = `High: ${today.highTemp}°F`;
      } else if (today.lowTemp != null) {
        tempStr = `Low: ${today.lowTemp}°F`;
      } else if (currentTemp != null) {
        // If we only have current temp, just use that
        tempStr = `Currently ${currentTemp}°F`;
      } else {
        // This shouldn't happen due to the check above, but just in case
        tempStr = 'Forecast available on website';
      }

      // Add current temp if we have it and it wasn't already included
      const currentTempStr = (currentTemp != null && (today.highTemp != null || today.lowTemp != null))
        ? `. Currently ${currentTemp}°F`
        : '';

      const message = {
        title: `🌤️ Good Morning! Weather for ${locationName}`,
        body: `${today.name}: ${today.shortForecast}. ${tempStr}${currentTempStr}`,
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

// Schedule daily summary at 6:00 AM CST
export function scheduleDailySummary() {
  // Convert 6:00 AM CST to local server time
  // CST is UTC-6, so 6:00 AM CST = 12:00 PM UTC (when not DST) or 11:00 AM UTC (during CDT)
  // Since Render servers likely run on UTC, we need to calculate properly

  const now = new Date();

  // Create a date for 6:00 AM CST today
  // We'll use toLocaleString to convert to CST timezone
  const cstTimeString = now.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour12: false
  });

  // Parse current CST time
  const cstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  // Create next 6:00 AM CST
  const scheduled = new Date(cstNow);
  scheduled.setHours(6, 0, 0, 0);

  // If already past 6 AM CST today, schedule for tomorrow
  if (cstNow >= scheduled) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  // Convert back to server time for scheduling
  const cstOffset = cstNow.getTime() - now.getTime();
  const scheduledServerTime = new Date(scheduled.getTime() - cstOffset);

  const timeUntil = scheduledServerTime - now;
  const hours = Math.floor(timeUntil / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));

  console.log(`[daily-summary] Next briefing scheduled in ${hours}h ${minutes}m at 6:00 AM CST`);
  console.log(`[daily-summary] That's ${scheduledServerTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);

  setTimeout(() => {
    sendDailySummaries();

    // Reschedule for next day (24 hours from now)
    setInterval(sendDailySummaries, 24 * 60 * 60 * 1000);
  }, timeUntil);
}
