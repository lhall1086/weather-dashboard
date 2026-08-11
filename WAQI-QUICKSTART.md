# WAQI Quick Start — Get Your AQI Token in 2 Minutes

Your dashboard now uses **WAQI (World Air Quality Index)** for air quality data — better coverage, instant approval, completely free.

## ⚡ Get Your Token (2 minutes)

1. **Visit**: https://aqicn.org/data-platform/token/

2. **Fill the form**:
   - Name: Your name
   - Email: Your email
   - Usage description: "Personal weather dashboard"
   - Organization: "Personal" (or leave blank)

3. **Submit** — you'll see your token **instantly** on the confirmation page

4. **Copy your token** (it looks like: `a1b2c3d4e5f6g7h8i9j0...`)

5. **Add to `.env`**:
   ```bash
   WAQI_API_TOKEN=paste_your_token_here
   ```

6. **Restart**:
   ```bash
   npm start
   ```

7. **Check your dashboard** — the Air Quality tile should appear!

## 🚀 For Render Deployment

Add the token as an environment variable:

1. Go to https://dashboard.render.com
2. Select your service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Key: `WAQI_API_TOKEN`
6. Value: `your_token_here`
7. Save (triggers auto-redeploy)

## ✅ What You'll See

Once configured, the AQI tile shows:
- **AQI number** (0-500, lower is better)
- **Color-coded level** (Good/Moderate/Unhealthy/etc.)
- **Primary pollutant** (PM2.5, Ozone, etc.)
- **Monitoring station name** (the nearest station providing the data)

## ℹ️ Without the Token

If you don't configure it:
- The AQI tile simply won't appear
- Everything else works perfectly
- No errors shown to users

---

**That's it!** The whole process takes ~2 minutes. WAQI gives you the token instantly (no waiting for email approval like other services).

For troubleshooting and more details, see [AQI-SETUP.md](AQI-SETUP.md).
