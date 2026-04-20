const FIELDS  = ['sleep', 'mood', 'motivation', 'soreness', 'fatigue', 'readiness'];
const LABELS  = ['Sleep', 'Mood', 'Motivation', 'Soreness', 'Fatigue', 'Readiness'];
const OPTIONS = ['', 'Poor', 'Fair', 'Good', 'Great'];

function fieldToSlider(val) {
  const idx = OPTIONS.indexOf(val || '');
  return idx >= 0 ? idx : 0;
}

function sliderToField(n) {
  return OPTIONS[parseInt(n)] || '';
}

export function renderQuestionnaire(session) {
  return `
    <div class="questionnaire-section">
      <div class="questionnaire-title">Session Questionnaire</div>
      <div class="questionnaire-list">
        ${FIELDS.map((f, i) => {
          const val = session?.[f] || '';
          const colorCls = val ? 'q-val-' + val.toLowerCase() : '';
          return `
            <div class="questionnaire-item">
              <div class="questionnaire-item-header">
                <span class="q-label">${LABELS[i].toUpperCase()}:</span>
                <span class="q-value ${colorCls}" data-field="${f}">${val || '—'}</span>
              </div>
              <input type="range" class="q-slider" data-field="${f}"
                min="1" max="4" step="1" value="${fieldToSlider(val) || 1}">
            </div>`;
        }).join('')}
        <div class="questionnaire-item q-notes-item">
          <span class="q-label">NOTES</span>
          <input type="text" class="form-control q-notes" placeholder="Session notes…"
            value="${session?.session_notes || ''}">
        </div>
      </div>
    </div>`;
}

export function attachQuestionnaireListeners(container, onSave) {
  const sliders    = container.querySelectorAll('.q-slider');
  const notesInput = container.querySelector('.q-notes');

  sliders.forEach(slider => {
    slider.addEventListener('input', () => {
      const val       = sliderToField(slider.value);
      const valueSpan = container.querySelector(`.q-value[data-field="${slider.dataset.field}"]`);
      if (valueSpan) {
        valueSpan.textContent = val || '—';
        valueSpan.className   = `q-value${val ? ' q-val-' + val.toLowerCase() : ''}`;
      }
    });
    slider.addEventListener('change', saveQuestionnaire);
  });

  notesInput?.addEventListener('blur', saveQuestionnaire);

  function saveQuestionnaire() {
    const data = {};
    sliders.forEach(s => { data[s.dataset.field] = sliderToField(s.value) || null; });
    data.session_notes = notesInput?.value || null;
    onSave(data);
  }
}
