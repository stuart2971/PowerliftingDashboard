const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireCoach } = require('../middleware/roles');

router.use(authenticate);

// GET /api/athletes
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'coach') {
      const result = await query(`
        SELECT ap.*, u.email
        FROM athlete_profiles ap
        JOIN users u ON u.id = ap.user_id
        WHERE ap.coach_id = $1
        ORDER BY ap.name
      `, [req.user.id]);
      return res.json(result.rows);
    }
    const result = await query(`
      SELECT ap.*, u.email
      FROM athlete_profiles ap
      JOIN users u ON u.id = ap.user_id
      WHERE ap.user_id = $1
    `, [req.user.id]);
    res.json(result.rows.length ? result.rows : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes — coach creates an athlete
router.post('/', requireCoach, async (req, res) => {
  const { email, password, name, weight_class, age, division, competition, start_date, comp_date } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const userResult = await query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase().trim(), hash, 'athlete']
    );
    const userId = userResult.rows[0].id;

    const profileResult = await query(`
      INSERT INTO athlete_profiles
        (user_id, coach_id, name, weight_class, age, division, competition, start_date, comp_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [userId, req.user.id, name, weight_class || null, age || null,
        division || 'Open', competition || 'N/A', start_date || null, comp_date || null]);

    const profileId = profileResult.rows[0].id;
    const profile = await query(
      'SELECT ap.*, u.email FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.id = $1',
      [profileId]
    );
    res.status(201).json(profile.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create athlete' });
  }
});

// GET /api/athletes/:id/exercise-data?type=squat|bench|deadlift
router.get('/:id/exercise-data', async (req, res) => {
  try {
    // Athletes can only view their own data; coaches can view any
    if (req.user.role === 'athlete') {
      const ownRes = await query('SELECT id FROM athlete_profiles WHERE user_id = $1', [req.user.id]);
      const own = ownRes.rows[0];
      if (!own || String(own.id) !== String(req.params.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { type } = req.query;
    if (!type) return res.json([]);

    const keywords = {
      squat: ['squat'],
      bench: ['bench'],
      deadlift: ['deadlift', 'dead lift']
    }[type.toLowerCase()];
    if (!keywords) return res.json([]);

    // Build ILIKE clauses with positional params starting at $2
    const likeClauses = keywords.map((_, i) => `le.exercise_name ILIKE $${i + 2}`).join(' OR ');
    const likeParams = keywords.map(k => `%${k}%`);

    const result = await query(`
      SELECT
        ls.id, ls.set_type, ls.reps, ls.load_kg, ls.actual_rpe, ls.target_rpe, ls.intensity_pct,
        ts.session_date,
        ts.sleep, ts.mood, ts.motivation, ts.soreness, ts.fatigue, ts.readiness,
        ts.session_notes AS notes,
        le.exercise_name
      FROM logged_sets ls
      JOIN logged_exercises le ON le.id = ls.logged_exercise_id
      JOIN training_sessions ts ON ts.id = le.session_id
      JOIN athlete_profiles ap ON ap.id = ts.athlete_id
      WHERE ap.id = $1
        AND ls.load_kg IS NOT NULL
        AND ls.actual_rpe IS NOT NULL
        AND (${likeClauses})
      ORDER BY ts.session_date DESC, ts.id DESC, ls.set_order ASC
    `, [req.params.id, ...likeParams]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athletes/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT ap.*, u.email
      FROM athlete_profiles ap
      JOIN users u ON u.id = ap.user_id
      WHERE ap.id = $1
    `, [req.params.id]);
    const profile = result.rows[0];
    if (!profile) return res.status(404).json({ error: 'Athlete not found' });
    if (req.user.role === 'athlete' && profile.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athletes/:id
router.put('/:id', async (req, res) => {
  try {
    const checkRes = await query('SELECT * FROM athlete_profiles WHERE id = $1', [req.params.id]);
    const profile = checkRes.rows[0];
    if (!profile) return res.status(404).json({ error: 'Athlete not found' });
    if (req.user.role === 'athlete' && profile.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, weight_class, age, division, competition, start_date, comp_date, payment_status, payment_start, notes } = req.body;
    await query(`
      UPDATE athlete_profiles SET
        name           = COALESCE($1, name),
        weight_class   = COALESCE($2, weight_class),
        age            = COALESCE($3, age),
        division       = COALESCE($4, division),
        competition    = COALESCE($5, competition),
        start_date     = COALESCE($6, start_date),
        comp_date      = COALESCE($7, comp_date),
        payment_status = COALESCE($8, payment_status),
        payment_start  = COALESCE($9, payment_start),
        notes          = COALESCE($10, notes)
      WHERE id = $11
    `, [name, weight_class, age, division, competition, start_date, comp_date, payment_status, payment_start, notes, req.params.id]);

    const updated = await query(
      'SELECT ap.*, u.email FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.id = $1',
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athletes/:id/pbs
router.get('/:id/pbs', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM personal_bests WHERE athlete_id = $1 ORDER BY lift, load_kg DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes/:id/pbs
router.post('/:id/pbs', async (req, res) => {
  try {
    const { lift, load_kg, reps, achieved_at, notes } = req.body;
    if (!lift || !load_kg) return res.status(400).json({ error: 'lift and load_kg required' });
    const result = await query(
      'INSERT INTO personal_bests (athlete_id, lift, load_kg, reps, achieved_at, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, lift, load_kg, reps || 1, achieved_at || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/athletes/:id/pbs/:pbId
router.delete('/:id/pbs/:pbId', requireCoach, async (req, res) => {
  try {
    await query('DELETE FROM personal_bests WHERE id = $1 AND athlete_id = $2', [req.params.pbId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
