// Which NWS alerts reach subscribers as push notifications, and how often.
// Fixtures are real api.weather.gov responses captured 2026-10-09.
// Run with: npm test
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const ALERTS = fixture('nws-alerts.json');
const WEATHER = fixture('nws-weather.json');

// Station point for subscribers without a saved location; never load the real .env.
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./fixtures/no-such.env', import.meta.url));
process.env.LAT = '32.5776';
process.env.LON = '-85.7583';

// Web push is the network boundary: record each attempted push instead of sending it.
let pushes = [];
let pushSucceeds = true;
mock.module('../server.js', {
  exports: {
    sendPushNotification: async (subscription, payload) => {
      pushes.push(payload);
      return pushSucceeds;
    },
  },
});

// Real SQLite, in memory, in place of weather.db.
const memDb = new Database(':memory:');
let stationReading = null;
mock.module('../db.js', { exports: { db: memDb, getLatest: () => stationReading } });

// api.weather.gov is the other boundary: serve captured responses; active alerts come from `feed`.
let feed = [];
const geoJson = (body) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/geo+json' } });
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('https://api.weather.gov/alerts/active?')) return geoJson({ ...WEATHER.alertsEnvelope, features: feed });
  if (u.startsWith('https://api.weather.gov/points/')) return geoJson(WEATHER.points);
  if (u === WEATHER.points.properties.observationStations) return geoJson(WEATHER.stations);
  if (u === `${WEATHER.stations.features[0].id}/observations/latest`) return geoJson(WEATHER.observation);
  throw new Error(`Unexpected fetch in test: ${u}`);
};

const { initSubscriptionsTable, saveSubscription } = await import('../subscriptions-db.js');
const { checkAndSendAlerts } = await import('../alert-monitor.js');
initSubscriptionsTable();

const MINUTE = 60 * 1000;
const HERE = { latitude: 32.5776, longitude: -85.7583, name: 'Test Town, AL' };

// Same shape public/notifications.js sends for a subscriber on default settings.
const DEFAULT_PREFS = {
  enabled: true,
  severeWeather: true,
  dailySummary: false,
  customAlerts: {
    tempBelow: { enabled: false, value: 32 },
    tempAbove: { enabled: false, value: 95 },
    windAbove: { enabled: false, value: 30 },
    rainAbove: { enabled: false, value: 1.0 },
  },
};

// A row of the readings table (db.js getLatest) for the station fallback.
const STATION_READING = {
  dateutc: Date.parse('2026-10-09T19:55:00Z'),
  tempf: 66.2, feelsLike: 66.2, dewPoint: 61.0, humidity: 84,
  windspeedmph: 12.1, windgustmph: 19.0, winddir: 95,
  baromrelin: 29.82, baromabsin: 29.41,
  hourlyrainin: 0.04, dailyrainin: 0.61, weeklyrainin: 1.37, monthlyrainin: 1.92,
  solarradiation: 88.4, uv: 0, tempinf: 72.5, humidityin: 51,
};

let subscriberCount = 0;
function addSubscriber({ location = HERE, preferences = DEFAULT_PREFS } = {}) {
  subscriberCount++;
  saveSubscription(
    { endpoint: `https://push.example.test/${subscriberCount}`, keys: { p256dh: 'test-p256dh', auth: 'test-auth' } },
    preferences,
    location
  );
}

const pushedHeadline = (alert) => pushes.some((p) => p.body.includes(alert.properties.headline));

beforeEach(() => {
  memDb.exec('DELETE FROM push_subscriptions');
  pushes = [];
  pushSucceeds = true;
  feed = [];
  stationReading = null;
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-09T20:00:00Z') });
});

afterEach(() => mock.timers.reset());

// [fixture, what it is, should it push?]
const CASES = [
  ['floodWatchUpdate', 'Flood Watch update', true],
  ['tropicalStormWarningUpdate', 'Tropical Storm Warning update', true],
  ['tropicalStormWatchUpdate', 'Tropical Storm Watch update', true],
  ['hurricaneWarningUpdate', 'Hurricane Warning update', true],
  ['hurricaneWatchUpdate', 'Hurricane Watch update', true],
  ['flashFloodWarningNew', 'new Flash Flood Warning', true],
  ['tornadoWarningUpdate', 'Tornado Warning update', true],
  ['severeThunderstormWarningUpdate', 'Severe Thunderstorm Warning update', true],
  ['floodWarningExtended', 'Flood Warning extended in time', true],
  ['tropicalCycloneLocalStatement', 'Tropical Cyclone Local Statement', false],
  ['specialWeatherStatement', 'Special Weather Statement', false],
  ['coastalFloodStatement', 'Coastal Flood Statement', false],
  ['floodAdvisoryNew', 'new Flood Advisory', false],
  ['windAdvisoryReplaced', 'Wind Advisory being replaced by a warning', false],
  ['tornadoWatchCancelled', 'Tornado Watch cancellation', false],
  ['floodWarningCancelled', 'Flood Warning cancellation', false],
  ['tropicalStormWarningReplaced', 'Tropical Storm Warning cancelled because it was upgraded', false],
  ['tornadoWarningExercise', 'Tornado Warning marked as an exercise', false],
  ['tornadoWarningExpiring', 'Tornado Warning expiration notice sent as messageType Alert', false],
  ['severeThunderstormWarningExpiring', 'Severe Thunderstorm Warning expiration notice', false],
  ['stormSurgeWarningUpdate', 'Storm Surge Warning (not on the push list)', false],
];

