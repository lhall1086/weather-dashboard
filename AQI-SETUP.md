# Air Quality Index (AQI) Setup

The dashboard displays real-time Air Quality Index data from the EPA's AirNow service. This feature is **optional** — if you don't configure it, the AQI tile simply won't appear.

## Getting Your Free API Key

1. **Request a key**: https://docs.airnowapi.org/account/request/
   - Fill out the form (name, email, organization can be "Personal")
   - Accept the terms
   - You'll receive your API key via email (usually within a few hours)

2. **Add it to your `.env` file**:
   ```bash
   AIRNOW_API_KEY=your_actual_key_here
   ```

3. **Restart the server**:
   ```bash
   npm start
   ```

4. **Verify it works**:
   - Visit your dashboard
   - You should see an "Air Quality" tile in the Astronomy & Air Quality section
   - Shows AQI value, color-coded level (Good/Moderate/Unhealthy), and primary pollutant

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
- **Primary Pollutant**: PM2.5, Ozone, PM10, etc.

## Without the Key

If you don't have an API key or don't want AQI data:
- The dashboard works perfectly without it
- The AQI tile simply won't appear
- No errors or warnings displayed to users

## Troubleshooting

**"Air Quality" tile doesn't appear:**
- Check that `AIRNOW_API_KEY` is set in your `.env` file
- Restart the server after adding the key
- Check the server console for `[aqi]` warnings
- Verify your key is active (may take a few hours after requesting)

**"AQI unavailable for this location":**
- AirNow only covers the United States
- Some rural areas may not have nearby monitoring stations
- The API searches within 25 miles of your station's location

## API Limits

AirNow's free tier:
- **500 requests/hour** per key
- The dashboard requests AQI once per hour, so you'll use ~24 requests/day
- Well within the free limit even with multiple users

## Privacy

Your AirNow API key:
- Is stored in `.env` (git-ignored, never committed)
- Only used server-side (never exposed to the browser)
- Only queries your station's lat/lon (no personal info sent)
