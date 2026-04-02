import { toast, navigate } from '../app.js';
import { programAPI, athleteAPI } from '../api.js';

const EXERCISE_TEMPLATES = [
  'Competition Squat',
  'Competition Bench Press',
  'Competition Deadlift',
  'Pause Squat',
  'Pause Bench Press',
  'Romanian Deadlift',
  'Overhead Press',
  'Close Grip Bench',
  'Sumo Deadlift',
  'Box Squat'
];

const MAIN_LIFT_RE = /squat|bench|deadlift|press/i;
const BIG3 = ['Competition Squat', 'Competition Bench Press', 'Competition Deadlift'];

// Parse shorthand like "top 2 @ 8 + 3x5 @ 7.5"
function parseShorthand(text) {
  if (!text?.trim()) return null;
  const sets = [];
  const parts = text.split('+').map(s => s.trim());
  for (const part of parts) {
    const topMatch = part.match(/^top\s*(\d+)(?:\s*@\s*([\d.]+))?$/i);
    if (topMatch) {
      sets.push({ set_type: 'top', reps: parseInt(topMatch[1]), target_rpe: topMatch[2] ? parseFloat(topMatch[2]) : null });
      continue;
    }
    const bdMatch = part.match(/^(\d+)\s*x\s*(\d+)(?:\s*@\s*([\d.]+))?$/i);
    if (bdMatch) {
      const count = parseInt(bdMatch[1]);
      for (let i = 0; i < count; i++) {
        sets.push({ set_type: 'backdown', reps: parseInt(bdMatch[2]), target_rpe: bdMatch[3] ? parseFloat(bdMatch[3]) : null });
      }
      continue;
    }
    const singleMatch = part.match(/^(\d+)\s*@\s*([\d.]+)$/i);
    if (singleMatch) {
      sets.push({ set_type: 'backdown', reps: parseInt(singleMatch[1]), target_rpe: parseFloat(singleMatch[2]) });
    }
  }
  return sets.length ? sets : null;
}

