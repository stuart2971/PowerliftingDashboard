import { navigate } from '../app.js';
import { athleteAPI } from '../api.js';
import { calcE1RM } from '../rpe.js';

export async function renderAthleteExercise(app, athleteId, liftType) {
  app.innerHTML = '<div class="page"><div class="loading-screen"><div class="spinner"></div></div></div>';

  let profile, rawData;
  if (!athleteId || athleteId === 'me') {
    const profiles = await athleteAPI.list();
    profile = profiles[0];
    if (!profile) { navigate('/dashboard'); return; }
    rawData = await athleteAPI.exerciseData(profile.id, liftType);
  } else {
    [profile, rawData] = await Promise.all([
      athleteAPI.get(athleteId),
      athleteAPI.exerciseData(athleteId, liftType)
    ]);
  }

  const title = liftType.charAt(0).toUpperCase() + liftType.slice(1);

  const data = rawData.map(row => ({
    ...row,
    e1rm: (row.load_kg && row.reps && row.actual_rpe)
      ? Math.round(calcE1RM(row.load_kg, row.reps, row.actual_rpe) * 10) / 10
      : null
  }));

  const uniqueReps = [...new Set(data.map(r => r.reps).filter(Boolean))].sort((a, b) => a - b);
  const uniqueRpe  = [...new Set(data.map(r => r.actual_rpe).filter(Boolean))].sort((a, b) => a - b);
  const uniqueType = [...new Set(data.map(r => r.set_type).filter(Boolean))];

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <button class="btn btn-secondary btn-sm" onclick="history.back()">← Back</button>
          <div style="margin-top:8px">
            <h1 class="page-title">${title} — ${profile.name}</h1>
            <div class="page-subtitle">${data.length} logged sets</div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="exercise-filters">
        <select class="filter-select" id="f-type">
          <option value="">All types</option>
          ${uniqueType.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
        <select class="filter-select" id="f-reps">
          <option value="">All reps</option>
          ${uniqueReps.map(r => `<option value="${r}">${r} rep${r > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <select class="filter-select" id="f-rpe">
          <option value="">All RPE</option>
          ${uniqueRpe.map(r => `<option value="${r}">@${r}</option>`).join('')}
        </select>
        <input type="date" class="filter-select" id="f-date-from" title="From date">
        <input type="date" class="filter-select" id="f-date-to" title="To date">
        <button class="btn btn-secondary btn-sm" id="f-clear">Clear</button>
      </div>

      <!-- Analytics layout: stacked mobile, side-by-side desktop -->
      <div class="analytics-layout">

        <!-- Chart — always first/main -->
        <div class="analytics-chart-panel">
          <div class="section">
            <div class="section-header">
              <span class="section-title">Estimated 1RM Over Time</span>
            </div>
            <div class="section-body chart-body" id="e1rm-chart-wrap">
              <!-- rendered by JS -->
            </div>
          </div>
        </div>

        <!-- Table — below chart on mobile, sidebar on desktop -->
        <div class="analytics-table-panel">
          <div class="section">
            <div class="section-header"><span class="section-title">All Sets</span></div>
            <div class="section-body" style="padding:0">
              <div class="table-wrap" id="exercise-table-wrap">
                <!-- rendered by JS -->
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>`;

  let filtered = [...data];

  function getFilters() {
    return {
      type:     document.getElementById('f-type')?.value || '',
      reps:     document.getElementById('f-reps')?.value || '',
      rpe:      document.getElementById('f-rpe')?.value  || '',
      dateFrom: document.getElementById('f-date-from')?.value || '',
      dateTo:   document.getElementById('f-date-to')?.value   || ''
    };
  }

  function applyFilters() {
    const f = getFilters();
    filtered = data.filter(r => {
      if (f.type && r.set_type !== f.type) return false;
      if (f.reps && String(r.reps) !== f.reps) return false;
      if (f.rpe  && String(r.actual_rpe) !== f.rpe) return false;
      if (f.dateFrom && r.session_date < f.dateFrom) return false;
      if (f.dateTo   && r.session_date > f.dateTo)   return false;
      return true;
    });
    renderTable();
    renderE1rmChart();
  }

  function renderTable() {
    const wrap = document.getElementById('exercise-table-wrap');
    if (!wrap) return;
    if (!filtered.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:32px"><div class="empty-state-text">No sets match the current filters</div></div>';
      return;
    }

    // On desktop (sidebar) we skip wellness columns — keep the table narrow enough to fit
    wrap.innerHTML = `
      <table class="exercise-data-table">
        <thead>
          <tr>
            <th>Date</th><th>Type</th><th>Reps</th><th>Load</th><th>RPE</th><th>e1RM</th><th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td>${r.session_date}</td>
              <td><span class="set-type-pill ${r.set_type}">${r.set_type}</span></td>
              <td>${r.reps ?? '—'}</td>
              <td>${r.load_kg ?? '—'}</td>
              <td>${r.actual_rpe ?? '—'}</td>
              <td>${r.e1rm != null ? r.e1rm + ' kg' : '—'}</td>
              <td class="notes-cell">${r.athlete_notes ? `<span title="${r.athlete_notes}">${r.athlete_notes.slice(0, 30)}${r.athlete_notes.length > 30 ? '…' : ''}</span>` : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // ── SVG chart ──────────────────────────────────────────────────────
  function renderLineChart(wrap, points, yLabel, color = '#22c55e') {
    if (!points.length) {
      wrap.innerHTML = '<div class="chart-empty">Not enough data</div>';
      return;
    }

    const W = wrap.clientWidth || 500;
    const H = 240;
    const PAD = { top: 16, right: 24, bottom: 40, left: 56 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    points = [...points].sort((a, b) => a.date.localeCompare(b.date));

    const dates  = points.map(p => p.date);
    const values = points.map(p => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rangeV = maxV - minV || 1;

    const x = (i) => PAD.left + (i / Math.max(points.length - 1, 1)) * plotW;
    const y = (v) => PAD.top + plotH - ((v - minV) / rangeV) * plotH;

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${x(points.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

    const yTicks = Array.from({ length: 5 }, (_, i) => minV + (rangeV * i / 4));
    const step = Math.max(1, Math.floor(points.length / 6));
    const xTickIdxs = points.map((_, i) => i).filter(i => i % step === 0);
    const svgId = `chart-grad-${Math.random().toString(36).slice(2)}`;

    wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;overflow:visible">
        <defs>
          <linearGradient id="${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${yTicks.map(v => `
          <line x1="${PAD.left}" y1="${y(v).toFixed(1)}" x2="${PAD.left + plotW}" y2="${y(v).toFixed(1)}"
                stroke="var(--border)" stroke-width="1"/>
        `).join('')}
        ${yTicks.map(v => `
          <text x="${PAD.left - 6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle"
                font-size="11" fill="var(--text-muted)">${Math.round(v)}</text>
        `).join('')}
        <path d="${areaD}" fill="url(#${svgId})"/>
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${points.map((p, i) => `
          <circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5"
                  fill="${color}" stroke="var(--bg-card)" stroke-width="2">
            <title>${p.date}: ${p.value} ${yLabel}</title>
          </circle>
        `).join('')}
        ${xTickIdxs.map(i => `
          <text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle"
                font-size="10" fill="var(--text-muted)">${dates[i].slice(5)}</text>
        `).join('')}
        <text x="12" y="${PAD.top + plotH / 2}" text-anchor="middle" dominant-baseline="middle"
              font-size="11" fill="var(--text-muted)"
              transform="rotate(-90, 12, ${PAD.top + plotH / 2})">${yLabel}</text>
      </svg>`;
  }

  function renderE1rmChart() {
    const wrap = document.getElementById('e1rm-chart-wrap');
    if (!wrap) return;
    const byDate = {};
    for (const r of filtered) {
      if (r.e1rm == null) continue;
      if (!byDate[r.session_date] || r.e1rm > byDate[r.session_date]) {
        byDate[r.session_date] = r.e1rm;
      }
    }
    const points = Object.entries(byDate).map(([date, value]) => ({ date, value }));
    renderLineChart(wrap, points, 'e1RM (kg)', '#22c55e');
  }

  renderTable();
  renderE1rmChart();

  ['f-type','f-reps','f-rpe','f-date-from','f-date-to'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });

  document.getElementById('f-clear')?.addEventListener('click', () => {
    ['f-type','f-reps','f-rpe'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['f-date-from','f-date-to'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    applyFilters();
  });

  // Re-render chart on resize for correct width calculation
  const resizeObserver = new ResizeObserver(() => renderE1rmChart());
  const chartPanel = document.querySelector('.analytics-chart-panel');
  if (chartPanel) resizeObserver.observe(chartPanel);
}
