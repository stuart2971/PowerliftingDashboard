export function showHistoryModal(exerciseName, sets) {
  document.getElementById('exercise-history-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'exercise-history-modal';
  modal.className = 'history-modal-overlay';
  modal.innerHTML = renderHistoryModal(exerciseName, sets);
  document.body.appendChild(modal);
  attachHistoryListeners(modal, sets);
}

function renderHistoryModal(exerciseName, sets) {
  const repOptions = [...new Set(sets.map(s => s.reps))].sort((a, b) => a - b);
  const rpeOptions = [...new Set(sets.map(s => s.actual_rpe))].sort((a, b) => a - b);
  return `
    <div class="history-modal">
      <div class="history-modal-header">
        <h2>${exerciseName} — History</h2>
        <button class="history-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="history-filters">
        <select class="history-filter-reps filter-select">
          <option value="">All reps</option>
          ${repOptions.map(r => `<option value="${r}">${r} rep${r !== 1 ? 's' : ''}</option>`).join('')}
        </select>
        <select class="history-filter-rpe filter-select">
          <option value="">All RPE</option>
          ${rpeOptions.map(r => `<option value="${r}">RPE ${r}</option>`).join('')}
        </select>
        <select class="history-filter-type filter-select">
          <option value="">All sets</option>
          <option value="top">Top sets</option>
          <option value="backdown">Backdowns</option>
        </select>
      </div>
      <div class="history-table-wrap">
        ${renderHistoryTable(sets)}
      </div>
    </div>`;
}

function renderHistoryTable(sets) {
  if (!sets.length) {
    return '<div class="history-empty">No logged sets found for this exercise.</div>';
  }
  return `
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Reps</th>
          <th>Load (kg)</th>
          <th>RPE</th>
          <th class="intensity-col">Intensity</th>
        </tr>
      </thead>
      <tbody>
        ${sets.map(s => `
          <tr>
            <td>${formatHistoryDate(s.session_date)}</td>
            <td><span class="set-type-pill ${s.set_type}">${s.set_type === 'top' ? 'Top' : 'BD'}</span></td>
            <td>${s.reps}</td>
            <td>${s.load_kg}</td>
            <td>${s.actual_rpe}</td>
            <td class="intensity-col">${s.intensity_pct != null ? s.intensity_pct + '%' : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function formatHistoryDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function attachHistoryListeners(modal, allSets) {
  modal.querySelector('.history-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  function applyFilters() {
    const reps = modal.querySelector('.history-filter-reps').value;
    const rpe  = modal.querySelector('.history-filter-rpe').value;
    const type = modal.querySelector('.history-filter-type').value;
    let filtered = allSets;
    if (reps) filtered = filtered.filter(s => String(s.reps) === reps);
    if (rpe)  filtered = filtered.filter(s => String(s.actual_rpe) === rpe);
    if (type) filtered = filtered.filter(s => s.set_type === type);
    modal.querySelector('.history-table-wrap').innerHTML = renderHistoryTable(filtered);
  }

  modal.querySelector('.history-filter-reps').addEventListener('change', applyFilters);
  modal.querySelector('.history-filter-rpe').addEventListener('change', applyFilters);
  modal.querySelector('.history-filter-type').addEventListener('change', applyFilters);
}
