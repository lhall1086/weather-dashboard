// Dashboard client. Talks only to our own /api/* endpoints (never AWN directly).

const REFRESH_MS = 60 * 1000; // re-pull current conditions every minute
const STALE_MS = 90 * 1000;   // if no live push arrives in 90s, poll as a backstop
let lastCurrentAt = 0;         // timestamp of the most recent applied reading
let charts = {}; // keyed by canvas id
let currentRange = '24h';

// ---- helpers ----
const $ = (sel) => document.querySelector(sel);
const fmt = (v, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(digits));

// Convert a wind bearing in degrees to a compass label (N, NNE, ...).
function dirLabel(deg) {
  if (deg === null || deg === undefined) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// The tiles we render, in order. Each maps an AWN field to a label/unit/formatter.
const TILE_DEFS = [
  { key: 'tempf',        label: 'Temperature', unit: '°F', digits: 1, hero: true },
  { key: 'feelsLike',    label: 'Feels Like',  unit: '°F', digits: 1 },
  { key: 'humidity',     label: 'Humidity',    unit: '%',  digits: 0 },
  { key: 'dewPoint',     label: 'Dew Point',   unit: '°F', digits: 1 },
  { key: 'baromrelin',   label: 'Pressure',    unit: 'inHg', digits: 2 },
  { key: 'dailyrainin',  label: 'Rain Today',  unit: 'in', digits: 2 },
  { key: 'uv',           label: 'UV Index',    unit: '',   digits: 0 },
  { key: 'solarradiation',label: 'Solar',      unit: 'W/m²', digits: 0 },
];

// ---- current conditions ----
// Apply one reading to the UI (shared by the SSE stream and the polling fallback).
function applyCurrent(source, data, error) {
  if (!data) return;
  lastCurrentAt = Date.now(); // mark that fresh data just landed
  renderTiles(data);
  renderWind(data);
  $('#updated').textContent = data.dateutc
    ? `Updated ${new Date(data.dateutc).toLocaleTimeString()}`
    : 'Updated —';
  const badge = $('#source-badge');
  badge.textContent = source;
  badge.className = `badge ${source}`;
  $('#foot-note').textContent = error ? `(live fetch failed: ${error})` : '';
}

// One-shot REST pull — used as a fallback if the live stream isn't available.
async function loadCurrent() {
  try {
    const res = await fetch('/api/current');
    const { source, data, error } = await res.json();
    if (!data) throw new Error(error || 'no data');
    applyCurrent(source, data, error);
  } catch (err) {
    $('#foot-note').textContent = `Error loading current conditions: ${err.message}`;
  }
}

// Live push stream (Server-Sent Events). Updates arrive the instant the station uploads.
let pollFallback = null;
function startStream() {
  if (!('EventSource' in window)) return loadCurrent(); // ancient browser: just poll once

  const es = new EventSource('/api/stream');

  es.onmessage = (ev) => {
    clearFallback(); // stream is alive; no need to poll
    try {
      const { source, data, error } = JSON.parse(ev.data);
      applyCurrent(source, data, error);
    } catch { /* ignore malformed frame */ }
  };

  // If the stream errors/drops, poll every 60s until it recovers (EventSource auto-reconnects).
  es.onerror = () => {
    if (!pollFallback) {
      loadCurrent();
      pollFallback = setInterval(loadCurrent, REFRESH_MS);
    }
  };
}

function clearFallback() {
  if (pollFallback) {
    clearInterval(pollFallback);
    pollFallback = null;
  }
}

// Staleness watchdog: the SSE connection can stay open while the upstream feed
// silently stalls (no error fires), leaving the page frozen. If no reading has
// arrived within STALE_MS, pull once over REST so the tiles stay current.
function startStaleWatchdog() {
  setInterval(() => {
    if (document.hidden) return; // don't poll a backgrounded tab
    if (Date.now() - lastCurrentAt > STALE_MS) loadCurrent();
  }, 30 * 1000);
}

// When the user returns to the tab, refresh immediately if data looks stale
// (browsers throttle timers in background tabs, so the watchdog may be behind).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastCurrentAt > STALE_MS) loadCurrent();
});

