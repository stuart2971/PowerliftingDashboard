import { getUser, navigate, toast } from '../app.js';
import { programAPI, sessionAPI, athleteAPI } from '../api.js';

export async function renderAthleteDashboard(app) {
  const user = getUser();

  const [profiles, programs] = await Promise.all([
    athleteAPI.list(),
    programAPI.list()
  ]);

  const profile = profiles[0];
  const activeProgram = programs[0];

  if (!activeProgram) {
    app.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Training</h1>
            <div class="page-subtitle">${profile?.name ?? user.email}</div>
          </div>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">🏋️</div>
          <div class="empty-state-title">No Program Assigned</div>
          <div class="empty-state-text">Your coach hasn't assigned a program yet.</div>
        </div>
      </div>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const todayDow = new Date().getDay();

  const [fullProgram, sessions, avgDuration] = await Promise.all([
    programAPI.getFull(activeProgram.id),
    sessionAPI.list(),
    sessionAPI.avgDuration(todayDow).catch(() => null)
  ]);

  const weeksOut = profile?.comp_date
    ? Math.max(0, Math.ceil((new Date(profile.comp_date) - new Date()) / (7 * 86400000)))
    : null;

  // Build lookup: programDayId → { week, day }
  const dayMap = {};
  for (const w of (fullProgram.weeks || [])) {
    for (const d of (w.days || [])) {
      dayMap[d.id] = { week: w, day: d };
    }
  }

  // Sessions come back DESC (newest first). Keep only the most recent per day.
  const sessionByDayId = {};
  for (const s of sessions) {
    if (s.program_day_id && !sessionByDayId[s.program_day_id]) {
      sessionByDayId[s.program_day_id] = s;
    }
  }

  // Check if all days in program are truly completed (completed_at set)
  const allDays = (fullProgram.weeks || []).flatMap(w => w.days || []);
  const programComplete = allDays.length > 0 && allDays.every(d => {
    const s = sessionByDayId[d.id];
    return !!(s && s.completed_at);
  });

  // Find the first day that isn't fully completed — that's the current/upcoming day
  let currentWeek = null;
  let upcomingDay = null;
  let upcomingDaySession = null;

  outer: for (const w of (fullProgram.weeks || [])) {
    for (const d of (w.days || [])) {
      const s = sessionByDayId[d.id];
      if (!s || !s.completed_at) {
        currentWeek = w;
        upcomingDay = d;
        upcomingDaySession = s || null; // null = not started, session obj = in progress
        break outer;
      }
    }
  }

  const weekNum = currentWeek?.week_number;
  const dayNum  = upcomingDay?.day_number;
  const pageTitle = (weekNum && dayNum)
    ? `Week ${weekNum} · Day ${dayNum}`
    : fullProgram.name;

  const avgDurStr = avgDuration?.avg_minutes
    ? `${Math.floor(avgDuration.avg_minutes / 60)}h ${avgDuration.avg_minutes % 60}m`
    : null;

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${pageTitle}</h1>
          <div class="page-subtitle">${profile?.name ?? ''}${profile?.weight_class ? ' · ' + profile.weight_class + 'kg' : ''}${profile?.division ? ' · ' + profile.division : ''}</div>
        </div>
        ${weeksOut != null ? `<div class="stat-chip"><div class="stat-chip-value">${weeksOut}</div><div class="stat-chip-label">Weeks Out</div></div>` : ''}
      </div>

      ${programComplete ? `
      <div class="program-complete-card">
        <div class="program-complete-icon">🏆</div>
        <div class="program-complete-title">Program Complete!</div>
        <div class="program-complete-body">${fullProgram.name} — all sessions logged. Great work.</div>
      </div>` : upcomingDay ? `
      <div class="today-card">
        <div class="today-card-header">
          <div>
            <div class="today-card-label">${upcomingDaySession ? (upcomingDaySession.session_date === today ? "Today's Session" : 'In Progress') : 'Next Up'}</div>
            <div class="today-card-title">${upcomingDay.label ? upcomingDay.label : (currentWeek?.label || '')}</div>
          </div>
          ${avgDurStr ? `<div class="today-avg-time">⏱ avg ${avgDurStr}</div>` : ''}
        </div>

        <div class="today-exercises">
          ${upcomingDay.exercises?.map(ex => `
            <div class="today-exercise-row">
              <span class="today-exercise-name">${ex.name}</span>
            </div>`
          ).join('') || '<div style="padding:8px 0;color:var(--text-muted)">No exercises</div>'}
        </div>

        <div class="today-card-footer">
          ${upcomingDaySession
            ? `<button class="btn btn-primary btn-lg btn-block today-go-btn" data-session-id="${upcomingDaySession.id}">Continue Session →</button>`
            : `<button class="btn btn-primary btn-lg btn-block today-go-btn" data-day-id="${upcomingDay.id}">Start Session →</button>`
          }
        </div>
      </div>` : ''}

      <!-- Lift Analytics (collapsed by default) -->
      <div class="section" style="margin-top:16px">
        <div class="section-header collapse-toggle" id="analytics-toggle" style="cursor:pointer">
          <span class="section-title">Lift Analytics</span>
          <span class="collapse-arrow">▾</span>
        </div>
        <div class="collapse-content" id="analytics-content">
          <div class="lift-analytics-row" style="padding:8px 0 4px">
            ${['squat','bench','deadlift'].map(lift => `
              <button class="btn btn-secondary lift-analytics-btn" data-lift="${lift}">
                ${lift.charAt(0).toUpperCase() + lift.slice(1)} ↗
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Program Weeks (collapsed by default) -->
      <div class="section" style="margin-top:8px">
        <div class="section-header collapse-toggle" id="weeks-toggle" style="cursor:pointer">
          <span class="section-title">Program Weeks</span>
          <span class="collapse-arrow">▾</span>
        </div>
        <div class="collapse-content" id="weeks-content">
          <div class="section-body" style="padding:4px 0">
            ${fullProgram.weeks?.length ? fullProgram.weeks.map(w => {
              const isCurrent = currentWeek?.id === w.id;
              const completedDays = w.days?.filter(d => {
                const s = sessionByDayId[d.id];
                return !!(s && s.completed_at);
              }).length || 0;
              const totalDays = w.days?.length || 0;
              return `
                <div class="week-nav-row${isCurrent ? ' current' : ''}" data-week-id="${w.id}">
                  <div class="week-nav-info">
                    <span class="week-nav-label">Week ${w.week_number}${w.label ? ' — ' + w.label : ''}</span>
                    <span class="week-nav-progress">${completedDays} / ${totalDays} days logged</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${isCurrent ? '<span class="badge badge-accent">Current</span>' : ''}
                    ${completedDays === totalDays && totalDays > 0 ? '<span class="badge badge-muted">Complete</span>' : ''}
                    <span class="week-nav-arrow">›</span>
                  </div>
                </div>`;
            }).join('') : '<div style="padding:16px;color:var(--text-muted)">No weeks in this program</div>'}
          </div>
        </div>
      </div>
    </div>`;

  // Collapse toggles
  ['analytics', 'weeks'].forEach(name => {
    const toggle  = document.getElementById(`${name}-toggle`);
    const content = document.getElementById(`${name}-content`);
    if (!toggle || !content) return;
    toggle.addEventListener('click', () => {
      const isOpen = content.classList.toggle('open');
      const arrow = toggle.querySelector('.collapse-arrow');
      if (arrow) arrow.textContent = isOpen ? '▴' : '▾';
    });
  });

  // Lift analytics buttons
  app.querySelectorAll('.lift-analytics-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(`/my/exercise/${btn.dataset.lift}`));
  });

  // Today card start / continue
  app.querySelector('.today-go-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.sessionId) {
      navigate(`/session/${btn.dataset.sessionId}`);
    } else {
      btn.disabled = true;
      btn.textContent = 'Starting…';
      try {
        const session = await sessionAPI.create({ program_day_id: Number(btn.dataset.dayId), session_date: today });
        navigate(`/session/${session.id}`);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Start Session →';
      }
    }
  });

  // Week nav rows
  app.querySelectorAll('.week-nav-row').forEach(row => {
    row.addEventListener('click', () => navigate(`/training/week/${row.dataset.weekId}`));
  });
}
