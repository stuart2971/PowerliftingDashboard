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

  // Sessions indexed by program_day_id
  const sessionByDayId = {};
  for (const s of sessions) {
    if (s.program_day_id) sessionByDayId[s.program_day_id] = s;
  }

  // Find today's active session or next upcoming day
  const todaySession = sessions.find(s => s.session_date === today && s.program_day_id);
  let currentWeek = null;
  let upcomingDay = null;
  let upcomingDaySession = null;

  if (todaySession) {
    const ref = dayMap[todaySession.program_day_id];
    currentWeek = ref?.week;
    upcomingDay = ref?.day;
    upcomingDaySession = todaySession;
  } else {
    const lastSession = sessions.filter(s => s.program_day_id).slice(-1)[0];
    let foundLast = !lastSession;
    outer: for (const w of (fullProgram.weeks || [])) {
      for (const d of (w.days || [])) {
        if (foundLast && !sessionByDayId[d.id]) {
          currentWeek = w;
          upcomingDay = d;
          break outer;
        }
        if (lastSession && d.id === lastSession.program_day_id) foundLast = true;
      }
    }
  }

  const dayLabel = upcomingDay
    ? `Day ${upcomingDay.day_number}${upcomingDay.label ? ' — ' + upcomingDay.label : ''}`
    : null;
  const weekLabel = currentWeek
    ? `Week ${currentWeek.week_number}${currentWeek.label ? ' — ' + currentWeek.label : ''}`
    : null;
  const avgDurStr = avgDuration?.avg_minutes
    ? `${Math.floor(avgDuration.avg_minutes / 60)}h ${avgDuration.avg_minutes % 60}m`
    : null;

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${fullProgram.name}</h1>
          <div class="page-subtitle">${profile?.name ?? ''}${profile?.weight_class ? ' · ' + profile.weight_class + 'kg' : ''}${profile?.division ? ' · ' + profile.division : ''}</div>
        </div>
        ${weeksOut != null ? `<div class="stat-chip"><div class="stat-chip-value">${weeksOut}</div><div class="stat-chip-label">Weeks Out</div></div>` : ''}
      </div>

      <!-- Lift analytics buttons -->
      <div class="lift-analytics-row">
        ${['squat','bench','deadlift'].map(lift => `
          <button class="btn btn-secondary lift-analytics-btn" onclick="window.location.hash='#/my/exercise/${lift}'">
            ${lift.charAt(0).toUpperCase() + lift.slice(1)} ↗
          </button>
        `).join('')}
      </div>

      ${upcomingDay ? `
      <div class="today-card">
        <div class="today-card-header">
          <div>
            <div class="today-card-label">${upcomingDaySession || todaySession ? "Today's Session" : 'Next Up'}</div>
            <div class="today-card-title">${weekLabel} · ${dayLabel}</div>
          </div>
          <div class="today-card-actions">
            ${avgDurStr ? `<div class="today-avg-time">⏱ avg ${avgDurStr}</div>` : ''}
            ${todaySession
              ? `<button class="btn btn-primary today-go-btn" data-session-id="${todaySession.id}">Continue →</button>`
              : `<button class="btn btn-primary today-go-btn" data-day-id="${upcomingDay.id}">Start →</button>`
            }
          </div>
        </div>

        <div class="today-exercises">
          ${upcomingDay.exercises?.map(ex => {
            const top = ex.sets?.find(s => s.set_type === 'top');
            const bds = ex.sets?.filter(s => s.set_type === 'backdown') || [];
            const desc = top
              ? `${top.reps}@RPE${top.target_rpe ?? '?'}${bds.length ? ` + ${bds.length}×${bds[0].reps}@RPE${bds[0].target_rpe ?? '?'}` : ''}`
              : `${ex.sets?.length ?? 0} sets`;
            return `
              <div class="today-exercise-row">
                <div class="today-exercise-main">
                  <span class="today-exercise-name">${ex.name}</span>
                  <span class="today-exercise-desc">${desc}</span>
                </div>
              </div>`;
          }).join('') || '<div style="padding:8px 0;color:var(--text-muted)">No exercises</div>'}
        </div>

      </div>` : ''}

      <div class="section" style="margin-top:24px">
        <div class="section-header">
          <span class="section-title">Program Weeks</span>
        </div>
        <div class="section-body" style="padding:4px 0">
          ${fullProgram.weeks?.length ? fullProgram.weeks.map(w => {
            const isCurrent = currentWeek?.id === w.id;
            const completedDays = w.days?.filter(d => sessionByDayId[d.id]).length || 0;
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
    </div>`;

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
        btn.textContent = 'Start →';
      }
    }
  });

  app.querySelectorAll('.week-nav-row').forEach(row => {
    row.addEventListener('click', () => navigate(`/training/week/${row.dataset.weekId}`));
  });
}
