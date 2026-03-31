const router = require('express').Router();
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireCoach } = require('../middleware/roles');
const { calcE1RM, calcBackdownLoad, calcIntensityPct } = require('../utils/rpe');

router.use(authenticate);

// Helper: get full session with exercises and sets
async function getFullSession(sessionId) {
  const sessionRes = await query('SELECT * FROM training_sessions WHERE id = $1', [sessionId]);
  const session = sessionRes.rows[0];
  if (!session) return null;

  const exRes = await query(
    'SELECT * FROM logged_exercises WHERE session_id = $1 ORDER BY exercise_order',
    [sessionId]
  );
  const exercises = exRes.rows;

  for (const ex of exercises) {
    const setRes = await query(
      'SELECT * FROM logged_sets WHERE logged_exercise_id = $1 ORDER BY set_order',
      [ex.id]
    );
    ex.sets = setRes.rows;

    // Lazy-sync: if exercise has no logged sets but is linked to a program exercise,
    // copy the current program sets in (handles sets added to program after session creation)
    if (ex.sets.length === 0 && ex.program_exercise_id) {
      const progSets = await query(
        'SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order',
        [ex.program_exercise_id]
      );
      for (const s of progSets.rows) {
        const inserted = await query(
          'INSERT INTO logged_sets (logged_exercise_id, program_set_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
          [ex.id, s.id, s.set_order, s.set_type, s.reps, s.target_rpe]
        );
        ex.sets.push(inserted.rows[0]);
      }
    }
  }
  session.exercises = exercises;
  return session;
}

