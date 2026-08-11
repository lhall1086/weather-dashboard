# ✅ Deployment Checklist

Use this checklist to deploy your dashboard step-by-step.

---

## Pre-Deployment (Already Done! ✅)

- [x] Dashboard running locally
- [x] Git repository initialized
- [x] Code committed to git
- [x] Deployment files created (Dockerfile, etc.)
- [x] .gitignore protecting sensitive files
- [x] .env NOT committed (contains secrets)

---

## GitHub Setup

- [ ] Create GitHub account (if needed): https://github.com/join
- [ ] Create new repository: https://github.com/new
  - Repository name: `weather-dashboard`
  - Visibility: **Public**
  - Do NOT initialize with README
- [ ] Copy the remote URL (e.g., `https://github.com/YOUR_USERNAME/weather-dashboard.git`)
- [ ] Run these commands:
  ```bash
  cd C:/Users/212434506/weather-dashboard
  git remote add origin [YOUR_GITHUB_URL]
  git branch -M main
  git push -u origin main
  ```
- [ ] Verify code is on GitHub (visit your repo URL)

---

## Deployment Platform Setup

### Option A: Render.com (Recommended - 100% Free)

- [ ] Create Render account: https://render.com/signup
- [ ] Sign in with GitHub
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub repository: `weather-dashboard`
- [ ] Configure service:
  - Name: `local-weather-labs`
  - Environment: **Docker**
  - Region: US West (Oregon)
  - Branch: `main`
  - Plan: **Free**

- [ ] Add environment variables:
  - [ ] `AWN_API_KEY` = `0a82032f5c824617bb8be9e9d5f847983b66c47bc8aa4f8b9b78587bffe5482d`
  - [ ] `AWN_APP_KEY` = `b170f85752cb42158ff06e060e5f3f108853364935964cc39f0beaddf1e9408a`
  - [ ] `AWN_MAC` = `F8:B3:B7:86:33:22`
  - [ ] `LAT` = `32.5776`
  - [ ] `LON` = `-85.7583`
  - [ ] `PORT` = `3000`
  - [ ] `COLLECT_CRON` = `*/5 * * * *`

- [ ] Click "Create Web Service"
- [ ] Wait for deployment (5-10 minutes)
- [ ] Check logs for success message
- [ ] Copy your live URL (e.g., `https://your-app.onrender.com`)

### Option B: Railway.app (Alternative - Very Easy)

- [ ] Create Railway account: https://railway.app/signup
- [ ] Sign in with GitHub
- [ ] Click "New Project" → "Deploy from GitHub repo"
- [ ] Select `weather-dashboard` repository
- [ ] Add environment variables (same as Render list above)
- [ ] Click "Deploy"
- [ ] Go to Settings → Generate Domain
- [ ] Copy your live URL (e.g., `https://your-app.up.railway.app`)

---

## Testing Your Live Site

- [ ] Visit your live URL
- [ ] Check each feature works:
  - [ ] Dashboard loads (no errors)
  - [ ] Current conditions show data
  - [ ] Temperature displays
  - [ ] Map loads
  - [ ] Temperature overlay works
  - [ ] Active Alerts layer works (if any alerts active)
  - [ ] Satellite layer toggles on/off
  - [ ] Precipitation layer toggles on/off
  - [ ] SPC outlook cards clickable
  - [ ] 7-day forecast loads
  - [ ] Hourly forecast loads
  - [ ] Historical analytics section present

- [ ] Test on mobile device
- [ ] Test from different network (not just your home)

---

## Sharing Preparation

- [ ] Bookmark your live URL
- [ ] Take screenshots for social media:
  - [ ] Full dashboard view
  - [ ] Interactive map with alerts (if active)
  - [ ] Close-up of current conditions
  - [ ] SPC outlook section

- [ ] Prepare social media posts (see examples in QUICKSTART.md)

---

## Social Media Sharing

- [ ] **Facebook:**
  - [ ] Create post with dashboard URL
  - [ ] Add screenshot
  - [ ] Use hashtags: #Weather #Alabama #TallapoosaCounty
  - [ ] Post in relevant groups (weather enthusiasts, Alabama local)

- [ ] **Twitter/X:**
  - [ ] Tweet with dashboard URL
  - [ ] Add screenshot
  - [ ] Use hashtags: #WxTwitter #ALwx #WeatherStation
  - [ ] Tag relevant accounts: @NWSBirmingham

- [ ] **LinkedIn:**
  - [ ] Create professional post
  - [ ] Explain tech stack
  - [ ] Add dashboard URL
  - [ ] Use hashtags: #WebDevelopment #DataVisualization

- [ ] **Instagram:**
  - [ ] Post screenshot
  - [ ] Add URL to bio
  - [ ] Story with link sticker

- [ ] **Reddit:**
  - [ ] Post in r/weather, r/WeatherGifs, r/Alabama
  - [ ] Follow subreddit rules (some require permission for self-promotion)

---

## Optional Enhancements

- [ ] **Custom Domain:**
  - [ ] Buy domain (Namecheap, Google Domains)
  - [ ] Add to Render/Railway settings
  - [ ] Update DNS records
  - [ ] Wait for propagation (24-48 hours)

- [ ] **Uptime Monitoring:**
  - [ ] Sign up for UptimeRobot.com (free)
  - [ ] Add your dashboard URL
  - [ ] Set check interval to 5 minutes
  - [ ] Get email alerts if site goes down

- [ ] **Analytics:**
  - [ ] Sign up for Google Analytics
  - [ ] Add tracking code to index.html
  - [ ] Monitor visitor stats

---

## Maintenance

- [ ] **Weekly:**
  - [ ] Check if site is still up
  - [ ] Review any error logs
  - [ ] Verify data is updating

- [ ] **Monthly:**
  - [ ] Check free tier usage
  - [ ] Review platform bills (if applicable)
  - [ ] Update dependencies if needed

- [ ] **When Making Changes:**
  - [ ] Test locally first
  - [ ] Commit to git
  - [ ] Push to GitHub
  - [ ] Verify deployment auto-updates
  - [ ] Test live site after update

---

## Troubleshooting Reference

### Site Won't Load
1. Check Render/Railway dashboard for errors
2. View logs for error messages
3. Verify all environment variables set
4. Try redeploying

### No Weather Data
1. Check AWN credentials are correct
2. Verify MAC address is correct
3. Check logs for API errors
4. Wait 5 minutes for initial collection

### Map Not Working
1. Check browser console for errors
2. Verify map loads without errors
3. Check if NWS API is accessible

### Slow Load Times (Render Free Tier)
1. Normal - free tier sleeps after 15 min inactivity
2. First visit after sleep = ~30 sec load
3. Consider upgrade or uptime monitor

---

## Support Resources

- **Render Docs:** https://render.com/docs
- **Railway Docs:** https://docs.railway.app
- **GitHub Help:** https://docs.github.com
- **Your Deployment Guide:** See DEPLOYMENT.md
- **Quick Start:** See QUICKSTART.md

---

## Success! 🎉

When you've checked everything above, your dashboard is:
- ✅ Live and shareable
- ✅ Accessible worldwide
- ✅ Running 24/7 (or on-demand for Render free tier)
- ✅ Ready to show off!

**Your Live URL:** _________________________

**Shared On:**
- [ ] Facebook
- [ ] Twitter/X
- [ ] LinkedIn
- [ ] Instagram
- [ ] Reddit
- [ ] Other: _____________

**Date Deployed:** _____________

**Visitors So Far:** _____________

---

Congratulations! Your Local Weather Labs dashboard is now live! 🌦️🎉
