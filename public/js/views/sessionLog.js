import { toast, navigate } from '../app.js';
import { sessionAPI } from '../api.js';
import { renderQuestionnaire, attachQuestionnaireListeners } from '../components/questionnaire.js';
import { renderSetRow, renderSetTableHeader, attachSetRowListeners, readSetRowValues } from '../components/setRow.js';
import { calcE1RM, calcBackdownLoad, calcIntensityPct } from '../rpe.js';
import { showHistoryModal } from '../components/exerciseHistory.js';

export async function renderSessionLog(app, sessionId) {
  let session = await sessionAPI.get(sessionId);

  // Fetch last-load hints and exercise history for each exercise (in parallel)
  const lastLoads = {};
  const histories = {};
  await Promise.all(
    (session.exercises || []).map(async ex => {
      try {
        const [lastLoad, history] = await Promise.all([
          sessionAPI.lastLoad(ex.exercise_name),
          sessionAPI.exerciseHistory(ex.exercise_name)
        ]);
        if (lastLoad) lastLoads[ex.id] = lastLoad;
        if (history?.length) histories[ex.id] = history;
      } catch { /* non-critical */ }
    })
  );

  function totalSets() {
    return session.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
  }

  function loggedSets() {
    return session.exercises?.reduce((sum, ex) =>
      sum + (ex.sets?.filter(s => s.actual_rpe != null).length || 0), 0) || 0;
  }

  function renderProgressBar() {
    const total  = totalSets();
    const logged = loggedSets();
    const pct    = total > 0 ? Math.round((logged / total) * 100) : 0;
    return `
      <div class="session-progress">
        <div class="session-progress-text">
          <span class="session-progress-count">${logged} / ${total}</span>
          <span class="session-progress-label"> sets logged</span>
        </div>
        <div class="session-progress-bar">
          <div class="session-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  function renderPage() {
    app.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Session Log</h1>
            <div class="page-subtitle">${session.session_date}</div>
          </div>
          <button class="btn btn-secondary" onclick="history.back()">← Back</button>
        </div>

        <div id="session-progress-mount">${renderProgressBar()}</div>

        ${renderQuestionnaire(session)}

        <div id="exercises-container">
          ${session.exercises?.length
            ? session.exercises.map(ex => renderExerciseBlock(ex)).join('')
            : '<div class="empty-state"><div class="empty-state-text">No exercises in this session</div></div>'
          }
        </div>

        <div style="margin-top:24px;display:flex;gap:12px;justify-content:flex-end">
          <button class="btn btn-primary btn-lg" id="finish-btn">✓ Finish Session</button>
        </div>
      </div>`;

    attachQuestionnaireListeners(app, async (data) => {
      try { session = await sessionAPI.update(sessionId, data); } catch (err) { toast(err.message, 'error'); }
    });

    attachAllExerciseListeners();

    document.getElementById('finish-btn').addEventListener('click', () => {
      toast('Session saved!', 'success');
      navigate('/dashboard');
    });
  }

  function calcLoadRange(history, prescribedReps, targetRpe) {
    if (!prescribedReps || !targetRpe || !history?.length) return 'kg';
    const topSets = history.filter(s => s.set_type === 'top').slice(0, 5);
    if (!topSets.length) return 'kg';
    const loads = topSets
      .map(s => {
        const e1rm = calcE1RM(s.load_kg, s.reps, s.actual_rpe);
        return e1rm ? calcBackdownLoad(e1rm, prescribedReps, targetRpe) : null;
      })
      .filter(Boolean);
    if (!loads.length) return 'kg';
    const lo = Math.min(...loads);
    const hi = Math.max(...loads);
    return lo === hi ? `${lo} kg` : `${lo}–${hi} kg`;
  }

  function renderExerciseBlock(ex) {
    const hint = lastLoads[ex.id];
    let backdownIdx = 0;
    return `
      <div class="exercise-block" id="ex-${ex.id}">
        <div class="exercise-header">
          <div class="exercise-name">${ex.exercise_name}</div>
          <button class="exercise-history-btn btn btn-sm" data-ex-id="${ex.id}">📋 History</button>
          ${hint ? `
            <div class="last-load-hint" data-ex-id="${ex.id}" data-load="${hint.load_kg}" data-rpe="${hint.actual_rpe ?? ''}">
              <span class="last-load-text">Last: ${hint.load_kg}kg${hint.actual_rpe ? ' @ RPE ' + hint.actual_rpe : ''}</span>
              <span class="last-load-date">${formatDate(hint.session_date)}</span>
              <button class="last-load-fill-btn btn btn-sm" type="button">Use ↵</button>
            </div>` : ''}
        </div>
        <div class="sets-table">
          ${renderSetTableHeader()}
          ${ex.sets?.map(s => {
            if (s.set_type === 'backdown') backdownIdx++;
            const ph = (!s.actual_rpe && s.set_type === 'top')
              ? calcLoadRange(histories[ex.id], s.reps, s.target_rpe)
              : 'kg';
            return renderSetRow(s, backdownIdx, ph);
          }).join('') || ''}
        </div>
      </div>`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function attachAllExerciseListeners() {
    session.exercises?.forEach(ex => attachExerciseListeners(ex));
  }

  function attachExerciseListeners(ex) {
    const exEl = document.getElementById(`ex-${ex.id}`);
    if (!exEl) return;

    // History button
    exEl.querySelector('.exercise-history-btn')?.addEventListener('click', () => {
      showHistoryModal(ex.exercise_name, histories[ex.id] || []);
    });

    // Last-load fill button
    const hintEl = exEl.querySelector('.last-load-hint');
    hintEl?.querySelector('.last-load-fill-btn')?.addEventListener('click', () => {
      const load = parseFloat(hintEl.dataset.load);
      const rpe  = parseFloat(hintEl.dataset.rpe);
      const topRow = exEl.querySelector('.set-row.top-set');
      if (!topRow || topRow.classList.contains('logged')) return;
      const loadInput = topRow.querySelector('.load-input');
      if (loadInput) {
        loadInput.value = load;
        loadInput.classList.remove('calculated');
        loadInput.classList.add('saved');
      }
      if (rpe && !isNaN(rpe)) {
        const rpeInput = topRow.querySelector('.rpe-input');
        if (rpeInput) {
          rpeInput.value = rpe;
          rpeInput.classList.remove('prescribed');
          rpeInput.classList.add('saved');
          rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      updateBackdownPreviews(ex, exEl);
      toast('Last session values filled', 'info');
    });

    // Attach RPE ± buttons to unlocked rows only
    exEl.querySelectorAll('.set-row:not(.logged)').forEach(rowEl => {
      attachSetRowListeners(rowEl, () => {
        if (rowEl.classList.contains('top-set')) {
          updateBackdownPreviews(ex, exEl);
        }
      });
    });

    // Watch top set load/reps changes for live backdown preview
    const topRow = exEl.querySelector('.set-row.top-set:not(.logged)');
    if (topRow) {
      const loadInput = topRow.querySelector('.load-input');
      const repsInput = topRow.querySelector('.reps-input');
      loadInput?.addEventListener('input', () => updateBackdownPreviews(ex, exEl));
      repsInput?.addEventListener('input', () => updateBackdownPreviews(ex, exEl));
    }

    // Save button handlers (unlocked rows only)
    exEl.querySelectorAll('.set-save-btn').forEach(btn => {
      btn.addEventListener('click', () => saveSet(ex, btn.dataset.setId, exEl));
    });

    // Unlog button handlers
    exEl.querySelectorAll('.set-unlog-btn').forEach(btn => {
      btn.addEventListener('click', () => unlogSet(ex, btn.dataset.setId, exEl));
    });

    // Enter key on unlocked inputs saves the set
    exEl.querySelectorAll('.set-row:not(.logged)').forEach(row => {
      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveSet(ex, row.dataset.setId, exEl);
          }
        });
      });
    });
  }

  function updateBackdownPreviews(ex, exEl) {
    const topRow = exEl.querySelector('.set-row.top-set');
    if (!topRow) return;
    const load = parseFloat(topRow.querySelector('.load-input')?.value);
    const rpe  = parseFloat(topRow.querySelector('.rpe-input')?.value);
    const reps = parseInt(topRow.querySelector('.reps-input')?.value);
    if (!load || !rpe || !reps) return;

    const e1rm = calcE1RM(load, reps, rpe);
    if (!e1rm) return;

    exEl.querySelectorAll('.set-row.backdown').forEach(row => {
      const setId  = row.dataset.setId;
      const dbSet  = ex.sets.find(s => String(s.id) === setId);
      if (!dbSet?.target_rpe) return;
      const newLoad = calcBackdownLoad(e1rm, dbSet.reps, dbSet.target_rpe);
      const loadEl  = row.querySelector('.load-input');
      if (loadEl && !dbSet.actual_rpe) {
        loadEl.value = newLoad;
        loadEl.className = 'set-input load-input calculated';
      }
    });
  }

  async function unlogSet(ex, setId, exEl) {
    // Capture RPE the user had typed before re-render resets it to prescription
    const prevRpe = exEl.querySelector(`[data-set-id="${setId}"] .rpe-input`)?.value;
    try {
      const updatedEx = await sessionAPI.unlogSet(setId);
      const exIdx = session.exercises.findIndex(e => e.id === ex.id);
      if (exIdx >= 0) session.exercises[exIdx] = updatedEx;
      const newDiv = document.createElement('div');
      newDiv.innerHTML = renderExerciseBlock(updatedEx);
      exEl.replaceWith(newDiv.firstElementChild);
      // Restore the RPE value the user had entered
      if (prevRpe) {
        const newExEl = document.getElementById(`ex-${updatedEx.id}`);
        const rpeInput = newExEl?.querySelector(`[data-set-id="${setId}"] .rpe-input`);
        if (rpeInput) rpeInput.value = prevRpe;
      }
      attachExerciseListeners(updatedEx);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
      toast('Set unlogged — edit and re-log', 'info');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function saveSet(ex, setId, exEl) {
    const row = exEl.querySelector(`[data-set-id="${setId}"]`);
    if (!row) return;

    const dbSet = ex.sets.find(s => String(s.id) === setId);
    const { reps, load_kg, actual_rpe, athlete_notes } = readSetRowValues(row);

    if (!reps || !load_kg) {
      toast('Enter reps and load before saving', 'error');
      return;
    }

    // ── Optimistic UI: lock the row immediately ──────────────────
    row.classList.add('logged');
    row.querySelectorAll('input').forEach(inp => { inp.disabled = true; });
    row.querySelectorAll('.rpe-adj-btn, .load-adj-btn').forEach(b => { b.disabled = true; });
    const actionCol = row.querySelector('.set-col-action');
    if (actionCol) actionCol.innerHTML =
      `<button class="set-unlog-btn" data-set-id="${setId}" disabled>✓</button>`;

    // Calculate backdown loads client-side right away (top set only)
    if (dbSet.set_type === 'top' && actual_rpe) {
      const e1rm = calcE1RM(load_kg, reps, actual_rpe);
      if (e1rm) {
        exEl.querySelectorAll('.set-row.backdown:not(.logged)').forEach(bdRow => {
          const bdSet = ex.sets.find(s => String(s.id) === bdRow.dataset.setId);
          if (!bdSet?.target_rpe || bdSet.actual_rpe != null) return;
          const calcLoad = calcBackdownLoad(e1rm, bdSet.reps, bdSet.target_rpe);
          const loadEl = bdRow.querySelector('.load-input');
          if (loadEl) { loadEl.value = calcLoad; loadEl.className = 'set-input load-input calculated'; }
        });
      }
    }

    // Update last-load cache optimistically
    if (dbSet.set_type === 'top' && load_kg) {
      lastLoads[ex.id] = { load_kg, actual_rpe, session_date: session.session_date };
    }

    // Update progress bar optimistically
    const prevRpe = dbSet.actual_rpe;
    if (prevRpe == null) dbSet.actual_rpe = actual_rpe ?? 0;
    document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
    if (prevRpe == null) dbSet.actual_rpe = null;

    // Advance to next set immediately — don't wait for server
    autoAdvance(ex.id, setId);

    try {
      const updatedEx = await sessionAPI.logSet(ex.id, {
        set_type:       dbSet.set_type,
        reps,
        load_kg,
        actual_rpe,
        athlete_notes,
        program_set_id: dbSet.program_set_id,
        set_order:      dbSet.set_order,
        target_rpe:     dbSet.target_rpe
      });

      const exIdx = session.exercises.findIndex(e => e.id === ex.id);
      if (exIdx >= 0) session.exercises[exIdx] = updatedEx;

      // Re-render with server-confirmed data (backdown loads etc.)
      const newDiv = document.createElement('div');
      newDiv.innerHTML = renderExerciseBlock(updatedEx);
      exEl.replaceWith(newDiv.firstElementChild);
      attachExerciseListeners(updatedEx);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();

    } catch (err) {
      toast(err.message, 'error');
      // Rollback: re-render from original session state
      const newDiv = document.createElement('div');
      newDiv.innerHTML = renderExerciseBlock(ex);
      exEl.replaceWith(newDiv.firstElementChild);
      attachExerciseListeners(ex);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
    }
  }

  function autoAdvance(savedExId, savedSetId) {
    // Find next set that has no actual_rpe logged and isn't optimistically locked
    for (const ex of session.exercises) {
      const exEl = document.getElementById(`ex-${ex.id}`);
      if (!exEl) continue;
      for (const s of (ex.sets || [])) {
        if (s.actual_rpe != null) continue;  // confirmed-logged by server
        const row = exEl.querySelector(`[data-set-id="${s.id}"]`);
        if (!row || row.classList.contains('logged')) continue;  // optimistically locked
        // Found next unlogged set — scroll to it and focus load input
        setTimeout(() => {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstInput = row.querySelector('.load-input, .reps-input');
          firstInput?.focus();
          row.classList.add('highlight-next');
          setTimeout(() => row.classList.remove('highlight-next'), 1500);
        }, 200);
        return;
      }
    }
  }

  renderPage();
}
