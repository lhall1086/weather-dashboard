// Database management for push notification subscriptions
import { db } from './db.js';

// Create subscriptions table with location data
export function initSubscriptionsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE NOT NULL,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      preferences TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      last_alert_sent INTEGER DEFAULT 0
    )
  `);

  // Add location columns to existing table if they don't exist (migration)
  try {
    db.exec(`ALTER TABLE push_subscriptions ADD COLUMN latitude REAL`);
    console.log('[subscriptions] Added latitude column');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec(`ALTER TABLE push_subscriptions ADD COLUMN longitude REAL`);
    console.log('[subscriptions] Added longitude column');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec(`ALTER TABLE push_subscriptions ADD COLUMN location_name TEXT`);
    console.log('[subscriptions] Added location_name column');
  } catch (e) {
    // Column already exists, ignore
  }

  console.log('[subscriptions] Table initialized with location support');
}

// Save or update a subscription with location data
export function saveSubscription(subscription, preferences, location = null) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions
    (endpoint, keys_p256dh, keys_auth, preferences, latitude, longitude, location_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    JSON.stringify(preferences),
    location?.latitude || null,
    location?.longitude || null,
    location?.name || null
  );

  const locationStr = location?.name || `${location?.latitude?.toFixed(2)}, ${location?.longitude?.toFixed(2)}` || 'default station location';
  console.log(`[subscriptions] Subscription saved for location: ${locationStr}`);
}

// Get all active subscriptions with location data
export function getAllSubscriptions() {
  const stmt = db.prepare('SELECT * FROM push_subscriptions');
  const rows = stmt.all();

  return rows.map(row => ({
    id: row.id,
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.keys_p256dh,
        auth: row.keys_auth
      }
    },
    preferences: JSON.parse(row.preferences),
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      name: row.location_name
    },
    lastAlertSent: row.last_alert_sent,
    createdAt: row.created_at
  }));
}

// Update last alert sent timestamp for a subscription
export function updateLastAlertSent(subscriptionId) {
  const stmt = db.prepare('UPDATE push_subscriptions SET last_alert_sent = ? WHERE id = ?');
  stmt.run(Date.now(), subscriptionId);
}

// Remove a subscription (called when push fails or user unsubscribes)
export function removeSubscription(endpoint) {
  const stmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
  const result = stmt.run(endpoint);

  if (result.changes > 0) {
    console.log('[subscriptions] Removed subscription');
  }

  return result.changes > 0;
}

// Get subscription count (for admin/stats)
export function getSubscriptionCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions');
  return stmt.get().count;
}

// Get new subscriptions in the last N days
export function getNewSubscriptionsLastNDays(days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM push_subscriptions
    WHERE created_at >= ?
  `);

  const result = stmt.get(cutoff);
  return result.count || 0;
}
