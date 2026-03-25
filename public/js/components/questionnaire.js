const FIELDS = ['sleep', 'mood', 'motivation', 'soreness', 'fatigue', 'readiness'];
const OPTIONS = ['', 'Poor', 'Fair', 'Good', 'Great'];
const COLOR_MAP = { Poor: 'poor', Fair: 'fair', Good: 'good', Great: 'great' };

export function renderQuestionnaire(session) {
  return `
    <div class="questionnaire-section">
      <div class="questionnaire-title">Session Questionnaire</div>
      <div class="questionnaire-grid">
        ${FIELDS.map(f => `
          <div class="questionnaire-item">
            <label>${f.toUpperCase()}</label>
            <select class="q-select" data-field="${f}" onchange="this.className='q-select '+(this.value ? '${COLOR_MAP[OPTIONS[1]]}' : '')">
              ${OPTIONS.map(o => `<option value="${o}" ${session?.[f] === o ? 'selected' : ''}>${o || '—'}</option>`).join('')}
            </select>
          </div>
        `).join('')}
        <div class="questionnaire-item">
          <label>NOTES</label>
          <input type="text" class="form-control q-notes" placeholder="Session notes…" value="${session?.session_notes || ''}" style="padding:7px 10px;font-size:0.82rem;">
        </div>
      </div>
    </div>`;
}

export function attachQuestionnaireListeners(container, onSave) {
  const selects = container.querySelectorAll('.q-select');
  const notesInput = container.querySelector('.q-notes');

  function applyColor(sel) {
    sel.className = 'q-select ' + (sel.value ? sel.value.toLowerCase() : '');
  }

  selects.forEach(sel => {
    applyColor(sel);
    sel.addEventListener('change', () => {
      applyColor(sel);
      saveQuestionnaire();
    });
  });

  notesInput?.addEventListener('blur', saveQuestionnaire);

  function saveQuestionnaire() {
    const data = {};
    selects.forEach(s => { data[s.dataset.field] = s.value || null; });
    data.session_notes = notesInput?.value || null;
    onSave(data);
  }
}
