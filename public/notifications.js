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

// Get user's location with permission
async function getUserLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      console.warn('[notifications] Geolocation not supported');
      resolve(null);
      return;
    }

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

          resolve({
            latitude: lat,
            longitude: lon,
            name: locationName
          });
        } catch (err) {
          console.warn('[notifications] Could not get location name:', err.message);
          resolve({
            latitude: lat,
            longitude: lon,
            name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`
          });
        }
      },
      (error) => {
        console.warn('[notifications] Location permission denied or unavailable:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      }
    );
  });
}

// Subscribe to push notifications with user location
async function subscribeToPush(registration) {
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

    // Get user's location
    console.log('[notifications] Requesting location for personalized alerts...');
    const location = await getUserLocation();

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

// Initialize notifications
async function initNotifications() {
  const prefs = getNotificationPrefs();

  // If user has enabled notifications, set up service worker
  if (prefs.enabled && supportsNotifications()) {
    const registration = await registerServiceWorker();
    if (registration) {
      await subscribeToPush(registration);
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
  init: initNotifications
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initNotifications();
});
