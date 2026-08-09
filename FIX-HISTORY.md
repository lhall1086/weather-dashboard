# Fixing Missing Historical Data on Render

Your dashboard is live at **local-weather-lab.onrender.com**, but the historical data section is empty because the production database is brand new. Here's how to fix it.

---

## Why Historical Data is Missing

When you deployed to Render:
- ✅ Fresh container created
- ✅ Fresh empty database
- ❌ No historical data from your local computer

Your local computer has 30 days of data, but the production server needs to fetch its own.

---

## Solution: Auto-Populate on Next Deploy

I've created a startup script that automatically backfills historical data when the database is empty.

### What Changed:

1. **Created `startup.js`** - Checks database and runs backfill if empty
2. **Updated `package.json`** - Changed start command to use startup.js
3. **Updated `Dockerfile`** - Now runs startup.js instead of server.js directly

---

## Deploy the Fix

### Step 1: Commit Changes

```powershell
cd C:\Users\212434506\weather-dashboard

git add startup.js package.json Dockerfile
git commit -m "Add automatic historical data backfill on startup"
git push origin main
```

### Step 2: Wait for Render to Rebuild

- Render will automatically detect the push
- It will rebuild and redeploy (takes 5-10 minutes)
- Watch the logs at: https://dashboard.render.com

### Step 3: Monitor the Backfill in Logs

In Render dashboard → Your service → Logs, you'll see:

```
[startup] Checking database...
[startup] Database is empty. Running backfill for last 30 days...
[startup] This will take 1-2 minutes. Please wait...
[backfill] Fetching last 30 days...
[backfill] ████████████████████████████████ 100% | Day 30/30
[backfill] Done! 8,640 new records imported
[startup] Backfill complete! Starting server...
Weather dashboard on http://localhost:3000
```

### Step 4: Refresh Your Dashboard

After you see "Weather dashboard on http://localhost:3000" in logs:

1. Visit: https://local-weather-lab.onrender.com
2. Scroll to **Historical Analytics** section
3. You should now see data! 📊

---

## How It Works

**On first deploy (database empty):**
1. `startup.js` detects empty database
2. Runs `backfill.js` to fetch last 30 days from AWN API
3. Takes 1-2 minutes (respects AWN 1 req/sec rate limit)
4. Imports ~8,640 records (5-minute intervals × 30 days)
5. Starts server normally

**On subsequent restarts (database has data):**
1. `startup.js` detects existing data
2. Skips backfill
3. Starts server immediately

**Ongoing data collection:**
- Collector runs every 5 minutes
- Realtime WebSocket updates every 60 seconds
- Database grows continuously

---

## Alternative: Manual Backfill (If You Want to Run It Now)

If you don't want to wait for redeploy, you can trigger backfill manually via Render Shell:

### Step 1: Open Render Shell

1. Go to: https://dashboard.render.com
2. Click your service: **local-weather-lab**
3. Click **"Shell"** tab at the top
4. A terminal will open

### Step 2: Run Backfill

In the Render shell, type:

```bash
node backfill.js
```

Press Enter and wait 1-2 minutes. You'll see progress:

```
[backfill] Fetching last 30 days...
[backfill] ████████████████████████████████ 100% | Day 30/30
[backfill] Done! 8,640 new records imported
```

### Step 3: Refresh Dashboard

Visit https://local-weather-lab.onrender.com and check Historical Analytics section.

---

## Troubleshooting

### "Backfill seems stuck at X%"

**Normal!** AWN API has a 1 request/second rate limit. Backfill takes:
- 30 days = ~60 seconds (1 request per day)
- Progress updates every 5 days

Just wait - it will complete.

---

### "Historical Analytics still shows 'Insufficient Data'"

**Causes:**
1. Backfill hasn't run yet (check logs)
2. Backfill is still running (be patient)
3. Not enough data yet (needs at least a few days)

**Check logs:**
```
Dashboard → Logs tab → Search for "[backfill]"
```

If you see no backfill messages, the startup script hasn't triggered yet.

---

### "Database keeps getting wiped"

**This shouldn't happen**, but on Render's free tier:

- Database is stored in `/app/data/` inside the container
- **Should persist** across restarts
- **Will reset** on redeploys (new container)

If you redeploy frequently, backfill will run each time (which is fine - it's automatic).

---

### "I want year-over-year comparison, not month-over-month"

You need 335+ days of data. Options:

1. **Wait 11 months** - dashboard auto-switches to YoY when data available
2. **Import more history** - Modify backfill.js line:
   ```javascript
   // Change from 30 to 365
   const DAYS_TO_BACKFILL = 365;
   ```
   Then redeploy. Takes ~6 minutes to import a year.

---

## Expected Timeline

| Time | What Happens |
|------|--------------|
| **Now** | Dashboard live, but no historical data |
| **You push changes** | Render starts rebuilding |
| **5-10 min later** | Rebuild complete, startup.js runs |
| **1-2 min after that** | Backfill completes, server starts |
| **Total: ~12 min** | Dashboard now has 30 days of history! |

---

## Verify It Worked

Visit: https://local-weather-lab.onrender.com

Scroll to **Historical Analytics** section:

**Before fix:**
```
Insufficient Data
Run backfill to import historical data
```

**After fix:**
```
✅ Avg Temp: 85.3°F (Month-over-Month)
✅ Total Rain: 2.34 in
✅ Charts showing last 30 days
```

---

## One-Time Setup

You only need to do this **once**. After the initial backfill:
- Data keeps collecting automatically
- No manual intervention needed
- Analytics section stays populated

---

## Summary

**Quick Fix:**
```powershell
cd C:\Users\212434506\weather-dashboard
git add startup.js package.json Dockerfile
git commit -m "Add automatic historical data backfill on startup"
git push origin main
```

Then wait 12 minutes and refresh your dashboard. Historical data will be there! 📊

---

## Questions?

- **Check Render logs** for backfill progress
- **Be patient** - backfill takes 1-2 minutes
- **Refresh dashboard** after seeing "Weather dashboard on..." in logs

Your dashboard will be complete in ~12 minutes! 🎉
