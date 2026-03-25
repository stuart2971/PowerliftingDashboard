import { navigate } from '../app.js';

export function renderWeekCard(week, sessions, onStartSession) {
  const daysHtml = week.days.map(day => renderDayCard(day, sessions, onStartSession)).join('');
  return `
    <div class="section">
      <div class="section-header collapse-toggle open" data-target="week-${week.id}">
        <span class="section-title">Week ${week.week_number}${week.label ? ` — ${week.label}` : ''}</span>
        <span class="arrow">▼</span>
      </div>
      <div class="collapse-content open" id="week-${week.id}">
        ${daysHtml || '<div class="empty-state" style="padding:24px"><div class="empty-state-text">No days in this week</div></div>'}
      </div>
    </div>`;
}

function renderDayCard(day, sessions, onStartSession) {
  const session = sessions?.find(s => s.program_day_id === day.id);
  const isLogged = !!session;

  return `
    <div class="day-card">
      <div class="day-header collapse-toggle open" data-target="day-${day.id}">
        <div>
          <div class="day-title">Day ${day.day_number}${day.label ? ` — ${day.label}` : ''}</div>
          ${isLogged ? '<span class="badge badge-accent" style="margin-top:4px">Logged</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${isLogged
            ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.location.hash='#/session/${session.id}'">View Log</button>`
            : `<button class="btn btn-primary btn-sm start-session-btn" data-day-id="${day.id}">Start Session</button>`
          }
          <span class="arrow">▼</span>
        </div>
      </div>
      <div class="collapse-content open day-body" id="day-${day.id}">
        ${day.exercises?.length
          ? day.exercises.map(ex => renderExercisePreview(ex)).join('')
          : '<div style="padding:16px 20px;color:var(--text-muted);font-size:0.85rem">No exercises</div>'
        }
      </div>
    </div>`;
}

function renderExercisePreview(ex) {
  const topSet = ex.sets?.find(s => s.set_type === 'top');
  const backdowns = ex.sets?.filter(s => s.set_type === 'backdown') || [];
  const setDesc = topSet
    ? `${topSet.reps}@${topSet.target_rpe ?? '?'} + ${backdowns.length}×${backdowns[0]?.reps ?? '?'}@${backdowns[0]?.target_rpe ?? '?'}`
    : `${ex.sets?.length ?? 0} sets`;

  return `
    <div class="exercise-block">
      <div class="exercise-header">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-coach-notes">${setDesc}</div>
      </div>
    </div>`;
}

export function attachCollapseListeners(container) {
  container.querySelectorAll('.collapse-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.dataset.target;
      const content = document.getElementById(targetId);
      if (!content) return;
      const isOpen = content.classList.contains('open');
      content.classList.toggle('open', !isOpen);
      toggle.classList.toggle('open', !isOpen);
    });
  });
}
