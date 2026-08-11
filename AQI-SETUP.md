# Air Quality Index (AQI) Setup

The dashboard displays real-time Air Quality Index data from the **WAQI (World Air Quality Index)** project at aqicn.org. This feature is **optional** — if you don't configure it, the AQI tile simply won't appear.

## Why WAQI?

- ✅ **Instant approval** — get your token immediately (no waiting)
- ✅ **Better coverage** — more stations than EPA (includes community sensors)
- ✅ **Global** — works worldwide, not just the US
- ✅ **Free forever** — no rate limits on the free tier
- ✅ **Accurate** — aggregates data from EPA, PurpleAir, and local agencies

## Getting Your Free API Token

1. **Request a token**: https://aqicn.org/data-platform/token/
   - Fill out the simple form (name, email, usage description: "Personal weather dashboard")
   - Click submit
   - **You'll get your token instantly on the confirmation page** — copy it immediately!
   - You'll also receive it via email as a backup

2. **Add it to your `.env` file**:
   ```bash
   WAQI_API_TOKEN=your_actual_token_here
   ```

3. **Restart the server**:
   ```bash
   npm start
   ```

4. **Verify it works**:
   - Visit your dashboard
   - You should see an "Air Quality" tile in the Astronomy & Air Quality section
   - Shows AQI value, color-coded level (Good/Moderate/Unhealthy), primary pollutant, and monitoring station name

## What You'll See

The AQI tile displays:
- **AQI Number**: 0-500 scale (lower is better)
- **Color-coded Level**:
  - 🟢 **0-50**: Good (green)
  - 🟡 **51-100**: Moderate (yellow)
  - 🟠 **101-150**: Unhealthy for Sensitive Groups (orange)
  - 🔴 **151-200**: Unhealthy (red)
  - 🟣 **201-300**: Very Unhealthy (purple)
  - 🟤 **301-500**: Hazardous (maroon)
- **Primary Pollutant**: PM2.5, PM10, O3 (Ozone), NO2, SO2, CO
- **Monitoring Station**: Name of the nearest station providing the data

## Without the Token

If you don't have an API token or don't want AQI data:
- The dashboard works perfectly without it
- The AQI tile simply won't appear
- No errors or warnings displayed to users

## Troubleshooting

**"Air Quality" tile doesn't appear:**
- Check that `WAQI_API_TOKEN` is set in your `.env` file
- Restart the server after adding the token
- Check the server console for `[aqi]` warnings
- Visit https://aqicn.org/ to verify there are stations near your location

**"AQI unavailable for this location":**
- WAQI has global coverage but not every location has a nearby station
- Very rural areas may not have monitoring within range
- The API finds the nearest station to your lat/lon coordinates
- You can check available stations at https://aqicn.org/map/

**Token not working:**
- Make sure you copied the entire token (they can be long)
- Check for extra spaces before/after the token in `.env`
- Verify the token at https://aqicn.org/data-platform/token/ (your account page)

## API Limits

WAQI's free tier:
- **No rate limits** for reasonable personal use
- The dashboard requests AQI once per hour (~24 requests/day)
- Commercial use requires a different license (but personal dashboards are fine)

## Data Sources

WAQI aggregates data from:
- EPA (US government monitoring)
- PurpleAir (community sensors)
- Local environmental agencies worldwide
- Official government monitoring stations

## Privacy

Your WAQI API token:
- Is stored in `.env` (git-ignored, never committed)
- Only used server-side (never exposed to the browser)
- Only queries your station's lat/lon (no personal info sent)
