// National Weather Service forecast, alerts, and hourly (api.weather.gov). Free, US-only, no key.
// NWS requires a User-Agent identifying your app.
//
// Three data products:
//  1. /alerts/active?point=lat,lon  → current watches/warnings/advisories
//  2. /forecast                      → 12h day/night periods
//  3. /forecast/hourly               → per-hour temp/precip/humidity (denser near-term view)
//
// Alerts refresh every 2 min (time-sensitive), forecast/hourly refresh hourly (slow-moving).
import 'dotenv/config';

const { LAT, LON } = process.env;
const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';

// Cached gridpoint URLs resolved once from /points.
let forecastUrl = null;
let forecastHourlyUrl = null;
let locationLabel = null; // e.g. "Linn, KS"

let forecastCache = { at: 0, data: null };
let hourlyCache = { at: 0, data: null };
let alertsCache = { at: 0, data: null };

const FORECAST_TTL = 60 * 60 * 1000; // 1h
const ALERTS_TTL = 2 * 60 * 1000;    // 2m (alerts change fast)

async function nwsGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } });
  if (!res.ok) throw new Error(`NWS ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// Resolve lat/lon -> gridpoint URLs and location label (done once).
async function resolveGridpoint() {
  if (forecastUrl) return; // already resolved
  if (!LAT || !LON) throw new Error('Missing LAT / LON in .env for NWS forecast.');
  const points = await nwsGet(`https://api.weather.gov/points/${LAT},${LON}`);
  forecastUrl = points.properties.forecast;
  forecastHourlyUrl = points.properties.forecastHourly;
  const rel = points.properties.relativeLocation?.properties;
  if (rel?.city && rel?.state) locationLabel = `${rel.city}, ${rel.state}`;
}

// 12h day/night forecast periods, cached 1h.
export async function fetchForecast() {
  const now = Date.now();
  if (forecastCache.data && now - forecastCache.at < FORECAST_TTL) return forecastCache.data;

  await resolveGridpoint();
  const forecast = await nwsGet(forecastUrl);
  const periods = forecast.properties.periods.map((p) => ({
    name: p.name,
    isDaytime: p.isDaytime,
    temp: p.temperature,
    tempUnit: p.temperatureUnit,
    wind: p.windSpeed,
    windDir: p.windDirection,
    shortForecast: p.shortForecast,
    icon: p.icon,
    precip: p.probabilityOfPrecipitation?.value ?? null,
  }));

  forecastCache = { at: now, data: periods };
  return periods;
}

// Hourly forecast (next 24h by default). Each period is ~1h. Denser near-term view.
// NWS returns dewpoint in °C; convert to °F for consistency with our station (imperial).
export async function fetchHourly(limit = 24) {
  const now = Date.now();
  if (hourlyCache.data && now - hourlyCache.at < FORECAST_TTL) return hourlyCache.data;

  await resolveGridpoint();
  const hourly = await nwsGet(forecastHourlyUrl);
  const periods = hourly.properties.periods.slice(0, limit).map((p) => {
    const dewpointC = p.dewpoint?.value;
    const dewpointF = dewpointC != null ? (dewpointC * 9) / 5 + 32 : null;
    return {
      startTime: p.startTime,
      isDaytime: p.isDaytime,
      temp: p.temperature,
      tempUnit: p.temperatureUnit,
      precip: p.probabilityOfPrecipitation?.value ?? null,
      humidity: p.relativeHumidity?.value ?? null,
      dewpoint: dewpointF,
      wind: p.windSpeed,
      windDir: p.windDirection,
      shortForecast: p.shortForecast,
      icon: p.icon,
    };
  });

  hourlyCache = { at: now, data: periods };
  return periods;
}

