import { navigate } from '../app.js';
import { programAPI, sessionAPI } from '../api.js';

export async function renderWeekDetail(app, weekId) {
  // Fetch the full program to find this week
  const programs = await programAPI.list();
  const activeProgram = programs[0];
  if (!activeProgram) { navigate('/dashboard'); return; }

  const [fullProgram, sessions] = await Promise.all([
    programAPI.getFull(activeProgram.id),
    sessionAPI.list()
  ]);

  const week = fullProgram.weeks?.find(w => String(w.id) === String(weekId));
  if (!week) { navigate('/dashboard'); return; }

  const sessionByDayId = {};
  for (const s of sessions) {
    if (s.program_day_id) sessionByDayId[s.program_day_id] = s;
  }

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Week ${week.week_number}${week.label ? ' — ' + week.label : ''}</h1>
          <div class="page-subtitle">${fullProgram.name}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${week.days?.length
          ? week.days.map(day => renderDayCard(day, sessionByDayId[day.id])).join('')
          : '<div class="empty-state"><div class="empty-state-text">No days in this week</div></div>'
        }
      </div>
    </div>`;

  app.querySelectorAll('.week-day-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const sessionId = card.dataset.sessionId;
      if (sessionId) navigate(`/session/${sessionId}`);
    });
  });

  app.querySelectorAll('.day-start-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = 'Starting…';
      try {
        const { sessionAPI: sAPI } = await import('../api.js');
        const session = await sAPI.create({
          program_day_id: Number(btn.dataset.dayId),
          session_date: new Date().toISOString().split('T')[0]
        });
        navigate(`/session/${session.id}`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Start';
      }
    });
  });
}

function renderDayCard(day, session) {
  const isComplete = !!(session?.completed_at);
  const hasSession = !!session;

  const exerciseSummary = day.exercises?.map(ex => `
    <div class="week-day-exercise">
      <span class="week-day-exercise-name">${ex.name}</span>
    </div>`
  ).join('') || '';

  return `
    <div class="week-day-card" data-day-id="${day.id}" ${session ? `data-session-id="${session.id}"` : ''}>
      <div class="week-day-header">
        <div>
          <div class="week-day-title">Day ${day.day_number}${day.label ? ' — ' + day.label : ''}</div>
        </div>
        <div>
          ${isComplete
            ? `<button class="btn btn-secondary btn-sm">Completed</button>`
            : hasSession
              ? `<button class="btn btn-primary btn-sm day-start-btn" data-day-id="${day.id}">Continue</button>`
              : `<button class="btn btn-primary btn-sm day-start-btn" data-day-id="${day.id}">Start</button>`
          }
        </div>
      </div>
      <div class="week-day-exercises">
        ${exerciseSummary || '<div style="color:var(--text-muted);font-size:0.85rem">No exercises</div>'}
      </div>
    </div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
