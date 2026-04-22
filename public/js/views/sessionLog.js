import { toast, navigate } from '../app.js';
import { sessionAPI } from '../api.js';
import { renderQuestionnaire, attachQuestionnaireListeners } from '../components/questionnaire.js?v=2';
import { attachSetRowListeners, readSetRowValues } from '../components/setRow.js?v=4';
import { calcE1RM, calcBackdownLoad } from '../rpe.js';
import { showHistoryModal } from '../components/exerciseHistory.js';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  // ── Card navigation state ──────────────────────────────────────
  let currentExIdx = 0;
  // pendingInputs preserves un-saved input values when navigating between exercises
  // shape: { [exId]: { [setId]: { reps, load_kg, actual_rpe } } }
  const pendingInputs = {};

  // ── Predicted load for a set (used to prefill inputs) ─────────
  function calcPrefillLoad(ex, s) {
    if (s.actual_rpe != null) return null; // already logged

    if (s.set_type === 'top') {
      // Top set: use last session's top-set load if available
      return lastLoads[ex.id]?.load_kg ?? null;
    }

    if (s.set_type === 'backdown' && s.reps && s.target_rpe) {
      // Try to calculate from a top set already logged this session
      const loggedTop = ex.sets?.find(ts => ts.set_type === 'top' && ts.actual_rpe != null);
      if (loggedTop?.load_kg && loggedTop?.reps && loggedTop?.actual_rpe) {
        const e1rm = calcE1RM(loggedTop.load_kg, loggedTop.reps, loggedTop.actual_rpe);
        if (e1rm) return calcBackdownLoad(e1rm, s.reps, s.target_rpe);
      }
      // Fall back to history average
      const hist = histories[ex.id];
      if (hist?.length) {
        const loads = hist
          .filter(h => h.set_type === 'top' && h.load_kg && h.reps && h.actual_rpe)
          .slice(0, 5)
          .map(h => {
            const e1rm = calcE1RM(h.load_kg, h.reps, h.actual_rpe);
            return e1rm ? calcBackdownLoad(e1rm, s.reps, s.target_rpe) : null;
          })
          .filter(Boolean);
        if (loads.length) {
          const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
          return Math.round(avg / 2.5) * 2.5; // round to nearest 2.5kg
        }
      }
    }

    return null;
  }

  // ── Progress helpers ───────────────────────────────────────────
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

  // ── Dot nav ────────────────────────────────────────────────────
  function renderDotNav() {
    const nav = document.getElementById('dot-nav');
    if (!nav) return;
    const exercises = session.exercises || [];
    nav.innerHTML = exercises.map((ex, i) => {
      const allLogged  = ex.sets?.length > 0 && ex.sets.every(s => s.actual_rpe != null);
      const someLogged = ex.sets?.some(s => s.actual_rpe != null);
      const isCurrent  = i === currentExIdx;
      const cls = allLogged
        ? 'dot-btn done'
        : someLogged
          ? 'dot-btn partial'
          : isCurrent
            ? 'dot-btn active'
            : 'dot-btn';
      return `<button class="${cls}" data-ex-idx="${i}" aria-label="${ex.exercise_name}"><span class="dot-inner"></span></button>`;
    }).join('');

    nav.querySelectorAll('.dot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        capturePendingInputs();
        showExercise(parseInt(btn.dataset.exIdx));
      });
    });
  }

  // ── Capture unsaved inputs before navigating away ──────────────
  // Only the active set has real inputs — future sets are collapsed headers
  function capturePendingInputs() {
    const mount = document.getElementById('exercise-card-mount');
    if (!mount) return;
    const ex = session.exercises?.[currentExIdx];
    if (!ex) return;

    if (!pendingInputs[ex.id]) pendingInputs[ex.id] = {};
    mount.querySelectorAll('.set-card-block.active').forEach(row => {
      const setId = row.dataset.setId;
      if (!setId) return;
      const { reps, load_kg, actual_rpe, athlete_notes } = readSetRowValues(row);
      pendingInputs[ex.id][setId] = { reps, load_kg, actual_rpe, athlete_notes };
    });
  }

  // ── Show a specific exercise by index ──────────────────────────
  function showExercise(idx) {
    currentExIdx = idx;
    const ex = session.exercises?.[idx];
    if (!ex) return;

    const mount = document.getElementById('exercise-card-mount');
    if (mount) {
      mount.innerHTML = renderExerciseCard(ex);
      attachExerciseCardListeners(ex);
    }
    renderDotNav();
  }

  // ── Render one set as a card block ─────────────────────────────
  // setIdx: 0-based index within the exercise
  // firstUnloggedIdx: index of the first unlogged set (active/expanded)
  function renderSetCardBlock(ex, s, setIdx, firstUnloggedIdx) {
    const isLogged  = s.actual_rpe != null;
    const isActive  = !isLogged && setIdx === firstUnloggedIdx;
    const isFuture  = !isLogged && setIdx > firstUnloggedIdx;
    const typeClass = s.set_type === 'top' ? 'top-set' : 'backdown';
    const typeLabel = s.set_type === 'top' ? 'TOP SET' : 'BACK-OFF';

    const prescriptionStr = [
      s.reps ? `${s.reps} reps` : null,
      s.target_rpe != null ? `@ RPE ${s.target_rpe}` : null,
    ].filter(Boolean).join(' ');

    // ── Logged: dimmed summary row ───────────────────────────────
    if (isLogged) {
      const rpeStr = s.actual_rpe != null ? ` @ RPE ${s.actual_rpe}` : '';
      return `
        <div class="set-card-block logged ${typeClass}" data-set-id="${s.id}">
          <div class="set-card-summary">
            <span class="set-type-label">${typeLabel}</span>
            <span class="set-card-logged-vals">${s.load_kg}kg × ${s.reps}${rpeStr}</span>
            <button class="set-unlog-btn" data-set-id="${s.id}" title="Undo">undo</button>
          </div>
          ${s.athlete_notes ? `<div class="set-logged-note">${escapeHtml(s.athlete_notes)}</div>` : ''}
        </div>`;
    }

    // ── Future: collapsed prescription header ────────────────────
    if (isFuture) {
      return `
        <div class="set-card-block future ${typeClass}" data-set-id="${s.id}">
          <div class="set-future-header">
            <span class="set-type-label">${typeLabel}</span>
            <span class="set-future-prescription">${prescriptionStr}</span>
          </div>
        </div>`;
    }

    // ── Active: full 3-row vertical layout ───────────────────────
    const saved     = pendingInputs[ex.id]?.[s.id] || {};
    const repsVal   = saved.reps         ?? s.reps        ?? '';
    const prefill   = calcPrefillLoad(ex, s);
    const loadVal   = saved.load_kg      ?? prefill        ?? '';
    const rpeVal    = saved.actual_rpe   ?? s.target_rpe  ?? '';
    const notesVal  = saved.athlete_notes ?? s.athlete_notes ?? '';

    return `
      <div class="set-card-block active ${typeClass}" data-set-id="${s.id}">
        <div class="set-card-header">
          <span class="set-type-label active">${typeLabel}</span>
          ${prescriptionStr ? `<span class="set-card-target">${prescriptionStr}</span>` : ''}
        </div>

        <div class="set-card-input-row">
          <span class="set-card-label">REPS</span>
          <div class="set-card-adjrow">
            <button class="adj-btn reps-minus" type="button">−</button>
            <input class="set-input reps-input" type="number" value="${repsVal}" min="1" max="30">
            <button class="adj-btn reps-plus" type="button">+</button>
          </div>
        </div>

        <div class="set-card-input-row">
          <span class="set-card-label">LOAD (kg)</span>
          <div class="set-card-adjrow">
            <button class="adj-btn load-minus" type="button">−</button>
            <input class="set-input load-input ${loadVal ? 'prefilled' : ''}" type="number" value="${loadVal}" step="2.5" min="0">
            <button class="adj-btn load-plus" type="button">+</button>
          </div>
        </div>

        <div class="set-card-input-row">
          <span class="set-card-label">RPE</span>
          <div class="set-card-adjrow">
            <button class="adj-btn rpe-minus" type="button">−</button>
            <input class="set-input rpe-input" type="number" value="${rpeVal}" step="0.5" min="0" max="10">
            <button class="adj-btn rpe-plus" type="button">+</button>
          </div>
        </div>

        <div class="set-card-notes-row">
          <textarea class="set-notes-input" placeholder="Notes (optional)" rows="2">${notesVal ? notesVal : ''}</textarea>
        </div>

        <button class="btn btn-primary btn-lg btn-block set-save-btn" type="button" data-set-id="${s.id}">Log Set</button>
      </div>`;
  }

  // ── Transition bar shown when all sets of current exercise are done ──
  function renderTransitionBar() {
    const nextEx = session.exercises?.[currentExIdx + 1];
    if (nextEx) {
      return `
        <div class="exercise-transition">
          <div class="exercise-transition-label">Exercise complete ✓</div>
          <button class="btn btn-primary btn-lg btn-block transition-next-btn">
            Next: ${nextEx.exercise_name} →
          </button>
        </div>`;
    }
    return `
      <div class="exercise-transition">
        <div class="exercise-transition-label">All exercises done!</div>
        <button class="btn btn-primary btn-lg btn-block" id="finish-early-btn">✓ Finish Session</button>
      </div>`;
  }

  // ── Render one full exercise as a card ─────────────────────────
  function renderExerciseCard(ex) {
    const allLogged        = ex.sets?.length > 0 && ex.sets.every(s => s.actual_rpe != null);
    const firstUnloggedIdx = ex.sets?.findIndex(s => s.actual_rpe == null) ?? -1;
    const hint             = lastLoads[ex.id];

    const exCount   = session.exercises?.length || 1;
    const exNumText = `${currentExIdx + 1} of ${exCount}`;

    return `
      <div class="exercise-card" id="ex-${ex.id}">
        <div class="exercise-card-top">
          <div class="exercise-card-meta">${exNumText}</div>
          <div class="exercise-card-name">${ex.exercise_name}</div>
          <div class="exercise-card-menu-wrap">
            <button class="exercise-card-menu-btn" type="button" aria-label="Exercise options">⋮</button>
            <div class="exercise-card-menu-dropdown" id="menu-${ex.id}" style="display:none">
              <button class="menu-item exercise-history-btn" data-ex-id="${ex.id}">📋 History</button>
              ${hint ? `<button class="menu-item last-load-fill-btn" data-ex-id="${ex.id}" data-load="${hint.load_kg}" data-rpe="${hint.actual_rpe ?? ''}">⟳ Copy last session</button>` : ''}
            </div>
          </div>
        </div>

        <div class="exercise-card-sets">
          ${ex.sets?.map((s, i) => renderSetCardBlock(ex, s, i, firstUnloggedIdx)).join('')
            || '<div class="set-card-empty">No sets prescribed</div>'}
        </div>

        ${allLogged ? renderTransitionBar() : ''}
      </div>`;
  }

  // ── Backdown load preview (top set only) ───────────────────────
  function updateBackdownPreviews(ex, cardEl) {
    // The active top set has class .active.top-set
    const topBlock = cardEl.querySelector('.set-card-block.active.top-set');
    if (!topBlock) return;
    const load = parseFloat(topBlock.querySelector('.load-input')?.value);
    const rpe  = parseFloat(topBlock.querySelector('.rpe-input')?.value);
    const reps = parseInt(topBlock.querySelector('.reps-input')?.value);
    if (!load || !rpe || !reps) return;

    const e1rm = calcE1RM(load, reps, rpe);
    if (!e1rm) return;

    // Update the active backdown set's load input if it's visible
    cardEl.querySelectorAll('.set-card-block.active.backdown').forEach(block => {
      const setId  = block.dataset.setId;
      const dbSet  = ex.sets.find(s => String(s.id) === setId);
      if (!dbSet?.target_rpe) return;
      const newLoad = calcBackdownLoad(e1rm, dbSet.reps, dbSet.target_rpe);
      const loadEl  = block.querySelector('.load-input');
      if (loadEl && !dbSet.actual_rpe) {
        loadEl.value = newLoad;
        loadEl.classList.add('calculated');
      }
    });
  }

  // ── Attach listeners to the current exercise card ──────────────
  function attachExerciseCardListeners(ex) {
    const cardEl = document.getElementById(`ex-${ex.id}`);
    if (!cardEl) return;

    // ⋮ menu toggle — open on button click, close on click-outside
    const menuBtn = cardEl.querySelector('.exercise-card-menu-btn');
    const menuDrop = document.getElementById(`menu-${ex.id}`);
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menuDrop.style.display !== 'none';
      if (!isVisible) {
        menuDrop.style.display = 'block';
        // Register a one-shot outside-click handler after this event finishes
        setTimeout(() => {
          document.addEventListener('click', function closeMenu() {
            menuDrop.style.display = 'none';
            document.removeEventListener('click', closeMenu);
          });
        }, 0);
      } else {
        menuDrop.style.display = 'none';
      }
    });

    // History
    cardEl.querySelector('.exercise-history-btn')?.addEventListener('click', () => {
      if (menuDrop) menuDrop.style.display = 'none';
      showHistoryModal(ex.exercise_name, histories[ex.id] || []);
    });

    // Copy last session
    cardEl.querySelector('.last-load-fill-btn')?.addEventListener('click', (e) => {
      if (menuDrop) menuDrop.style.display = 'none';
      const btn  = e.currentTarget;
      const load = parseFloat(btn.dataset.load);
      const rpe  = parseFloat(btn.dataset.rpe);
      const topBlock = cardEl.querySelector('.set-card-block.active.top-set');
      if (!topBlock) return;
      const loadInput = topBlock.querySelector('.load-input');
      if (loadInput) {
        loadInput.value = load;
        loadInput.classList.add('saved');
        loadInput.classList.remove('calculated');
      }
      if (rpe && !isNaN(rpe)) {
        const rpeInput = topBlock.querySelector('.rpe-input');
        if (rpeInput) {
          rpeInput.value = rpe;
          rpeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      updateBackdownPreviews(ex, cardEl);
      toast('Last session values filled', 'info');
    });

    // ± buttons and live backdown preview on unlogged blocks
    cardEl.querySelectorAll('.set-card-block:not(.logged)').forEach(block => {
      attachSetRowListeners(block, () => {
        if (block.classList.contains('top-set')) {
          updateBackdownPreviews(ex, cardEl);
        }
      });

      // Watch top set inputs for live backdown preview
      if (block.classList.contains('top-set')) {
        block.querySelector('.load-input')?.addEventListener('input', () => updateBackdownPreviews(ex, cardEl));
        block.querySelector('.reps-input')?.addEventListener('input', () => updateBackdownPreviews(ex, cardEl));
      }

      // Enter key submits (but not from the notes textarea)
      block.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveSet(ex, block.dataset.setId, cardEl);
          }
        });
      });
    });

    // Log Set buttons
    cardEl.querySelectorAll('.set-save-btn').forEach(btn => {
      btn.addEventListener('click', () => saveSet(ex, btn.dataset.setId, cardEl));
    });

    // Unlog buttons
    cardEl.querySelectorAll('.set-unlog-btn').forEach(btn => {
      btn.addEventListener('click', () => unlogSet(ex, btn.dataset.setId, cardEl));
    });

    // Transition: next exercise button
    cardEl.querySelector('.transition-next-btn')?.addEventListener('click', () => {
      capturePendingInputs();
      showExercise(currentExIdx + 1);
    });

    // Transition: finish from last exercise (all sets complete — safe to mark done)
    cardEl.querySelector('#finish-early-btn')?.addEventListener('click', async () => {
      try {
        await sessionAPI.complete(sessionId);
        toast('Session complete!', 'success');
        navigate('/dashboard');
      } catch (err) {
        console.error('Failed to mark session complete:', err);
        toast('Could not save session completion — please try again', 'error');
      }
    });
  }

  // ── Auto-advance within current exercise ───────────────────────
  function autoAdvance() {
    const ex = session.exercises?.[currentExIdx];
    if (!ex) return;
    const cardEl = document.getElementById(`ex-${ex.id}`);
    if (!cardEl) return;

    for (const s of (ex.sets || [])) {
      if (s.actual_rpe != null) continue;
      const block = cardEl.querySelector(`[data-set-id="${s.id}"]`);
      if (!block || block.classList.contains('logged')) continue;
      setTimeout(() => {
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        block.querySelector('.reps-input, .load-input')?.focus();
      }, 150);
      return;
    }
    // All sets done — scroll transition bar into view
    setTimeout(() => {
      cardEl.querySelector('.exercise-transition')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  // ── Unlog a set ────────────────────────────────────────────────
  async function unlogSet(ex, setId, cardEl) {
    try {
      const updatedEx = await sessionAPI.unlogSet(setId);
      const exIdx = session.exercises.findIndex(e => e.id === ex.id);
      if (exIdx >= 0) session.exercises[exIdx] = updatedEx;

      showExercise(currentExIdx);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
      toast('Set unlogged — edit and re-log', 'info');
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Save a set ─────────────────────────────────────────────────
  async function saveSet(ex, setId, cardEl) {
    const block = cardEl.querySelector(`[data-set-id="${setId}"]`);
    if (!block) return;

    const dbSet = ex.sets.find(s => String(s.id) === setId);
    const { reps, load_kg, actual_rpe, athlete_notes } = readSetRowValues(block);

    if (!reps || !load_kg) {
      toast('Enter reps and load before saving', 'error');
      return;
    }

    // Optimistic UI: lock the block immediately
    block.classList.add('logged');
    block.querySelectorAll('input').forEach(inp => { inp.disabled = true; });
    const saveBtn = block.querySelector('.set-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    // Backdown load preview using client-side e1rm
    if (dbSet.set_type === 'top' && actual_rpe) {
      const e1rm = calcE1RM(load_kg, reps, actual_rpe);
      if (e1rm) {
        cardEl.querySelectorAll('.set-card-block.backdown:not(.logged)').forEach(bdBlock => {
          const bdSet = ex.sets.find(s => String(s.id) === bdBlock.dataset.setId);
          if (!bdSet?.target_rpe || bdSet.actual_rpe != null) return;
          const calcLoad = calcBackdownLoad(e1rm, bdSet.reps, bdSet.target_rpe);
          const loadEl = bdBlock.querySelector('.load-input');
          if (loadEl) { loadEl.value = calcLoad; loadEl.classList.add('calculated'); }
        });
      }
    }

    // Update last-load cache optimistically
    if (dbSet.set_type === 'top' && load_kg) {
      lastLoads[ex.id] = { load_kg, actual_rpe, session_date: session.session_date };
    }

    // Optimistic progress bar
    const prevRpe = dbSet.actual_rpe;
    if (prevRpe == null) dbSet.actual_rpe = actual_rpe ?? 0;
    document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
    if (prevRpe == null) dbSet.actual_rpe = null;

    try {
      const updatedEx = await sessionAPI.logSet(ex.id, {
        set_id:         dbSet.id,
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

      // Re-render card with server-confirmed data
      showExercise(currentExIdx);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
      autoAdvance();

    } catch (err) {
      toast(err.message, 'error');
      // Rollback: re-render from original state
      showExercise(currentExIdx);
      document.getElementById('session-progress-mount').innerHTML = renderProgressBar();
    }
  }

  // ── Page skeleton ──────────────────────────────────────────────
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

        <!-- Questionnaire: collapsed by default -->
        <div class="session-questionnaire-wrap">
          <button class="collapse-toggle questionnaire-toggle" type="button">
            Session Questionnaire <span class="collapse-arrow">▾</span>
          </button>
          <div class="collapse-content questionnaire-content" id="questionnaire-content">
            ${renderQuestionnaire(session)}
          </div>
        </div>

        <!-- One exercise at a time -->
        <div id="exercise-card-mount">
          ${session.exercises?.length
            ? ''
            : '<div class="empty-state"><div class="empty-state-text">No exercises in this session</div></div>'
          }
        </div>

        <!-- Dot nav -->
        <div class="dot-nav" id="dot-nav"></div>

        <div style="margin-top:24px">
          <button class="btn btn-secondary btn-lg btn-block" id="finish-btn">✓ Finish Session</button>
        </div>
      </div>`;

    // Questionnaire collapse
    const qToggle  = app.querySelector('.questionnaire-toggle');
    const qContent = document.getElementById('questionnaire-content');
    qToggle?.addEventListener('click', () => {
      const isOpen = qContent.classList.toggle('open');
      const arrow = qToggle.querySelector('.collapse-arrow');
      if (arrow) arrow.textContent = isOpen ? '▴' : '▾';
    });

    attachQuestionnaireListeners(app, async (data) => {
      try { session = await sessionAPI.update(sessionId, data); } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('finish-btn').addEventListener('click', async () => {
      try {
        await sessionAPI.complete(sessionId);
        toast('Session complete!', 'success');
        navigate('/dashboard');
      } catch (err) {
        console.error('Failed to mark session complete:', err);
        toast('Could not save session completion — please try again', 'error');
      }
    });

    if (session.exercises?.length) {
      renderDotNav();
      showExercise(0);
    }
  }

  renderPage();
}