for (const [key, what, shouldPush] of CASES) {
  test(`${shouldPush ? 'pushes' : 'does not push'} a ${what}`, async () => {
    addSubscriber();
    feed = [ALERTS[key]];
    await checkAndSendAlerts();
    assert.equal(pushes.length, shouldPush ? 1 : 0);
  });
}

test('pushes every active watch/warning in the area, each as its own notification', async () => {
  addSubscriber();
  // What NWS listed for the station point on 2026-10-09.
  feed = [ALERTS.floodWatchUpdate, ALERTS.tropicalCycloneLocalStatement, ALERTS.tropicalStormWarningUpdate];
  await checkAndSendAlerts();
  assert.equal(pushes.length, 2);
  assert.ok(pushedHeadline(ALERTS.floodWatchUpdate));
  assert.ok(pushedHeadline(ALERTS.tropicalStormWarningUpdate));
  assert.notEqual(pushes[0].tag, pushes[1].tag);
});

test('does not push the same watch again while it stays active', async () => {
  addSubscriber();
  feed = [ALERTS.floodWatchUpdate];
  await checkAndSendAlerts();
  mock.timers.tick(20 * MINUTE);
  await checkAndSendAlerts();
  mock.timers.tick(60 * MINUTE);
  await checkAndSendAlerts();
  assert.equal(pushes.length, 1);
});

test('pushes an NWS update to a watch right away, even 5 minutes after the last push', async () => {
  addSubscriber();
  feed = [ALERTS.floodWatchPrevious];
  await checkAndSendAlerts();
  mock.timers.tick(5 * MINUTE);
  feed = [ALERTS.floodWatchUpdate]; // NWS replaced the watch message with an update (new ID)
  await checkAndSendAlerts();
  assert.equal(pushes.length, 2);
  assert.ok(pushes[1].body.includes(ALERTS.floodWatchUpdate.properties.headline));
});

test('subscriber without a saved location gets the station area watches and warnings', async () => {
  addSubscriber({ location: null });
  stationReading = STATION_READING;
  feed = [
    ALERTS.floodWatchUpdate,
    ALERTS.tropicalCycloneLocalStatement,
    ALERTS.tropicalStormWarningUpdate,
    ALERTS.tornadoWarningExpiring, // only the VTEC check rejects this one
  ];
  await checkAndSendAlerts();
  assert.equal(pushes.length, 2);
  assert.ok(pushedHeadline(ALERTS.floodWatchUpdate));
  assert.ok(pushedHeadline(ALERTS.tropicalStormWarningUpdate));
});

test('retries a watch/warning whose push failed, then stops', async () => {
  addSubscriber();
  feed = [ALERTS.tornadoWarningUpdate];
  pushSucceeds = false;
  await checkAndSendAlerts();
  pushSucceeds = true;
  mock.timers.tick(5 * MINUTE);
  await checkAndSendAlerts();
  mock.timers.tick(5 * MINUTE);
  await checkAndSendAlerts();
  assert.equal(pushes.length, 2); // failed attempt + one successful retry
});

for (const [who, location] of [['with', HERE], ['without', null]]) {
  test(`temperature alerts still wait 15 minutes between pushes (subscriber ${who} a saved location)`, async () => {
    // Both the fixture observation (19 °C) and the station reading are ~66 °F,
    // so a 60 °F "above" threshold fires.
    stationReading = STATION_READING;
    addSubscriber({
      location,
      preferences: {
        ...DEFAULT_PREFS,
        severeWeather: false,
        customAlerts: { ...DEFAULT_PREFS.customAlerts, tempAbove: { enabled: true, value: 60 } },
      },
    });
    await checkAndSendAlerts();
    mock.timers.tick(5 * MINUTE);
    await checkAndSendAlerts();
    assert.equal(pushes.length, 1, 'repeated within 15 minutes');
    mock.timers.tick(15 * MINUTE);
    await checkAndSendAlerts();
    assert.equal(pushes.length, 2, 'not repeated after 15 minutes');
  });
}