// Active watches/warnings/advisories for our point. Cached 2min (time-sensitive).
// Severity: Extreme > Severe > Moderate > Minor > Unknown
// Urgency: Immediate > Expected > Future > Past > Unknown
export async function fetchAlerts() {
  const now = Date.now();
  if (alertsCache.data && now - alertsCache.at < ALERTS_TTL) return alertsCache.data;

  if (!LAT || !LON) throw new Error('Missing LAT / LON in .env for NWS alerts.');
  const alerts = await nwsGet(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`);

  const list = (alerts.features || []).map((f) => {
    const p = f.properties;
    return {
      event: p.event,
      severity: p.severity,
      urgency: p.urgency,
      certainty: p.certainty,
      headline: p.headline,
      description: p.description,
      instruction: p.instruction,
      onset: p.onset,
      expires: p.expires,
      ends: p.ends,
      areaDesc: p.areaDesc,
      messageType: p.messageType,
      senderName: p.senderName,
    };
  });

  alertsCache = { at: now, data: list };
  return list;
}

// Location label ("City, ST") for display, resolved once.
export async function getLocationLabel() {
  await resolveGridpoint();
  return locationLabel || 'your location';
}

// 7-day extended forecast aggregated from NWS's 14 periods (day/night splits).
// Each day gets: date, high, low, day conditions, night conditions, precip %, detailedForecast.
// Severe weather keywords are flagged for the multi-day alert scanner.
const SEVERE_KEYWORDS = /tornado|severe|damaging|flooding|flash flood|large hail|destructive|hurricane|tropical storm|winter storm|blizzard|ice storm/i;

export async function fetch7Day() {
  const now = Date.now();
  if (forecastCache.data && now - forecastCache.at < FORECAST_TTL) {
    // Re-aggregate from cached forecast periods.
    return aggregate7Day(forecastCache.data);
  }

  await resolveGridpoint();
  const forecast = await nwsGet(forecastUrl);
  const periods = forecast.properties.periods.map((p) => ({
    name: p.name,
    isDaytime: p.isDaytime,
    temp: p.temperature,
    tempUnit: p.temperatureUnit,
    wind: p.windSpeed,
    windDir: p.windDirection,
    shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast,
    icon: p.icon,
    precip: p.probabilityOfPrecipitation?.value ?? null,
    startTime: p.startTime,
  }));

  forecastCache = { at: now, data: periods };
  return aggregate7Day(periods);
}

function aggregate7Day(periods) {
  const days = [];
  for (let i = 0; i < periods.length; i += 2) {
    const first = periods[i];
    const second = periods[i + 1];
    if (!first) break;

    // NWS returns 14 periods starting from "now" — could be a daytime or nighttime
    // period first. Identify which is day vs night by isDaytime, not by position.
    const dayPeriod = first.isDaytime ? first : second;
    const nightPeriod = first.isDaytime ? second : first;

    const date = new Date(first.startTime);
    const high = dayPeriod?.temp ?? nightPeriod?.temp;  // prefer day temp as high
    const low = nightPeriod?.temp ?? dayPeriod?.temp;   // prefer night temp as low

    const detailedDay = dayPeriod?.detailedForecast || dayPeriod?.shortForecast || '';
    const detailedNight = nightPeriod?.detailedForecast || nightPeriod?.shortForecast || '';
    const hasSevereKeywords =
      SEVERE_KEYWORDS.test(detailedDay) || SEVERE_KEYWORDS.test(detailedNight);

    days.push({
      name: first.name.replace(/\s+(Night|Day)$/i, ''), // "Tonight" -> "Tonight", "Monday" -> "Monday"
      date: date.toISOString().split('T')[0],
      high,
      low,
      dayConditions: dayPeriod?.shortForecast || nightPeriod?.shortForecast || '',
      nightConditions: nightPeriod?.shortForecast || '',
      dayIcon: dayPeriod?.icon || nightPeriod?.icon,
      nightIcon: nightPeriod?.icon || dayPeriod?.icon,
      precipDay: dayPeriod?.precip,
      precipNight: nightPeriod?.precip,
      detailedForecast: detailedDay + (detailedNight ? ' ' + detailedNight : ''),
      hasSevereKeywords,
    });
  }
  return days;
}
