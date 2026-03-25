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

// Parse shorthand like "Top x2 + 3x4@8 + 2x4@7.5"
function parseShorthand(text) {
  if (!text?.trim()) return null;
  const sets = [];
  const parts = text.split('+').map(s => s.trim());
  for (const part of parts) {
    // Top set: "Top x2" or "Top x2@8"
    const topMatch = part.match(/^top\s+x(\d+)(?:@([\d.]+))?$/i);
    if (topMatch) {
      sets.push({ set_type: 'top', reps: parseInt(topMatch[1]), target_rpe: topMatch[2] ? parseFloat(topMatch[2]) : null });
      continue;
    }
    // Backdown: "3x4@8" or "4@7.5" (count x reps @ rpe)
    const bdMatch = part.match(/^(\d+)x(\d+)(?:@([\d.]+))?$/i);
    if (bdMatch) {
      const count = parseInt(bdMatch[1]);
      for (let i = 0; i < count; i++) {
        sets.push({ set_type: 'backdown', reps: parseInt(bdMatch[2]), target_rpe: bdMatch[3] ? parseFloat(bdMatch[3]) : null });
      }
      continue;
    }
    // Single set: "4@8"
    const singleMatch = part.match(/^(\d+)@([\d.]+)$/i);
    if (singleMatch) {
      sets.push({ set_type: 'backdown', reps: parseInt(singleMatch[1]), target_rpe: parseFloat(singleMatch[2]) });
    }
  }
  return sets.length ? sets : null;
}

