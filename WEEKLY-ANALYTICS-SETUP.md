# 📊 Weekly Analytics Email Reports - Setup Guide

Get automated weekly reports sent to **localweatherlab@gmail.com** every **Monday at 7:00 AM CST** with:
- Total active subscribers
- New subscriptions this week
- Unique visitors
- Total page views
- Daily breakdown

---

## ✅ **What's Already Done**

All the code is implemented! The system includes:

- ✅ Visitor tracking database (logs all page visits)
- ✅ Weekly stats generator (aggregates 7-day data)
- ✅ Email service with Nodemailer (Gmail SMTP)
- ✅ Scheduler (every Monday at 7:00 AM CST)
- ✅ Beautiful HTML email template
- ✅ Subscription tracking (with createdAt timestamps)

**What you need to do:** Generate Gmail App Password and add it to Render

---

## 📋 **Setup Steps**

### **Step 1: Generate Gmail App Password**

Since you're using **localweatherlab@gmail.com**, you need to create an "App Password" for secure authentication.

**Instructions:**

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/security
   - Or Google Account → Security

2. **Enable 2-Factor Authentication (if not already enabled)**
   - Under "Signing in to Google"
   - Click "2-Step Verification"
   - Follow prompts to enable

3. **Generate App Password**
   - Under "Signing in to Google"
   - Click "App passwords" (only appears if 2FA is enabled)
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Enter name: "Weather Dashboard Analytics"
   - Click "Generate"

4. **Copy the 16-character password**
   - Google will show a 16-character password like: `abcd efgh ijkl mnop`
   - **SAVE THIS** - you can only see it once
   - Format: Remove spaces → `abcdefghijklmnop`

---

### **Step 2: Add Environment Variables to Render**

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Click on your `weather-dashboard` service

2. **Add Environment Variables**
   - Click "Environment" in the left sidebar
   - Click "Add Environment Variable"
   - Add these TWO variables:

   **Variable 1:**
   ```
   Key: EMAIL_USER
   Value: localweatherlab@gmail.com
   ```

   **Variable 2:**
   ```
   Key: EMAIL_PASSWORD
   Value: [paste your 16-character App Password here]
   ```

3. **Save Changes**
   - Click "Save Changes" at the bottom
   - Render will automatically restart your service

---

### **Step 3: Deploy the Updated Code**

The code is ready to commit and push:

```bash
# The following files are new/updated:
# - visits-db.js (NEW - visitor tracking)
# - email-service.js (NEW - email configuration)
# - weekly-stats.js (NEW - report generator)
# - subscriptions-db.js (UPDATED - added getNewSubscriptionsLastNDays)
# - server.js (UPDATED - added visitor tracking + scheduler)
# - package.json (UPDATED - added nodemailer)
```

Once you push to GitHub, Render will:
1. Auto-deploy the new code
2. Install nodemailer dependency
3. Start visitor tracking
4. Schedule weekly reports for next Monday

---

### **Step 4: Verify It's Working**

After deployment (about 5 minutes):

1. **Check Render Logs**
   - Look for these messages:
   ```
   [visits-db] Visitor tracking database initialized
   [weekly-stats] Scheduling weekly analytics reports...
   [weekly-stats] Next report scheduled in Xd Yh Zm
   ```

2. **Visit Your Website**
   - Open https://weather-dashboard-5hdo.onrender.com
   - This will log a visit in the database

3. **Check Server Logs for Visitor Tracking**
   - Should see visitor logs when you visit the page
   - Confirms tracking is working

---

## 📧 **What the Weekly Email Will Look Like**

**Subject:** 📊 Local Weather Labs - Weekly Report (Aug 9 - Aug 15, 2026)

**Content:**
- **Header:** Blue gradient with logo and title
- **Date Range:** Exact 7-day period covered
- **Subscriber Metrics:**
  - Total Active Subscribers (big number)
  - New This Week (with % change)
- **Website Traffic:**
  - Unique Visitors
  - Total Page Views
  - Avg Views per Visitor
