function rpePillClass(val) {
  if (val === '' || val == null) return '';
  const n = parseFloat(val) || 0;
  if (n >= 9)   return 'rpe-high';
  if (n >= 7.5) return 'rpe-medium';
  return 'rpe-low';
}

function repsControlHtml(reps, locked) {
  const dis = locked ? 'disabled' : '';
  return `
    <div class="reps-control">
      <button type="button" class="reps-adj-btn reps-minus" aria-label="Decrease reps" ${dis}>−</button>
      <input type="number" class="set-input reps-input" value="${reps || ''}"
        min="1" max="20" placeholder="—" inputmode="numeric" ${dis}>
      <button type="button" class="reps-adj-btn reps-plus" aria-label="Increase reps" ${dis}>+</button>
    </div>`;
}

function loadControlHtml(load, isCalculated, locked) {
  const cls = isCalculated ? 'calculated' : (load ? 'saved' : '');
  const dis = locked ? 'disabled' : '';
  return `
    <div class="load-control">
      <button type="button" class="load-adj-btn load-minus" aria-label="Decrease 2.5kg" ${dis}>−</button>
      <input type="number" class="set-input load-input ${cls}" value="${load ?? ''}"
        step="2.5" min="0" placeholder="—"
        data-calculated="${isCalculated ? (load ?? '') : ''}"
        data-original="${load ?? ''}" ${dis}>
      <button type="button" class="load-adj-btn load-plus" aria-label="Increase 2.5kg" ${dis}>+</button>
    </div>`;
}

function rpeControlHtml(selectedRpe, targetRpe, locked) {
  const val     = selectedRpe != null ? selectedRpe : (targetRpe != null ? targetRpe : '');
  const cls     = selectedRpe != null ? 'saved' : (targetRpe != null ? 'prescribed' : '');
  const dis     = locked ? 'disabled' : '';
  const colorCls = val !== '' ? rpePillClass(val) : '';
  return `
    <div class="rpe-control">
      <button type="button" class="rpe-adj-btn rpe-minus" aria-label="Decrease RPE" ${dis}>−</button>
      <input type="number" class="set-input rpe-input ${cls} ${colorCls}" value="${val}"
        step="0.5" min="5" max="10" placeholder="—" inputmode="decimal" ${dis}>
      <button type="button" class="rpe-adj-btn rpe-plus" aria-label="Increase RPE" ${dis}>+</button>
    </div>`;
}

export function renderSetRow(set, _index, _loadPlaceholder = 'kg') {
  const isTop        = set.set_type === 'top';
  const locked       = set.actual_rpe != null;
  const load         = set.load_kg ?? set.calculated_load_kg ?? '';
  const isCalculated = !set.actual_rpe && set.calculated_load_kg != null && set.load_kg == null;

  return `
    <div class="set-row ${isTop ? 'top-set' : 'backdown'}${locked ? ' logged' : ''}"
         data-set-id="${set.id}" data-set-type="${set.set_type}" data-set-order="${set.set_order}">

      <div class="set-col set-col-reps">
        ${repsControlHtml(set.reps, locked)}
      </div>

      <div class="set-col set-col-load">
        ${loadControlHtml(load || '', isCalculated, locked)}
      </div>

      <div class="set-col set-col-rpe">
        ${rpeControlHtml(set.actual_rpe, set.target_rpe, locked)}
      </div>

      <div class="set-col set-col-action">
        ${locked
          ? `<button class="set-unlog-btn" data-set-id="${set.id}">↩ Unlog</button>`
          : `<button class="set-save-btn" data-set-id="${set.id}">Log</button>`}
      </div>
    </div>`;
}

export function renderSetTableHeader() {
  return `
    <div class="sets-table-head">
      <span>Reps</span>
      <span>Load (kg)</span>
      <span>RPE</span>
      <span>Status</span>
    </div>`;
}

export function attachSetRowListeners(rowEl, onRpeChange) {
  const rpeInput = rowEl.querySelector('.rpe-input');
  if (rpeInput) {
    const updateRpeColor = (val) => {
      rpeInput.classList.remove('rpe-low', 'rpe-medium', 'rpe-high');
      if (val) rpeInput.classList.add(rpePillClass(parseFloat(val)));
    };
    rowEl.querySelector('.rpe-minus')?.addEventListener('click', () => {
      const val = parseFloat(rpeInput.value) || 5;
      rpeInput.value = Math.max(5, Math.round((val - 0.5) * 2) / 2);
      rpeInput.classList.remove('prescribed');
      rpeInput.classList.add('saved');
      updateRpeColor(rpeInput.value);
      rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
    rowEl.querySelector('.rpe-plus')?.addEventListener('click', () => {
      const val = parseFloat(rpeInput.value) || 5;
      rpeInput.value = Math.min(10, Math.round((val + 0.5) * 2) / 2);
      rpeInput.classList.remove('prescribed');
      rpeInput.classList.add('saved');
      updateRpeColor(rpeInput.value);
      rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
    rpeInput.addEventListener('input', () => {
      updateRpeColor(rpeInput.value);
      if (onRpeChange) onRpeChange(parseFloat(rpeInput.value));
    });
  }

  const repsInput = rowEl.querySelector('.reps-input');
  if (repsInput) {
    rowEl.querySelector('.reps-minus')?.addEventListener('click', () => {
      const val = parseInt(repsInput.value) || 1;
      repsInput.value = Math.max(1, val - 1);
      repsInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    rowEl.querySelector('.reps-plus')?.addEventListener('click', () => {
      const val = parseInt(repsInput.value) || 0;
      repsInput.value = Math.min(20, val + 1);
      repsInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const loadInput = rowEl.querySelector('.load-input');
  if (!loadInput) return;
  rowEl.querySelector('.load-minus')?.addEventListener('click', () => {
    const val = parseFloat(loadInput.value) || 0;
    loadInput.value = Math.max(0, val - 2.5);
    loadInput.classList.remove('calculated');
    loadInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  rowEl.querySelector('.load-plus')?.addEventListener('click', () => {
    const val = parseFloat(loadInput.value) || 0;
    loadInput.value = val + 2.5;
    loadInput.classList.remove('calculated');
    loadInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function readSetRowValues(rowEl) {
  return {
    reps:          parseInt(rowEl.querySelector('.reps-input')?.value) || null,
    load_kg:       parseFloat(rowEl.querySelector('.load-input')?.value) || null,
    actual_rpe:    parseFloat(rowEl.querySelector('.rpe-input')?.value) || null,
    athlete_notes: rowEl.querySelector('.set-notes-input')?.value || null
  };
}
