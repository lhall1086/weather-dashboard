// Service Worker for push notifications
// This runs in the background and handles notification display

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Handle push notification received
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Weather Alert', body: event.data.text() };
    }
  }

  const title = data.title || 'Local Weather Lab';
  const options = {
    body: data.body || 'New weather update available',
    icon: data.icon || '/local-weather-lab-logo.png',
    badge: '/local-weather-lab-logo.png',
    data: data.url || '/',
    tag: data.tag || 'weather-alert',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click');
  event.notification.close();

  // Navigate to the website when notification is clicked
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
