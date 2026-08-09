// Derived meteorological indices computed from station observations.
// These are what meteorologists actually use for decision-making (not just raw temp/humidity).

// Heat Index (apparent temperature when hot/humid).
// NWS equation: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
// Valid when temp >= 80°F and RH >= 40%. Returns null if conditions don't warrant it.
export function heatIndex(tempF, humidity) {
  if (tempF == null || humidity == null || tempF < 80 || humidity < 40) return null;

  const T = tempF;
  const RH = humidity;

  // Rothfusz regression (NWS standard).
  let HI =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    6.83783e-3 * T ** 2 -
    5.481717e-2 * RH ** 2 +
    1.22874e-3 * T ** 2 * RH +
    8.5282e-4 * T * RH ** 2 -
    1.99e-6 * T ** 2 * RH ** 2;

  // Adjustments for low/high RH.
  if (RH < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (RH > 85 && T >= 80 && T <= 87) {
    HI += ((RH - 85) / 10) * ((87 - T) / 5);
  }

  return Math.round(HI);
}

// Wind Chill (apparent temperature when cold/windy).
// NWS equation: valid when temp <= 50°F and wind >= 3 mph.
export function windChill(tempF, windMph) {
  if (tempF == null || windMph == null || tempF > 50 || windMph < 3) return null;

  const WC = 35.74 + 0.6215 * tempF - 35.75 * windMph ** 0.16 + 0.4275 * tempF * windMph ** 0.16;
  return Math.round(WC);
}

// Dewpoint Depression (temp - dewpoint).
// Indicator for fog/stratus formation: < 5°F = fog likely, < 3°F = fog imminent.
// Also: a proxy for evaporation rate and human comfort.
export function dewpointDepression(tempF, dewpointF) {
  if (tempF == null || dewpointF == null) return null;
  return tempF - dewpointF;
}

// Wet Bulb Temperature (psychrometric, not globe temp).
// Approximation via Stull (2011) — accurate to ~1°C for typical conditions.
// True heat-stress metric: >88°F wet bulb is dangerous even for healthy people.
export function wetBulbTemp(tempF, humidity) {
  if (tempF == null || humidity == null) return null;

  // Convert to Celsius for Stull formula.
  const T = ((tempF - 32) * 5) / 9;
  const RH = humidity;

  const Tw =
    T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
    Math.atan(T + RH) -
    Math.atan(RH - 1.676331) +
    0.00391838 * RH ** (3 / 2) * Math.atan(0.023101 * RH) -
    4.686035;

  // Convert back to Fahrenheit.
  return Math.round((Tw * 9) / 5 + 32);
}

// Vapor Pressure Deficit (VPD, in kPa) — evapotranspiration proxy.
// High VPD = dry air, high evaporative demand. Agricultural/irrigation indicator.
export function vaporPressureDeficit(tempF, humidity) {
  if (tempF == null || humidity == null) return null;

  // Convert to Celsius.
  const T = ((tempF - 32) * 5) / 9;
  const RH = humidity;

  // Saturation vapor pressure (Tetens formula).
  const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3)); // kPa
  const ea = (es * RH) / 100; // actual vapor pressure
  const vpd = es - ea;

  return Math.round(vpd * 100) / 100; // round to 2 decimals
}

// Compute all applicable indices from a station reading.
// Returns an object with each index (null if not applicable).
export function computeIndices(reading) {
  const { tempf, humidity, dewPoint, windspeedmph } = reading;

  return {
    heatIndex: heatIndex(tempf, humidity),
    windChill: windChill(tempf, windspeedmph),
    dewpointDepression: dewpointDepression(tempf, dewPoint),
    wetBulbTemp: wetBulbTemp(tempf, humidity),
    vaporPressureDeficit: vaporPressureDeficit(tempf, humidity),
  };
}