// GET /api/sessions/last-load?exerciseName=...
router.get('/last-load', async (req, res) => {
  try {
    const { exerciseName } = req.query;
    if (!exerciseName) return res.json(null);

    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.json(null);

    const result = await query(`
      SELECT ls.load_kg, ls.actual_rpe, ts.session_date
      FROM logged_sets ls
      JOIN logged_exercises le ON le.id = ls.logged_exercise_id
      JOIN training_sessions ts ON ts.id = le.session_id
      WHERE ts.athlete_id = $1
        AND ls.set_type = 'top'
        AND ls.load_kg IS NOT NULL
        AND le.exercise_name ILIKE $2
      ORDER BY ts.session_date DESC, ls.id DESC
      LIMIT 1
    `, [profile.id, exerciseName.trim()]);

    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/exercise-history?exerciseName=...
router.get('/exercise-history', async (req, res) => {
  try {
    const { exerciseName } = req.query;
    if (!exerciseName) return res.json([]);

    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.json([]);

    const result = await query(`
      SELECT ls.id, ls.set_type, ls.reps, ls.load_kg, ls.actual_rpe, ls.target_rpe,
             ls.intensity_pct, ts.session_date
      FROM logged_sets ls
      JOIN logged_exercises le ON le.id = ls.logged_exercise_id
      JOIN training_sessions ts ON ts.id = le.session_id
      WHERE ts.athlete_id = $1
        AND ls.load_kg IS NOT NULL
        AND ls.actual_rpe IS NOT NULL
        AND le.exercise_name ILIKE $2
      ORDER BY ts.session_date DESC, ts.id DESC, ls.set_order ASC
      LIMIT 100
    `, [profile.id, exerciseName.trim()]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/avg-duration?dayOfWeek=N (0=Sun…6=Sat)
router.get('/avg-duration', async (req, res) => {
  try {
    const { dayOfWeek } = req.query;
    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.json(null);

    const result = await query(`
      SELECT AVG(
        EXTRACT(EPOCH FROM sub.last_set::timestamptz) - EXTRACT(EPOCH FROM ts.created_at)
      ) / 60.0 AS avg_minutes,
      COUNT(*) AS session_count
      FROM training_sessions ts
      JOIN (
        SELECT le.session_id, MAX(ls.created_at) AS last_set
        FROM logged_sets ls
        JOIN logged_exercises le ON le.id = ls.logged_exercise_id
        GROUP BY le.session_id
      ) sub ON sub.session_id = ts.id
      WHERE ts.athlete_id = $1
        AND EXTRACT(DOW FROM ts.session_date::date)::text = $2
    `, [profile.id, String(dayOfWeek ?? 1)]);

    const row = result.rows[0];
    res.json(row?.avg_minutes ? {
      avg_minutes: Math.round(parseFloat(row.avg_minutes)),
      session_count: parseInt(row.session_count)
    } : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions — athlete: own sessions; coach: all athlete sessions
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'coach') {
      const { athleteId } = req.query;
      if (athleteId) {
        const result = await query(
          'SELECT * FROM training_sessions WHERE athlete_id = $1 ORDER BY session_date DESC',
          [athleteId]
        );
        return res.json(result.rows);
      }
      const result = await query(`
        SELECT ts.*, ap.name as athlete_name
        FROM training_sessions ts
        JOIN athlete_profiles ap ON ap.id = ts.athlete_id
        WHERE ap.coach_id = $1
        ORDER BY session_date DESC
        LIMIT 50
      `, [req.user.id]);
      return res.json(result.rows);
    }
    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.json([]);
    const result = await query(
      'SELECT * FROM training_sessions WHERE athlete_id = $1 ORDER BY session_date DESC',
      [profile.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions — start a new session
router.post('/', async (req, res) => {
  try {
    const profileRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(400).json({ error: 'No athlete profile found' });

    const { program_day_id, session_date, sleep, mood, motivation, soreness, fatigue, readiness, session_notes } = req.body;
    const date = session_date || new Date().toISOString().split('T')[0];

    const sessionResult = await query(`
      INSERT INTO training_sessions
        (athlete_id, program_day_id, session_date, sleep, mood, motivation, soreness, fatigue, readiness, session_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [profile.id, program_day_id || null, date,
        sleep || null, mood || null, motivation || null,
        soreness || null, fatigue || null, readiness || null, session_notes || null]);

    const sessionId = sessionResult.rows[0].id;

    if (program_day_id) {
      const exRes = await query(
        'SELECT * FROM program_exercises WHERE day_id = $1 ORDER BY exercise_order',
        [program_day_id]
      );
      for (const ex of exRes.rows) {
        const leResult = await query(
          'INSERT INTO logged_exercises (session_id, program_exercise_id, exercise_name, exercise_order) VALUES ($1, $2, $3, $4) RETURNING id',
          [sessionId, ex.id, ex.name, ex.exercise_order]
        );
        const leId = leResult.rows[0].id;
        const setsRes = await query(
          'SELECT * FROM program_sets WHERE exercise_id = $1 ORDER BY set_order',
          [ex.id]
        );
        for (const s of setsRes.rows) {
          await query(
            'INSERT INTO logged_sets (logged_exercise_id, program_set_id, set_order, set_type, reps, target_rpe) VALUES ($1, $2, $3, $4, $5, $6)',
            [leId, s.id, s.set_order, s.set_type, s.reps, s.target_rpe]
          );
        }
      }
    }

    res.status(201).json(await getFullSession(sessionId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const session = await getFullSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id — update questionnaire
router.put('/:id', async (req, res) => {
  try {
    const { sleep, mood, motivation, soreness, fatigue, readiness, session_notes } = req.body;
    await query(`
      UPDATE training_sessions SET
        sleep          = COALESCE($1, sleep),
        mood           = COALESCE($2, mood),
        motivation     = COALESCE($3, motivation),
        soreness       = COALESCE($4, soreness),
        fatigue        = COALESCE($5, fatigue),
        readiness      = COALESCE($6, readiness),
        session_notes  = COALESCE($7, session_notes)
      WHERE id = $8
    `, [sleep, mood, motivation, soreness, fatigue, readiness, session_notes, req.params.id]);
    res.json(await getFullSession(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/exercises — add an ad-hoc exercise
router.post('/:id/exercises', async (req, res) => {
  try {
    const { exercise_name, program_exercise_id, exercise_order } = req.body;
    if (!exercise_name) return res.status(400).json({ error: 'exercise_name required' });
    const result = await query(
      'INSERT INTO logged_exercises (session_id, program_exercise_id, exercise_name, exercise_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, program_exercise_id || null, exercise_name, exercise_order || 0]
    );
    const ex = result.rows[0];
    ex.sets = [];
    res.status(201).json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/exercises/:exId/sets — log a set
router.post('/exercises/:exId/sets', async (req, res) => {
  try {
    const { set_type, reps, load_kg, actual_rpe, target_rpe, program_set_id, set_order, athlete_notes } = req.body;
    if (!set_type || !reps) return res.status(400).json({ error: 'set_type and reps required' });

    const leRes = await query('SELECT * FROM logged_exercises WHERE id = $1', [req.params.exId]);
    const le = leRes.rows[0];
    if (!le) return res.status(404).json({ error: 'Exercise not found' });

    if (set_type === 'top') {
      const existingRes = await query(
        "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'top' ORDER BY set_order LIMIT 1",
        [req.params.exId]
      );
      const existing = existingRes.rows[0];

      let e1rm = null;
      if (load_kg && reps && actual_rpe) e1rm = calcE1RM(load_kg, reps, actual_rpe);

      if (existing) {
        await query(
          'UPDATE logged_sets SET reps=$1, load_kg=$2, actual_rpe=$3, target_rpe=COALESCE($4,target_rpe), intensity_pct=$5, athlete_notes=$6 WHERE id=$7',
          [reps, load_kg, actual_rpe, target_rpe, e1rm ? calcIntensityPct(load_kg, e1rm) : null, athlete_notes || null, existing.id]
        );
      } else {
        await query(
          "INSERT INTO logged_sets (logged_exercise_id, program_set_id, set_order, set_type, reps, load_kg, actual_rpe, target_rpe, intensity_pct, athlete_notes) VALUES ($1,$2,$3,'top',$4,$5,$6,$7,$8,$9)",
          [req.params.exId, program_set_id || null, set_order || 0, reps, load_kg, actual_rpe, target_rpe || null, e1rm ? calcIntensityPct(load_kg, e1rm) : null, athlete_notes || null]
        );
      }

      if (e1rm) {
        const bdRes = await query(
          "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'backdown' ORDER BY set_order",
          [req.params.exId]
        );
        for (const bd of bdRes.rows) {
          if (bd.target_rpe && bd.reps) {
            const calcLoad = calcBackdownLoad(e1rm, bd.reps, bd.target_rpe);
            const intensityPct = calcIntensityPct(calcLoad, e1rm);
            await query(
              'UPDATE logged_sets SET calculated_load_kg=$1, load_kg=CASE WHEN actual_rpe IS NULL THEN $2 ELSE load_kg END, intensity_pct=$3 WHERE id=$4',
              [calcLoad, calcLoad, intensityPct, bd.id]
            );
          }
        }
      }
    } else {
      // Backdown
      const existingRes = program_set_id
        ? await query('SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND program_set_id = $2 LIMIT 1', [req.params.exId, program_set_id])
        : { rows: [] };
      const existing = existingRes.rows[0];

      if (existing) {
        await query(
          'UPDATE logged_sets SET reps=$1, load_kg=$2, actual_rpe=$3, athlete_notes=$4 WHERE id=$5',
          [reps, load_kg, actual_rpe || null, athlete_notes || null, existing.id]
        );
      } else {
        await query(
          "INSERT INTO logged_sets (logged_exercise_id, program_set_id, set_order, set_type, reps, load_kg, actual_rpe, target_rpe, athlete_notes) VALUES ($1,$2,$3,'backdown',$4,$5,$6,$7,$8)",
          [req.params.exId, program_set_id || null, set_order || 0, reps, load_kg, actual_rpe || null, target_rpe || null, athlete_notes || null]
        );
      }

      if (actual_rpe && load_kg && reps) {
        const newE1rm = calcE1RM(load_kg, reps, actual_rpe);
        if (newE1rm) {
          const currentSet = existing || (await query(
            "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'backdown' ORDER BY id DESC LIMIT 1",
            [req.params.exId]
          )).rows[0];

          if (currentSet) {
            const nextRes = await query(
              "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'backdown' AND set_order > $2 ORDER BY set_order LIMIT 1",
              [req.params.exId, currentSet.set_order]
            );
            const nextBackdown = nextRes.rows[0];
            if (nextBackdown && nextBackdown.target_rpe) {
              const newLoad = calcBackdownLoad(newE1rm, nextBackdown.reps, nextBackdown.target_rpe);
              await query(
                'UPDATE logged_sets SET calculated_load_kg=$1, load_kg=$2, intensity_pct=$3 WHERE id=$4',
                [newLoad, newLoad, calcIntensityPct(newLoad, newE1rm), nextBackdown.id]
              );
            }
          }
        }
      }
    }

    const exRes = await query('SELECT * FROM logged_exercises WHERE id = $1', [req.params.exId]);
    const ex = exRes.rows[0];
    const setsRes = await query('SELECT * FROM logged_sets WHERE logged_exercise_id = $1 ORDER BY set_order', [req.params.exId]);
    ex.sets = setsRes.rows;
    res.json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/sets/:setId — update a logged set
router.put('/sets/:setId', async (req, res) => {
  try {
    const { reps, load_kg, actual_rpe, athlete_notes } = req.body;

    const currentRes = await query('SELECT * FROM logged_sets WHERE id = $1', [req.params.setId]);
    const currentSet = currentRes.rows[0];
    if (!currentSet) return res.status(404).json({ error: 'Set not found' });

    await query(
      'UPDATE logged_sets SET reps=COALESCE($1,reps), load_kg=COALESCE($2,load_kg), actual_rpe=COALESCE($3,actual_rpe), athlete_notes=COALESCE($4,athlete_notes) WHERE id=$5',
      [reps, load_kg, actual_rpe, athlete_notes, req.params.setId]
    );

    const updatedRes = await query('SELECT * FROM logged_sets WHERE id = $1', [req.params.setId]);
    const updatedSet = updatedRes.rows[0];

    if (actual_rpe && updatedSet.set_type === 'backdown') {
      const effectiveLoad = load_kg || updatedSet.load_kg;
      const effectiveReps = reps || updatedSet.reps;
      if (effectiveLoad && effectiveReps) {
        const newE1rm = calcE1RM(effectiveLoad, effectiveReps, actual_rpe);
        if (newE1rm) {
          const nextRes = await query(
            "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'backdown' AND set_order > $2 ORDER BY set_order LIMIT 1",
            [updatedSet.logged_exercise_id, updatedSet.set_order]
          );
          const nextBackdown = nextRes.rows[0];
          if (nextBackdown && nextBackdown.target_rpe) {
            const newLoad = calcBackdownLoad(newE1rm, nextBackdown.reps, nextBackdown.target_rpe);
            await query(
              'UPDATE logged_sets SET calculated_load_kg=$1, load_kg=$2, intensity_pct=$3 WHERE id=$4',
              [newLoad, newLoad, calcIntensityPct(newLoad, newE1rm), nextBackdown.id]
            );
          }
        }
      }
    }

    if (updatedSet.set_type === 'top') {
      const effectiveLoad = load_kg || updatedSet.load_kg;
      const effectiveReps = reps || updatedSet.reps;
      const effectiveRpe = actual_rpe || updatedSet.actual_rpe;
      if (effectiveLoad && effectiveReps && effectiveRpe) {
        const e1rm = calcE1RM(effectiveLoad, effectiveReps, effectiveRpe);
        if (e1rm) {
          const bdRes = await query(
            "SELECT * FROM logged_sets WHERE logged_exercise_id = $1 AND set_type = 'backdown' ORDER BY set_order",
            [updatedSet.logged_exercise_id]
          );
          for (const bd of bdRes.rows) {
            if (bd.target_rpe && bd.reps) {
              const calcLoad = calcBackdownLoad(e1rm, bd.reps, bd.target_rpe);
              await query(
                'UPDATE logged_sets SET calculated_load_kg=$1, load_kg=$2, intensity_pct=$3 WHERE id=$4',
                [calcLoad, calcLoad, calcIntensityPct(calcLoad, e1rm), bd.id]
              );
            }
          }
        }
      }
    }

    const exRes = await query('SELECT * FROM logged_exercises WHERE id = $1', [updatedSet.logged_exercise_id]);
    const ex = exRes.rows[0];
    const setsRes = await query('SELECT * FROM logged_sets WHERE logged_exercise_id = $1 ORDER BY set_order', [ex.id]);
    ex.sets = setsRes.rows;
    res.json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/sets/:setId/unlog
router.post('/sets/:setId/unlog', async (req, res) => {
  try {
    const setRes = await query('SELECT * FROM logged_sets WHERE id = $1', [req.params.setId]);
    const set = setRes.rows[0];
    if (!set) return res.status(404).json({ error: 'Set not found' });

    await query(
      'UPDATE logged_sets SET actual_rpe = NULL, load_kg = COALESCE(calculated_load_kg, load_kg), athlete_notes = NULL WHERE id = $1',
      [req.params.setId]
    );

    const exRes = await query('SELECT * FROM logged_exercises WHERE id = $1', [set.logged_exercise_id]);
    const ex = exRes.rows[0];
    const setsRes = await query('SELECT * FROM logged_sets WHERE logged_exercise_id = $1 ORDER BY set_order', [ex.id]);
    ex.sets = setsRes.rows;
    res.json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/sets/:setId/coach-notes
router.put('/sets/:setId/coach-notes', requireCoach, async (req, res) => {
  try {
    const { coach_notes } = req.body;
    await query('UPDATE logged_sets SET coach_notes = $1 WHERE id = $2', [coach_notes, req.params.setId]);
    const result = await query('SELECT * FROM logged_sets WHERE id = $1', [req.params.setId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
