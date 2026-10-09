// Which NHC forecast-cone graphics the site shows, and how it notices updates.
// Fixtures are real nhc.noaa.gov responses captured 2026-10-09.
// Run with: npm test
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const STORMS = fixture('nhc-current-storms.json'); // Isaias (Atlantic) + Rachel, Simon (Eastern Pacific)
const CONE_PAGE = fixture('nhc-graphics-at4-cone.html');
const PLAIN_PAGE = fixture('nhc-graphics-at4-plain.html'); // same page without the cone section
const CONE_URL = 'https://www.nhc.noaa.gov/storm_graphics/AT09/refresh/AL092026_5day_cone+png/092204_5day_cone.png';

// nhc.noaa.gov is the network boundary: serve the captured responses.
let storms;
let conePage;
let nhcReachable;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (!nhcReachable) throw new TypeError('fetch failed');
  if (u === 'https://www.nhc.noaa.gov/CurrentStorms.json') {
    return new Response(storms, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u === 'https://www.nhc.noaa.gov/graphics_at4.shtml?cone') {
    return new Response(conePage, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  throw new Error(`Unexpected fetch in test: ${u}`);
};

const { fetchActiveStorms } = await import('../nhc.js');

const MINUTE = 60 * 1000;
let now = Date.parse('2026-10-09T22:00:00Z');

beforeEach(() => {
  storms = STORMS;
  conePage = CONE_PAGE;
  nhcReachable = true;
  now += 60 * MINUTE; // each test starts after the previous test's cache has expired
  mock.timers.enable({ apis: ['Date'], now });
});

afterEach(() => mock.timers.reset());

// Must run first: later tests leave a cached result behind.
test('reports an error when NHC is unreachable and nothing is cached yet', async () => {
  nhcReachable = false;
  await assert.rejects(fetchActiveStorms());
});

test('shows the cone graphic for each active Atlantic storm only', async () => {
  const { storms: list } = await fetchActiveStorms();
  assert.deepEqual(list.map((s) => s.name), ['Isaias']);
  assert.equal(list[0].label, 'Hurricane Isaias');
  assert.equal(list[0].coneImageUrl, CONE_URL);
  assert.equal(list[0].advisoryNumber, '013');
  assert.equal(list[0].issuance, '2026-10-09T21:00:00.000Z');
  assert.equal(list[0].graphicsPageUrl, 'https://www.nhc.noaa.gov/graphics_at4.shtml?cone');
});

test('shows nothing when no Atlantic storm is active', async () => {
  const json = JSON.parse(STORMS);
  json.activeStorms = json.activeStorms.filter((s) => !s.id.startsWith('al'));
  storms = JSON.stringify(json);
  const { storms: list } = await fetchActiveStorms();
  assert.deepEqual(list, []);
});

test('links to the NHC page when the cone image is missing from it', async () => {
  conePage = PLAIN_PAGE;
  const { storms: list } = await fetchActiveStorms();
  assert.equal(list[0].coneImageUrl, null);
  assert.equal(list[0].graphicsPageUrl, 'https://www.nhc.noaa.gov/graphics_at4.shtml?cone');
});

test('switches to the new cone image after NHC updates the graphic', async () => {
  const before = await fetchActiveStorms();
  assert.equal(before.storms[0].coneImageUrl, CONE_URL);

  // NHC regenerates the graphic under a new time-stamped name (DDHHMM).
  conePage = CONE_PAGE.replaceAll('092204_5day_cone', '100304_5day_cone');
  mock.timers.tick(6 * MINUTE);
  const after = await fetchActiveStorms();
  assert.equal(after.storms[0].coneImageUrl, CONE_URL.replace('092204', '100304'));
});

test('keeps the last known graphic when NHC is unreachable', async () => {
  await fetchActiveStorms();
  nhcReachable = false;
  mock.timers.tick(6 * MINUTE);
  const { storms: list } = await fetchActiveStorms();
  assert.equal(list[0].coneImageUrl, CONE_URL);
});
