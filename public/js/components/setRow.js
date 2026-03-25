function rpeControlHtml(selectedRpe, targetRpe, locked) {
  const val = selectedRpe != null ? selectedRpe : (targetRpe != null ? targetRpe : '');
  const cls = selectedRpe != null ? 'saved' : (targetRpe != null ? 'prescribed' : '');
  const dis = locked ? 'disabled' : '';
  return `
    <div class="rpe-control">
      <button type="button" class="rpe-adj-btn rpe-minus" aria-label="Decrease 0.5 RPE" ${dis}>−</button>
      <input type="number" class="set-input rpe-input ${cls}" value="${val}"
        step="0.5" min="5" max="10" placeholder="RPE" inputmode="decimal" ${dis}>
      <button type="button" class="rpe-adj-btn rpe-plus" aria-label="Increase 0.5 RPE" ${dis}>+</button>
    </div>`;
}

function loadControlHtml(load, isCalculated, locked, placeholder = 'kg') {
  const cls = isCalculated ? 'calculated' : (load ? 'saved' : '');
  const dis = locked ? 'disabled' : '';
  return `
    <div class="load-control">
      <button type="button" class="load-adj-btn load-minus" aria-label="Decrease 2.5kg" ${dis}>−</button>
      <input type="number" class="set-input load-input ${cls}" value="${load ?? ''}"
        step="2.5" min="0" placeholder="${placeholder}"
        data-calculated="${isCalculated ? (load ?? '') : ''}"
        data-original="${load ?? ''}" ${dis}>
      <button type="button" class="load-adj-btn load-plus" aria-label="Increase 2.5kg" ${dis}>+</button>
    </div>`;
}

export function renderSetRow(set, index, loadPlaceholder = 'kg') {
  const isTop = set.set_type === 'top';
  const locked = set.actual_rpe != null;
  const load = set.load_kg ?? set.calculated_load_kg ?? '';
  const isCalculated = !set.actual_rpe && set.calculated_load_kg != null && set.load_kg == null;
  const dis = locked ? 'disabled' : '';

  return `
    <div class="set-row ${isTop ? 'top-set' : 'backdown'}${locked ? ' logged' : ''}" data-set-id="${set.id}" data-set-type="${set.set_type}" data-set-order="${set.set_order}">
      <div class="set-col-type">
        <span class="set-type-label ${isTop ? 'top' : 'backdown'}">
          ${isTop ? 'Top' : `BD ${index}`}
        </span>
        <div class="set-reps-wrap">
          <input type="number" class="set-input reps-input" value="${set.reps || ''}" min="1" max="20" placeholder="—" inputmode="numeric" ${dis}>
          <span class="set-reps-label">reps</span>
        </div>
      </div>

      <div class="set-col-load">
        ${loadControlHtml(load || '', isCalculated, locked, loadPlaceholder)}
        ${set.intensity_pct ? `<div class="set-intensity">${set.intensity_pct}%</div>` : '<div class="set-intensity"></div>'}
      </div>

      <div class="set-col-rpe">
        ${rpeControlHtml(set.actual_rpe, set.target_rpe, locked)}
        ${set.target_rpe ? `<div class="set-target-rpe">Prescribed: @${set.target_rpe}</div>` : ''}
      </div>

      <div class="set-col-notes">
        <input type="text" class="set-notes-input" placeholder="Notes…" value="${set.athlete_notes || ''}" ${dis}>
        ${set.coach_notes ? `<div class="coach-note-text">📋 ${set.coach_notes}</div>` : ''}
      </div>

      <div class="set-col-action">
        ${locked
          ? `<button class="set-unlog-btn" data-set-id="${set.id}">↩ Unlog</button>`
          : `<button class="set-save-btn" data-set-id="${set.id}">Log</button>`}
      </div>
    </div>`;
}

export function renderSetTableHeader() {
  return `
    <div class="sets-table-head">
      <span>Set / Reps</span>
      <span>Load</span>
      <span>RPE</span>
      <span>Notes</span>
      <span></span>
    </div>`;
}

// Attach RPE control + load ±2.5 event listeners to a set row element
export function attachSetRowListeners(rowEl, onRpeChange) {
  // RPE ± buttons
  const rpeInput = rowEl.querySelector('.rpe-input');
  if (rpeInput) {
    rowEl.querySelector('.rpe-minus')?.addEventListener('click', () => {
      const val = parseFloat(rpeInput.value) || 5;
      rpeInput.value = Math.max(5, Math.round((val - 0.5) * 2) / 2);
      rpeInput.classList.remove('prescribed');
      rpeInput.classList.add('saved');
      rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
    rowEl.querySelector('.rpe-plus')?.addEventListener('click', () => {
      const val = parseFloat(rpeInput.value) || 5;
      rpeInput.value = Math.min(10, Math.round((val + 0.5) * 2) / 2);
      rpeInput.classList.remove('prescribed');
      rpeInput.classList.add('saved');
      rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
    rpeInput.addEventListener('input', () => {
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
  }

  // Load ± buttons
  const loadInput = rowEl.querySelector('.load-input');
  rowEl.querySelector('.load-minus')?.addEventListener('click', () => {
    const val = parseFloat(loadInput.value) || 0;
    loadInput.value = Math.max(0, val - 2.5);
    loadInput.classList.remove('calculated');
    loadInput.classList.add('saved');
    loadInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  rowEl.querySelector('.load-plus')?.addEventListener('click', () => {
    const val = parseFloat(loadInput.value) || 0;
    loadInput.value = val + 2.5;
    loadInput.classList.remove('calculated');
    loadInput.classList.add('saved');
    loadInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Read current values from a set row element
export function readSetRowValues(rowEl) {
  return {
    reps:          parseInt(rowEl.querySelector('.reps-input')?.value) || null,
    load_kg:       parseFloat(rowEl.querySelector('.load-input')?.value) || null,
    actual_rpe:    parseFloat(rowEl.querySelector('.rpe-input')?.value) || null,
    athlete_notes: rowEl.querySelector('.set-notes-input')?.value || null
  };
}
