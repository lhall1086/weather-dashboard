// Client-side notification management
// Handles browser push notifications and user preferences

const NOTIFICATION_PREFS_KEY = 'weather-notification-prefs';

// Default notification preferences
const DEFAULT_PREFS = {
  enabled: false,
  severeWeather: true,
  dailySummary: false,
  customAlerts: {
    tempBelow: { enabled: false, value: 32 },
    tempAbove: { enabled: false, value: 95 },
    windAbove: { enabled: false, value: 30 },
    rainAbove: { enabled: false, value: 1.0 }
  }
};

// Get saved preferences or defaults
function getNotificationPrefs() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    return saved ? JSON.parse(saved) : { ...DEFAULT_PREFS };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}

// Save preferences
function saveNotificationPrefs(prefs) {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

// Check if browser supports notifications
function supportsNotifications() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Request notification permission
async function requestNotificationPermission() {
  if (!supportsNotifications()) {
    alert('Your browser does not support notifications. Please use a modern browser like Chrome, Firefox, or Edge.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('[notifications] Permission request failed:', error);
    return false;
  }
}

// Register service worker
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[notifications] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[notifications] Service Worker registered');
    return registration;
  } catch (error) {
    console.error('[notifications] Service Worker registration failed:', error);
    return null;
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Cache the user's location so we don't have to re-prompt on every visit.
const LOCATION_CACHE_KEY = 'weather-user-location';

function getCachedLocation() {
  try {
    const saved = localStorage.getItem(LOCATION_CACHE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function cacheLocation(loc) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(loc));
  } catch (e) {
    // ignore storage errors
  }
}

// Check the browser's current geolocation permission state without prompting.
// Returns 'granted' | 'prompt' | 'denied' | 'unsupported'.
async function queryGeolocationPermission() {
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'unsupported';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch (e) {
    return 'unsupported';
  }
}

// Actually request a fresh position from the browser (may show a prompt).
function requestFreshPosition() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // Reverse geocode to get city/state name
        try {
          const res = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
            headers: {
              'User-Agent': 'local-weather-dashboard (contact: you@example.com)'
            }
          });
          const data = await res.json();
          const rel = data.properties?.relativeLocation?.properties;
          const locationName = rel?.city && rel?.state ? `${rel.city}, ${rel.state}` : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

          const loc = { latitude: lat, longitude: lon, name: locationName };
          cacheLocation(loc);
          resolve(loc);
        } catch (err) {
          console.warn('[notifications] Could not get location name:', err.message);
          const loc = { latitude: lat, longitude: lon, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
          cacheLocation(loc);
          resolve(loc);
        }
      },
      (error) => {
        console.warn('[notifications] Location permission denied or unavailable:', error.message);
        resolve(getCachedLocation());
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      }
    );
  });
}

// Get user's location.
// - On a background page load (allowPrompt = false), we only fetch a fresh
//   position if the browser has ALREADY granted permission; otherwise we reuse
//   the cached location. This prevents the location popup from re-appearing on
//   every visit once a user has allowed it once.
// - On an explicit user opt-in (allowPrompt = true), we go ahead and prompt.
async function getUserLocation(allowPrompt = false) {
  if (!('geolocation' in navigator)) {
    console.warn('[notifications] Geolocation not supported');
    return getCachedLocation();
  }

  const state = await queryGeolocationPermission();

  if (state === 'granted') {
    // Already granted — fetching a position will NOT show a popup.
    return requestFreshPosition();
  }

  if (allowPrompt) {
    // User just opted in — it's appropriate to prompt now.
    return requestFreshPosition();
  }

  // Not granted and this is a background call — don't prompt, reuse cache.
  return getCachedLocation();
}

