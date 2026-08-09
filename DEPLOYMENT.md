# Deploying Local Weather Labs to the Public

This guide will help you deploy your weather dashboard so you can share it on social media.

## Quick Start - Recommended Platforms

We'll use **Railway.app** (easiest, free tier) or **Render.com** (also free, no credit card required).

---

## Option 1: Railway.app (Recommended - Fastest)

**Free Tier:** 500 hours/month, 512MB RAM, shared CPU

### Steps:

1. **Create a Railway account**
   - Go to https://railway.app
   - Sign up with GitHub (recommended for easy deployment)

2. **Install Railway CLI** (optional, or use web dashboard)
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Deploy from this directory**
   ```bash
   cd weather-dashboard
   railway init
   railway up
   ```

4. **Set environment variables in Railway dashboard**
   - Go to your project at https://railway.app/dashboard
   - Click on your service
   - Go to "Variables" tab
   - Add these variables:
     - `AWN_API_KEY`: Your Ambient Weather API key
     - `AWN_APP_KEY`: Your Ambient Weather Application key
     - `AWN_MAC`: Your weather station MAC address
     - `LAT`: 32.5776
     - `LON`: -85.7583
     - `PORT`: 3000
     - `COLLECT_CRON`: */5 * * * *

5. **Generate a public URL**
   - In your service settings, click "Generate Domain"
   - You'll get a URL like: `your-app.up.railway.app`
   - **This is your shareable link!**

6. **Share it!**
   - Your dashboard is now live at your Railway URL
   - Share the link on Facebook, Twitter, etc.

---

## Option 2: Render.com (No Credit Card Required)

**Free Tier:** 750 hours/month, sleeps after 15 min of inactivity

### Steps:

1. **Create a Render account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Push code to GitHub** (if not already)
   ```bash
   cd weather-dashboard
   git init
   git add .
   git commit -m "Initial commit for deployment"
   # Create a new repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git
   git push -u origin main
   ```

3. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your weather-dashboard repo

4. **Configure the service**
   - Name: `local-weather-labs`
   - Environment: `Docker`
   - Region: Choose closest to you
   - Branch: `main`
   - Dockerfile Path: `./Dockerfile`

5. **Add environment variables**
   Click "Advanced" and add:
   - `AWN_API_KEY`: [your key]
   - `AWN_APP_KEY`: [your app key]
   - `AWN_MAC`: [your MAC address]
   - `LAT`: 32.5776
   - `LON`: -85.7583
   - `PORT`: 3000
   - `COLLECT_CRON`: */5 * * * *

6. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for first build
   - You'll get a URL like: `your-app.onrender.com`

7. **Share it!**
   - Your dashboard is live!
   - **Note:** Free tier sleeps after 15 min of inactivity
   - First visit after sleep takes ~30 seconds to wake up

---

## Option 3: Fly.io (More Advanced)

**Free Tier:** 3 shared-cpu VMs, 3GB storage

### Steps:

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Mac/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Sign up and login**
   ```bash
   fly auth signup
   # or
   fly auth login
   ```

3. **Launch your app**
   ```bash
   cd weather-dashboard
   fly launch --no-deploy
   ```
   - Choose app name: `local-weather-labs` (or your choice)
   - Choose region: closest to you
   - Don't deploy yet - we need to set secrets first

4. **Set secrets (environment variables)**
   ```bash
   fly secrets set AWN_API_KEY="your_api_key_here"
   fly secrets set AWN_APP_KEY="your_app_key_here"
   fly secrets set AWN_MAC="your_mac_address_here"
   fly secrets set LAT="32.5776"
   fly secrets set LON="-85.7583"
   fly secrets set COLLECT_CRON="*/5 * * * *"
   ```

5. **Create persistent volume for database**
   ```bash
   fly volumes create weather_data --size 1
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

7. **Get your URL**
   ```bash
   fly status
   ```
   - Your app will be at: `https://your-app-name.fly.dev`

8. **Share it!**
   - Dashboard is live 24/7
   - Fastest option (no sleep)

---

## After Deployment - Test Your Live Site

1. **Visit your URL** (from Railway, Render, or Fly.io)
2. **Check that everything works:**
   - Current weather data loads
   - Map displays with temperatures
   - Active alerts show (if any in your area)
   - Forecast sections populate
   - Historical data starts accumulating

3. **Monitor for issues:**
   - Check platform logs if something doesn't work
   - Most common issue: forgot to set environment variables

---

## Sharing Your Dashboard

