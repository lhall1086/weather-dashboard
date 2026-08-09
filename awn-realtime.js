// Ambient Weather real-time (WebSocket) client.
//
// Unlike the REST API (rt.ambientweather.net, polled), the realtime API pushes each
// new reading to us the instant the station uploads it. Connection details verified
// against Ambient's official client source:
//   - endpoint:  https://api.ambientweather.net/   (the "api." host, NOT "rt.")
//   - connect:   ?api=1&applicationKey=<APP_KEY>, websocket transport only
//   - subscribe: emit 'subscribe' with { apiKeys: [<API_KEY>, ...] }
//   - events:    'connect', 'subscribed', 'data', 'error'
//
// IMPORTANT: the server speaks the socket.io v2 protocol, so this depends on
// socket.io-client@^2. A v3/v4 client will fail the handshake.
import 'dotenv/config';
import { EventEmitter } from 'events';
import io from 'socket.io-client';

const API_URL = 'https://api.ambientweather.net/';
const { AWN_API_KEY, AWN_APP_KEY, AWN_MAC } = process.env;

// Emits:
//   'reading' (lastData-like object) on every pushed reading for our station
//   'status'  ({ connected, subscribed, devices? }) on connection lifecycle changes
export const realtime = new EventEmitter();

let socket = null;

export function startRealtime() {
  if (!AWN_API_KEY || !AWN_APP_KEY) {
    console.warn('[realtime] missing AWN keys — realtime disabled, REST/collector still works');
    return;
  }
  if (socket) return socket; // already started

  socket = io(`${API_URL}?api=1&applicationKey=${AWN_APP_KEY}`, {
    transports: ['websocket'],
    // socket.io v2 auto-reconnects; tune the backoff a little.
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  // (Re)subscribe on every connect — covers the initial connect and reconnects.
  socket.on('connect', () => {
    console.log('[realtime] connected, subscribing…');
    socket.emit('subscribe', { apiKeys: [AWN_API_KEY] });
    realtime.emit('status', { connected: true, subscribed: false });
  });

  // Sent once after a successful subscribe; includes the account's device list.
  socket.on('subscribed', (payload) => {
    const count = payload?.devices?.length ?? 0;
    console.log(`[realtime] subscribed (${count} device${count === 1 ? '' : 's'})`);
    realtime.emit('status', { connected: true, subscribed: true, devices: payload?.devices });
  });

  // One 'data' event per new reading. Payload carries macAddress + the reading fields.
  socket.on('data', (data) => {
    if (AWN_MAC && data.macAddress && data.macAddress !== AWN_MAC) return; // ignore other stations
    realtime.emit('reading', data);
  });

  socket.on('error', (err) => console.error('[realtime] error:', err));
  socket.on('disconnect', (reason) => {
    console.warn(`[realtime] disconnected: ${reason}`);
    realtime.emit('status', { connected: false, subscribed: false });
  });

  return socket;
}

export function stopRealtime() {
  if (socket) {
    socket.close();
    socket = null;
  }
}
