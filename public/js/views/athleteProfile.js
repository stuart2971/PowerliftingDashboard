import { getUser, toast } from '../app.js';
import { athleteAPI } from '../api.js';

export async function renderAthleteProfile(app) {
  const user = getUser();
  const profiles = await athleteAPI.list();
  const profile = profiles[0];

  if (!profile) {
    app.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-state-title">No Profile Found</div></div></div>`;
    return;
  }

  const pbs = await athleteAPI.pbs(profile.id);

  const compDate = profile.comp_date ? new Date(profile.comp_date) : null;
  const startDate = profile.start_date ? new Date(profile.start_date) : null;
  const weeksOut = compDate ? Math.max(0, Math.ceil((compDate - new Date()) / (7 * 86400000))) : null;
  const paymentWeeks = (profile.payment_start && compDate)
    ? Math.ceil((compDate - new Date(profile.payment_start)) / (7 * 86400000))
    : null;
  const paymentDue = profile.payment_start
    ? new Date(new Date(profile.payment_start).getTime() + 30 * 86400000).toLocaleDateString('en-US')
    : 'N/A';

  // Group PBs by rep count, best load per lift per rep count
  const repCounts = [...new Set(pbs.map(p => p.reps).filter(Boolean))].sort((a, b) => a - b);
  if (!repCounts.length) repCounts.push(1, 2, 3);

  function bestLoad(lift, reps) {
    const matches = pbs.filter(p => p.lift === lift && p.reps === reps);
    return matches.length ? Math.max(...matches.map(p => p.load_kg)) : null;
  }

  function pbRows() {
    return repCounts.map(reps => {
      const s = bestLoad('squat', reps);
      const b = bestLoad('bench', reps);
      const d = bestLoad('deadlift', reps);
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${reps}</td>
        <td class="pb-val">${s ?? ''}</td>
        <td class="pb-val">${b ?? ''}</td>
        <td class="pb-val">${d ?? ''}</td>
      </tr>`;
    }).join('');
  }

  function infoRow(label, value) {
    return `<div class="info-row">
      <div class="info-label">${label}</div>
      <div class="info-value">${value ?? 'N/A'}</div>
    </div>`;
  }

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${profile.name}</h1>
          <div class="page-subtitle">${profile.email ?? ''}</div>
        </div>
        <button class="btn btn-secondary" id="edit-profile-btn">Edit Profile</button>
      </div>

      <div class="profile-grid">
        <!-- Personal Bests -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">Personal Bests</span>
            <button class="btn btn-primary btn-sm" id="add-pb-btn">+ Add PB</button>
          </div>
          <div class="section-body" style="padding:0">
            <div class="table-wrap">
              <table class="pb-table">
                <thead>
                  <tr>
                    <th>Reps</th>
                    <th>Squat</th>
                    <th>Bench</th>
                    <th>Deadlift</th>
                  </tr>
                </thead>
                <tbody id="pb-body">
                  ${pbRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Athlete Info -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">Athlete Information</span>
          </div>
          <div class="section-body" style="padding:0">
            <div class="info-table">
              ${infoRow('Name', profile.name)}
              ${infoRow('Email', profile.email)}
              ${infoRow('Weight Class', profile.weight_class ? profile.weight_class + ' kg' : null)}
              ${infoRow('Age/Division', profile.division)}
              ${infoRow('Competition', profile.competition)}
              ${infoRow('Start Date', startDate ? startDate.toLocaleDateString('en-US') : null)}
              ${infoRow('Comp Date', compDate ? compDate.toLocaleDateString('en-US') : null)}
              ${infoRow('Weeks Out', weeksOut ?? null)}
              ${infoRow('Payment Start', profile.payment_start ? new Date(profile.payment_start).toLocaleDateString('en-US') : null)}
              ${infoRow('Payment Weeks', paymentWeeks)}
              ${infoRow('Payment Due', paymentDue)}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add PB Modal -->
    <div class="modal-backdrop hidden" id="pb-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Add Personal Best</span>
          <button class="modal-close" id="close-pb-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Lift</label>
            <select class="form-select" id="pb-lift">
              <option value="squat">Squat</option>
              <option value="bench">Bench</option>
              <option value="deadlift">Deadlift</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Load (kg)</label>
              <input type="number" class="form-control" id="pb-load" step="0.5" min="0" placeholder="180">
            </div>
            <div class="form-group">
              <label class="form-label">Reps</label>
              <input type="number" class="form-control" id="pb-reps" min="1" max="20" value="1">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Date Achieved</label>
            <input type="date" class="form-control" id="pb-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <input type="text" class="form-control" id="pb-notes" placeholder="Competition PR…">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancel-pb">Cancel</button>
          <button class="btn btn-primary" id="save-pb">Save PB</button>
        </div>
      </div>
    </div>`;

  // Add PB modal
  const modal = document.getElementById('pb-modal');
  document.getElementById('add-pb-btn').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('close-pb-modal').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('cancel-pb').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('save-pb').addEventListener('click', async () => {
    const lift = document.getElementById('pb-lift').value;
    const load_kg = parseFloat(document.getElementById('pb-load').value);
    if (!load_kg) { toast('Enter a load', 'error'); return; }

    try {
      await athleteAPI.addPb(profile.id, {
        lift,
        load_kg,
        reps: parseInt(document.getElementById('pb-reps').value) || 1,
        achieved_at: document.getElementById('pb-date').value,
        notes: document.getElementById('pb-notes').value
      });
      toast('Personal best added!', 'success');
      modal.classList.add('hidden');
      renderAthleteProfile(app);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Edit profile modal (simplified — just weight class + division)
  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    showEditModal(profile, app);
  });
}

function showEditModal(profile, app) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Profile</span>
        <button class="modal-close" id="close-edit">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Weight Class (kg)</label>
            <input type="number" class="form-control" id="ep-wc" value="${profile.weight_class || ''}" placeholder="83">
          </div>
          <div class="form-group">
            <label class="form-label">Division</label>
            <select class="form-select" id="ep-div">
              <option value="Open" ${profile.division === 'Open' ? 'selected' : ''}>Open</option>
              <option value="Juniors" ${profile.division === 'Juniors' ? 'selected' : ''}>Juniors</option>
              <option value="Sub-Juniors" ${profile.division === 'Sub-Juniors' ? 'selected' : ''}>Sub-Juniors</option>
              <option value="Masters 40+" ${profile.division === 'Masters 40+' ? 'selected' : ''}>Masters 40+</option>
              <option value="Masters 50+" ${profile.division === 'Masters 50+' ? 'selected' : ''}>Masters 50+</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Competition</label>
            <input type="text" class="form-control" id="ep-comp" value="${profile.competition || ''}" placeholder="N/A">
          </div>
          <div class="form-group">
            <label class="form-label">Comp Date</label>
            <input type="date" class="form-control" id="ep-compdate" value="${profile.comp_date || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="ep-startdate" value="${profile.start_date || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Start</label>
            <input type="date" class="form-control" id="ep-paystart" value="${profile.payment_start || ''}">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-edit">Cancel</button>
        <button class="btn btn-primary" id="save-edit">Save</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#close-edit').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#cancel-edit').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#save-edit').addEventListener('click', async () => {
    try {
      await athleteAPI.update(profile.id, {
        weight_class: backdrop.querySelector('#ep-wc').value || null,
        division: backdrop.querySelector('#ep-div').value,
        competition: backdrop.querySelector('#ep-comp').value || null,
        comp_date: backdrop.querySelector('#ep-compdate').value || null,
        start_date: backdrop.querySelector('#ep-startdate').value || null,
        payment_start: backdrop.querySelector('#ep-paystart').value || null
      });
      backdrop.remove();
      toast('Profile updated!', 'success');
      renderAthleteProfile(app);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
