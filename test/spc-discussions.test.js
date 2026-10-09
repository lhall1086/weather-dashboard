// Which SPC mesoscale discussions show in the Active Alerts panel.
// Fixtures: the live SPC discussion feed captured 2026-10-09 (MD 2350), and
// archived MDs 2348 and 2334 wrapped in the same feed format.
// Run with: npm test
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const LIVE_FEED = fixture('spc-md-rss.xml'); // MD 2350: Florida Panhandle, valid 2148Z-2315Z Oct 9
const ARCHIVE_FEED = fixture('spc-md-archive-rss.xml'); // MD 2348: SE Alabama/FL Panhandle; MD 2334: SE Arizona

// The test "station" sits inside MD 2350's area; never load the real .env.
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./fixtures/no-such.env', import.meta.url));
process.env.LAT = '29.85';
process.env.LON = '-83.5';

// spc.noaa.gov is the network boundary: serve the chosen feed.
let feed;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u === 'https://www.spc.noaa.gov/products/spcmdrss.xml') {
    return new Response(feed, { status: 200, headers: { 'Content-Type': 'application/rss+xml' } });
  }
  throw new Error(`Unexpected fetch in test: ${u}`);
};

const { fetchDiscussions } = await import('../spc.js');

const at = (iso) => mock.timers.enable({ apis: ['Date'], now: Date.parse(iso) });
afterEach(() => mock.timers.reset());

// Tests run in time order: the feed is cached for 5 minutes.
test('finds discussions west of 100°W, where SPC drops the leading 1 of the longitude', async () => {
  at('2026-09-29T21:00:00Z');
  feed = ARCHIVE_FEED;
  const found = await fetchDiscussions(32.0, -110.0); // near Willcox, AZ
  assert.deepEqual(found.map((d) => d.number), [2334]);
});

test('shows a discussion whose area covers the point, with wrapped fields joined', async () => {
  at('2026-10-09T16:00:00Z');
  feed = ARCHIVE_FEED;
  const found = await fetchDiscussions(30.5, -86.5); // near Crestview, FL
  assert.deepEqual(found.map((d) => d.number), [2348]);
  // SPC wraps this line in the source text; it should read as one line.
  assert.equal(found[0].areasAffected, 'portions of southeast Alabama...the Florida Panhandle and southwest Georgia');
});

test('includes the full SPC text and links, for the station by default', async () => {
  at('2026-10-09T22:30:00Z');
  feed = LIVE_FEED;
  const [md, ...rest] = await fetchDiscussions();
  assert.equal(rest.length, 0);
  assert.equal(md.number, 2350);
  assert.equal(md.title, 'Mesoscale Discussion 2350');
  assert.equal(md.concerning, 'Tornado Watch 677...');
  assert.equal(md.areasAffected, 'The Florida Panhandle');
  assert.equal(md.url, 'https://www.spc.noaa.gov/products/md/md2350.html');
  assert.equal(md.imageUrl, 'https://www.spc.noaa.gov/products/md/mcd2350.png');
  assert.equal(md.validUntil, '2026-10-09T23:15:00.000Z');
  assert.ok(md.text.includes('SUMMARY...The main tornado threat this evening will be near the'));
});

test('does not show discussions whose area leaves out the point', async () => {
  at('2026-10-09T22:40:00Z');
  feed = LIVE_FEED;
  assert.deepEqual(await fetchDiscussions(32.5776, -85.7583), []); // Montgomery, AL
});

test('drops a discussion once its valid period ends', async () => {
  at('2026-10-09T23:30:00Z');
  feed = LIVE_FEED;
  assert.deepEqual(await fetchDiscussions(), []);
});

test('keeps a discussion whose valid period runs into the next month', async () => {
  at('2026-10-31T23:55:00Z');
  feed = LIVE_FEED
    .replace('Fri, 09 Oct 2026 21:49:06 +0000</pubDate>', 'Sat, 31 Oct 2026 23:49:06 +0000</pubDate>')
    .replace('Valid 092148Z - 092315Z', 'Valid 312348Z - 010115Z');
  const found = await fetchDiscussions();
  assert.deepEqual(found.map((d) => d.number), [2350]);
});
