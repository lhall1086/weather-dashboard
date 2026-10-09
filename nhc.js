// National Hurricane Center (NHC): the "Watches/Warnings Forecast Cone for
// Storm Center" graphic for each active Atlantic storm.
//
// CurrentStorms.json lists the active storms. Each storm's graphics page
// (graphics_atN.shtml?cone) shows the current cone image, and NHC gives that
// image a new URL every time it updates the graphic — so a changed URL means
// a new graphic. Cached 5 min (NHC itself serves the image with max-age=300).
const NHC = 'https://www.nhc.noaa.gov';
const USER_AGENT = 'local-weather-dashboard (contact: you@example.com)';
const CACHE_TTL = 5 * 60 * 1000;

let cache = { at: 0, data: null };

// CurrentStorms.json classification codes -> display names.
const CLASSIFICATIONS = {
  HU: 'Hurricane',
  TS: 'Tropical Storm',
  TD: 'Tropical Depression',
  PTC: 'Potential Tropical Cyclone',
};

async function nhcGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`NHC ${url} failed: ${res.status}`);
  return res;
}

// The cone graphic on a storm's graphics page: <img id="coneimage" src="...">.
// (The page also has look-alike thumbnails, so match the id, not the file name.)
async function fetchConeImageUrl(conePageUrl) {
  const html = await (await nhcGet(conePageUrl)).text();
  const tag = (html.match(/<img\b[^>]*\bid\s*=\s*"coneimage"[^>]*>/i) || [])[0];
  const src = tag && (tag.match(/\bsrc\s*=\s*"([^"]+)"/i) || [])[1];
  return src ? new URL(src, NHC).href : null;
}

async function toStorm(storm) {
  const pageUrl = storm.forecastGraphics?.url || `${NHC}/graphics_${storm.binNumber.toLowerCase()}.shtml`;
  const graphicsPageUrl = `${pageUrl}?cone`;

  let coneImageUrl = null;
  try {
    coneImageUrl = await fetchConeImageUrl(graphicsPageUrl);
    if (!coneImageUrl) console.warn(`[nhc] No cone image found on ${graphicsPageUrl} (page layout changed?)`);
  } catch (err) {
    console.warn(`[nhc] Could not load ${graphicsPageUrl}:`, err.message);
  }

  const kind = CLASSIFICATIONS[storm.classification];
  return {
    id: storm.id,
    name: storm.name,
    label: kind ? `${kind} ${storm.name}` : storm.name,
    advisoryNumber: storm.publicAdvisory?.advNum ?? null,
    issuance: storm.publicAdvisory?.issuance ?? null,
    coneImageUrl,
    graphicsPageUrl,
  };
}

// Active Atlantic storms with their current cone graphic (cached 5 min).
// On an NHC outage, keeps returning the last known result if there is one.
export async function fetchActiveStorms() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL) return cache.data;

  try {
    const current = await (await nhcGet(`${NHC}/CurrentStorms.json`)).json();
    const atlantic = (current.activeStorms || []).filter((s) => s.id?.startsWith('al'));
    const data = { storms: await Promise.all(atlantic.map(toStorm)) };
    cache = { at: now, data };
    return data;
  } catch (err) {
    console.error('[nhc]', err.message);
    if (cache.data) return cache.data;
    throw err;
  }
}
