import { toast, navigate } from '../app.js';
import { athleteAPI, programAPI } from '../api.js';

export async function renderCoachDashboard(app) {
  const [athletes, programs] = await Promise.all([
    athleteAPI.list(),
    programAPI.list()
  ]);

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Coach Dashboard</h1>
          <div class="page-subtitle">StrengthTrack</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="new-program-btn">+ New Program</button>
          <button class="btn btn-primary" id="new-athlete-btn">+ Add Athlete</button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid-3" style="margin-bottom:24px">
        <div class="stat-chip">
          <div class="stat-chip-value">${athletes.length}</div>
          <div class="stat-chip-label">Athletes</div>
        </div>
        <div class="stat-chip">
          <div class="stat-chip-value">${programs.length}</div>
          <div class="stat-chip-label">Programs</div>
        </div>
        <div class="stat-chip">
          <div class="stat-chip-value">${programs.filter(p => p.is_active).length}</div>
          <div class="stat-chip-label">Active Programs</div>
        </div>
      </div>

      <!-- Athletes section -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Athletes</span>
        </div>
        <div class="section-body" style="padding:12px;display:flex;flex-direction:column;gap:8px">
          ${athletes.length
            ? athletes.map(a => renderAthleteCard(a, programs)).join('')
            : '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">No Athletes Yet</div><div class="empty-state-text">Add your first athlete to get started.</div></div>'
          }
        </div>
      </div>

      <!-- Programs section -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Programs</span>
        </div>
        <div class="section-body" style="padding:0">
          ${programs.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>Name</th><th>Athlete</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${programs.map(p => {
                    const athlete = athletes.find(a => a.id === p.athlete_id);
                    return `<tr>
                      <td><strong>${p.name}</strong></td>
                      <td>${athlete ? athlete.name : '<em style="color:var(--text-muted)">Unassigned</em>'}</td>
                      <td>${p.is_active ? '<span class="badge badge-accent">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
                      <td style="text-align:right;white-space:nowrap">
                        <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/coach/program/${p.id}'">Edit</button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table></div>`
            : '<div class="empty-state" style="padding:32px"><div class="empty-state-text">No programs yet. Create one!</div></div>'
          }
        </div>
      </div>
    </div>`;

  // New athlete modal
  document.getElementById('new-athlete-btn').addEventListener('click', () => showNewAthleteModal(app));

  // New program
  document.getElementById('new-program-btn').addEventListener('click', () => showNewProgramModal(athletes, app));
}

function renderAthleteCard(athlete, programs) {
  const program = programs.find(p => p.athlete_id === athlete.id && p.is_active);
  const initials = athlete.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const compDate = athlete.comp_date ? new Date(athlete.comp_date) : null;
  const weeksOut = compDate ? Math.max(0, Math.ceil((compDate - new Date()) / (7 * 86400000))) : null;

  return `
    <div class="athlete-card" onclick="window.location.hash='#/coach/athlete/${athlete.id}'">
      <div class="athlete-avatar">${initials}</div>
      <div class="athlete-info">
        <div class="athlete-name">${athlete.name}</div>
        <div class="athlete-meta">
          ${athlete.weight_class ? athlete.weight_class + 'kg' : ''}
          ${athlete.division ? ' | ' + athlete.division : ''}
          ${weeksOut != null ? ' | ' + weeksOut + ' weeks out' : ''}
        </div>
        ${program ? `<span class="badge badge-accent" style="margin-top:4px">${program.name}</span>` : '<span class="badge badge-muted" style="margin-top:4px">No Program</span>'}
      </div>
      <div style="color:var(--text-muted);font-size:1.2rem">›</div>
    </div>`;
}

function showNewAthleteModal(app) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Add Athlete</span>
        <button class="modal-close" id="close-na">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-control" id="na-name" placeholder="Stuart Fong" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="na-email" placeholder="athlete@email.com">
          </div>
          <div class="form-group">
            <label class="form-label">Temp Password</label>
            <input type="password" class="form-control" id="na-pw" placeholder="••••••••">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Weight Class (kg)</label>
            <input type="number" class="form-control" id="na-wc" placeholder="83">
          </div>
          <div class="form-group">
            <label class="form-label">Division</label>
            <select class="form-select" id="na-div">
              <option value="Open">Open</option>
              <option value="Juniors">Juniors</option>
              <option value="Sub-Juniors">Sub-Juniors</option>
              <option value="Masters 40+">Masters 40+</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="na-start" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Comp Date</label>
            <input type="date" class="form-control" id="na-comp">
          </div>
        </div>
        <div id="na-error" class="form-error hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-na">Cancel</button>
        <button class="btn btn-primary" id="save-na">Add Athlete</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#close-na').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#cancel-na').addEventListener('click', () => backdrop.remove());

  backdrop.querySelector('#save-na').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#na-error');
    errEl.classList.add('hidden');
    try {
      await athleteAPI.create({
        name: backdrop.querySelector('#na-name').value,
        email: backdrop.querySelector('#na-email').value,
        password: backdrop.querySelector('#na-pw').value || 'changeme123',
        weight_class: backdrop.querySelector('#na-wc').value || null,
        division: backdrop.querySelector('#na-div').value,
        start_date: backdrop.querySelector('#na-start').value || null,
        comp_date: backdrop.querySelector('#na-comp').value || null
      });
      backdrop.remove();
      toast('Athlete added!', 'success');
      renderCoachDashboard(app);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

function showNewProgramModal(athletes, app) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">New Program</span>
        <button class="modal-close" id="close-np">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Program Name</label>
          <input type="text" class="form-control" id="np-name" placeholder="12-Week Comp Prep">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" id="np-desc" placeholder="Optional description">
        </div>
        <div class="form-group">
          <label class="form-label">Assign to Athlete (optional)</label>
          <select class="form-select" id="np-athlete">
            <option value="">— Template (no athlete) —</option>
            ${athletes.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-np">Cancel</button>
        <button class="btn btn-primary" id="save-np">Create Program</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#close-np').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#cancel-np').addEventListener('click', () => backdrop.remove());

  backdrop.querySelector('#save-np').addEventListener('click', async () => {
    try {
      const program = await programAPI.create({
        name: backdrop.querySelector('#np-name').value || 'New Program',
        description: backdrop.querySelector('#np-desc').value
      });
      const athleteId = backdrop.querySelector('#np-athlete').value;
      if (athleteId) {
        await programAPI.assign(program.id, athleteId);
      }
      backdrop.remove();
      toast('Program created!', 'success');
      navigate(`/coach/program/${program.id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
