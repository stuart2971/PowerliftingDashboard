const router = require('express').Router();
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireCoach } = require('../middleware/roles');

router.use(authenticate);

// Helper: NULL-out all FK references to a program day before deleting it
async function nullOutDayRefs(dayId) {
  await query('UPDATE training_sessions SET program_day_id = NULL WHERE program_day_id = $1', [dayId]);
  const exRes = await query('SELECT id FROM program_exercises WHERE day_id = $1', [dayId]);
  for (const ex of exRes.rows) {
    const setRes = await query('SELECT id FROM program_sets WHERE exercise_id = $1', [ex.id]);
    for (const s of setRes.rows) {
      await query('UPDATE logged_sets SET program_set_id = NULL WHERE program_set_id = $1', [s.id]);
    }
    await query('UPDATE logged_exercises SET program_exercise_id = NULL WHERE program_exercise_id = $1', [ex.id]);
  }
}

// GET /api/programs
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'coach') {
      const result = await query(
        'SELECT * FROM programs WHERE coach_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );
      return res.json(result.rows);
    }
    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.json([]);
    const result = await query(
      'SELECT * FROM programs WHERE athlete_id = $1 AND is_active = true',
      [profile.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/programs
router.post('/', requireCoach, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await query(
      'INSERT INTO programs (coach_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/programs/:id
router.put('/:id', requireCoach, async (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    await query(
      'UPDATE programs SET name = COALESCE($1, name), description = COALESCE($2, description), is_active = COALESCE($3, is_active) WHERE id = $4 AND coach_id = $5',
      [name, description, is_active != null ? is_active : null, req.params.id, req.user.id]
    );
    const result = await query('SELECT * FROM programs WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/programs/:id
router.delete('/:id', requireCoach, async (req, res) => {
  try {
    await query('DELETE FROM programs WHERE id = $1 AND coach_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/programs/:id/assign/:athleteId
router.post('/:id/assign/:athleteId', requireCoach, async (req, res) => {
  try {
    await query('UPDATE programs SET is_active = false WHERE athlete_id = $1', [req.params.athleteId]);
    await query(
      'UPDATE programs SET athlete_id = $1, is_active = true WHERE id = $2 AND coach_id = $3',
      [req.params.athleteId, req.params.id, req.user.id]
    );
    const result = await query('SELECT * FROM programs WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/programs/:id/full
router.get('/:id/full', async (req, res) => {
  try {
    const progRes = await query('SELECT * FROM programs WHERE id = $1', [req.params.id]);
    const program = progRes.rows[0];
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const weeksRes = await query(
      'SELECT * FROM program_weeks WHERE program_id = $1 ORDER BY week_number',
      [program.id]
    );
    const weeks = weeksRes.rows;

    for (const week of weeks) {
      const daysRes = await query(
        'SELECT * FROM program_days WHERE week_id = $1 ORDER BY day_number',
        [week.id]
      );
      week.days = daysRes.rows;
      for (const day of week.days) {
        const exRes = await query(
          'SELECT * FROM program_exercises WHERE day_id = $1 ORDER BY exercise_order',
          [day.id]
        );
        day.exercises = exRes.rows;
        for (const ex of day.exercises) {
          const setRes = await query(
            'SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order',
            [ex.id]
          );
          ex.sets = setRes.rows;
        }
      }
    }
    program.weeks = weeks;
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/programs/:id/copy-week/:weekId
router.post('/:id/copy-week/:weekId', requireCoach, async (req, res) => {
  try {
    const { rpe_increment = 0.5 } = req.body;
    const inc = parseFloat(rpe_increment) || 0;

    const maxRes = await query(
      'SELECT MAX(week_number) as m FROM program_weeks WHERE program_id = $1',
      [req.params.id]
    );
    const newWeekNum = (maxRes.rows[0]?.m || 0) + 1;

    const MAIN_LIFT_KEYWORDS = ['squat', 'bench', 'deadlift', 'press'];
    const isMainLift = (name) => MAIN_LIFT_KEYWORDS.some(kw => (name || '').toLowerCase().includes(kw));

    const srcWeekRes = await query('SELECT * FROM program_weeks WHERE id = $1', [req.params.weekId]);
    const srcWeek = srcWeekRes.rows[0];
    if (!srcWeek) return res.status(404).json({ error: 'Source week not found' });

    const newWeekRes = await query(
      'INSERT INTO program_weeks (program_id, week_number, label) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, newWeekNum, srcWeek.label || null]
    );
    const newWeekId = newWeekRes.rows[0].id;

    const srcDaysRes = await query(
      'SELECT * FROM program_days WHERE week_id = $1 ORDER BY day_number',
      [req.params.weekId]
    );
    for (const day of srcDaysRes.rows) {
      const newDayRes = await query(
        'INSERT INTO program_days (week_id, day_number, label) VALUES ($1, $2, $3) RETURNING id',
        [newWeekId, day.day_number, day.label || null]
      );
      const newDayId = newDayRes.rows[0].id;

      const srcExRes = await query(
        'SELECT * FROM program_exercises WHERE day_id = $1 ORDER BY exercise_order',
        [day.id]
      );
      for (const ex of srcExRes.rows) {
        const newExRes = await query(
          'INSERT INTO program_exercises (day_id, exercise_order, name, notes) VALUES ($1, $2, $3, $4) RETURNING id',
          [newDayId, ex.exercise_order, ex.name, ex.notes || null]
        );
        const newExId = newExRes.rows[0].id;
        const applyInc = inc > 0 && isMainLift(ex.name);

        const srcSetsRes = await query(
          'SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order',
          [ex.id]
        );
        for (const s of srcSetsRes.rows) {
          const newRpe = s.target_rpe != null && applyInc
            ? Math.min(10, Math.round((s.target_rpe + inc) * 2) / 2)
            : s.target_rpe;
          await query(
            'INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe, notes) VALUES ($1, $2, $3, $4, $5, $6)',
            [newExId, s.set_order, s.set_type, s.reps, newRpe, s.notes || null]
          );
        }
      }
    }

    // Return full new week structure
    const weekRes = await query('SELECT * FROM program_weeks WHERE id = $1', [newWeekId]);
    const week = weekRes.rows[0];
    const daysRes = await query('SELECT * FROM program_days WHERE week_id = $1 ORDER BY day_number', [newWeekId]);
    week.days = daysRes.rows;
    for (const day of week.days) {
      const exRes = await query('SELECT * FROM program_exercises WHERE day_id = $1 ORDER BY exercise_order', [day.id]);
      day.exercises = exRes.rows;
      for (const ex of day.exercises) {
        const setRes = await query('SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order', [ex.id]);
        ex.sets = setRes.rows;
      }
    }
    res.status(201).json(week);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Weeks ──────────────────────────────────────────────────────────────────

router.get('/:id/weeks', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM program_weeks WHERE program_id = $1 ORDER BY week_number',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/weeks', requireCoach, async (req, res) => {
  try {
    const { week_number, label } = req.body;
    const result = await query(
      'INSERT INTO program_weeks (program_id, week_number, label) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, week_number, label || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/weeks/:weekId', requireCoach, async (req, res) => {
  try {
    const daysRes = await query('SELECT id FROM program_days WHERE week_id = $1', [req.params.weekId]);
    for (const day of daysRes.rows) await nullOutDayRefs(day.id);
    await query('DELETE FROM program_weeks WHERE id = $1', [req.params.weekId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Days ───────────────────────────────────────────────────────────────────

router.get('/weeks/:weekId/days', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM program_days WHERE week_id = $1 ORDER BY day_number',
      [req.params.weekId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/weeks/:weekId/days', requireCoach, async (req, res) => {
  try {
    const { day_number, label } = req.body;
    const result = await query(
      'INSERT INTO program_days (week_id, day_number, label) VALUES ($1, $2, $3) RETURNING *',
      [req.params.weekId, day_number, label || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/days/:dayId', requireCoach, async (req, res) => {
  try {
    await nullOutDayRefs(req.params.dayId);
    await query('DELETE FROM program_days WHERE id = $1', [req.params.dayId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Exercises ──────────────────────────────────────────────────────────────

router.get('/days/:dayId/exercises', async (req, res) => {
  try {
    const exRes = await query(
      'SELECT * FROM program_exercises WHERE day_id = $1 ORDER BY exercise_order',
      [req.params.dayId]
    );
    const exercises = exRes.rows;
    for (const ex of exercises) {
      const setRes = await query('SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order', [ex.id]);
      ex.sets = setRes.rows;
    }
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/days/:dayId/exercises', requireCoach, async (req, res) => {
  try {
    const { name, exercise_order, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await query(
      'INSERT INTO program_exercises (day_id, exercise_order, name, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.dayId, exercise_order || 0, name, notes || null]
    );
    const ex = result.rows[0];
    ex.sets = [];
    res.status(201).json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/exercises/:exId', requireCoach, async (req, res) => {
  try {
    const { name, exercise_order, notes } = req.body;
    await query(
      'UPDATE program_exercises SET name = COALESCE($1, name), exercise_order = COALESCE($2, exercise_order), notes = COALESCE($3, notes) WHERE id = $4',
      [name, exercise_order, notes, req.params.exId]
    );
    const result = await query('SELECT * FROM program_exercises WHERE id = $1', [req.params.exId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/exercises/:exId', requireCoach, async (req, res) => {
  try {
    await query('DELETE FROM program_exercises WHERE id = $1', [req.params.exId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sets ───────────────────────────────────────────────────────────────────

router.get('/exercises/:exId/sets', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order',
      [req.params.exId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exercises/:exId/sets', requireCoach, async (req, res) => {
  try {
    const { set_order, set_type, reps, target_rpe, notes } = req.body;
    if (!set_type || !reps) return res.status(400).json({ error: 'set_type and reps required' });
    const result = await query(
      'INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.exId, set_order || 0, set_type, reps, target_rpe || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sets/:setId', requireCoach, async (req, res) => {
  try {
    const { set_order, set_type, reps, target_rpe, notes } = req.body;
    await query(
      'UPDATE program_sets SET set_order = COALESCE($1, set_order), set_type = COALESCE($2, set_type), reps = COALESCE($3, reps), target_rpe = COALESCE($4, target_rpe), notes = COALESCE($5, notes) WHERE id = $6',
      [set_order, set_type, reps, target_rpe, notes, req.params.setId]
    );
    const result = await query('SELECT * FROM program_sets WHERE id = $1', [req.params.setId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sets/:setId', requireCoach, async (req, res) => {
  try {
    await query('DELETE FROM program_sets WHERE id = $1', [req.params.setId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
