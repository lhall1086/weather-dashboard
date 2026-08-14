# 🔔 Automated Weather Alert Notifications - Setup Guide

This guide will help you set up the automated weather alert notification system that sends real-time push notifications to your users.

---

## ✅ **What's Already Done**

All the code is implemented and deployed! The system includes:

- ✅ Backend push notification service
- ✅ Alert monitoring (checks every 5 minutes)
- ✅ Daily summary scheduler (7:00 AM)
- ✅ Subscription management database
- ✅ Frontend integration complete

**What you need to do:** Generate VAPID keys and add them to Render

---

## 📋 **Setup Steps**

### **Step 1: Generate VAPID Keys (Locally)**

VAPID keys authenticate your server when sending push notifications.

**On your computer:**

```bash
cd /path/to/weather-dashboard
node generate-vapid-keys.js
```

**This will output something like:**

```
🔑 Generating VAPID keys for push notifications...

✅ Keys generated! Add these to your .env file:

────────────────────────────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=BDa8f5K... (long string)
VAPID_PRIVATE_KEY=xE9mP2... (long string)
VAPID_SUBJECT=mailto:your-email@example.com
────────────────────────────────────────────────────────────────────────────────

📝 Instructions:
1. Copy the three lines above
2. Add them to your .env file
3. Replace "your-email@example.com" with your actual email
4. Add the same values to Render environment variables
5. Restart your server
```

**⚠️ IMPORTANT:** 
- Save these keys somewhere safe
- Never commit them to GitHub
- You only need to generate them ONCE

---

### **Step 2: Add Keys to Render**

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Click on your `weather-dashboard` service

2. **Add Environment Variables**
   - Click "Environment" in the left sidebar
   - Click "Add Environment Variable"
   - Add these THREE variables:

   **Variable 1:**
   - Key: `VAPID_PUBLIC_KEY`
   - Value: `BDa8f5K...` (paste the public key from Step 1)

   **Variable 2:**
   - Key: `VAPID_PRIVATE_KEY`
   - Value: `xE9mP2...` (paste the private key from Step 1)

   **Variable 3:**
   - Key: `VAPID_SUBJECT`
   - Value: `mailto:your-email@example.com` (replace with your actual email)

3. **Save Changes**
   - Click "Save Changes" at the bottom
   - Render will automatically restart your service

---

### **Step 3: Verify It's Working**

Wait about 2-3 minutes for Render to restart, then:

1. **Visit your website**
2. **Click the bell icon** (🔔) in the top-right header
3. **Toggle "Enable Notifications"**
4. **Allow browser permission** when prompted
5. **Set a test threshold:**
   - Check "Temperature rises above"
   - Set value to `0°F` (will definitely trigger)
6. **Wait 5 minutes** for the alert monitor to run
7. **You should receive a push notification!**

**Check server logs in Render:**
```
[push] VAPID configured ✓
[subscriptions] Table initialized
[alert-monitor] Starting alert monitoring service...
[alert-monitor] Checking weather conditions...
[alert-monitor] Sending 1 alert(s) to subscription #1
```

---

## 🎯 **How It Works Now**

### **For Your Users:**

1. Visit your website
2. Click bell icon → Enable notifications
3. Set their preferences:
   - Severe weather alerts (tornadoes, floods, etc.)
   - Daily morning summary
   - Custom thresholds (temp, wind, rain)
4. Receive automatic alerts!

### **Behind the Scenes:**

**Every 5 minutes**, the server:
1. Gets current weather data
2. Gets all user subscriptions
3. Checks each subscription's preferences
4. Sends push notifications if conditions are met

**Every morning at 7:00 AM:**
- Sends daily weather summary to subscribed users

**Subscription Management:**
- Stores in SQLite database
- Removes expired subscriptions automatically
- Prevents spam (max 1 alert per 15 minutes per user)

---

## 📊 **What Alerts Are Sent**

### **1. Severe Weather Alerts** ⚠️
- Tornado warnings
- Thunderstorm warnings
- Flood warnings
- Automatically sent when NWS issues alerts

### **2. Temperature Alerts** 🌡️
- Temperature drops below X°F
- Temperature rises above Y°F
- User sets their own thresholds

### **3. Wind Alerts** 💨
- Wind speed exceeds Z mph
- Useful for high wind warnings

### **4. Rainfall Alerts** 🌧️
- Rainfall exceeds N inches per hour
- Flash flood detection

### **5. Daily Summary** 🌤️
- Sent at 7:00 AM
- Current conditions + today's forecast
- Optional (user can disable)

---

## 🔧 **Testing & Troubleshooting**

### **Test Notifications**

1. Enable notifications on your website
2. Click "Send Test Notification"
3. Should see: "Test notification - You will receive weather alerts here!"

If test works but automatic alerts don't:
- Check Render logs for errors
- Verify VAPID keys are set correctly
- Wait 5+ minutes for monitor to run

### **Check Subscription Count**

The server logs will show:
```
[alert-monitor] Checking 3 subscription(s)
```

This tells you how many active subscriptions exist.

### **Common Issues**

**"Push notifications not configured"**
- VAPID keys not added to Render
- Check environment variables

**"Service Worker registration failed"**
- Browser doesn't support service workers
- Try Chrome, Firefox, or Edge

**"Permission denied"**
- User blocked notifications in browser
- Need to re-enable in browser settings

**No alerts received:**
- Check thresholds (might not be met)
- Wait 5 minutes for next check
- Verify subscription saved (check logs)

---

## 📱 **Browser Support**

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full support |
| Edge | ✅ Full support |
| Firefox | ✅ Full support |
| Safari (iOS) | ✅ iOS 16.4+ |
| Safari (macOS) | ✅ macOS 13+ |
| Opera | ✅ Full support |

**Note:** Push notifications require HTTPS (your Render deployment is already HTTPS)

---

## 🎉 **You're Done!**

Once you add the VAPID keys to Render, your weather dashboard will have:

✅ **Real-time severe weather alerts**
✅ **Customizable threshold notifications**
✅ **Morning weather summaries**
✅ **Background monitoring (every 5 minutes)**
✅ **Works even when browser is closed**

Your users can now get instant weather alerts tailored to their needs!

---

## 🚀 **Next Steps (Optional)**

### **Add Email Notifications**
- Use Nodemailer or SendGrid
- Fallback for users without push support

### **Add SMS Notifications**
- Use Twilio API
- Premium feature for critical alerts

### **Admin Dashboard**
- View subscription count
- See alert history
- Manage users

### **More Alert Types**
- UV Index alerts
- Pollen alerts
- Air quality alerts
- Lightning detection

---

## 📞 **Need Help?**

If you run into issues:

1. Check Render logs for errors
2. Verify VAPID keys are correct
3. Test with browser console open (F12)
4. Check that service worker registered successfully

**Quick debug command:**
```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => console.log(reg))
```

Should show: `ServiceWorkerRegistration { scope: "https://your-site.onrender.com/" }`

---

**Generated:** 2026-08-14
**Version:** 1.0.0
