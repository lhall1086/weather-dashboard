// Thin wrapper around the Ambient Weather Network REST API.
// AWN rate limit is 1 request/second per API key, so callers should cache.
import 'dotenv/config';

const BASE = 'https://rt.ambientweather.net/v1';
const { AWN_API_KEY, AWN_APP_KEY, AWN_MAC } = process.env;

function requireKeys() {
  if (!AWN_API_KEY || !AWN_APP_KEY) {
    throw new Error('Missing AWN_API_KEY / AWN_APP_KEY — copy .env.example to .env and fill them in.');
  }
}

// Fetch all devices on the account; each has a `lastData` object with current conditions.
export async function fetchDevices() {
  requireKeys();
  const url = `${BASE}/devices?applicationKey=${AWN_APP_KEY}&apiKey=${AWN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AWN /devices failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// Current conditions for our station's `lastData` (first device, or the one matching AWN_MAC).
export async function fetchCurrent() {
  const devices = await fetchDevices();
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error('AWN returned no devices — check your keys and that the station is online.');
  }
  const device =
    devices.find((d) => d.macAddress === AWN_MAC) || devices[0];
  return device.lastData;
}

// Historical records for charting. `limit` maxes at 288 per request (one day at 5-min spacing).
export async function fetchHistory({ limit = 288, endDate } = {}) {
  requireKeys();
  if (!AWN_MAC) throw new Error('Missing AWN_MAC in .env');
  let url = `${BASE}/devices/${encodeURIComponent(AWN_MAC)}?applicationKey=${AWN_APP_KEY}&apiKey=${AWN_API_KEY}&limit=${limit}`;
  if (endDate) url += `&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AWN history failed: ${res.status} ${res.statusText}`);
  return res.json();
}
