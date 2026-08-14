// Database management for push notification subscriptions
import { db } from './db.js';

// Create subscriptions table
export function initSubscriptionsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE NOT NULL,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      preferences TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      last_alert_sent INTEGER DEFAULT 0
    )
  `);
  console.log('[subscriptions] Table initialized');
}

// Save or update a subscription
export function saveSubscription(subscription, preferences) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, preferences)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    JSON.stringify(preferences)
  );

  console.log('[subscriptions] Subscription saved');
}

// Get all active subscriptions
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
