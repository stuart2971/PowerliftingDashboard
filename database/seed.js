// Seed script - creates demo coach, athlete, program
// Run: node database/seed.js
require('dotenv').config();
const { query, initSchema } = require('./db');
const bcrypt = require('bcrypt');

async function seed() {
  await initSchema();

  // Clear existing data (order matters for FK constraints)
  await query(`
    DELETE FROM logged_sets;
    DELETE FROM logged_exercises;
    DELETE FROM training_sessions;
    DELETE FROM program_sets;
    DELETE FROM program_exercises;
    DELETE FROM program_days;
    DELETE FROM program_weeks;
    DELETE FROM programs;
    DELETE FROM personal_bests;
    DELETE FROM athlete_profiles;
    DELETE FROM users;
  `);

  console.log('Seeding database...');

  // Coach
  const coachHash = await bcrypt.hash('coach123', 10);
  const coachRes = await query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
    ['coach@g5.com', coachHash, 'coach']
  );
  const coachId = coachRes.rows[0].id;

  // Athlete user
  const athHash = await bcrypt.hash('athlete123', 10);
  const athUserRes = await query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
    ['stuartbfong@gmail.com', athHash, 'athlete']
  );
  const athUserId = athUserRes.rows[0].id;

  // Athlete profile
  const athRes = await query(`
    INSERT INTO athlete_profiles
      (user_id, coach_id, name, weight_class, division, competition, start_date, comp_date, payment_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [athUserId, coachId, 'Stuart Fong', 83, 'Open', 'N/A', '2026-03-23', '2026-09-15', 'unpaid']);
  const athId = athRes.rows[0].id;

  // Personal bests
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1, $2, $3, $4)', [athId, 'squat', 180, 1]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1, $2, $3, $4)', [athId, 'squat', 157.5, 4]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1, $2, $3, $4)', [athId, 'bench', 115, 1]);
  await query('INSERT INTO personal_bests (athlete_id, lift, load_kg, reps) VALUES ($1, $2, $3, $4)', [athId, 'bench', 105, 4]);

  // Program
  const progRes = await query(
    'INSERT INTO programs (coach_id, athlete_id, name, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
    [coachId, athId, 'Week 1 — Stuart Fong', true]
  );
  const progId = progRes.rows[0].id;

  // Week 1
  const weekRes = await query(
    'INSERT INTO program_weeks (program_id, week_number, label) VALUES ($1, $2, $3) RETURNING id',
    [progId, 1, '']
  );
  const weekId = weekRes.rows[0].id;

  // Day 1 - Monday
  const day1Res = await query(
    'INSERT INTO program_days (week_id, day_number, label) VALUES ($1, $2, $3) RETURNING id',
    [weekId, 1, 'Monday']
  );
  const day1Id = day1Res.rows[0].id;

  // Competition Squat
  const sqRes = await query(
    'INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1, $2, $3) RETURNING id',
    [day1Id, 0, 'Competition Squat x 2@8']
  );
  const sqId = sqRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sqId, 0, 'top', 2, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sqId, 1, 'backdown', 4, 7.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [sqId, 2, 'backdown', 4, 7]);

  // Competition Bench Press
  const bpRes = await query(
    'INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1, $2, $3) RETURNING id',
    [day1Id, 1, 'Competition Bench Press x 1@7']
  );
  const bpId = bpRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bpId, 0, 'top', 1, 7]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bpId, 1, 'backdown', 4, 7.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bpId, 2, 'backdown', 4, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [bpId, 3, 'backdown', 4, 8]);

  // Day 2 - Wednesday
  const day2Res = await query(
    'INSERT INTO program_days (week_id, day_number, label) VALUES ($1, $2, $3) RETURNING id',
    [weekId, 2, 'Wednesday']
  );
  const day2Id = day2Res.rows[0].id;

  // Competition Deadlift
  const dlRes = await query(
    'INSERT INTO program_exercises (day_id, exercise_order, name) VALUES ($1, $2, $3) RETURNING id',
    [day2Id, 0, 'Competition Deadlift x 2@8']
  );
  const dlId = dlRes.rows[0].id;
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dlId, 0, 'top', 2, 8]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dlId, 1, 'backdown', 4, 7.5]);
  await query('INSERT INTO program_sets (exercise_id, set_order, set_type, reps, target_rpe) VALUES ($1,$2,$3,$4,$5)', [dlId, 2, 'backdown', 4, 7]);

  console.log('\n✓ Seed complete!\n');
  console.log('Coach login:   coach@g5.com / coach123');
  console.log('Athlete login: stuartbfong@gmail.com / athlete123');
  console.log('\nStart server:  npm run dev');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
