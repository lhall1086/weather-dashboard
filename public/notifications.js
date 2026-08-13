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

// Subscribe to push notifications
async function subscribeToPush(registration) {
  try {
    // For now, we'll use a simple notification system without a push server
    // In production, you'd generate VAPID keys and set up a push service
    console.log('[notifications] Push subscription ready');
    return true;
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