export async function renderProgramBuilder(app, programId) {
  let program = await programAPI.getFull(programId);
  const athletes = await athleteAPI.list();

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
    return `
      <div class="program-week" id="pw-${week.id}">
        <div class="program-week-header">
          <span class="program-week-title">Week ${week.week_number}${week.label ? ' — ' + week.label : ''}</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm add-day-btn" data-week-id="${week.id}">+ Day</button>
            <button class="btn btn-ghost btn-sm del-week-btn" data-week-id="${week.id}" title="Delete Week">✕</button>
          </div>
        </div>
        <div id="pw-days-${week.id}">
          ${week.days?.map(d => renderDaySection(d)).join('') || ''}
        </div>
      </div>`;
  }

  function renderDaySection(day) {
    return `
      <div class="program-day" id="pd-${day.id}">
        <div class="program-day-header">
          <span class="program-day-title">Day ${day.day_number}${day.label ? ' — ' + day.label : ''}</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm add-ex-btn" data-day-id="${day.id}">+ Exercise</button>
            <button class="btn btn-ghost btn-sm del-day-btn" data-day-id="${day.id}" title="Delete Day">✕</button>
          </div>
        </div>
        <div id="pd-exercises-${day.id}" style="padding:0 0 8px 0">
          ${day.exercises?.map(ex => renderExercise(ex)).join('') || '<div style="padding:10px 40px;color:var(--text-muted);font-size:0.82rem">No exercises</div>'}
        </div>
      </div>`;
  }

  function renderExercise(ex) {
    return `
      <div class="program-exercise" id="pex-${ex.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="program-exercise-name">${ex.name}</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm add-set-btn" data-ex-id="${ex.id}">+ Set</button>
            <button class="btn btn-ghost btn-sm del-ex-btn" data-ex-id="${ex.id}" title="Delete Exercise">✕</button>
          </div>
        </div>
        <div id="pex-sets-${ex.id}">
          ${ex.sets?.length
            ? ex.sets.map((s, i) => renderSet(s, i)).join('')
            : '<div style="color:var(--text-muted);font-size:0.8rem">No sets — use shorthand below or "+ Set"</div>'}
        </div>
      </div>`;
  }

  function renderSet(s, i) {
    const isTop = s.set_type === 'top';
    const label = isTop ? 'Top' : `BD ${i}`;
    return `
      <div class="program-set-row" id="ps-${s.id}">
        <span class="tag ${isTop ? 'tag-top' : 'tag-backdown'}">${label}</span>
        <span style="color:var(--text-secondary)">${s.reps} rep${s.reps !== 1 ? 's' : ''}</span>
        ${s.target_rpe ? `<span class="badge badge-muted">@${s.target_rpe} RPE</span>` : ''}
        ${s.notes ? `<span style="color:var(--text-muted);font-size:0.78rem;font-style:italic">${s.notes}</span>` : ''}
        <button class="btn btn-ghost btn-sm del-set-btn" data-set-id="${s.id}" style="margin-left:auto">✕</button>
      </div>`;
  }

  function attachListeners() {
    // Add week — smart modal if weeks exist
    document.getElementById('add-week-btn').addEventListener('click', () => {
      if (program.weeks?.length > 0) {
        showCopyWeekModal();
      } else {
        createEmptyWeek();
      }
    });

    document.getElementById('assign-btn')?.addEventListener('click', () => showAssignModal());

    app.querySelectorAll('.add-day-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const weekId = btn.dataset.weekId;
        const week = program.weeks.find(w => String(w.id) === weekId);
        const dayNum = (week?.days?.length || 0) + 1;
        const label = prompt(`Day ${dayNum} label (e.g. Monday, Upper):`, `Day ${dayNum}`) ?? `Day ${dayNum}`;
        try {
          await programAPI.addDay(weekId, { day_number: dayNum, label });
          program = await programAPI.getFull(programId);
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    app.querySelectorAll('.del-week-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this week and all its days and exercises?')) return;
        try {
          await programAPI.deleteWeek(btn.dataset.weekId);
          program = await programAPI.getFull(programId);
          render();
          toast('Week deleted', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    app.querySelectorAll('.del-day-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this day and all its exercises?')) return;
        try {
          await programAPI.deleteDay(btn.dataset.dayId);
          program = await programAPI.getFull(programId);
          render();
          toast('Day deleted', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    app.querySelectorAll('.add-ex-btn').forEach(btn => {
      btn.addEventListener('click', () => showAddExerciseModal(btn.dataset.dayId));
    });

    app.querySelectorAll('.del-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this exercise?')) return;
        try {
          await programAPI.deleteExercise(btn.dataset.exId);
          program = await programAPI.getFull(programId);
          render();
          toast('Exercise deleted', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    app.querySelectorAll('.add-set-btn').forEach(btn => {
      btn.addEventListener('click', () => showAddSetModal(btn.dataset.exId));
    });

    app.querySelectorAll('.del-set-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await programAPI.deleteSet(btn.dataset.setId);
          program = await programAPI.getFull(programId);
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  async function createEmptyWeek() {
    const weekNum = (program.weeks?.length || 0) + 1;
    try {
      await programAPI.addWeek(programId, { week_number: weekNum, label: '' });
      program = await programAPI.getFull(programId);
      render();
      toast(`Week ${weekNum} added`, 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  function showCopyWeekModal() {
    const lastWeek = program.weeks[program.weeks.length - 1];
    const nextWeekNum = (program.weeks?.length || 0) + 1;

    const bd = createModal('Add Week', `
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:0.9rem">
        You have <strong>${program.weeks.length}</strong> week${program.weeks.length > 1 ? 's' : ''} already. Copy from the previous week or start empty?
      </p>

      <div class="copy-week-options">
        <label class="copy-week-option selected" id="opt-copy">
          <input type="radio" name="week-type" value="copy" checked style="display:none">
          <div class="copy-week-option-title">📋 Copy Week ${lastWeek.week_number}</div>
          <div class="copy-week-option-desc">Copies all days, exercises &amp; sets. Increases RPE on main lifts.</div>
        </label>
        <label class="copy-week-option" id="opt-empty">
          <input type="radio" name="week-type" value="empty" style="display:none">
          <div class="copy-week-option-title">➕ Empty Week</div>
          <div class="copy-week-option-desc">Start from scratch.</div>
        </label>
      </div>

      <div id="copy-options" style="margin-top:16px">
        <div class="form-group">
          <label class="form-label">RPE Increment on Main Lifts</label>
          <div class="rpe-increment-btns">
            ${[0, 0.5, 1].map(v => `
              <button type="button" class="btn btn-secondary inc-btn ${v === 0.5 ? 'active' : ''}" data-inc="${v}">
                ${v === 0 ? 'None' : '+' + v}
              </button>`).join('')}
          </div>
          <div class="form-hint">Main lifts: exercises containing Squat, Bench, Deadlift, Press</div>
        </div>
      </div>
    `, async () => {
      const type = bd.querySelector('input[name="week-type"]:checked')?.value;
      const inc  = parseFloat(bd.querySelector('.inc-btn.active')?.dataset.inc ?? 0.5);

      if (type === 'copy') {
        try {
          await programAPI.copyWeek(programId, lastWeek.id, inc);
          program = await programAPI.getFull(programId);
          bd.remove();
          render();
          toast(`Week ${nextWeekNum} added (copied from Week ${lastWeek.week_number}${inc > 0 ? `, RPE +${inc}` : ''})`, 'success');
        } catch (err) { toast(err.message, 'error'); }
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

    // RPE increment buttons
    bd.querySelectorAll('.inc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelectorAll('.inc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

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
        <input type="text" class="form-control" id="ex-shorthand" placeholder="e.g. Top x2 + 3x4@8 + 2x4@7.5">
        <div class="form-hint">Top x{reps} = top set &nbsp;|&nbsp; {count}x{reps}@{rpe} = backdowns &nbsp;|&nbsp; leave blank to add sets manually</div>
      </div>
      <div class="form-group">
        <label class="form-label">Coach Notes (optional)</label>
        <input type="text" class="form-control" id="ex-notes" placeholder="Focus on depth…">
      </div>
    `, async () => {
      const name = bd.querySelector('#ex-name').value.trim();
      if (!name) return toast('Enter exercise name', 'error');

      const ex = await programAPI.addExercise(dayId, {
        name,
        notes: bd.querySelector('#ex-notes').value
      });

      // Parse and add shorthand sets
      const shorthand = bd.querySelector('#ex-shorthand').value.trim();
      const parsedSets = parseShorthand(shorthand);
      if (parsedSets?.length) {
        for (let i = 0; i < parsedSets.length; i++) {
          await programAPI.addSet(ex.id, { ...parsedSets[i], set_order: i });
        }
      }

      program = await programAPI.getFull(programId);
      bd.remove();
      render();
      toast(`${name} added${parsedSets?.length ? ` with ${parsedSets.length} sets` : ''}`, 'success');
    });

    // Template buttons
    bd.querySelectorAll('.ex-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelector('#ex-name').value = btn.dataset.name;
        bd.querySelector('#ex-name').focus();
      });
    });
  }

  function showAddSetModal(exId) {
    const week = program.weeks?.find(w => w.days?.find(d => d.exercises?.find(e => String(e.id) === exId)));
    const day  = week?.days?.find(d => d.exercises?.find(e => String(e.id) === exId));
    const ex   = day?.exercises?.find(e => String(e.id) === exId);
    const hasTop = ex?.sets?.some(s => s.set_type === 'top');

    const bd = createModal('Add Set', `
      <div class="form-group">
        <label class="form-label">Shorthand (fastest)</label>
        <input type="text" class="form-control" id="set-shorthand" placeholder="e.g. 3x4@8 or Top x2@8 + 3x4@7.5" autofocus>
        <div class="form-hint">Leave blank to use fields below</div>
      </div>
      <div class="divider"></div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Set Type</label>
          <select class="form-select" id="set-type">
            ${!hasTop ? '<option value="top">Top Set</option>' : ''}
            <option value="backdown" ${hasTop ? 'selected' : ''}>Backdown</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Reps</label>
          <input type="number" class="form-control" id="set-reps" min="1" max="20" value="4" inputmode="numeric">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Target RPE</label>
        <div class="rpe-picker rpe-picker-modal">
          ${[5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(r => `
            <button type="button" class="rpe-btn ${r <= 7 ? 'rpe-btn-low' : r <= 8.5 ? 'rpe-btn-med' : 'rpe-btn-high'}" data-rpe="${r}">${r}</button>
          `).join('')}
          <input type="hidden" id="set-rpe-hidden" value="">
        </div>
        <div class="form-hint">Tap to select target RPE (optional)</div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <input type="text" class="form-control" id="set-notes" placeholder="Pause on chest…">
      </div>
    `, async () => {
      const shorthand = bd.querySelector('#set-shorthand').value.trim();
      const parsedSets = parseShorthand(shorthand);

      if (parsedSets?.length) {
        const baseOrder = (ex?.sets?.length || 0);
        for (let i = 0; i < parsedSets.length; i++) {
          await programAPI.addSet(exId, { ...parsedSets[i], set_order: baseOrder + i });
        }
        toast(`${parsedSets.length} sets added`, 'success');
      } else {
        const setOrder = (ex?.sets?.length || 0);
        await programAPI.addSet(exId, {
          set_type:   bd.querySelector('#set-type').value,
          reps:       parseInt(bd.querySelector('#set-reps').value) || 4,
          target_rpe: bd.querySelector('#set-rpe-hidden').value || null,
          set_order:  setOrder,
          notes:      bd.querySelector('#set-notes').value
        });
      }

      program = await programAPI.getFull(programId);
      bd.remove();
      render();
    });

    // RPE picker in modal
    bd.querySelectorAll('.rpe-picker-modal .rpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelectorAll('.rpe-picker-modal .rpe-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        bd.querySelector('#set-rpe-hidden').value = btn.dataset.rpe;
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
      await programAPI.assign(programId, athleteId);
      bd.remove();
      toast('Program assigned!', 'success');
      program = await programAPI.getFull(programId);
      render();
    });
  }

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
    backdrop.querySelector('.modal-close').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('.cancel-modal-btn').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('.save-modal-btn').addEventListener('click', async () => {
      try { await onSave(); } catch (err) { toast(err.message, 'error'); }
    });
    setTimeout(() => backdrop.querySelector('input')?.focus(), 50);
    return backdrop;
  }

  render();
}