- **Daily Breakdown Table:** 
  - Each day's visitors and page views
- **Footer:** Next report date

**Format:** Beautiful HTML email (works in all email clients)

---

## 🧪 **Testing the Email System**

Want to test before waiting until Monday? You can trigger a test report.

**Option A: Wait for Next Monday**
- The system will automatically send the report
- No action needed

**Option B: Manually Trigger Test (Advanced)**
- SSH into Render console
- Run: `node -e "import('./weekly-stats.js').then(m => m.generateWeeklyReport())"`
- This sends a test report immediately

---

## 📊 **What Data Gets Tracked**

### **Visitor Tracking:**
- IP address (for unique visitor count)
- User agent (browser/device info)
- Path (what page was visited)
- Referrer (where they came from)
- Timestamp (when they visited)

**Privacy Notes:**
- Only page visits are tracked (not API calls or assets)
- No cookies or personal data stored
- IP addresses used only for counting unique visitors
- Old data auto-deleted after 90 days

### **Subscription Tracking:**
- Total active subscriptions
- When each subscription was created
- New subscriptions in last 7 days

---

## 🔧 **Troubleshooting**

### **"Email not sent" in logs**
- Check that EMAIL_USER and EMAIL_PASSWORD are set in Render
- Verify App Password is correct (no spaces)
- Make sure 2FA is enabled on Gmail account

### **"VAPID keys not configured" warning**
- This is for push notifications, not email reports
- Email reports will still work
- See NOTIFICATIONS-SETUP.md to configure push notifications

### **No visitors showing in report**
- Make sure you've visited the website after deployment
- Check that visitor tracking logs appear in Render logs
- Wait a few days to accumulate visitor data

### **Report scheduled for wrong time**
- Reports are scheduled for 7:00 AM CST (Chicago timezone)
- Server automatically handles timezone conversion
- Check Render logs for "Next report scheduled in..." message

---

## 📅 **Report Schedule**

**Frequency:** Every Monday  
**Time:** 7:00 AM Central Standard Time (CST)  
**Recipient:** localweatherlab@gmail.com  
**Data Period:** Previous 7 days (Monday-Sunday)

**First Report:**
- Will be sent on the first Monday after deployment
- Will include data from the past 7 days (since deployment)

---

## 🎯 **What Happens Each Week**

**Every Monday at 7:00 AM CST:**
1. System queries last 7 days of data
2. Calculates total subscribers, new subscriptions
3. Calculates unique visitors, page views
4. Generates daily breakdown table
5. Formats beautiful HTML email
6. Sends to localweatherlab@gmail.com
7. Logs success/failure in Render logs

**No manual action needed!** 🎉

---

## 🔐 **Security Notes**

✅ **App Password is secure:**
- Used only for this application
- Can be revoked anytime from Google Account settings
- Never shared or exposed publicly

✅ **Email credentials stored safely:**
- In Render environment variables (encrypted)
- Never committed to Git
- Not accessible in browser/frontend

✅ **Visitor data privacy:**
- IP addresses hashed for uniqueness
- No tracking cookies
- No personal information collected
- Complies with basic privacy best practices

---

## 📞 **Need Help?**

If you run into issues:

1. **Check Render Logs** for error messages
2. **Verify Gmail App Password** is correct
3. **Confirm 2FA is enabled** on Gmail account
4. **Check environment variables** are set in Render

**Common Issues:**
- "Authentication failed" → Wrong App Password
- "No report sent" → Environment variables not set
- "EAUTH" error → 2FA not enabled on Gmail

---

## 🚀 **You're Almost Done!**

Once you:
1. ✅ Generate Gmail App Password
2. ✅ Add EMAIL_USER and EMAIL_PASSWORD to Render
3. ✅ Push code to GitHub (auto-deploys to Render)

You'll start receiving weekly analytics reports every Monday morning! 📊📧

---

**Generated:** 2026-08-16  
**Version:** 1.0.0  
**Recipient:** localweatherlab@gmail.com  
**Schedule:** Every Monday at 7:00 AM CST