function renderTiles(d) {
  const tiles = $('#tiles');
  tiles.innerHTML = TILE_DEFS.map((t) => {
    const val = fmt(d[t.key], t.digits);
    return `
      <div class="tile ${t.hero ? 'hero' : ''}">
        <div class="label">${t.label}</div>
        <div class="value">${val}<small> ${t.unit}</small></div>
      </div>`;
  }).join('');
}

function renderWind(d) {
  $('#wind-speed').textContent = fmt(d.windspeedmph, 1);
  $('#wind-gust').textContent = fmt(d.windgustmph, 1) + ' mph';
  $('#wind-dir-label').textContent = `${dirLabel(d.winddir)} (${fmt(d.winddir)}°)`;
  // Point the needle toward the direction the wind is coming FROM.
  $('#needle').style.transform = `translate(-50%, -100%) rotate(${d.winddir ?? 0}deg)`;
}

// ---- today/tomorrow briefing ----
async function loadBriefing() {
  try {
    const res = await fetch('/api/briefing');
    const { today, tomorrow } = await res.json();

    if (today) {
      const precipStr = today.precipDay != null ? `💧 ${today.precipDay}% chance` : '';
      const severeFlag = today.hasSevereKeywords ? '<div class="severe-badge">⚠ Severe weather possible</div>' : '';
      $('#today-card .briefing-content').innerHTML = `
        <div class="high-low">
          <span class="high">${today.high}°</span>
          <span class="low">${today.low}°</span>
        </div>
        <div class="conditions">${today.dayConditions}</div>
        <div class="precip">${precipStr}</div>
        <div class="forecast-text">${today.detailedForecast || ''}</div>
        ${severeFlag}
      `;
    }

    if (tomorrow) {
      const precipStr = tomorrow.precipDay != null ? `💧 ${tomorrow.precipDay}% chance` : '';
      const severeFlag = tomorrow.hasSevereKeywords ? '<div class="severe-badge">⚠ Severe weather possible</div>' : '';
      $('#tomorrow-card .briefing-content').innerHTML = `
        <div class="high-low">
          <span class="high">${tomorrow.high}°</span>
          <span class="low">${tomorrow.low}°</span>
        </div>
        <div class="conditions">${tomorrow.dayConditions}</div>
        <div class="precip">${precipStr}</div>
        <div class="forecast-text">${tomorrow.detailedForecast || ''}</div>
        ${severeFlag}
      `;
    }
  } catch (err) {
    console.warn('[briefing]', err.message);
  }
}

// ---- SPC severe outlook ----
async function loadSPCOutlook() {
  try {
    const res = await fetch('/api/spc/outlook');
    const { day1, day2, day3 } = await res.json();

    const renderDay = (day, label, dayNum) => {
      const url = `https://www.spc.noaa.gov/products/outlook/day${dayNum}otlk.html`;
      const risk = day ? day.label : 'No risk';
      const code = day ? day.code : 'none';
      const title = `Open the official SPC Day ${dayNum} Convective Outlook`;
      return `<a href="${url}" target="_blank" rel="noopener" class="spc-day ${code}" title="${title}">
        <div class="day-label">${label}</div>
        <div class="risk-label">${risk}</div>
        <div class="spc-link-hint">View full outlook ↗</div>
      </a>`;
    };

    $('#spc-timeline').innerHTML = renderDay(day1, 'Day 1', 1) + renderDay(day2, 'Day 2', 2) + renderDay(day3, 'Day 3', 3);
  } catch (err) {
    $('#spc-timeline').innerHTML = '<div class="spc-day none"><div class="risk-label">Outlook unavailable</div></div>';
    console.warn('[spc]', err.message);
  }
}

// ---- 7-day forecast ----
async function load7Day() {
  try {
    const res = await fetch('/api/forecast/7day');
    const { days } = await res.json();
    $('#forecast-7day').innerHTML = days
      .map((d) => {
        const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const precipDay = d.precipDay != null ? `💧 ${d.precipDay}%` : '';
        const severeFlag = d.hasSevereKeywords ? '<div class="severe-badge-small">⚠ Severe</div>' : '';
        const severeClass = d.hasSevereKeywords ? 'has-severe' : '';
        return `
        <div class="day-card ${severeClass}">
          <div class="day-name">${d.name}</div>
          <div class="day-date">${date}</div>
          <img class="day-icon" src="${d.dayIcon}" alt="" loading="lazy" />
          <div class="day-temps">
            <span class="day-high">${d.high}°</span>
            <span class="day-low">${d.low}°</span>
          </div>
          <div class="day-conditions">${d.dayConditions}</div>
          <div class="day-precip">${precipDay}</div>
          ${severeFlag}
        </div>`;
      })
      .join('');
  } catch (err) {
    $('#forecast-7day').innerHTML = '<div class="day-card">7-day unavailable</div>';
    console.warn('[7day]', err.message);
  }
}