export async function renderProgramBuilder(app, programId) {
  let program = await programAPI.getFull(programId);
  const athletes = await athleteAPI.list();
  const collapsed = new Set();
  let tmpCounter = 0;
  const tmpId = () => 'tmp_' + (++tmpCounter);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function findSetById(setId) {
    for (const w of program.weeks || []) {
      for (const d of w.days || []) {
        for (const ex of d.exercises || []) {
          for (const s of ex.sets || []) {
            if (String(s.id) === String(setId)) return { ...s, exId: String(ex.id) };
          }
        }
      }
    }
    return null;
  }

  function findExById(exId) {
    for (const w of program.weeks || []) {
      for (const d of w.days || []) {
        for (const ex of d.exercises || []) {
          if (String(ex.id) === String(exId)) return { ex, dayId: String(d.id) };
        }
      }
    }
    return null;
  }

  // Replace a temporary ID with the real server-assigned ID
  function resolveTemp(tempId, realId) {
    for (const w of program.weeks || []) {
      if (String(w.id) === String(tempId)) { w.id = realId; return; }
      for (const d of w.days || []) {
        if (String(d.id) === String(tempId)) { d.id = realId; return; }
        for (const ex of d.exercises || []) {
          if (String(ex.id) === String(tempId)) { ex.id = realId; return; }
          for (const s of ex.sets || []) {
            if (String(s.id) === String(tempId)) { s.id = realId; return; }
          }
        }
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    const assignedAthlete = athletes.find(a => a.id === program.athlete_id);
    app.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">${program.name}</h1>
            <div class="page-subtitle">Program Builder ${assignedAthlete ? '— ' + assignedAthlete.name : ''}</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="window.location.hash='#/coach'">← Back</button>
            ${!program.athlete_id
              ? `<button class="btn btn-secondary" id="assign-btn">Assign Athlete</button>`
              : `<span class="badge badge-accent" style="padding:8px 14px">${assignedAthlete?.name ?? 'Assigned'}</span>`
            }
            <button class="btn btn-primary" id="add-week-btn">+ Week</button>
          </div>
        </div>

        <div class="program-tree" id="program-tree">
          ${program.weeks?.length
            ? program.weeks.map(w => renderWeekSection(w)).join('')
            : '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No Weeks Yet</div><div class="empty-state-text">Click "+ Week" to build your program.</div></div>'
          }
        </div>
      </div>`;

    attachListeners();
  }

  function renderWeekSection(week) {
    const key = 'w' + week.id;
    const isCollapsed = collapsed.has(key);
    return `
      <div class="program-week${isCollapsed ? ' collapsed' : ''}" id="pw-${week.id}">
        <div class="program-week-header">
          <button class="collapse-btn" data-key="${key}" title="${isCollapsed ? 'Expand' : 'Collapse'}">${isCollapsed ? '▶' : '▼'}</button>
          <span class="program-week-title">Week ${week.week_number}${week.label ? ' — ' + week.label : ''}</span>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn btn-primary btn-sm add-day-btn" data-week-id="${week.id}">+ Day</button>
            <button class="btn btn-ghost btn-sm del-week-btn" data-week-id="${week.id}" title="Delete Week">✕</button>
          </div>
        </div>
        <div class="pw-days-content">
          ${week.days?.map(d => renderDaySection(d)).join('') || ''}
        </div>
      </div>`;
  }

  function renderDaySection(day) {
    const key = 'd' + day.id;
    const isCollapsed = collapsed.has(key);
    return `
      <div class="program-day${isCollapsed ? ' collapsed' : ''}" id="pd-${day.id}">
        <div class="program-day-header">
          <button class="collapse-btn" data-key="${key}" title="${isCollapsed ? 'Expand' : 'Collapse'}">${isCollapsed ? '▶' : '▼'}</button>
          <span class="program-day-title">Day ${day.day_number}${day.label ? ' — ' + day.label : ''}</span>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn btn-secondary btn-sm add-ex-btn" data-day-id="${day.id}">+ Exercise</button>
            <button class="btn btn-ghost btn-sm del-day-btn" data-day-id="${day.id}" title="Delete Day">✕</button>
          </div>
        </div>
        <div class="pd-exercises-content">
          ${day.exercises?.map(ex => renderExercise(ex)).join('') || '<div style="padding:10px 40px;color:var(--text-muted);font-size:0.82rem">No exercises</div>'}
        </div>
      </div>`;
  }

  function renderExercise(ex) {
    const key = 'e' + ex.id;
    const isCollapsed = collapsed.has(key);
    const exTitle = ex.name;
    return `
      <div class="program-exercise${isCollapsed ? ' collapsed' : ''}" id="pex-${ex.id}" draggable="true" data-ex-id="${ex.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button class="collapse-btn" data-key="${key}" title="${isCollapsed ? 'Expand' : 'Collapse'}">${isCollapsed ? '▶' : '▼'}</button>
            <div class="program-exercise-name">${exTitle}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm add-set-btn" data-ex-id="${ex.id}">+ Set</button>
            <button class="btn btn-ghost btn-sm del-ex-btn" data-ex-id="${ex.id}" title="Delete Exercise">✕</button>
          </div>
        </div>
        <div class="pex-sets-content" id="pex-sets-${ex.id}">
          ${ex.sets?.length
            ? ex.sets.map((s, i) => renderSet(s, i, ex.id)).join('')
            : '<div style="color:var(--text-muted);font-size:0.8rem">No sets — use shorthand below or "+ Set"</div>'}
        </div>
      </div>`;
  }

  function renderSet(s, i, exId) {
    const isTop = s.set_type === 'top';
    const label = isTop ? 'Top' : `BD ${i}`;
    return `
      <div class="program-set-row" id="ps-${s.id}" data-set-id="${s.id}" data-ex-id="${exId}" draggable="true" title="Click to edit, drag to reorder">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="tag ${isTop ? 'tag-top' : 'tag-backdown'}">${label}</span>
        <span style="color:var(--text-secondary)">${s.reps} rep${s.reps !== 1 ? 's' : ''}</span>
        ${s.target_rpe ? `<span class="badge badge-muted">@${s.target_rpe} RPE</span>` : ''}
        ${s.notes ? `<span style="color:var(--text-muted);font-size:0.78rem;font-style:italic">${s.notes}</span>` : ''}
        <button class="btn btn-ghost btn-sm del-set-btn" data-set-id="${s.id}" style="margin-left:auto">✕</button>
      </div>`;
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  let dragState = { type: null, id: null, sourceEl: null };

  async function reorderSets(dragId, targetId) {
    const dragSet   = findSetById(dragId);
    const targetSet = findSetById(targetId);
    if (!dragSet || !targetSet || dragSet.exId !== targetSet.exId) return;
    const dragOrder   = dragSet.set_order;
    const targetOrder = targetSet.set_order;
    const saved = structuredClone(program);
    for (const w of program.weeks || []) {
      for (const d of w.days || []) {
        for (const ex of d.exercises || []) {
          for (const s of ex.sets || []) {
            if (String(s.id) === String(dragId))   s.set_order = targetOrder;
            if (String(s.id) === String(targetId)) s.set_order = dragOrder;
          }
          ex.sets.sort((a, b) => a.set_order - b.set_order);
        }
      }
    }
    render();
    try {
      await Promise.all([
        programAPI.updateSet(dragId,   { set_order: targetOrder }),
        programAPI.updateSet(targetId, { set_order: dragOrder   })
      ]);
    } catch (err) {
      program = saved;
      render();
      toast(err.message, 'error');
    }
  }

  async function reorderExercises(dragId, targetId) {
    const dragInfo   = findExById(dragId);
    const targetInfo = findExById(targetId);
    if (!dragInfo || !targetInfo || dragInfo.dayId !== targetInfo.dayId) return;
    const saved = structuredClone(program);
    let updatedExercises = [];
    for (const w of program.weeks || []) {
      for (const d of w.days || []) {
        if (String(d.id) !== dragInfo.dayId) continue;
        const dragIdx   = d.exercises.findIndex(e => String(e.id) === String(dragId));
        const targetIdx = d.exercises.findIndex(e => String(e.id) === String(targetId));
        if (dragIdx === -1 || targetIdx === -1) continue;
        const [dragEx] = d.exercises.splice(dragIdx, 1);
        d.exercises.splice(targetIdx, 0, dragEx);
        d.exercises.forEach((ex, i) => { ex.exercise_order = i; });
        updatedExercises = d.exercises;
      }
    }
    render();
    try {
      await Promise.all(updatedExercises.map(ex =>
        programAPI.updateExercise(ex.id, { exercise_order: ex.exercise_order })
      ));
    } catch (err) {
      program = saved;
      render();
      toast(err.message, 'error');
    }
  }

  // ── Attach listeners ─────────────────────────────────────────────────────

  function attachListeners() {
    document.getElementById('add-week-btn').addEventListener('click', () => {
      if (program.weeks?.length > 0) showCopyWeekModal();
      else createEmptyWeek();
    });

    document.getElementById('assign-btn')?.addEventListener('click', () => showAssignModal());

    // Collapse toggles
    app.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key = btn.dataset.key;
        if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
        render();
      });
    });

    app.querySelectorAll('.add-day-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const weekId = btn.dataset.weekId;
        const week = program.weeks.find(w => String(w.id) === weekId);
        const dayNum = (week?.days?.length || 0) + 1;
        const label = prompt(`Day ${dayNum} label (e.g. Monday, Upper):`, `Day ${dayNum}`) ?? `Day ${dayNum}`;
        const saved = structuredClone(program);
        const tempDay = { id: tmpId(), week_id: weekId, day_number: dayNum, label, exercises: [] };
        const targetWeek = program.weeks.find(w => String(w.id) === String(weekId));
        if (!targetWeek.days) targetWeek.days = [];
        targetWeek.days.push(tempDay);
        render();
        try {
          const day = await programAPI.addDay(weekId, { day_number: dayNum, label });
          resolveTemp(tempDay.id, day.id);
          render();
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      });
    });

    app.querySelectorAll('.del-week-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this week and all its days and exercises?')) return;
        const saved = structuredClone(program);
        program.weeks = program.weeks.filter(w => String(w.id) !== String(btn.dataset.weekId));
        render();
        toast('Week deleted', 'success');
        try {
          await programAPI.deleteWeek(btn.dataset.weekId);
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      });
    });

    app.querySelectorAll('.del-day-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this day and all its exercises?')) return;
        const saved = structuredClone(program);
        for (const w of program.weeks || []) {
          w.days = (w.days || []).filter(d => String(d.id) !== String(btn.dataset.dayId));
        }
        render();
        toast('Day deleted', 'success');
        try {
          await programAPI.deleteDay(btn.dataset.dayId);
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      });
    });

    app.querySelectorAll('.add-ex-btn').forEach(btn => {
      btn.addEventListener('click', () => showAddExerciseModal(btn.dataset.dayId));
    });

    app.querySelectorAll('.del-ex-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this exercise?')) return;
        const saved = structuredClone(program);
        for (const w of program.weeks || []) {
          for (const d of w.days || []) {
            d.exercises = (d.exercises || []).filter(ex => String(ex.id) !== String(btn.dataset.exId));
          }
        }
        render();
        toast('Exercise deleted', 'success');
        try {
          await programAPI.deleteExercise(btn.dataset.exId);
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      });
    });

    app.querySelectorAll('.add-set-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showSetModal(btn.dataset.exId);
      });
    });

    app.querySelectorAll('.del-set-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const saved = structuredClone(program);
        for (const w of program.weeks || []) {
          for (const d of w.days || []) {
            for (const ex of d.exercises || []) {
              ex.sets = (ex.sets || []).filter(s => String(s.id) !== String(btn.dataset.setId));
            }
          }
        }
        render();
        try {
          await programAPI.deleteSet(btn.dataset.setId);
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      });
    });

    // Click set row to edit
    app.querySelectorAll('.program-set-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.del-set-btn') || e.target.closest('.drag-handle')) return;
        const set = findSetById(row.dataset.setId);
        if (set) showSetModal(set.exId, set);
      });
    });

    // Exercise drag-and-drop
    app.querySelectorAll('.program-exercise[draggable]').forEach(el => {
      el.addEventListener('dragstart', e => {
        if (e.target.closest('.program-set-row')) return;
        dragState = { type: 'exercise', id: el.dataset.exId, sourceEl: el };
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', e => {
        if (dragState.type !== 'exercise') return;
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', async e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (dragState.type !== 'exercise' || dragState.id === el.dataset.exId) return;
        try { await reorderExercises(dragState.id, el.dataset.exId); }
        catch (err) { toast(err.message, 'error'); }
      });
    });

    // Set drag-and-drop
    app.querySelectorAll('.program-set-row[draggable]').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragState = { type: 'set', id: el.dataset.setId, sourceEl: el };
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', e => {
        if (dragState.type !== 'set') return;
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', async e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (dragState.type !== 'set' || dragState.id === el.dataset.setId) return;
        try { await reorderSets(dragState.id, el.dataset.setId); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  // ── Week actions ─────────────────────────────────────────────────────────

  async function createEmptyWeek() {
    const weekNum = (program.weeks?.length || 0) + 1;
    const saved = structuredClone(program);
    const tempWeek = { id: tmpId(), program_id: programId, week_number: weekNum, label: '', days: [] };
    if (!program.weeks) program.weeks = [];
    program.weeks.push(tempWeek);
    render();
    toast(`Week ${weekNum} added`, 'success');
    try {
      const week = await programAPI.addWeek(programId, { week_number: weekNum, label: '' });
      resolveTemp(tempWeek.id, week.id);
      render();
    } catch (err) {
      program = saved;
      render();
      toast(err.message, 'error');
    }
  }

  function showCopyWeekModal() {
    const lastWeek    = program.weeks[program.weeks.length - 1];
    const nextWeekNum = (program.weeks?.length || 0) + 1;

    const exercises = [];
    for (const day of lastWeek.days || []) {
      for (const ex of day.exercises || []) {
        if (!exercises.find(e => e.name === ex.name)) exercises.push(ex);
      }
    }

    const sorted = [...exercises].sort((a, b) => {
      const ai = BIG3.indexOf(a.name), bi = BIG3.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    const exRowsHtml = sorted.map(ex => {
      const defaultInc = BIG3.includes(ex.name) ? 0.5 : 0;
      return `
        <div class="copy-week-ex-row">
          <span class="copy-week-ex-name">${ex.name}</span>
          <div class="rpe-increment-btns">
            ${[0, 0.5, 1].map(v => `
              <button type="button" class="btn btn-secondary btn-sm inc-btn ${defaultInc === v ? 'active' : ''}"
                data-ex-name="${ex.name}" data-inc="${v}">${v === 0 ? '±0' : '+' + v}</button>
            `).join('')}
          </div>
        </div>`;
    }).join('');

    const bd = createModal('Add Week', `
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:0.9rem">
        You have <strong>${program.weeks.length}</strong> week${program.weeks.length > 1 ? 's' : ''} already. Copy from the previous week or start empty?
      </p>

      <div class="copy-week-options">
        <label class="copy-week-option selected" id="opt-copy">
          <input type="radio" name="week-type" value="copy" checked style="display:none">
          <div class="copy-week-option-title">📋 Copy Week ${lastWeek.week_number}</div>
          <div class="copy-week-option-desc">Copies all days, exercises &amp; sets.</div>
        </label>
        <label class="copy-week-option" id="opt-empty">
          <input type="radio" name="week-type" value="empty" style="display:none">
          <div class="copy-week-option-title">➕ Empty Week</div>
          <div class="copy-week-option-desc">Start from scratch.</div>
        </label>
      </div>

      <div id="copy-options" style="margin-top:16px">
        ${exercises.length ? `
          <div class="form-group">
            <label class="form-label">RPE Increment per Exercise</label>
            <div class="copy-week-exercises">${exRowsHtml}</div>
          </div>
        ` : ''}
      </div>
    `, async () => {
      const type = bd.querySelector('input[name="week-type"]:checked')?.value;

      if (type === 'copy') {
        const exerciseIncrements = {};
        bd.querySelectorAll('.copy-week-ex-row').forEach(row => {
          const activeBtn = row.querySelector('.inc-btn.active');
          if (activeBtn) {
            exerciseIncrements[activeBtn.dataset.exName] = parseFloat(activeBtn.dataset.inc);
          }
        });
        const saveBtn = bd.querySelector('.save-modal-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Copying…';
        try {
          const newWeek = await programAPI.copyWeek(programId, lastWeek.id, exerciseIncrements);
          if (!program.weeks) program.weeks = [];
          program.weeks.push(newWeek);
          bd.remove();
          render();
          toast(`Week ${nextWeekNum} added (copied from Week ${lastWeek.week_number})`, 'success');
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add Week';
          toast(err.message, 'error');
        }
      } else {
        bd.remove();
        createEmptyWeek();
      }
    }, 'Add Week');

    // Option toggle
    bd.querySelectorAll('.copy-week-option').forEach(opt => {
      opt.addEventListener('click', () => {
        bd.querySelectorAll('.copy-week-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        bd.querySelector('#copy-options').style.display =
          opt.querySelector('input').value === 'copy' ? 'block' : 'none';
      });
    });

    // Per-exercise RPE increment toggle
    bd.querySelectorAll('.inc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.copy-week-ex-row');
        row.querySelectorAll('.inc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ── Set modal (add + edit) ────────────────────────────────────────────────

  function showSetModal(exId, existingSet = null) {
    const found = program.weeks?.flatMap(w => w.days || [])
      .flatMap(d => d.exercises || [])
      .find(e => String(e.id) === String(exId));
    const ex     = found;
    const hasTop = ex?.sets?.some(s => s.set_type === 'top');
    const isEdit = !!existingSet;

    const bd = createModal(isEdit ? 'Edit Set' : 'Add Set', `
      ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">Shorthand (fastest)</label>
          <input type="text" class="form-control" id="set-shorthand" placeholder="e.g. Top 3 @ 5 + 2x8 @ 5" autofocus>
          <div class="form-hint">e.g. <em>Top 3 @ 5 + 2x8 @ 5</em> — top set first, then NxReps @ RPE for backdowns. Leave blank to use fields below.</div>
        </div>
        <div class="divider"></div>
      ` : ''}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Set Type</label>
          <select class="form-select" id="set-type">
            ${(!hasTop || existingSet?.set_type === 'top') ? '<option value="top"' + (existingSet?.set_type === 'top' ? ' selected' : '') + '>Top Set</option>' : ''}
            <option value="backdown" ${existingSet?.set_type === 'backdown' || (hasTop && !existingSet) ? 'selected' : ''}>Backdown</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Reps</label>
          <input type="number" class="form-control" id="set-reps" min="1" max="20" value="${existingSet?.reps ?? 4}" inputmode="numeric" ${isEdit ? 'autofocus' : ''}>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Target RPE</label>
        <div class="rpe-picker rpe-picker-modal">
          ${[5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(r => `
            <button type="button" class="rpe-btn ${r <= 7 ? 'rpe-btn-low' : r <= 8.5 ? 'rpe-btn-med' : 'rpe-btn-high'} ${existingSet?.target_rpe === r ? 'selected' : ''}" data-rpe="${r}">${r}</button>
          `).join('')}
          <input type="hidden" id="set-rpe-hidden" value="${existingSet?.target_rpe ?? ''}">
        </div>
        <div class="form-hint">Tap to select target RPE (optional)</div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <input type="text" class="form-control" id="set-notes" placeholder="Pause on chest…" value="${existingSet?.notes ?? ''}">
      </div>
    `, async () => {
      // Read all form values before closing
      const setType    = bd.querySelector('#set-type').value;
      const reps       = parseInt(bd.querySelector('#set-reps').value) || 4;
      const targetRpe  = bd.querySelector('#set-rpe-hidden').value || null;
      const notes      = bd.querySelector('#set-notes').value;
      const shorthand  = !isEdit ? bd.querySelector('#set-shorthand').value.trim() : null;
      const parsedSets = parseShorthand(shorthand);

      const saved = structuredClone(program);
      const target = program.weeks?.flatMap(w => w.days || [])
        .flatMap(d => d.exercises || [])
        .find(e => String(e.id) === String(exId));

      if (!isEdit) {
        if (parsedSets?.length) {
          const baseOrder = (ex?.sets?.length || 0);
          const tempSets = parsedSets.map((s, i) => ({
            ...s, id: tmpId(), exercise_id: exId, set_order: baseOrder + i
          }));
          if (target) { if (!target.sets) target.sets = []; target.sets.push(...tempSets); }
          bd.remove();
          render();
          toast(`${parsedSets.length} sets added`, 'success');
          try {
            const newSets = await Promise.all(
              parsedSets.map((s, i) => programAPI.addSet(exId, { ...s, set_order: baseOrder + i }))
            );
            tempSets.forEach((ts, i) => resolveTemp(ts.id, newSets[i].id));
            render();
          } catch (err) {
            program = saved;
            render();
            toast(err.message, 'error');
          }
        } else {
          const setOrder = (ex?.sets?.length || 0);
          const tempSet = { id: tmpId(), exercise_id: exId, set_type: setType, reps, target_rpe: targetRpe, notes, set_order: setOrder };
          if (target) { if (!target.sets) target.sets = []; target.sets.push(tempSet); }
          bd.remove();
          render();
          try {
            const newSet = await programAPI.addSet(exId, { set_type: setType, reps, target_rpe: targetRpe, set_order: setOrder, notes });
            resolveTemp(tempSet.id, newSet.id);
            render();
          } catch (err) {
            program = saved;
            render();
            toast(err.message, 'error');
          }
        }
      } else {
        // Edit: apply optimistically, close modal immediately, sync in background
        const optimisticSet = { ...existingSet, set_type: setType, reps, target_rpe: targetRpe ? parseFloat(targetRpe) : null, notes };
        for (const w of program.weeks || []) {
          for (const d of w.days || []) {
            for (const ex2 of d.exercises || []) {
              const idx = ex2.sets?.findIndex(s => String(s.id) === String(existingSet.id));
              if (idx !== undefined && idx >= 0) ex2.sets[idx] = optimisticSet;
            }
          }
        }
        bd.remove();
        render();
        toast('Set updated', 'success');
        try {
          const updatedSet = await programAPI.updateSet(existingSet.id, { set_type: setType, reps, target_rpe: targetRpe, notes });
          for (const w of program.weeks || []) {
            for (const d of w.days || []) {
              for (const ex2 of d.exercises || []) {
                const idx = ex2.sets?.findIndex(s => String(s.id) === String(existingSet.id));
                if (idx !== undefined && idx >= 0) ex2.sets[idx] = updatedSet;
              }
            }
          }
          render();
        } catch (err) {
          program = saved;
          render();
          toast(err.message, 'error');
        }
      }
    }, isEdit ? 'Save Changes' : 'Save');

    // RPE picker
    bd.querySelectorAll('.rpe-picker-modal .rpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelectorAll('.rpe-picker-modal .rpe-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        bd.querySelector('#set-rpe-hidden').value = btn.dataset.rpe;
      });
    });
  }

  // ── Other modals ─────────────────────────────────────────────────────────

  function showAddExerciseModal(dayId) {
    const bd = createModal('Add Exercise', `
      <div class="form-group">
        <label class="form-label">Quick Templates</label>
        <div class="ex-template-grid">
          ${EXERCISE_TEMPLATES.map(t => `
            <button type="button" class="btn btn-ghost btn-sm ex-template-btn" data-name="${t}">${t}</button>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Exercise Name</label>
        <input type="text" class="form-control" id="ex-name" placeholder="or type a custom name…" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Shorthand Sets (optional)</label>
        <input type="text" class="form-control" id="ex-shorthand" placeholder="e.g. Top 3 @ 5 + 2x8 @ 5">
        <div class="form-hint">e.g. <em>Top 3 @ 5 + 2x8 @ 5</em> — top set first, then NxReps @ RPE for backdowns. Leave blank to add sets manually.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Coach Notes (optional)</label>
        <input type="text" class="form-control" id="ex-notes" placeholder="Focus on depth…">
      </div>
    `, async () => {
      const name = bd.querySelector('#ex-name').value.trim();
      if (!name) return toast('Enter exercise name', 'error');

      const notes      = bd.querySelector('#ex-notes').value;
      const shorthand  = bd.querySelector('#ex-shorthand').value.trim();
      const parsedSets = parseShorthand(shorthand);

      const saved = structuredClone(program);

      // Determine exercise_order for the new exercise
      let exOrder = 0;
      for (const w of program.weeks || []) {
        for (const d of w.days || []) {
          if (String(d.id) === String(dayId)) exOrder = d.exercises?.length || 0;
        }
      }

      const tempExId = tmpId();
      const tempSets = parsedSets?.map((s, i) => ({ ...s, id: tmpId(), set_order: i })) || [];
      const tempEx = { id: tempExId, day_id: dayId, exercise_order: exOrder, name, notes, sets: tempSets };

      for (const w of program.weeks || []) {
        for (const d of w.days || []) {
          if (String(d.id) === String(dayId)) {
            if (!d.exercises) d.exercises = [];
            d.exercises.push(tempEx);
            break;
          }
        }
      }

      bd.remove();
      render();
      toast(`${name} added${parsedSets?.length ? ` with ${parsedSets.length} sets` : ''}`, 'success');

      try {
        const ex = await programAPI.addExercise(dayId, { name, notes });
        resolveTemp(tempExId, ex.id);
        if (parsedSets?.length) {
          const newSets = await Promise.all(
            parsedSets.map((s, i) => programAPI.addSet(ex.id, { ...s, set_order: i }))
          );
          tempSets.forEach((ts, i) => resolveTemp(ts.id, newSets[i].id));
        }
        render();
      } catch (err) {
        program = saved;
        render();
        toast(err.message, 'error');
      }
    });

    bd.querySelectorAll('.ex-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelector('#ex-name').value = btn.dataset.name;
        bd.querySelector('#ex-name').focus();
      });
    });
  }

  function showAssignModal() {
    const bd = createModal('Assign Program', `
      <div class="form-group">
        <label class="form-label">Select Athlete</label>
        <select class="form-select" id="assign-athlete">
          ${athletes.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px">This will set the program as the athlete's active program.</p>
    `, async () => {
      const athleteId = bd.querySelector('#assign-athlete').value;
      const saved = structuredClone(program);
      program.athlete_id = parseInt(athleteId);
      bd.remove();
      toast('Program assigned!', 'success');
      render();
      try {
        await programAPI.assign(programId, athleteId);
      } catch (err) {
        program = saved;
        render();
        toast(err.message, 'error');
      }
    });
  }

  // ── Modal factory ─────────────────────────────────────────────────────────

  function createModal(title, bodyHtml, onSave, saveLabel = 'Save') {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary cancel-modal-btn">Cancel</button>
          <button class="btn btn-primary save-modal-btn">${saveLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', handleKey);
    };

    const save = async () => {
      try { await onSave(); } catch (err) { toast(err.message, 'error'); }
    };

    function handleKey(e) {
      if (e.key === 'Escape') { close(); }
      if (e.key === 'Enter' && !e.target.matches('textarea, input[type=text]')) {
        e.preventDefault();
        backdrop.querySelector('.save-modal-btn').click();
      }
    }
    document.addEventListener('keydown', handleKey);

    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.querySelector('.cancel-modal-btn').addEventListener('click', close);
    backdrop.querySelector('.save-modal-btn').addEventListener('click', save);
    setTimeout(() => backdrop.querySelector('input')?.focus(), 50);
    return backdrop;
  }

  render();
}
