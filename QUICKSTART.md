# 🚀 Quick Start - Deploy in 5 Minutes

The **fastest and easiest** way to get your dashboard online and shareable.

---

## ✅ Recommended: Render.com (100% Free, No Credit Card)

### Step 1: Create Render Account
1. Go to: https://render.com
2. Click "Get Started"
3. Sign up with **GitHub** (easiest option)

### Step 2: Push Code to GitHub

**⚠️ HAVING TROUBLE? See [GITHUB-SETUP.md](GITHUB-SETUP.md) for detailed troubleshooting!**

#### Quick Steps:

```bash
# 1. Create a new repo on GitHub.com
# - Go to https://github.com/new
# - Name it: weather-dashboard
# - Make it PUBLIC
# - Don't initialize with README (we have one)
# - Click "Create repository"

# 2. Push your code (run these in PowerShell/Terminal)
cd C:/Users/212434506/weather-dashboard

git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git
git branch -M main
git push -u origin main
```

**Authentication Required:**
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (NOT your GitHub password)
- Generate token at: https://github.com/settings/tokens
- Select scope: `repo`

**OR use GitHub Desktop (easier):**
- Download: https://desktop.github.com
- Sign in → Add Local Repository → Publish

**Full troubleshooting guide:** [GITHUB-SETUP.md](GITHUB-SETUP.md)

### Step 3: Deploy on Render
1. Go to: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect GitHub"** (if needed)
4. Find and select your `weather-dashboard` repository
5. Click **"Connect"**

### Step 4: Configure Service
Fill in these settings:
- **Name:** `local-weather-labs` (or whatever you want)
- **Region:** US West (Oregon) or closest to you
- **Branch:** `main`
- **Root Directory:** (leave blank)
- **Environment:** **Docker**
- **Docker Command:** (leave blank - uses Dockerfile)
- **Plan:** **Free**

### Step 5: Add Environment Variables
Scroll down to **"Environment Variables"** section.

Click **"Add Environment Variable"** for each of these:

| Key | Value |
|-----|-------|
| `AWN_API_KEY` | `0a82032f5c824617bb8be9e9d5f847983b66c47bc8aa4f8b9b78587bffe5482d` |
| `AWN_APP_KEY` | `b170f85752cb42158ff06e060e5f3f108853364935964cc39f0beaddf1e9408a` |
| `AWN_MAC` | `F8:B3:B7:86:33:22` |
| `LAT` | `32.5776` |
| `LON` | `-85.7583` |
| `PORT` | `3000` |
| `COLLECT_CRON` | `*/5 * * * *` |

### Step 6: Deploy!
1. Click **"Create Web Service"** at the bottom
2. Wait 5-10 minutes for the build to complete
3. Watch the logs - you'll see:
   ```
   Weather dashboard on http://localhost:3000
   [realtime] Connected to AWN WebSocket
   [collector] Cron schedule: */5 * * * *
   ```

### Step 7: Get Your URL
Once deployed, you'll see your URL at the top:
```
https://local-weather-labs.onrender.com
```
or similar (with your chosen name).

### Step 8: Test It
1. Click your URL
2. Dashboard should load with current weather!
3. All features should work:
   - ✅ Current conditions
   - ✅ Interactive map
   - ✅ Active alerts
   - ✅ Forecasts

### Step 9: Share It! 🎉
Copy your URL and share on:
- Facebook
- Twitter/X
- LinkedIn
- Instagram (in bio)
- Reddit

---

## 📝 Sample Social Media Posts

### Facebook:
```
🌦️ Check out my live weather dashboard for Tallapoosa County, Alabama!

🔴 Real-time data from my personal weather station
🗺️ Interactive US map with nationwide temperatures
⚠️ Live severe weather alerts
📊 7-day forecasts & historical analytics

View it live: [YOUR-URL-HERE]

#Weather #Alabama #TallapoosaCounty
```

### Twitter/X:
```
🌦️ Built a live weather dashboard for Tallapoosa County, AL

✅ Real-time station data
✅ Interactive US map
✅ Severe weather alerts
✅ 7-day SPC outlook

Check it out: [YOUR-URL-HERE]

#WxTwitter #ALwx #WeatherStation
```

---

## ⚠️ Important Notes

### Free Tier Limitations:
- ✅ **750 hours/month** (more than enough)
- ⚠️ **Sleeps after 15 minutes** of inactivity
- First visit after sleep takes ~30 seconds to wake up
- Perfect for personal use and social media sharing

### Keeping It Awake (Optional):
If you want 24/7 uptime with no sleep:
1. Upgrade to Railway ($5/month)
2. Or upgrade to Render paid plan ($7/month)
3. Or use a free uptime monitor (UptimeRobot.com) to ping every 5 min

---

## 🔧 Troubleshooting

### "Build failed"
- Check that all environment variables are set correctly
- Make sure Dockerfile exists in your repo

### "Dashboard loads but no data"
- Check Render logs for errors
- Verify AWN_API_KEY, AWN_APP_KEY, and AWN_MAC are correct
- Wait 5 minutes for initial data collection

### "Map loads but no temperatures"
- Normal on first deploy - wait 5 minutes
- Database is initializing

### Need help?
- Check Render logs: Dashboard → "Logs" tab
- Check full deployment guide: See DEPLOYMENT.md

---

## 🎯 What's Next?

### After Successful Deployment:

1. **Bookmark your URL** - you'll share this often!

2. **Monitor it** - Check Render dashboard occasionally:
   - View logs
   - Check uptime
   - Monitor resource usage

3. **Custom domain** (optional):
   - Buy a domain (e.g., weather.yourname.com)
   - Add it in Render settings
   - Update DNS records

4. **Upgrade if needed**:
   - Free tier perfect for most use
   - Upgrade if you need 24/7 uptime (no sleep)

---

## ✨ You're Done!

Your weather dashboard is now:
- ✅ **Live on the internet**
- ✅ **Shareable via URL**
- ✅ **Accessible from anywhere**
- ✅ **Free to run**

Go share it with the world! 🌍

---

## Alternative: Railway (Also Easy)

If you prefer Railway.app:

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your weather-dashboard repo
5. Add environment variables (same as above)
6. Click "Deploy"
7. Generate domain in settings
8. Done!

**Railway Pros:**
- No sleep (always on)
- 500 free hours/month
- Easier to use

**Railway Cons:**
- Requires credit card after free trial
- May charge $5/month after initial credits

---

Need help? Read the full DEPLOYMENT.md guide for more options and troubleshooting.