### Get Your Public URL:
- **Railway:** `https://your-app.up.railway.app`
- **Render:** `https://your-app.onrender.com`
- **Fly.io:** `https://your-app-name.fly.dev`

### Share on Social Media:

**Facebook Post Example:**
```
🌦️ Check out my Live Weather Dashboard for Tallapoosa County, Alabama!

Real-time data from my personal weather station:
• Current conditions & forecasts
• Interactive US weather map
• Live severe weather alerts
• Historical trends & analytics

View it here: [your-url]

#Weather #Alabama #TallapoosaCounty #WeatherStation
```

**Twitter/X Post Example:**
```
🌦️ Live weather dashboard for Tallapoosa County, AL

✅ Real-time station data
✅ Interactive US map with alerts
✅ 7-day forecasts
✅ SPC severe outlook

Check it out: [your-url]

#WxTwitter #ALwx
```

**LinkedIn Post Example:**
```
I built a comprehensive weather monitoring dashboard using:
- Ambient Weather Network API
- National Weather Service data
- Node.js + Express backend
- SQLite for historical analytics
- Leaflet.js for interactive mapping

Features real-time data from my personal weather station in Tallapoosa County, Alabama, with nationwide severe weather alerts and forecasts.

View live: [your-url]

#WebDevelopment #DataVisualization #Weather
```

---

## Custom Domain (Optional)

Want a custom domain like `weather.yourdomain.com`?

### For Railway:
1. Buy a domain (Namecheap, Google Domains, etc.)
2. In Railway dashboard → Settings → Custom Domain
3. Add your domain
4. Update DNS CNAME record to point to Railway

### For Render:
1. Buy a domain
2. In Render dashboard → Settings → Custom Domain
3. Add your domain
4. Update DNS CNAME record to point to Render

### For Fly.io:
1. Buy a domain
2. Run: `fly certs add your-domain.com`
3. Update DNS A/AAAA records as instructed

---

## Cost Breakdown

### All Free Tiers:
- **Railway:** Free 500 hrs/month ($0/mo initially, then $5/mo if you exceed)
- **Render:** Free 750 hrs/month (always free, but sleeps)
- **Fly.io:** Free 3 VMs up to $5/mo worth of resources

### Recommendation:
- **Start with Render** (100% free, no card needed)
- **Upgrade to Railway or Fly.io** if you want 24/7 uptime with no sleep

---

## Monitoring Your Deployment

### Check if it's running:
```bash
# Railway
railway logs

# Render
# Check logs in dashboard at dashboard.render.com

# Fly.io
fly logs
```

### Common Issues:

**Issue:** Dashboard loads but no current weather data
**Fix:** Check that AWN_API_KEY, AWN_APP_KEY, and AWN_MAC are set correctly

**Issue:** Map loads but no temperatures
**Fix:** Database might be initializing, wait 5 minutes

**Issue:** "Cannot connect" or "App crashed"
**Fix:** Check logs, ensure PORT=3000 is set, ensure all env vars are present

---

## Database Persistence

- **Railway:** Database persists automatically
- **Render:** Database is ephemeral on free tier - will reset on redeploy
- **Fly.io:** Database persists in volume (best option)

If you need permanent historical data, consider:
- Upgrading to a paid plan with persistent storage
- Using Fly.io with volumes (free and persistent)

---

## Updating Your Live Dashboard

When you make changes locally:

### Railway:
```bash
git add .
git commit -m "Update dashboard"
git push
# Railway auto-deploys on push
```

### Render:
```bash
git add .
git commit -m "Update dashboard"
git push origin main
# Render auto-deploys on push
```

### Fly.io:
```bash
fly deploy
```

---

## Security Notes

✅ **Already secure:**
- API keys are in environment variables (not in code)
- Never committed to git (in .gitignore)
- Only you can see them in the platform dashboard

✅ **Your keys are safe:**
- Server talks to AWN/NWS APIs
- Browser only talks to your server
- Keys never exposed to public

⚠️ **Don't commit .env to git!**
- Already in .gitignore, but double-check before pushing

---

## Support

If you have issues deploying:

1. Check platform documentation:
   - Railway: https://docs.railway.app
   - Render: https://render.com/docs
   - Fly.io: https://fly.io/docs

2. Check logs for error messages

3. Verify all environment variables are set correctly

4. Ensure your AWN credentials are valid

---

## Next Steps

1. ✅ Choose a platform (Render is easiest to start)
2. ✅ Deploy following the steps above
3. ✅ Test your live URL
4. ✅ Share on social media!
5. ✅ Monitor usage and upgrade if needed

Your dashboard is ready to share with the world! 🌍🌦️
