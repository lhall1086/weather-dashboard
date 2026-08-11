// Sun and moon times/phase calculations using suncalc.
// All times returned in epoch milliseconds (UTC), format for display in the frontend.
import 'dotenv/config';
import * as SunCalc from 'suncalc';

const { LAT, LON } = process.env;

// Get sunrise, sunset, and related solar times for a given date at the station location.
// Returns times in epoch ms (UTC) — frontend converts to local time for display.
export function getSunTimes(date = new Date()) {
  if (!LAT || !LON) throw new Error('Missing LAT/LON in .env for sun calculations');
  const lat = parseFloat(LAT);
  const lon = parseFloat(LON);
  const times = SunCalc.getTimes(date, lat, lon);

  return {
    sunrise: times.sunrise.getTime(),
    sunset: times.sunset.getTime(),
    solarNoon: times.solarNoon.getTime(),
    dawn: times.dawn.getTime(),            // civil dawn (sun 6° below horizon)
    dusk: times.dusk.getTime(),            // civil dusk
    nauticalDawn: times.nauticalDawn.getTime(),
    nauticalDusk: times.nauticalDusk.getTime(),
    goldenHourEnd: times.goldenHourEnd.getTime(),   // morning golden hour ends
    goldenHour: times.goldenHour.getTime(),         // evening golden hour starts
  };
}

// Get moonrise, moonset, moon phase, and illumination for a given date.
// Phase: 0 = new moon, 0.25 = first quarter, 0.5 = full moon, 0.75 = last quarter.
// Illumination: fraction (0-1) and angle (degrees) of the bright limb.
export function getMoonData(date = new Date()) {
  if (!LAT || !LON) throw new Error('Missing LAT/LON in .env for moon calculations');
  const lat = parseFloat(LAT);
  const lon = parseFloat(LON);

  const times = SunCalc.getMoonTimes(date, lat, lon);
  const illum = SunCalc.getMoonIllumination(date);

  // getMoonTimes can return undefined for rise/set if the moon doesn't rise/set on this day
  // (happens near the poles or when the moon is always above/below the horizon).
  return {
    moonrise: times.rise ? times.rise.getTime() : null,
    moonset: times.set ? times.set.getTime() : null,
    phase: illum.phase,                     // 0-1 (0/1 = new, 0.5 = full)
    illumination: illum.fraction,           // 0-1 (percent lit)
    angle: illum.angle,                     // radians, angle of illuminated limb
    phaseName: getMoonPhaseName(illum.phase),
    phaseEmoji: getMoonPhaseEmoji(illum.phase),
  };
}

// Convert numeric phase (0-1) to a human-readable name.
function getMoonPhaseName(phase) {
  if (phase < 0.03) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  if (phase < 0.97) return 'Waning Crescent';
  return 'New Moon';
}

// Emoji representation of the moon phase.
function getMoonPhaseEmoji(phase) {
  if (phase < 0.03) return '🌑'; // new moon
  if (phase < 0.22) return '🌒'; // waxing crescent
  if (phase < 0.28) return '🌓'; // first quarter
  if (phase < 0.47) return '🌔'; // waxing gibbous
  if (phase < 0.53) return '🌕'; // full moon
  if (phase < 0.72) return '🌖'; // waning gibbous
  if (phase < 0.78) return '🌗'; // last quarter
  if (phase < 0.97) return '🌘'; // waning crescent
  return '🌑'; // new moon
}

// Combined sun + moon data for a given date (defaults to today).
export function getAstronomyData(date = new Date()) {
  return {
    sun: getSunTimes(date),
    moon: getMoonData(date),
    date: date.toISOString().split('T')[0],
  };
}