// Subscribe to push notifications with user location.
// allowPrompt should be true only when the user just opted in (an explicit
// action), so we never trigger a location popup on a background page load.
async function subscribeToPush(registration, allowPrompt = false) {
  try {
    // Get VAPID public key from server
    const res = await fetch('/api/notifications/vapid-key');
    const data = await res.json();

    if (!data.available || !data.publicKey) {
      console.warn('[notifications] Push notifications not configured on server');
      return false;
    }

    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey)
    });

    // Get user's location (only prompts if allowed / already granted)
    console.log('[notifications] Resolving location for personalized alerts...');
    const location = await getUserLocation(allowPrompt);

    if (location) {
      console.log(`[notifications] Location obtained: ${location.name}`);
    } else {
      console.log('[notifications] Using default station location for alerts');
    }

    // Get current preferences
    const prefs = getNotificationPrefs();

    // Send subscription to server with location
    const saveRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        preferences: prefs,
        location: location
      })
    });

    const saveData = await saveRes.json();

    if (saveData.success) {
      console.log('[notifications] Push subscription saved successfully');
      return true;
    } else {
      console.error('[notifications] Failed to save subscription:', saveData.error);
      return false;
    }
  } catch (error) {
    console.error('[notifications] Push subscription failed:', error);
    return false;
  }
}

// Update ONLY the preferences for an already-registered push subscription on
// the server. No re-subscribe, no VAPID round-trip, and no location prompt —
// this is the cheap, safe way to make the server's stored preferences match
// what's in localStorage. Reads the current prefs from localStorage, so
// callers must saveNotificationPrefs() BEFORE calling this.
async function syncPreferencesToServer(subscription) {
  try {
    const prefs = getNotificationPrefs();
    const res = await fetch('/api/notifications/update-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, preferences: prefs })
    });
    const data = await res.json();
    if (data.success) {
      console.log('[notifications] Preferences synced to server');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[notifications] Failed to sync preferences:', err);
    return false;
  }
}

// Re-send the current preferences for the EXISTING push subscription to the
// server. This is what makes preference changes actually take effect: without
// it, toggling something like "Daily Forecast Summary" only updates
// localStorage and the server keeps the stale preferences it was given at
// subscribe time (dailySummary: false) — so the 6 AM loop skips the user.
//
// Never prompts for location. If there's already a push subscription we do a
// lightweight preferences-only update; if there isn't one yet (e.g. the user
// just enabled notifications) we fall back to a full subscribe.
async function resyncPreferences() {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !supportsNotifications()) return false;

  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ||
      (await registerServiceWorker());
    if (!registration) return false;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return await syncPreferencesToServer(existing);
    }
    return await subscribeToPush(registration, false);
  } catch (err) {
    console.error('[notifications] Failed to resync preferences:', err);
    return false;
  }
}

// Send a test notification
async function sendTestNotification() {
  if (Notification.permission !== 'granted') {
    alert('Please enable notifications first!');
    return;
  }

  const notification = new Notification('Local Weather Lab', {
    body: 'Test notification - You will receive weather alerts here!',
    icon: '/local-weather-lab-logo.png',
    badge: '/local-weather-lab-logo.png',
    tag: 'test-notification'
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

// Initialize notifications.
// allowPrompt is false for the automatic on-load init (so returning visitors are
// not re-prompted for location), and true when called right after the user
// explicitly enables notifications.
async function initNotifications(allowPrompt = false) {
  const prefs = getNotificationPrefs();

  // If user has enabled notifications, set up service worker
  if (prefs.enabled && supportsNotifications()) {
    const registration = await registerServiceWorker();
    if (!registration) return;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Existing subscriber (this device already has a push subscription):
      // push their current local settings to the server so any preference
      // changes — including ones made before this fix, or on another visit —
      // take effect on this visit. Cheap and never prompts for location.
      await syncPreferencesToServer(existing);
    } else {
      // Not subscribed on this device yet — do the full subscribe (which also
      // resolves and stores location, prompting only if allowPrompt is true).
      await subscribeToPush(registration, allowPrompt);
    }
  }
}

// Export functions for use in the main app
window.weatherNotifications = {
  getPrefs: getNotificationPrefs,
  savePrefs: saveNotificationPrefs,
  supports: supportsNotifications,
  requestPermission: requestNotificationPermission,
  sendTest: sendTestNotification,
  init: initNotifications,
  resync: resyncPreferences
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initNotifications();
});