// ---- alerts ----
async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const { alerts, location } = await res.json();
    const banner = $('#alerts-banner');
    if (!alerts || alerts.length === 0) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.innerHTML = alerts
      .map((a) => {
        const instruction = a.instruction ? `<div class="instruction">${a.instruction}</div>` : '';
        return `
        <div class="alert-item ${a.severity}">
          <div class="event">${a.event}</div>
          <div class="headline">${a.headline}</div>
          ${instruction}
        </div>`;
      })
      .join('');
  } catch (err) {
    console.warn('[alerts]', err.message);
  }
}

// ---- hourly forecast ----
async function loadHourly() {
  try {
    const res = await fetch('/api/forecast/hourly?limit=24');
    const { periods } = await res.json();
    $('#forecast-hourly').innerHTML = periods
      .map((p) => {
        const t = new Date(p.startTime);
        const label = t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        return `
      <div class="fc-period">
        <div class="fc-name">${label}</div>
        <img src="${p.icon}" alt="" loading="lazy" />
        <div class="fc-temp">${p.temp}°${p.tempUnit}</div>
        <div class="fc-short">${p.shortForecast}</div>
        ${p.precip != null ? `<div class="fc-precip">💧 ${p.precip}%</div>` : ''}
      </div>`;
      })
      .join('');
  } catch (err) {
    $('#forecast-hourly').innerHTML = `<div class="fc-period">Hourly unavailable<br><small>${err.message}</small></div>`;
  }
}

// ---- derived meteorological indices ----
async function loadIndices() {
  try {
    const res = await fetch('/api/indices');
    const idx = await res.json();

    const tiles = [];

    if (idx.heatIndex != null) {
      tiles.push(`
        <div class="index-tile heat">
          <div class="index-label">Heat Index</div>
          <div class="index-value">${idx.heatIndex}°F</div>
          <div class="index-note">Apparent temp (hot/humid)</div>
        </div>
      `);
    }

    if (idx.windChill != null) {
      tiles.push(`
        <div class="index-tile cold">
          <div class="index-label">Wind Chill</div>
          <div class="index-value">${idx.windChill}°F</div>
          <div class="index-note">Apparent temp (cold/windy)</div>
        </div>
      `);
    }

    if (idx.dewpointDepression != null) {
      const note =
        idx.dewpointDepression < 3
          ? 'Fog imminent'
          : idx.dewpointDepression < 5
          ? 'Fog likely'
          : 'Dry air';
      tiles.push(`
        <div class="index-tile moisture">
          <div class="index-label">Dewpoint Depression</div>
          <div class="index-value">${fmt(idx.dewpointDepression, 1)}°F</div>
          <div class="index-note">${note}</div>
        </div>
      `);
    }

    if (idx.wetBulbTemp != null) {
      const note = idx.wetBulbTemp >= 88 ? 'Dangerous heat stress' : 'Heat stress metric';
      tiles.push(`
        <div class="index-tile heat">
          <div class="index-label">Wet Bulb Temp</div>
          <div class="index-value">${idx.wetBulbTemp}°F</div>
          <div class="index-note">${note}</div>
        </div>
      `);
    }

    if (idx.vaporPressureDeficit != null) {
      tiles.push(`
        <div class="index-tile moisture">
          <div class="index-label">VPD</div>
          <div class="index-value">${idx.vaporPressureDeficit} kPa</div>
          <div class="index-note">Evapotranspiration demand</div>
        </div>
      `);
    }

    $('#indices').innerHTML = tiles.length ? tiles.join('') : '<div class="index-note">No applicable indices</div>';
  } catch (err) {
    $('#indices').innerHTML = `<div class="index-note">Error: ${err.message}</div>`;
  }
}

