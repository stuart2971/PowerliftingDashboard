import { toast } from '../app.js';
import { athleteAPI, sessionAPI, programAPI } from '../api.js';

export async function renderAthleteDetail(app, athleteId) {
  const [profile, pbs, sessions, programs] = await Promise.all([
    athleteAPI.get(athleteId),
    athleteAPI.pbs(athleteId),
    sessionAPI.list(`?athleteId=${athleteId}`),
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
          <div class="section-header"><span class="section-title">Recent Sessions</span></div>
          <div class="section-body" style="padding:0">
            ${sessions.length
              ? `<div class="table-wrap"><table>
                  <thead><tr><th>Date</th><th>Readiness</th><th>Sets</th><th></th></tr></thead>
                  <tbody>
                    ${sessions.slice(0, 10).map(s => `
                      <tr>
                        <td>${s.session_date}</td>
                        <td>${s.readiness ? `<span class="badge badge-${s.readiness === 'Great' ? 'accent' : s.readiness === 'Good' ? 'info' : 'warning'}">${s.readiness}</span>` : '—'}</td>
                        <td>${s.athlete_name || ''}</td>
                        <td><button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/session/${s.id}'">View</button></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table></div>`
              : '<div class="empty-state" style="padding:32px"><div class="empty-state-text">No sessions logged yet</div></div>'
            }
          </div>
        </div>
      </div>
    </div>`;

  app.querySelectorAll('.lift-analytics-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/coach/athlete/${athleteId}/exercise/${btn.dataset.lift}`;
    });
  });
}
