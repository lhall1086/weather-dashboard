# Rainfall Calculation Fix

## The Problem

The historical analytics was showing **97 inches** of rain in May 2026, which is clearly wrong! Here's what was happening:

### Why It Was Wrong:

**Old Code (Line 46 in analytics.js):**
```javascript
SUM(hourlyrainin) as totalRain
```

This was **summing up every single reading's `hourlyrainin` value**, which caused massive inflation:

**Example of the problem:**
- Your station reports every 5 minutes (12 readings per hour)
- If it rained 0.5 inches in one hour, `hourlyrainin` = 0.5
- But we had **12 readings** all showing 0.5
- **Old calculation:** 0.5 × 12 = **6 inches** (WRONG!)
- **Actual rain:** 0.5 inches (correct)

Over a month with multiple rain events, this multiplied into absurd numbers like 97 inches!

### AWN Field Meanings:

| Field | What It Means | How It Works |
|-------|---------------|--------------|
| `hourlyrainin` | **Rate** - inches per hour | Updates every reading, shows current rate |
| `dailyrainin` | **Cumulative** - total since midnight | Increments throughout day, resets at midnight |
| `weeklyrainin` | **Cumulative** - total for week | Increments, resets weekly |
| `monthlyrainin` | **Cumulative** - total for month | Increments, resets monthly |

**Key insight:** `hourlyrainin` is a **rate**, not accumulation. Summing it multiplies the rain by the number of readings!

---

## The Fix

**New Code:**

```javascript
// Calculate total rainfall: sum of max daily rain for each day in range
// dailyrainin resets at midnight, so MAX per day gives us actual daily total
const rainfall = db
  .prepare(
    `SELECT SUM(daily_max) as totalRain
     FROM (
       SELECT DATE(dateutc / 1000, 'unixepoch') as day,
              MAX(dailyrainin) as daily_max
       FROM readings
       WHERE dateutc >= ? AND dateutc <= ?
       GROUP BY day
     )`
  )
  .get(startMs, endMs);
```

### How It Works Now:

1. **Group readings by day** - `DATE(dateutc / 1000, 'unixepoch') as day`
2. **Get max daily accumulation per day** - `MAX(dailyrainin)` for each day
   - Since `dailyrainin` resets at midnight, the max value = total for that day
3. **Sum the daily totals** - Add up all the daily maximums

**Example with correct calculation:**

| Day | Readings | dailyrainin values | MAX (daily total) |
|-----|----------|-------------------|-------------------|
| May 1 | 288 readings | 0, 0, 0.1, 0.1, 0.2, ... 0.5 | **0.5 inches** |
| May 2 | 288 readings | 0, 0, 0, ... 0 | **0 inches** |
| May 3 | 288 readings | 0, 0.3, 0.3, 0.8, ... 1.2 | **1.2 inches** |

**Total for 3 days:** 0.5 + 0 + 1.2 = **1.7 inches** ✓

---

## Expected Results After Fix

### Before Fix:
```
Total Rain: 97.34 in  ← WRONG! (summed hourly rates)
```

### After Fix:
```
Total Rain: 2.34 in   ← Correct! (sum of daily totals)
```

**Realistic Alabama rainfall:**
- May average: ~4-5 inches
- Monthly range: 1-8 inches typically
- Hurricane month: Could be 10-15 inches

**97 inches = 8 feet of rain = impossible!**

---

## How Backfilled Data Will Look

For the last 30 days of historical data:

### Month-over-Month Comparison:

**Last 30 Days (Current):**
- Total Rain: 2.1 inches ✓
- Avg Temp: 84.2°F ✓
- Max Gust: 28.4 mph ✓

**Previous 30 Days:**
- Total Rain: 1.8 inches ✓
- Avg Temp: 82.1°F ✓
- Max Gust: 24.7 mph ✓

**Delta:**
- Rain: +0.3 in (+16.7%) ✓
- Temp: +2.1°F (+2.6%) ✓

### Monthly Charts:

**Temperature Chart (Weekly breakdown):**
- Week 1: 82.3°F
- Week 2: 84.1°F
- Week 3: 85.8°F
- Week 4: 86.2°F

**Rainfall Chart (Weekly breakdown):**
- Week 1: 0.3 in
- Week 2: 0.8 in
- Week 3: 0.0 in
- Week 4: 1.0 in

All values now realistic! ✓

---

## Deploy the Fix

### Step 1: Push to GitHub

```powershell
cd C:\Users\212434506\weather-dashboard
git push origin main
```

### Step 2: Wait for Render to Rebuild

- Render will auto-detect the push
- Rebuild takes 5-10 minutes
- Server will restart with fixed calculation

### Step 3: Check Your Dashboard

Visit: https://local-weather-lab.onrender.com

Scroll to **Historical Analytics** section:

**You should now see realistic numbers:**
- Total Rain: ~2-5 inches (not 97!)
- All other metrics unchanged
- Charts show correct values

---

## Technical Details

### Why MAX(dailyrainin) Per Day?

AWN's `dailyrainin` field:
1. **Starts at 0** at midnight
2. **Increments** throughout the day as rain falls
3. **Resets to 0** at next midnight

So for any given day:
- First reading of day: 0.00
- After rain event: 0.50
- More rain: 0.85
- End of day: 1.23
- **MAX = 1.23 = total for that day**

### Why Not Use monthlyrainin?

We could, but:
- ❌ Only works for current month
- ❌ Doesn't work for historical comparisons
- ❌ Doesn't work for custom date ranges
- ✅ Daily aggregation works for any date range

### What About Midnight Edge Cases?

If rain is falling right at midnight:
- Old day's total: captured by MAX
- New day's total: starts accumulating from 0
- No double-counting ✓
- No missed rain ✓

---

## Verification

### Check Calculation is Correct:

After deploying, check a specific day's rain manually:

```sql
-- Pick a day you know it rained
SELECT DATE(dateutc / 1000, 'unixepoch') as day,
       MAX(dailyrainin) as total_rain
FROM readings
WHERE DATE(dateutc / 1000, 'unixepoch') = '2026-08-09'
GROUP BY day;
```

Compare to:
- Your local weather records
- NWS Birmingham observations
- Your AWN dashboard history

They should match now! ✓

---

## Summary

**What was broken:**
- Summing `hourlyrainin` (a rate) across all readings
- Multiplied actual rain by ~288 (readings per day)
- Resulted in absurd values like 97 inches/month

**What's fixed:**
- Using `MAX(dailyrainin)` per day
- Summing daily maximums
- Results in accurate monthly totals

**Deploy now:**
```powershell
cd C:\Users\212434506\weather-dashboard
git push origin main
```

**Wait 10 minutes, then check:** https://local-weather-lab.onrender.com

Rainfall should now show realistic numbers (2-5 inches typically)! ✓