// ---- precipitation analysis ----
async function loadPrecip() {
  try {
    const res = await fetch('/api/precip');
    const { stormTotal, recent } = await res.json();

    let html = '';

    if (stormTotal) {
      const startTime = new Date(stormTotal.startTime).toLocaleString();
      html += `
        <div class="storm-total-highlight">
          <div class="precip-line">
            <span class="label">Storm Total</span>
            <span class="value">${stormTotal.total} in</span>
          </div>
          <div class="precip-line">
            <span class="label">Started</span>
            <span class="value" style="font-size:0.75rem;">${startTime}</span>
          </div>
          <div class="precip-line">
            <span class="label">Duration</span>
            <span class="value">${stormTotal.durationHours} h</span>
          </div>
        </div>
      `;
    }

    html += `
      <div class="precip-line">
        <span class="label">Last hour</span>
        <span class="value">${recent.last1h} in</span>
      </div>
      <div class="precip-line">
        <span class="label">Last 6 hours</span>
        <span class="value">${recent.last6h} in</span>
      </div>
      <div class="precip-line">
        <span class="label">Last 24 hours</span>
        <span class="value">${recent.last24h} in</span>
      </div>
    `;

    $('#precip-content').innerHTML = html || '<div class="precip-line">No rain detected</div>';
  } catch (err) {
    $('#precip-content').innerHTML = `<div class="precip-line">Error: ${err.message}</div>`;
  }
}

// ---- pressure tendency (3h) ----
async function loadTendency() {
  try {
    const res = await fetch('/api/pressure-tendency');
    const t = await res.json();
    if (!t.available) {
      $('#tendency-content').innerHTML = '<div class="tendency-detail">Insufficient history (need 3h)</div>';
      return;
    }
    const arrow = t.trend === 'falling' ? '↓' : t.trend === 'rising' ? '↑' : '→';
    const word = t.trend === 'falling' ? 'Falling' : t.trend === 'rising' ? 'Rising' : 'Steady';
    const deltaStr = (t.delta >= 0 ? '+' : '') + fmt(t.delta, 2);
    $('#tendency-content').innerHTML = `
      <div class="tendency-readout ${t.trend}">
        <span class="arrow">${arrow}</span> ${word}
      </div>
      <div class="tendency-detail">${deltaStr} inHg over 3h</div>
      <div class="tendency-detail">Now: ${fmt(t.current, 2)} inHg</div>
    `;
  } catch (err) {
    $('#tendency-content').innerHTML = `<div class="tendency-detail">Error: ${err.message}</div>`;
  }
}

// ---- charts ----
const CHART_DEFS = [
  { id: 'tempChart', title: 'Temperature (°F)', series: [
      { key: 'tempf', label: 'Temp', color: '#f4a259' },
      { key: 'dewPoint', label: 'Dew Point', color: '#6fd3c7' },
  ]},
  { id: 'rainChart', title: 'Rain — daily accumulation (in)', series: [
      { key: 'dailyrainin', label: 'Rain Today', color: '#5b8def', fill: true },
  ]},
  { id: 'pressureChart', title: 'Pressure (inHg)', series: [
      { key: 'baromrelin', label: 'Pressure', color: '#4ea8de' },
  ]},
];

async function loadHistory(range) {
  const res = await fetch(`/api/history?range=${range}`);
  const { rows } = await res.json();

  for (const def of CHART_DEFS) {
    const datasets = def.series.map((s) => ({
      label: s.label,
      data: rows.map((r) => ({ x: r.dateutc, y: r[s.key] })),
      borderColor: s.color,
      backgroundColor: s.fill ? s.color + '33' : s.color,
      fill: !!s.fill,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
    }));

    if (charts[def.id]) {
      charts[def.id].data.datasets = datasets;
      charts[def.id].update();
    } else {
      charts[def.id] = new Chart(document.getElementById(def.id), {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            title: { display: true, text: def.title, color: '#9aa7bd' },
            legend: { labels: { color: '#9aa7bd' } },
          },
          scales: {
            x: { type: 'time', time: { tooltipFormat: 'DD T' }, ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
            y: { ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
          },
        },
      });
    }
  }
}

