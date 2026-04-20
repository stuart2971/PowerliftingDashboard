// Seed script - creates demo coach, athlete, full 2-week program + 4 cycles of history
// Run: node database/seed.js
require('dotenv').config();
const { query, initSchema } = require('./db');
const bcrypt = require('bcrypt');

// ── Helpers ──────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Simple E1RM estimate (Epley): weight * (1 + reps/30)
function e1rm(load, reps) {
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

function intensityPct(load, oneRm) {
  return Math.round((load / oneRm) * 100 * 10) / 10;
}

// ── Main ─────────────────────────────────────────────────────────
async function seed() {
  await initSchema();

  // Clear existing data (FK order)
  await query('DELETE FROM logged_sets');
  await query('DELETE FROM logged_exercises');
  await query('DELETE FROM training_sessions');
  await query('DELETE FROM program_sets');
  await query('DELETE FROM program_exercises');
  await query('DELETE FROM program_days');
  await query('DELETE FROM program_weeks');
  await query('DELETE FROM programs');
  await query('DELETE FROM personal_bests');
  await query('DELETE FROM athlete_profiles');
  await query('DELETE FROM users');

  console.log('Seeding database...');

  // ── Users ────────────────────────────────────────────────────
  const coachHash = await bcrypt.hash('coach123', 10);
  const coachRes = await query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
    ['coach@g5.com', coachHash, 'coach']
  );
  const coachId = coachRes.rows[0].id;

  const athHash = await bcrypt.hash('athlete123', 10);
  const athUserRes = await query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
    ['stuartbfong@gmail.com', athHash, 'athlete']
  );
  const athUserId = athUserRes.rows[0].id;

  // ── Athlete Profile ──────────────────────────────────────────
  const athRes = await query(`
    INSERT INTO athlete_profiles
      (user_id, coach_id, name, weight_class, division, competition, start_date, comp_date, payment_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [athUserId, coachId, 'Stuart Fong', 83, 'Open', 'Nationals 2026', '2026-02-09', '2026-09-15', 'paid']);
  const athId = athRes.rows[0].id;

  // ── Personal Bests ───────────────────────────────────────────
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'squat', 180, 1]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'squat', 157.5, 4]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'bench', 115, 1]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'bench', 105, 4]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'deadlift', 220, 1]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1,$2,$3,$4)', [athId, 'deadlift', 195, 4]);

  // ── Program ──────────────────────────────────────────────────
  const progRes = await query(
    'INSERT INTO programs (coach_id, athlete_id, name, description, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [coachId, athId, 'Nationals 2026 — Stuart Fong', '8-week peaking block leading into Nationals', true]
  );
  const progId = progRes.rows[0].id;

  // ── Week 1 ───────────────────────────────────────────────────
  const w1Res = await query(
    'INSERT INTO program_weeks (program_id, week_number, label) VALUES ($1,$2,$3) RETURNING id',
    [progId, 1, 'Intro']
  );
  const w1 = w1Res.rows[0].id;

  // Week 1 / Day 1 — Monday (Squat + Bench focus)
  const w1d1Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w1, 1, 'Monday']);
  const w1d1 = w1d1Res.rows[0].id;

  const sq1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d1, 0, 'Competition Squat']);
  const sq1 = sq1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1, 0, 'top', 3, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1, 1, 'backdown', 8, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1, 2, 'backdown', 8, 5]);

  const bp1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d1, 1, 'Competition Bench Press']);
  const bp1 = bp1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1, 0, 'top', 3, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1, 1, 'backdown', 8, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1, 2, 'backdown', 8, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1, 3, 'backdown', 8, 5]);

  const cp1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d1, 2, 'Chest Press']);
  const cp1 = cp1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp1, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp1, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp1, 2, 'backdown', 12, 8]);

  const tp1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d1, 3, 'Tricep Pushdown']);
  const tp1 = tp1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp1, 0, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp1, 1, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp1, 2, 'backdown', 15, 9]);

  // Week 1 / Day 2 — Wednesday (Deadlift focus)
  const w1d2Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w1, 2, 'Wednesday']);
  const w1d2 = w1d2Res.rows[0].id;

  const cgb1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d2, 0, 'Close Grip Bench']);
  const cgb1 = cgb1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb1, 0, 'top', 10, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb1, 1, 'backdown', 12, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb1, 2, 'backdown', 12, 5]);

  const dl1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d2, 1, 'Competition Deadlift']);
  const dl1 = dl1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl1, 0, 'top', 3, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl1, 1, 'backdown', 8, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl1, 2, 'backdown', 8, 5]);

  const mr1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d2, 3, 'Machine Row']);
  const mr1 = mr1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr1, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr1, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr1, 2, 'backdown', 12, 8]);

  const bc1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d2, 4, 'Bicep Curl']);
  const bc1 = bc1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc1, 0, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc1, 1, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc1, 2, 'backdown', 15, 9]);

  const bss1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d2, 5, 'Bulgarian Split Squat']);
  const bss1 = bss1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss1, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss1, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss1, 2, 'backdown', 12, 7]);

  // Week 1 / Day 3 — Friday (Squat/Bench volume)
  const w1d3Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w1, 3, 'Friday']);
  const w1d3 = w1d3Res.rows[0].id;

  const sq1bRes = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d3, 0, 'Competition Squat']);
  const sq1b = sq1bRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1b, 0, 'top', 5, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1b, 1, 'backdown', 10, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq1b, 2, 'backdown', 10, 5]);

  const bp1bRes = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d3, 1, 'Competition Bench Press']);
  const bp1b = bp1bRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1b, 0, 'top', 3, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1b, 1, 'backdown', 10, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1b, 2, 'backdown', 10, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp1b, 3, 'backdown', 10, 5]);

  const rd1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d3, 2, 'Rear Delt Flys']);
  const rd1 = rd1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd1, 0, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd1, 1, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd1, 2, 'backdown', 15, 8]);

  const ar1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d3, 3, 'Ab Rolls']);
  const ar1 = ar1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar1, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar1, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar1, 2, 'backdown', 12, 8]);

  const lr1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d3, 4, 'Lateral Raise']);
  const lr1 = lr1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr1, 0, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr1, 1, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr1, 2, 'backdown', 15, 8]);

  // Week 1 / Day 4 — Saturday (Accessories)
  const w1d4Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w1, 4, 'Saturday']);
  const w1d4 = w1d4Res.rows[0].id;

  const pdl1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d4, 0, 'Paused Deadlift']);
  const pdl1 = pdl1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl1, 0, 'top', 3, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl1, 1, 'backdown', 8, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl1, 2, 'backdown', 8, 5]);

  const tbp1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d4, 1, 'Tempo Bench Press']);
  const tbp1 = tbp1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp1, 0, 'top', 3, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp1, 1, 'backdown', 5, 5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp1, 2, 'backdown', 5, 5]);

  const lp1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d4, 2, 'Lat Pulldown']);
  const lp1 = lp1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp1, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp1, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp1, 2, 'backdown', 12, 7]);

  const dips1Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w1d4, 3, 'Dips']);
  const dips1 = dips1Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips1, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips1, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips1, 2, 'backdown', 12, 7]);

  // ── Week 2 ───────────────────────────────────────────────────
  const w2Res = await query(
    'INSERT INTO program_weeks (program_id, week_number, label) VALUES ($1,$2,$3) RETURNING id',
    [progId, 2, 'Build']
  );
  const w2 = w2Res.rows[0].id;

  // Week 2 / Day 1 — Monday
  const w2d1Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w2, 1, 'Monday']);
  const w2d1 = w2d1Res.rows[0].id;

  const sq2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d1, 0, 'Competition Squat']);
  const sq2 = sq2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2, 0, 'top', 3, 6.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2, 1, 'backdown', 8, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2, 2, 'backdown', 8, 5.5]);

  const bp2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d1, 1, 'Competition Bench Press']);
  const bp2 = bp2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2, 0, 'top', 3, 6.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2, 1, 'backdown', 8, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2, 2, 'backdown', 8, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2, 3, 'backdown', 8, 5.5]);

  const cp2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d1, 2, 'Chest Press']);
  const cp2 = cp2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp2, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp2, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cp2, 2, 'backdown', 12, 8]);

  const tp2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d1, 3, 'Tricep Pushdown']);
  const tp2 = tp2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp2, 0, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp2, 1, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tp2, 2, 'backdown', 15, 9]);

  // Week 2 / Day 2 — Wednesday
  const w2d2Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w2, 2, 'Wednesday']);
  const w2d2 = w2d2Res.rows[0].id;

  const cgb2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d2, 0, 'Close Grip Bench']);
  const cgb2 = cgb2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb2, 0, 'top', 10, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb2, 1, 'backdown', 12, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [cgb2, 2, 'backdown', 12, 5.5]);

  const dl2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d2, 2, 'Competition Deadlift']);
  const dl2 = dl2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl2, 0, 'top', 3, 6.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl2, 1, 'backdown', 8, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dl2, 2, 'backdown', 8, 5.5]);

  const mr2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d2, 3, 'Machine Row']);
  const mr2 = mr2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr2, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr2, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [mr2, 2, 'backdown', 12, 8]);

  const bc2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d2, 4, 'Bicep Curl']);
  const bc2 = bc2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc2, 0, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc2, 1, 'backdown', 15, 9]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bc2, 2, 'backdown', 15, 9]);

  const bss2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d2, 5, 'Bulgarian Split Squat']);
  const bss2 = bss2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss2, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss2, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bss2, 2, 'backdown', 12, 7]);

  // Week 2 / Day 3 — Friday
  const w2d3Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w2, 3, 'Friday']);
  const w2d3 = w2d3Res.rows[0].id;

  const sq2bRes = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d3, 0, 'Competition Squat']);
  const sq2b = sq2bRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2b, 0, 'top', 5, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2b, 1, 'backdown', 10, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sq2b, 2, 'backdown', 10, 5.5]);

  const bp2bRes = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d3, 1, 'Competition Bench Press']);
  const bp2b = bp2bRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2b, 0, 'top', 3, 6]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2b, 1, 'backdown', 10, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2b, 2, 'backdown', 10, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bp2b, 3, 'backdown', 10, 5.5]);

  const rd2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d3, 2, 'Rear Delt Flys']);
  const rd2 = rd2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd2, 0, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd2, 1, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [rd2, 2, 'backdown', 15, 8]);

  const ar2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d3, 3, 'Ab Rolls']);
  const ar2 = ar2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar2, 0, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar2, 1, 'backdown', 12, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [ar2, 2, 'backdown', 12, 8]);

  const lr2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d3, 4, 'Lateral Raise']);
  const lr2 = lr2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr2, 0, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr2, 1, 'backdown', 15, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lr2, 2, 'backdown', 15, 8]);

  // Week 2 / Day 4 — Saturday
  const w2d4Res = await query('INSERT INTO program_days (week_id, day_number, label) VALUES ($1,$2,$3) RETURNING id', [w2, 4, 'Saturday']);
  const w2d4 = w2d4Res.rows[0].id;

  const pdl2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d4, 0, 'Paused Deadlift']);
  const pdl2 = pdl2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl2, 0, 'top', 3, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl2, 1, 'backdown', 8, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [pdl2, 2, 'backdown', 8, 5.5]);

  const tbp2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d4, 1, 'Tempo Bench Press']);
  const tbp2 = tbp2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp2, 0, 'top', 3, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp2, 1, 'backdown', 5, 5.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [tbp2, 2, 'backdown', 5, 5.5]);

  const lp2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d4, 2, 'Lat Pulldown']);
  const lp2 = lp2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp2, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp2, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [lp2, 2, 'backdown', 12, 7]);

  const dips2Res = await query('INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1,$2,$3) RETURNING id', [w2d4, 3, 'Dips']);
  const dips2 = dips2Res.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips2, 0, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips2, 1, 'backdown', 12, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dips2, 2, 'backdown', 12, 7]);

  console.log('✓ Program structure created (2 weeks × 4 days)');

  // ── Logged History — 4 cycles (8 weeks) ──────────────────────
  // Program day IDs by week:
  // w1: Mon=w1d1, Wed=w1d2, Fri=w1d3, Sat=w1d4
  // w2: Mon=w2d1, Wed=w2d2, Fri=w2d3, Sat=w2d4
  //
  // Exercises per day (used for logged_exercises):
  // w1d1: sq1, bp1, cp1, tp1
  // w1d2: cgb1, dl1, mr1, bc1, bss1
  // w1d3: sq1b, bp1b, rd1, ar1, lr1
  // w1d4: pdl1, tbp1, lp1, dips1
  // (w2 mirrors w1 with same exercise names)

  // 1RM references for intensity calculations
  const SQ_1RM = 180, BP_1RM = 115, DL_1RM = 220;

  // Cycle progression: [squatTopKg, benchTopKg, deadliftTopKg, squatBDKg, benchBDKg, dlBDKg, actualRpe_top, actualRpe_bd]
  const cycles = [
    // Cycle 1 — 2026-02-09 (intro, low RPE)
    { w1Start: '2026-02-09', w2Start: '2026-02-16', sqTop: 130, bpTop: 80, dlTop: 160, sqBD: 115, bpBD: 70, dlBD: 140, rpeTop: 6, rpeBD: 5.5 },
    // Cycle 2 — 2026-02-23
    { w1Start: '2026-02-23', w2Start: '2026-03-02', sqTop: 137.5, bpTop: 82.5, dlTop: 167.5, sqBD: 120, bpBD: 72.5, dlBD: 147.5, rpeTop: 6.5, rpeBD: 6 },
    // Cycle 3 — 2026-03-09
    { w1Start: '2026-03-09', w2Start: '2026-03-16', sqTop: 145, bpTop: 85, dlTop: 175, sqBD: 127.5, bpBD: 75, dlBD: 155, rpeTop: 7, rpeBD: 6.5 },
    // Cycle 4 — 2026-03-23 (most recent, highest load/RPE)
    { w1Start: '2026-03-23', w2Start: '2026-03-30', sqTop: 152.5, bpTop: 87.5, dlTop: 182.5, sqBD: 132.5, bpBD: 77.5, dlBD: 162.5, rpeTop: 7.5, rpeBD: 7 },
  ];

  // Wellness cycling patterns
  const wellness = [
    { sleep: 'Good', mood: 'Good', motivation: 'Good', soreness: 'Good', fatigue: 'Good', readiness: 'Good' },
    { sleep: 'Great', mood: 'Great', motivation: 'Great', soreness: 'Good', fatigue: 'Good', readiness: 'Great' },
    { sleep: 'Fair', mood: 'Good', motivation: 'Good', soreness: 'Fair', fatigue: 'Good', readiness: 'Good' },
    { sleep: 'Good', mood: 'Good', motivation: 'Great', soreness: 'Good', fatigue: 'Good', readiness: 'Good' },
    { sleep: 'Good', mood: 'Fair', motivation: 'Good', soreness: 'Good', fatigue: 'Fair', readiness: 'Good' },
    { sleep: 'Great', mood: 'Good', motivation: 'Good', soreness: 'Great', fatigue: 'Good', readiness: 'Great' },
    { sleep: 'Fair', mood: 'Fair', motivation: 'Fair', soreness: 'Fair', fatigue: 'Fair', readiness: 'Fair' },
    { sleep: 'Good', mood: 'Good', motivation: 'Good', soreness: 'Good', fatigue: 'Good', readiness: 'Good' },
  ];

  let wellnessIdx = 0;

  async function logSession(programDayId, sessionDate, exercises) {
    // exercises: [{exId, name, sets: [{setType, reps, load, rpe}]}]
    const w = wellness[wellnessIdx % wellness.length];
    wellnessIdx++;

    const sessRes = await query(`
      INSERT INTO training_sessions
        (athlete_id, program_day_id, session_date, sleep, mood, motivation, soreness, fatigue, readiness)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [athId, programDayId, sessionDate, w.sleep, w.mood, w.motivation, w.soreness, w.fatigue, w.readiness]);
    const sessId = sessRes.rows[0].id;

    for (let ei = 0; ei < exercises.length; ei++) {
      const ex = exercises[ei];
      const leRes = await query(
        'INSERT INTO logged_exercises (session_id, program_exercise_id, exercise_name, exercise_order) VALUES ($1,$2,$3,$4) RETURNING id',
        [sessId, ex.exId, ex.name, ei]
      );
      const leId = leRes.rows[0].id;

      for (let si = 0; si < ex.sets.length; si++) {
        const s = ex.sets[si];
        const oneRm = ex.name.includes('Squat') ? SQ_1RM : ex.name.includes('Bench') || ex.name.includes('Tempo Bench') || ex.name.includes('Close Grip') ? BP_1RM : ex.name.includes('Deadlift') ? DL_1RM : null;
        const intPct = oneRm ? intensityPct(s.load, oneRm) : null;
        await query(`
          INSERT INTO logged_sets
            (logged_exercise_id, set_order, set_type, reps, load_kg, actual_rpe, target_rpe, intensity_pct)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [leId, si, s.setType, s.reps, s.load, s.rpe, s.targetRpe, intPct]);
      }
    }
  }

  for (const cyc of cycles) {
    // ── Cycle Week 1 ────────────────────────────────────────────
    const w1Mon = cyc.w1Start;
    const w1Wed = addDays(cyc.w1Start, 2);
    const w1Fri = addDays(cyc.w1Start, 4);
    const w1Sat = addDays(cyc.w1Start, 5);

    // Mon: Squat + Bench + Chest Press + Tricep
    await logSession(w1d1, w1Mon, [
      { exId: sq1, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 3, load: cyc.sqTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: bp1, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: cyc.bpTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: cp1, name: 'Chest Press', sets: [
        { setType: 'backdown', reps: 12, load: 40, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 40, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 40, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: tp1, name: 'Tricep Pushdown', sets: [
        { setType: 'backdown', reps: 15, load: 20, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 20, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 14, load: 20, rpe: 9.5, targetRpe: 9 },
      ]},
    ]);

    // Wed: Close Grip Bench + Deadlift + Machine Row + Bicep Curl + Bulgarian SS
    await logSession(w1d2, w1Wed, [
      { exId: cgb1, name: 'Close Grip Bench', sets: [
        { setType: 'top', reps: 10, load: Math.round(cyc.bpTop * 0.75 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5 },
        { setType: 'backdown', reps: 12, load: Math.round(cyc.bpBD * 0.75 * 2) / 2, rpe: cyc.rpeBD - 0.5, targetRpe: 5 },
        { setType: 'backdown', reps: 12, load: Math.round(cyc.bpBD * 0.75 * 2) / 2, rpe: cyc.rpeBD - 0.5, targetRpe: 5 },
      ]},
      { exId: dl1, name: 'Competition Deadlift', sets: [
        { setType: 'top', reps: 3, load: cyc.dlTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.dlBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.dlBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: mr1, name: 'Machine Row', sets: [
        { setType: 'backdown', reps: 12, load: 65, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 65, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 65, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: bc1, name: 'Bicep Curl', sets: [
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9.5, targetRpe: 9 },
      ]},
      { exId: bss1, name: 'Bulgarian Split Squat', sets: [
        { setType: 'backdown', reps: 12, load: 30, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 30, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 30, rpe: 7.5, targetRpe: 7 },
      ]},
    ]);

    // Fri: Squat + Bench volume + accessories
    await logSession(w1d3, w1Fri, [
      { exId: sq1b, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 5, load: Math.round(cyc.sqTop * 0.88 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: bp1b, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.bpTop * 0.9 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: rd1, name: 'Rear Delt Flys', sets: [
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      ]},
      { exId: ar1, name: 'Ab Rolls', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 8.5, targetRpe: 8 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 9, targetRpe: 8 },
      ]},
      { exId: lr1, name: 'Lateral Raise', sets: [
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8.5, targetRpe: 8 },
      ]},
    ]);

    // Sat: Accessories
    await logSession(w1d4, w1Sat, [
      { exId: pdl1, name: 'Paused Deadlift', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.dlTop * 0.7 * 2) / 2, rpe: cyc.rpeTop - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: Math.round(cyc.dlBD * 0.7 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: Math.round(cyc.dlBD * 0.7 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
      ]},
      { exId: tbp1, name: 'Tempo Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.bpTop * 0.72 * 2) / 2, rpe: cyc.rpeTop - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 5, load: Math.round(cyc.bpBD * 0.72 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 5, load: Math.round(cyc.bpBD * 0.72 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
      ]},
      { exId: lp1, name: 'Lat Pulldown', sets: [
        { setType: 'backdown', reps: 12, load: 55, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 55, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 55, rpe: 7.5, targetRpe: 7 },
      ]},
      { exId: dips1, name: 'Dips', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 8, targetRpe: 7 },
      ]},
    ]);

    // ── Cycle Week 2 ────────────────────────────────────────────
    const w2Mon = cyc.w2Start;
    const w2Wed = addDays(cyc.w2Start, 2);
    const w2Fri = addDays(cyc.w2Start, 4);
    const w2Sat = addDays(cyc.w2Start, 5);

    // Mon (slightly heavier than W1 Mon)
    const sqTop2 = cyc.sqTop + 2.5, bpTop2 = cyc.bpTop + 2.5, sqBD2 = cyc.sqBD + 2.5, bpBD2 = cyc.bpBD + 2.5;
    const rpeTop2 = Math.min(10, cyc.rpeTop + 0.5), rpeBD2 = Math.min(10, cyc.rpeBD + 0.5);

    await logSession(w2d1, w2Mon, [
      { exId: sq2, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 3, load: sqTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: sqBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: bp2, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: bpTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: cp2, name: 'Chest Press', sets: [
        { setType: 'backdown', reps: 12, load: 42.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 42.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 11, load: 42.5, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: tp2, name: 'Tricep Pushdown', sets: [
        { setType: 'backdown', reps: 15, load: 22.5, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 22.5, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 14, load: 22.5, rpe: 9.5, targetRpe: 9 },
      ]},
    ]);

    // Wed: Deadlift + accessories
    const dlTop2 = cyc.dlTop + 2.5, dlBD2 = cyc.dlBD + 2.5;

    await logSession(w2d2, w2Wed, [
      { exId: cgb2, name: 'Close Grip Bench', sets: [
        { setType: 'top', reps: 10, load: Math.round(bpTop2 * 0.75 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 12, load: Math.round(bpBD2 * 0.75 * 2) / 2, rpe: rpeBD2 - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 12, load: Math.round(bpBD2 * 0.75 * 2) / 2, rpe: rpeBD2 - 0.5, targetRpe: 5.5 },
      ]},
      { exId: dl2, name: 'Competition Deadlift', sets: [
        { setType: 'top', reps: 3, load: dlTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: dlBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: dlBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: mr2, name: 'Machine Row', sets: [
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: bc2, name: 'Bicep Curl', sets: [
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9.5, targetRpe: 9 },
      ]},
      { exId: bss2, name: 'Bulgarian Split Squat', sets: [
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7.5, targetRpe: 7 },
      ]},
    ]);

    // Fri: Volume day W2
    await logSession(w2d3, w2Fri, [
      { exId: sq2b, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 5, load: Math.round(sqTop2 * 0.88 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 6 },
        { setType: 'backdown', reps: 10, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: bp2b, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(bpTop2 * 0.9 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 6 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: rd2, name: 'Rear Delt Flys', sets: [
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      ]},
      { exId: ar2, name: 'Ab Rolls', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 8.5, targetRpe: 8 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 9, targetRpe: 8 },
      ]},
      { exId: lr2, name: 'Lateral Raise', sets: [
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 14, load: 8, rpe: 8.5, targetRpe: 8 },
      ]},
    ]);

    // Sat: Accessories W2
    await logSession(w2d4, w2Sat, [
      { exId: pdl2, name: 'Paused Deadlift', sets: [
        { setType: 'top', reps: 3, load: Math.round(dlTop2 * 0.7 * 2) / 2, rpe: rpeTop2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: Math.round(dlBD2 * 0.7 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: Math.round(dlBD2 * 0.7 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
      ]},
      { exId: tbp2, name: 'Tempo Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(bpTop2 * 0.72 * 2) / 2, rpe: rpeTop2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 5, load: Math.round(bpBD2 * 0.72 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 5, load: Math.round(bpBD2 * 0.72 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
      ]},
      { exId: lp2, name: 'Lat Pulldown', sets: [
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7.5, targetRpe: 7 },
      ]},
      { exId: dips2, name: 'Dips', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 8, targetRpe: 7 },
      ]},
    ]);

    console.log(`  ✓ Cycle logged: ${cyc.w1Start} – ${w2Sat}`);
  }

  // ── logSessionEx: explicit wellness + per-set athlete_notes ──────────────
  async function logSessionEx(programDayId, sessionDate, exercises, w) {
    const sessRes = await query(`
      INSERT INTO training_sessions
        (athlete_id, program_day_id, session_date, sleep, mood, motivation, soreness, fatigue, readiness, session_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [athId, programDayId, sessionDate, w.sleep, w.mood, w.motivation, w.soreness, w.fatigue, w.readiness, w.notes || null]);
    const sessId = sessRes.rows[0].id;
    for (let ei = 0; ei < exercises.length; ei++) {
      const ex = exercises[ei];
      const leRes = await query(
        'INSERT INTO logged_exercises (session_id, program_exercise_id, exercise_name, exercise_order) VALUES ($1,$2,$3,$4) RETURNING id',
        [sessId, ex.exId, ex.name, ei]
      );
      const leId = leRes.rows[0].id;
      for (let si = 0; si < ex.sets.length; si++) {
        const s = ex.sets[si];
        const oneRm = ex.name.includes('Squat') ? SQ_1RM
          : (ex.name.includes('Bench') || ex.name.includes('Close Grip')) ? BP_1RM
          : ex.name.includes('Deadlift') ? DL_1RM : null;
        const intPct = oneRm ? intensityPct(s.load, oneRm) : null;
        await query(`
          INSERT INTO logged_sets
            (logged_exercise_id, set_order, set_type, reps, load_kg, actual_rpe, target_rpe, intensity_pct, athlete_notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [leId, si, s.setType, s.reps, s.load, s.rpe, s.targetRpe, intPct, s.notes || null]);
      }
    }
  }

  // ── Cycle 5 — Week 1 generated sample (2026-04-07) ───────────────────────
  const c5 = { sqTop: 155, bpTop: 100, dlTop: 180, sqBD: 132.5, bpBD: 87.5, dlBD: 155, rpeTop: 4.5, rpeBD: 3.5 };

  await logSession(w1d1, '2026-04-07', [
    { exId: sq1, name: 'Competition Squat', sets: [
      { setType: 'top', reps: 3, load: c5.sqTop, rpe: c5.rpeTop, targetRpe: 6 },
      { setType: 'backdown', reps: 8, load: c5.sqBD, rpe: c5.rpeBD, targetRpe: 5.5 },
      { setType: 'backdown', reps: 8, load: c5.sqBD, rpe: c5.rpeBD, targetRpe: 5 },
    ]},
    { exId: bp1, name: 'Competition Bench Press', sets: [
      { setType: 'top', reps: 3, load: c5.bpTop, rpe: c5.rpeTop, targetRpe: 6 },
      { setType: 'backdown', reps: 8, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5.5 },
      { setType: 'backdown', reps: 8, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5 },
    ]},
    { exId: cp1, name: 'Chest Press', sets: [
      { setType: 'backdown', reps: 12, load: 47.5, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 47.5, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 47.5, rpe: 8.5, targetRpe: 8 },
    ]},
    { exId: tp1, name: 'Tricep Pushdown', sets: [
      { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 14, load: 15, rpe: 9.5, targetRpe: 9 },
    ]},
  ]);
  await logSession(w1d2, '2026-04-09', [
    { exId: cgb1, name: 'Close Grip Bench', sets: [
      { setType: 'top', reps: 10, load: Math.round(c5.bpTop * 0.75 * 2) / 2, rpe: c5.rpeTop - 0.5, targetRpe: 5 },
      { setType: 'backdown', reps: 12, load: Math.round(c5.bpBD * 0.75 * 2) / 2, rpe: c5.rpeBD - 0.5, targetRpe: 5 },
      { setType: 'backdown', reps: 12, load: Math.round(c5.bpBD * 0.75 * 2) / 2, rpe: c5.rpeBD - 0.5, targetRpe: 5 },
    ]},
    { exId: dl1, name: 'Competition Deadlift', sets: [
      { setType: 'top', reps: 3, load: c5.dlTop, rpe: c5.rpeTop, targetRpe: 6 },
      { setType: 'backdown', reps: 8, load: c5.dlBD, rpe: c5.rpeBD, targetRpe: 5.5 },
      { setType: 'backdown', reps: 8, load: c5.dlBD, rpe: c5.rpeBD, targetRpe: 5 },
    ]},
    { exId: mr1, name: 'Machine Row', sets: [
      { setType: 'backdown', reps: 12, load: 62.5, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 62.5, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 62.5, rpe: 8.5, targetRpe: 8 },
    ]},
    { exId: bc1, name: 'Bicep Curl', sets: [
      { setType: 'backdown', reps: 15, load: 12.5, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 15, load: 12.5, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 14, load: 12.5, rpe: 9.5, targetRpe: 9 },
    ]},
    { exId: bss1, name: 'Bulgarian Split Squat', sets: [
      { setType: 'backdown', reps: 12, load: 27.5, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 27.5, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 27.5, rpe: 7.5, targetRpe: 7 },
    ]},
  ]);
  await logSession(w1d3, '2026-04-11', [
    { exId: sq1b, name: 'Competition Squat', sets: [
      { setType: 'top', reps: 5, load: Math.round(c5.sqTop * 0.88 * 2) / 2, rpe: c5.rpeTop - 0.5, targetRpe: 5.5 },
      { setType: 'backdown', reps: 10, load: c5.sqBD, rpe: c5.rpeBD, targetRpe: 5 },
      { setType: 'backdown', reps: 10, load: c5.sqBD, rpe: c5.rpeBD, targetRpe: 5 },
    ]},
    { exId: bp1b, name: 'Competition Bench Press', sets: [
      { setType: 'top', reps: 3, load: Math.round(c5.bpTop * 0.9 * 2) / 2, rpe: c5.rpeTop - 0.5, targetRpe: 5.5 },
      { setType: 'backdown', reps: 10, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5 },
      { setType: 'backdown', reps: 10, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5 },
      { setType: 'backdown', reps: 10, load: c5.bpBD, rpe: c5.rpeBD, targetRpe: 5 },
    ]},
    { exId: rd1, name: 'Rear Delt Flys', sets: [
      { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
    ]},
    { exId: ar1, name: 'Ab Rolls', sets: [
      { setType: 'backdown', reps: 12, load: 0, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 0, rpe: 8.5, targetRpe: 8 },
      { setType: 'backdown', reps: 10, load: 0, rpe: 9, targetRpe: 8 },
    ]},
    { exId: lr1, name: 'Lateral Raise', sets: [
      { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 15, load: 8, rpe: 8.5, targetRpe: 8 },
    ]},
  ]);
  await logSession(w1d4, '2026-04-12', [
    { exId: pdl1, name: 'Paused Deadlift', sets: [
      { setType: 'top', reps: 6, load: Math.round(c5.dlTop * 0.7 * 2) / 2, rpe: c5.rpeTop - 1, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: Math.round(c5.dlBD * 0.7 * 2) / 2, rpe: c5.rpeBD - 1, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: Math.round(c5.dlBD * 0.7 * 2) / 2, rpe: c5.rpeBD - 1, targetRpe: 5 },
    ]},
    { exId: tbp1, name: 'Tempo Bench Press', sets: [
      { setType: 'top', reps: 3, load: Math.round(c5.bpTop * 0.72 * 2) / 2, rpe: c5.rpeTop - 1, targetRpe: 5 },
      { setType: 'backdown', reps: 5, load: Math.round(c5.bpBD * 0.72 * 2) / 2, rpe: c5.rpeBD - 1, targetRpe: 5 },
      { setType: 'backdown', reps: 5, load: Math.round(c5.bpBD * 0.72 * 2) / 2, rpe: c5.rpeBD - 1, targetRpe: 5 },
    ]},
    { exId: lp1, name: 'Lat Pulldown', sets: [
      { setType: 'backdown', reps: 12, load: 52.5, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 52.5, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 52.5, rpe: 7.5, targetRpe: 7 },
    ]},
    { exId: dips1, name: 'Dips', sets: [
      { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 10, load: 0, rpe: 8, targetRpe: 7 },
    ]},
  ]);
  console.log('  ✓ Cycle 5 Week 1 logged: 2026-04-07 – 2026-04-12 (generated sample)');

  // ── Cycle 5 — Week 2 CSV data (2026-04-14 to 2026-04-19) ─────────────────
  // Day 1 Monday — Squat + Bench + accessories
  await logSessionEx(w2d1, '2026-04-14', [
    { exId: sq2, name: 'Competition Squat', sets: [
      { setType: 'top', reps: 1, load: 160, rpe: 5, targetRpe: 5, notes: "Been having a lot of wrist pain before my break that's still hurting. Trying a wider grip" },
      { setType: 'backdown', reps: 6, load: 137.5, rpe: 4, targetRpe: 5 },
      { setType: 'backdown', reps: 6, load: 145, rpe: 5, targetRpe: 5 },
    ]},
    { exId: bp2, name: 'Competition Bench Press', sets: [
      { setType: 'top', reps: 1, load: 105, rpe: 4, targetRpe: 4 },
      { setType: 'backdown', reps: 6, load: 92.5, rpe: 5, targetRpe: 5 },
      { setType: 'backdown', reps: 6, load: 92.5, rpe: 6, targetRpe: 5 },
      { setType: 'backdown', reps: 6, load: 87.5, rpe: 4, targetRpe: 5 },
    ]},
    { exId: cp2, name: 'Chest Press', sets: [
      { setType: 'backdown', reps: 12, load: 50, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 50, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 50, rpe: 9, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 50, rpe: 9, targetRpe: 8 },
    ]},
    { exId: tp2, name: 'Tricep Pushdown', sets: [
      { setType: 'backdown', reps: 13, load: 15, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 13, load: 15, rpe: 9, targetRpe: 9 },
    ]},
  ], { sleep: 'Fair', mood: 'Fair', motivation: 'Good', soreness: 'Great', fatigue: 'Great', readiness: 'Fair', notes: 'Back from 2 week break and sick the past 2 days' });

  // Day 2 Wednesday — Deadlift + Close Grip + accessories
  await logSessionEx(w2d2, '2026-04-16', [
    { exId: cgb2, name: 'Close Grip Bench', sets: [
      { setType: 'top', reps: 8, load: 80, rpe: 4, targetRpe: 5 },
      { setType: 'backdown', reps: 10, load: 77.5, rpe: 5.5, targetRpe: 5 },
      { setType: 'backdown', reps: 10, load: 75, rpe: 5, targetRpe: 5 },
    ]},
    { exId: dl2, name: 'Competition Deadlift', sets: [
      { setType: 'top', reps: 1, load: 185, rpe: 5, targetRpe: 5 },
      { setType: 'backdown', reps: 6, load: 157.5, rpe: 4, targetRpe: 5 },
      { setType: 'backdown', reps: 6, load: 167.5, rpe: 5, targetRpe: 5 },
    ]},
    { exId: mr2, name: 'Machine Row', sets: [
      { setType: 'backdown', reps: 12, load: 25, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 25, rpe: 8, targetRpe: 8 },
    ]},
    { exId: bc2, name: 'Bicep Curl', sets: [
      { setType: 'backdown', reps: 13, load: 10, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 13, load: 10, rpe: 9, targetRpe: 9 },
    ]},
    { exId: bss2, name: 'Bulgarian Split Squat', sets: [
      { setType: 'backdown', reps: 12, load: 20, rpe: 7, targetRpe: 7, notes: 'Bulgarians causing hamstring pain. Switched for leg press.' },
      { setType: 'backdown', reps: 12, load: 20, rpe: 7, targetRpe: 7 },
    ]},
  ], { sleep: 'Poor', mood: 'Good', motivation: 'Good', soreness: 'Poor', fatigue: 'Great', readiness: 'Good' });

  // Day 3 Friday — Squat volume + Bench + accessories
  await logSessionEx(w2d3, '2026-04-18', [
    { exId: sq2b, name: 'Competition Squat', sets: [
      { setType: 'top', reps: 4, load: 150, rpe: 6, targetRpe: 5, notes: 'Glute pain at lockout. Kept backdown at 125' },
      { setType: 'backdown', reps: 8, load: 125, rpe: 2, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: 147.5, rpe: 3, targetRpe: 5 },
    ]},
    { exId: bp2b, name: 'Competition Bench Press', sets: [
      { setType: 'top', reps: 1, load: 107, rpe: 5, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: 82.5, rpe: 4, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: 87.5, rpe: 6, targetRpe: 5 },
      { setType: 'backdown', reps: 8, load: 82.5, rpe: 4, targetRpe: 5 },
    ]},
    { exId: rd2, name: 'Rear Delt Flys', sets: [
      { setType: 'backdown', reps: 13, load: 8, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 13, load: 8, rpe: 9, targetRpe: 9 },
    ]},
    { exId: ar2, name: 'Ab Rolls', sets: [
      { setType: 'backdown', reps: 13, load: 0, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 13, load: 0, rpe: 9, targetRpe: 9 },
    ]},
    { exId: lr2, name: 'Lateral Raise', sets: [
      { setType: 'backdown', reps: 13, load: 8, rpe: 9, targetRpe: 9 },
      { setType: 'backdown', reps: 13, load: 8, rpe: 9, targetRpe: 9 },
    ]},
  ], { sleep: 'Fair', mood: 'Poor', motivation: 'Poor', soreness: 'Poor', fatigue: 'Poor', readiness: 'Poor' });

  // Day 4 Saturday — Paused DL + Tempo Bench + accessories (no questionnaire in CSV → sample)
  await logSessionEx(w2d4, '2026-04-19', [
    { exId: pdl2, name: 'Paused Deadlift', sets: [
      { setType: 'top', reps: 6, load: 140, rpe: 4, targetRpe: 4 },
      { setType: 'backdown', reps: 8, load: 127.5, rpe: 4, targetRpe: 4 },
      { setType: 'backdown', reps: 8, load: 127.5, rpe: 4, targetRpe: 4 },
    ]},
    { exId: tbp2, name: 'Tempo Bench Press', sets: [
      { setType: 'top', reps: 1, load: 100, rpe: 4, targetRpe: 4 },
      { setType: 'backdown', reps: 3, load: 95, rpe: 4, targetRpe: 4 },
      { setType: 'backdown', reps: 3, load: 95, rpe: 4, targetRpe: 4 },
    ]},
    { exId: dips2, name: 'Dips', sets: [
      { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 10, rpe: 7, targetRpe: 7 },
      { setType: 'backdown', reps: 12, load: 10, rpe: 7, targetRpe: 7 },
    ]},
    { exId: lp2, name: 'Lat Pulldown', sets: [
      { setType: 'backdown', reps: 12, load: 55, rpe: 8, targetRpe: 8 },
      { setType: 'backdown', reps: 12, load: 55, rpe: 8, targetRpe: 8 },
    ]},
  ], { sleep: 'Good', mood: 'Good', motivation: 'Good', soreness: 'Good', fatigue: 'Good', readiness: 'Good' });

  console.log('  ✓ Cycle 5 Week 2 logged: 2026-04-14 – 2026-04-19 (CSV data)');

  // ── Cycles 6–11 — identical structure, RPE +0.5 per cycle up to 8 ────────
  const extCycles = [
    { w1Start: '2026-04-28', w2Start: '2026-05-05', sqTop: 162.5, bpTop: 107.5, dlTop: 190,   sqBD: 142.5, bpBD: 90,    dlBD: 162.5, rpeTop: 5.5, rpeBD: 4.5 },
    { w1Start: '2026-05-12', w2Start: '2026-05-19', sqTop: 165,   bpTop: 110,   dlTop: 195,   sqBD: 145,   bpBD: 92.5,  dlBD: 167.5, rpeTop: 6,   rpeBD: 5   },
    { w1Start: '2026-05-26', w2Start: '2026-06-02', sqTop: 167.5, bpTop: 112.5, dlTop: 200,   sqBD: 147.5, bpBD: 95,    dlBD: 172.5, rpeTop: 6.5, rpeBD: 5.5 },
    { w1Start: '2026-06-09', w2Start: '2026-06-16', sqTop: 170,   bpTop: 115,   dlTop: 205,   sqBD: 150,   bpBD: 97.5,  dlBD: 177.5, rpeTop: 7,   rpeBD: 6   },
    { w1Start: '2026-06-23', w2Start: '2026-06-30', sqTop: 172.5, bpTop: 117.5, dlTop: 210,   sqBD: 152.5, bpBD: 100,   dlBD: 182.5, rpeTop: 7.5, rpeBD: 6.5 },
    { w1Start: '2026-07-07', w2Start: '2026-07-14', sqTop: 175,   bpTop: 120,   dlTop: 215,   sqBD: 155,   bpBD: 102.5, dlBD: 187.5, rpeTop: 8,   rpeBD: 7   },
  ];

  for (const cyc of extCycles) {
    const w1Mon = cyc.w1Start;
    const w1Wed = addDays(cyc.w1Start, 2);
    const w1Fri = addDays(cyc.w1Start, 4);
    const w1Sat = addDays(cyc.w1Start, 5);

    await logSession(w1d1, w1Mon, [
      { exId: sq1, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 3, load: cyc.sqTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: bp1, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: cyc.bpTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: cp1, name: 'Chest Press', sets: [
        { setType: 'backdown', reps: 12, load: 50, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 50, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 50, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: tp1, name: 'Tricep Pushdown', sets: [
        { setType: 'backdown', reps: 15, load: 20, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 20, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 14, load: 20, rpe: 9.5, targetRpe: 9 },
      ]},
    ]);
    await logSession(w1d2, w1Wed, [
      { exId: cgb1, name: 'Close Grip Bench', sets: [
        { setType: 'top', reps: 10, load: Math.round(cyc.bpTop * 0.75 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5 },
        { setType: 'backdown', reps: 12, load: Math.round(cyc.bpBD * 0.75 * 2) / 2, rpe: cyc.rpeBD - 0.5, targetRpe: 5 },
        { setType: 'backdown', reps: 12, load: Math.round(cyc.bpBD * 0.75 * 2) / 2, rpe: cyc.rpeBD - 0.5, targetRpe: 5 },
      ]},
      { exId: dl1, name: 'Competition Deadlift', sets: [
        { setType: 'top', reps: 3, load: cyc.dlTop, rpe: cyc.rpeTop, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: cyc.dlBD, rpe: cyc.rpeBD, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: cyc.dlBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: mr1, name: 'Machine Row', sets: [
        { setType: 'backdown', reps: 12, load: 65, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 65, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 65, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: bc1, name: 'Bicep Curl', sets: [
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9.5, targetRpe: 9 },
      ]},
      { exId: bss1, name: 'Bulgarian Split Squat', sets: [
        { setType: 'backdown', reps: 12, load: 30, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 30, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 30, rpe: 7.5, targetRpe: 7 },
      ]},
    ]);
    await logSession(w1d3, w1Fri, [
      { exId: sq1b, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 5, load: Math.round(cyc.sqTop * 0.88 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.sqBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: bp1b, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.bpTop * 0.9 * 2) / 2, rpe: cyc.rpeTop - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
        { setType: 'backdown', reps: 10, load: cyc.bpBD, rpe: cyc.rpeBD, targetRpe: 5 },
      ]},
      { exId: rd1, name: 'Rear Delt Flys', sets: [
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      ]},
      { exId: ar1, name: 'Ab Rolls', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 8.5, targetRpe: 8 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 9, targetRpe: 8 },
      ]},
      { exId: lr1, name: 'Lateral Raise', sets: [
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8.5, targetRpe: 8 },
      ]},
    ]);
    await logSession(w1d4, w1Sat, [
      { exId: pdl1, name: 'Paused Deadlift', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.dlTop * 0.7 * 2) / 2, rpe: cyc.rpeTop - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: Math.round(cyc.dlBD * 0.7 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 8, load: Math.round(cyc.dlBD * 0.7 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
      ]},
      { exId: tbp1, name: 'Tempo Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(cyc.bpTop * 0.72 * 2) / 2, rpe: cyc.rpeTop - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 5, load: Math.round(cyc.bpBD * 0.72 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
        { setType: 'backdown', reps: 5, load: Math.round(cyc.bpBD * 0.72 * 2) / 2, rpe: cyc.rpeBD - 1, targetRpe: 5 },
      ]},
      { exId: lp1, name: 'Lat Pulldown', sets: [
        { setType: 'backdown', reps: 12, load: 55, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 55, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 55, rpe: 7.5, targetRpe: 7 },
      ]},
      { exId: dips1, name: 'Dips', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 8, targetRpe: 7 },
      ]},
    ]);

    const w2Mon = cyc.w2Start;
    const w2Wed = addDays(cyc.w2Start, 2);
    const w2Fri = addDays(cyc.w2Start, 4);
    const w2Sat = addDays(cyc.w2Start, 5);
    const sqTop2 = cyc.sqTop + 2.5, bpTop2 = cyc.bpTop + 2.5, sqBD2 = cyc.sqBD + 2.5, bpBD2 = cyc.bpBD + 2.5;
    const rpeTop2 = Math.min(10, cyc.rpeTop + 0.5), rpeBD2 = Math.min(10, cyc.rpeBD + 0.5);
    const dlTop2 = cyc.dlTop + 2.5, dlBD2 = cyc.dlBD + 2.5;

    await logSession(w2d1, w2Mon, [
      { exId: sq2, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 3, load: sqTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: sqBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: bp2, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: bpTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: cp2, name: 'Chest Press', sets: [
        { setType: 'backdown', reps: 12, load: 52.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 52.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 11, load: 52.5, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: tp2, name: 'Tricep Pushdown', sets: [
        { setType: 'backdown', reps: 15, load: 22.5, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 22.5, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 14, load: 22.5, rpe: 9.5, targetRpe: 9 },
      ]},
    ]);
    await logSession(w2d2, w2Wed, [
      { exId: cgb2, name: 'Close Grip Bench', sets: [
        { setType: 'top', reps: 10, load: Math.round(bpTop2 * 0.75 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 12, load: Math.round(bpBD2 * 0.75 * 2) / 2, rpe: rpeBD2 - 0.5, targetRpe: 5.5 },
        { setType: 'backdown', reps: 12, load: Math.round(bpBD2 * 0.75 * 2) / 2, rpe: rpeBD2 - 0.5, targetRpe: 5.5 },
      ]},
      { exId: dl2, name: 'Competition Deadlift', sets: [
        { setType: 'top', reps: 3, load: dlTop2, rpe: rpeTop2, targetRpe: 6.5 },
        { setType: 'backdown', reps: 8, load: dlBD2, rpe: rpeBD2, targetRpe: 6 },
        { setType: 'backdown', reps: 8, load: dlBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: mr2, name: 'Machine Row', sets: [
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 67.5, rpe: 8.5, targetRpe: 8 },
      ]},
      { exId: bc2, name: 'Bicep Curl', sets: [
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9, targetRpe: 9 },
        { setType: 'backdown', reps: 15, load: 15, rpe: 9.5, targetRpe: 9 },
      ]},
      { exId: bss2, name: 'Bulgarian Split Squat', sets: [
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 32.5, rpe: 7.5, targetRpe: 7 },
      ]},
    ]);
    await logSession(w2d3, w2Fri, [
      { exId: sq2b, name: 'Competition Squat', sets: [
        { setType: 'top', reps: 5, load: Math.round(sqTop2 * 0.88 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 6 },
        { setType: 'backdown', reps: 10, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: sqBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: bp2b, name: 'Competition Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(bpTop2 * 0.9 * 2) / 2, rpe: rpeTop2 - 0.5, targetRpe: 6 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
        { setType: 'backdown', reps: 10, load: bpBD2, rpe: rpeBD2, targetRpe: 5.5 },
      ]},
      { exId: rd2, name: 'Rear Delt Flys', sets: [
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 10, rpe: 8, targetRpe: 8 },
      ]},
      { exId: ar2, name: 'Ab Rolls', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 8.5, targetRpe: 8 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 9, targetRpe: 8 },
      ]},
      { exId: lr2, name: 'Lateral Raise', sets: [
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 15, load: 8, rpe: 8, targetRpe: 8 },
        { setType: 'backdown', reps: 14, load: 8, rpe: 8.5, targetRpe: 8 },
      ]},
    ]);
    await logSession(w2d4, w2Sat, [
      { exId: pdl2, name: 'Paused Deadlift', sets: [
        { setType: 'top', reps: 3, load: Math.round(dlTop2 * 0.7 * 2) / 2, rpe: rpeTop2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: Math.round(dlBD2 * 0.7 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 8, load: Math.round(dlBD2 * 0.7 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
      ]},
      { exId: tbp2, name: 'Tempo Bench Press', sets: [
        { setType: 'top', reps: 3, load: Math.round(bpTop2 * 0.72 * 2) / 2, rpe: rpeTop2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 5, load: Math.round(bpBD2 * 0.72 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
        { setType: 'backdown', reps: 5, load: Math.round(bpBD2 * 0.72 * 2) / 2, rpe: rpeBD2 - 1, targetRpe: 5.5 },
      ]},
      { exId: lp2, name: 'Lat Pulldown', sets: [
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 57.5, rpe: 7.5, targetRpe: 7 },
      ]},
      { exId: dips2, name: 'Dips', sets: [
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 12, load: 0, rpe: 7, targetRpe: 7 },
        { setType: 'backdown', reps: 10, load: 0, rpe: 8, targetRpe: 7 },
      ]},
    ]);
    console.log(`  ✓ Cycle logged: ${cyc.w1Start} – ${w2Sat} (RPE top ${cyc.rpeTop}→${rpeTop2})`);
  }

  console.log('\n✓ Seed complete!\n');
  console.log('Coach login:   coach@g5.com / coach123');
  console.log('Athlete login: stuartbfong@gmail.com / athlete123');
  console.log('Program:       Nationals 2026 — Stuart Fong (2 weeks × 4 days)');
  console.log('History:       4 cycles (8 weeks) of logged sessions\n');
  console.log('Start server:  npm run dev');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
