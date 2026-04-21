import { toast } from '../app.js';
import { athleteAPI, sessionAPI, programAPI } from '../api.js';

export async function renderAthleteDetail(app, athleteId) {
  const [profile, pbs, programs] = await Promise.all([
    athleteAPI.get(athleteId),
    athleteAPI.pbs(athleteId),
    programAPI.list()
  ]);

  const activeProgram = programs.find(p => p.athlete_id == athleteId && p.is_active);
  const compDate = profile.comp_date ? new Date(profile.comp_date) : null;
  const weeksOut = compDate ? Math.max(0, Math.ceil((compDate - new Date()) / (7 * 86400000))) : null;

  const topPbs = { squat: null, bench: null, deadlift: null };
  pbs.forEach(p => { if (!topPbs[p.lift] || p.load_kg > topPbs[p.lift].load_kg) topPbs[p.lift] = p; });

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${profile.name}</h1>
          <div class="page-subtitle">${profile.email} | ${profile.weight_class ? profile.weight_class + 'kg' : ''} | ${profile.division || 'Open'}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="window.location.hash='#/coach'">← Back</button>
          ${activeProgram
            ? `<button class="btn btn-secondary" onclick="window.location.hash='#/coach/program/${activeProgram.id}'">Edit Program</button>`
            : ''
          }
        </div>
      </div>

      <!-- Exercise analytics buttons -->
      <div class="lift-analytics-row">
        ${['squat','bench','deadlift'].map(lift => `
          <button class="btn btn-secondary lift-analytics-btn" data-lift="${lift}">
            ${lift.charAt(0).toUpperCase() + lift.slice(1)} ↗
          </button>
        `).join('')}
      </div>

      <!-- PB chips -->
      <div class="grid-3" style="margin-bottom:24px">
        ${['squat','bench','deadlift'].map(lift => `
          <div class="stat-chip">
            <div class="stat-chip-value">${topPbs[lift] ? topPbs[lift].load_kg + ' kg' : '—'}</div>
            <div class="stat-chip-label">${lift.charAt(0).toUpperCase() + lift.slice(1)} PB</div>
          </div>
        `).join('')}
      </div>

      <!-- Info row -->
      <div class="grid-2" style="margin-bottom:24px">
        <div class="section">
          <div class="section-header"><span class="section-title">Athlete Info</span></div>
          <div class="section-body" style="padding:0">
            ${[
              ['Competition', profile.competition],
              ['Comp Date', compDate ? compDate.toLocaleDateString('en-US') : null],
              ['Weeks Out', weeksOut],
              ['Start Date', profile.start_date ? new Date(profile.start_date).toLocaleDateString('en-US') : null],
              ['Program', activeProgram ? activeProgram.name : 'None'],
              ['Payment', profile.payment_status]
            ].map(([label, val]) => `
              <div class="info-row">
                <div class="info-label">${label}</div>
                <div class="info-value">${val ?? 'N/A'}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-header" style="display:flex;align-items:center;justify-content:space-between">
            <span class="section-title">Recent Sessions</span>
            <button class="btn btn-secondary btn-sm" id="refresh-sessions-btn">↻ Refresh</button>
          </div>
          <div class="section-body" style="padding:0" id="sessions-table-wrap">
            <div class="loading-inline">Loading…</div>
          </div>
        </div>
      </div>
    </div>`;

  app.querySelectorAll('.lift-analytics-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/coach/athlete/${athleteId}/exercise/${btn.dataset.lift}`;
    });
  });

  // ── Sessions: fetch fresh and re-render ──────────────────────
  async function loadSessions() {
    const wrap = document.getElementById('sessions-table-wrap');
    const btn  = document.getElementById('refresh-sessions-btn');
    if (!wrap) return;
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const sessions = await sessionAPI.list(`?athleteId=${athleteId}`);
      renderSessionsTable(wrap, sessions);
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-text">Failed to load sessions</div></div>`;
      toast('Could not load sessions', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
    }
  }

  function renderSessionsTable(wrap, sessions) {
    if (!sessions.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:32px"><div class="empty-state-text">No sessions logged yet</div></div>';
      return;
    }
    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Status</th><th>Readiness</th><th></th></tr></thead>
        <tbody>
          ${sessions.slice(0, 15).map(s => {
            const done = !!s.completed_at;
            const statusBadge = done
              ? '<span class="badge badge-accent">Done</span>'
              : '<span class="badge badge-muted">In Progress</span>';
            const readiness = s.readiness
              ? `<span class="badge badge-${s.readiness === 'Great' ? 'accent' : s.readiness === 'Good' ? 'info' : 'warning'}">${s.readiness}</span>`
              : '—';
            return `<tr>
              <td>${s.session_date}</td>
              <td>${statusBadge}</td>
              <td>${readiness}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/session/${s.id}'">View</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  }

  document.getElementById('refresh-sessions-btn')?.addEventListener('click', loadSessions);

  // Auto-refresh when page becomes visible again (athlete may have just finished)
  const onVisible = () => { if (!document.hidden) loadSessions(); };
  document.addEventListener('visibilitychange', onVisible);
  // Clean up listener when user navigates away (hash change)
  window.addEventListener('hashchange', () => {
    document.removeEventListener('visibilitychange', onVisible);
  }, { once: true });

  loadSessions();
}