// Range buttons
$('#range-buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  currentRange = btn.dataset.range;
  document.querySelectorAll('#range-buttons button').forEach((b) => b.classList.toggle('active', b === btn));
  loadHistory(currentRange);
});

// ---- radar (replaced with Weather.gov iframe embed) ----
// Interactive Leaflet map has been replaced with Weather.gov radar embed.
// The map functionality has been removed - radar is now displayed via iframe.

// ---- year-over-year analytics ----
async function loadMonthlyCharts() {
  try {
    const res = await fetch('/api/analytics/monthly');
    const resp = await res.json();
    const { type } = resp;

    let labels, tempDatasets, rainDatasets;

    if (type === 'trailing') {
      // Continuous trailing 12-month trend — a single series per chart.
      const series = resp.series || [];
      labels = series.map((d) => d.label);
      tempDatasets = [
        {
          label: 'Avg Temp',
          data: series.map((d) => d.avgTemp),
          borderColor: '#4ea8de',
          backgroundColor: 'rgba(78, 168, 222, 0.1)',
          fill: true,
          tension: 0.3,
          spanGaps: true,
        },
      ];
      rainDatasets = [
        {
          label: 'Total Rain',
          data: series.map((d) => d.totalRain),
          backgroundColor: '#5b8def',
        },
      ];
    } else {
      // Dual-series modes: year-over-year (monthly) or month-over-month (weekly).
      const { current, previous, currentLabel, previousLabel } = resp;
      const curLabel = currentLabel || (type === 'year' ? 'This Year' : 'Recent 30 Days');
      const prevLabel = previousLabel || (type === 'year' ? 'Last Year' : 'Prior 30 Days');

      if (type === 'year') {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        labels = current.map((d) => monthNames[d.month]);
      } else {
        labels = current.map((d, i) => `Week ${i + 1}`);
      }

      tempDatasets = [
        {
          label: curLabel,
          data: current.map((d) => d.avgTemp),
          borderColor: '#4ea8de',
          backgroundColor: 'rgba(78, 168, 222, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: prevLabel,
          data: previous.map((d) => d.avgTemp),
          borderColor: '#9aa7bd',
          backgroundColor: 'rgba(154, 167, 189, 0.1)',
          fill: true,
          tension: 0.3,
          borderDash: [5, 5],
        },
      ];
      rainDatasets = [
        {
          label: curLabel,
          data: current.map((d) => d.totalRain),
          backgroundColor: '#5b8def',
        },
        {
          label: prevLabel,
          data: previous.map((d) => d.totalRain),
          backgroundColor: '#9aa7bd',
        },
      ];
    }

    // Chart titles reflect the active mode.
    const tempTitle = type === 'trailing' ? 'Avg Temperature — Trailing 12 Months (°F)' : 'Avg Temperature (°F)';
    const rainTitle = type === 'trailing' ? 'Rainfall — Trailing 12 Months (in)' : 'Rainfall (inches)';

    if (charts.yoyTempChart) {
      charts.yoyTempChart.data.labels = labels;
      charts.yoyTempChart.data.datasets = tempDatasets;
      charts.yoyTempChart.options.plugins.title.text = tempTitle;
      charts.yoyTempChart.update();
    } else {
      charts.yoyTempChart = new Chart(document.getElementById('yoyTempChart'), {
        type: 'line',
        data: { labels, datasets: tempDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: tempTitle, color: '#9aa7bd' },
            legend: { labels: { color: '#9aa7bd' } },
          },
          scales: {
            y: { ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
            x: { ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
          },
        },
      });
    }

    // Rain chart — same reuse pattern.
    if (charts.yoyRainChart) {
      charts.yoyRainChart.data.labels = labels;
      charts.yoyRainChart.data.datasets = rainDatasets;
      charts.yoyRainChart.options.plugins.title.text = rainTitle;
      charts.yoyRainChart.update();
    } else {
      charts.yoyRainChart = new Chart(document.getElementById('yoyRainChart'), {
        type: 'bar',
        data: { labels, datasets: rainDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: rainTitle, color: '#9aa7bd' },
            legend: { labels: { color: '#9aa7bd' } },
          },
          scales: {
            y: { ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
            x: { ticks: { color: '#9aa7bd' }, grid: { color: '#2c3648' } },
          },
        },
      });
    }
  } catch (err) {
    console.warn('[yoy charts]', err.message);
  }
}

