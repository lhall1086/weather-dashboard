// Generate VAPID keys for web push notifications
// Run this ONCE: node generate-vapid-keys.js
// Then add the output to your .env file and Render environment variables
import webpush from 'web-push';

console.log('\n🔑 Generating VAPID keys for push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ Keys generated! Add these to your .env file:\n');
console.log('─'.repeat(80));
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log('─'.repeat(80));
console.log('\n📝 Instructions:');
console.log('1. Copy the three lines above');
console.log('2. Add them to your .env file');
console.log('3. Replace "your-email@example.com" with your actual email');
console.log('4. Add the same values to Render environment variables');
console.log('5. Restart your server\n');