// ---- astronomy & air quality ----
async function loadAstronomy() {
  try {
    const res = await fetch('/api/astronomy');
    const data = await res.json();

    // Sun times
    const sunrise = new Date(data.sun.sunrise).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const sunset = new Date(data.sun.sunset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const goldenHour = new Date(data.sun.goldenHour).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    $('#sun-times').innerHTML = `
      <div><strong>↑</strong> ${sunrise} · <strong>↓</strong> ${sunset}</div>
      <div style="font-size: 0.75rem; color: var(--ink-dim); margin-top: 0.3rem;">Golden hour: ${goldenHour}</div>
    `;

    // Moon phase & times
    $('#moon-icon').textContent = data.moon.phaseEmoji;
    $('#moon-label').textContent = data.moon.phaseName;
    const moonrise = data.moon.moonrise ? new Date(data.moon.moonrise).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'no rise';
    const moonset = data.moon.moonset ? new Date(data.moon.moonset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'no set';
    const illum = (data.moon.illumination * 100).toFixed(0);
    $('#moon-times').innerHTML = `
      <div><strong>↑</strong> ${moonrise} · <strong>↓</strong> ${moonset}</div>
      <div style="font-size: 0.75rem; color: var(--ink-dim); margin-top: 0.3rem;">${illum}% illuminated</div>
    `;
  } catch (err) {
    console.warn('[astronomy]', err.message);
  }
}

async function loadAQI() {
  try {
    const res = await fetch('/api/aqi');
    const data = await res.json();

    if (!data.available || !data.aqi) {
      $('#aqi-tile').style.display = 'none';
      return;
    }

    $('#aqi-tile').style.display = 'block';
    $('#aqi-content').innerHTML = `
      <div class="aqi-badge" style="background: ${data.color}; color: ${data.textColor};">
        AQI ${data.aqi} · ${data.level}
      </div>
      <div style="font-size: 0.75rem; color: var(--ink-dim); margin-top: 0.5rem;">
        Primary: ${data.pollutant}
      </div>
      ${data.stationName ? `<div style="font-size: 0.7rem; color: var(--ink-dim); margin-top: 0.3rem; font-style: italic;">Station: ${data.stationName}</div>` : ''}
    `;
  } catch (err) {
    console.warn('[aqi]', err.message);
    $('#aqi-tile').style.display = 'none';
  }
}

// ---- boot ----
// initMap() removed - using Weather.gov iframe embed instead of custom map
startStream();       // live current conditions via SSE (falls back to polling on error)
startStaleWatchdog(); // backstop: force a REST pull if the live stream silently stalls
loadBriefing();
loadSPCOutlook();
load7Day();
loadAlerts();
loadIndices();
loadPrecip();
loadAstronomy();
loadAQI();
loadMonthlyCharts();
loadHourly();
loadTendency();
loadHistory(currentRange);
setInterval(loadBriefing, 60 * 60 * 1000);  // briefing refreshes hourly
setInterval(loadSPCOutlook, 30 * 60 * 1000); // SPC outlook refreshes every 30 min
setInterval(load7Day, 60 * 60 * 1000);      // 7-day refreshes hourly
setInterval(loadAlerts, 2 * 60 * 1000);     // alerts refresh every 2 min (time-sensitive)
setInterval(loadIndices, REFRESH_MS);       // indices refresh with new station data
setInterval(loadPrecip, REFRESH_MS);        // precip analysis refreshes with new station data
setInterval(loadHourly, 60 * 60 * 1000);    // hourly forecast refresh every hour
setInterval(loadTendency, REFRESH_MS);      // tendency refreshes with new station data
setInterval(() => loadHistory(currentRange), REFRESH_MS * 5);
setInterval(loadAstronomy, 60 * 60 * 1000); // sun/moon times refresh hourly (changes slowly)
setInterval(loadAQI, 60 * 60 * 1000);       // AQI refreshes hourly
setInterval(loadMonthlyCharts, REFRESH_MS * 5); // historical charts refresh every 5 min

// Refresh the charts the moment the user returns to the tab.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  loadMonthlyCharts();
});
