const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('coach','athlete')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS athlete_profiles (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER UNIQUE NOT NULL REFERENCES users(id),
      coach_id       INTEGER REFERENCES users(id),
      name           TEXT NOT NULL,
      weight_class   TEXT,
      age            INTEGER,
      division       TEXT DEFAULT 'Open',
      competition    TEXT DEFAULT 'N/A',
      start_date     TEXT,
      comp_date      TEXT,
      payment_start  TEXT,
      payment_status TEXT DEFAULT 'unpaid',
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS personal_bests (
      id          SERIAL PRIMARY KEY,
      athlete_id  INTEGER NOT NULL REFERENCES athlete_profiles(id),
      lift        TEXT NOT NULL CHECK(lift IN ('squat','bench','deadlift')),
      load_kg     REAL NOT NULL,
      reps        INTEGER NOT NULL DEFAULT 1,
      achieved_at TEXT,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS programs (
      id          SERIAL PRIMARY KEY,
      coach_id    INTEGER NOT NULL REFERENCES users(id),
      athlete_id  INTEGER REFERENCES athlete_profiles(id),
      name        TEXT NOT NULL,
      description TEXT,
      is_active   BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS program_weeks (
      id          SERIAL PRIMARY KEY,
      program_id  INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      label       TEXT,
      UNIQUE(program_id, week_number)
    );

    CREATE TABLE IF NOT EXISTS program_days (
      id          SERIAL PRIMARY KEY,
      week_id     INTEGER NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
      day_number  INTEGER NOT NULL,
      label       TEXT,
      UNIQUE(week_id, day_number)
    );

    CREATE TABLE IF NOT EXISTS program_exercises (
      id             SERIAL PRIMARY KEY,
      day_id         INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
      exercise_order INTEGER NOT NULL DEFAULT 0,
      name           TEXT NOT NULL,
      notes          TEXT
    );

    CREATE TABLE IF NOT EXISTS program_sets (
      id          SERIAL PRIMARY KEY,
      exercise_id INTEGER NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
      set_order   INTEGER NOT NULL DEFAULT 0,
      set_type    TEXT NOT NULL CHECK(set_type IN ('top','backdown')),
      reps        INTEGER NOT NULL,
      target_rpe  REAL,
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS training_sessions (
      id             SERIAL PRIMARY KEY,
      athlete_id     INTEGER NOT NULL REFERENCES athlete_profiles(id),
      program_day_id INTEGER REFERENCES program_days(id) ON DELETE SET NULL,
      session_date   TEXT NOT NULL,
      sleep          TEXT CHECK(sleep IN ('Poor','Fair','Good','Great')),
      mood           TEXT CHECK(mood IN ('Poor','Fair','Good','Great')),
      motivation     TEXT CHECK(motivation IN ('Poor','Fair','Good','Great')),
      soreness       TEXT CHECK(soreness IN ('Poor','Fair','Good','Great')),
      fatigue        TEXT CHECK(fatigue IN ('Poor','Fair','Good','Great')),
      readiness      TEXT CHECK(readiness IN ('Poor','Fair','Good','Great')),
      session_notes  TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS logged_exercises (
      id                  SERIAL PRIMARY KEY,
      session_id          INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
      program_exercise_id INTEGER REFERENCES program_exercises(id) ON DELETE SET NULL,
      exercise_name       TEXT NOT NULL,
      exercise_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS logged_sets (
      id                 SERIAL PRIMARY KEY,
      logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
      program_set_id     INTEGER REFERENCES program_sets(id) ON DELETE SET NULL,
      set_order          INTEGER NOT NULL DEFAULT 0,
      set_type           TEXT NOT NULL CHECK(set_type IN ('top','backdown')),
      reps               INTEGER NOT NULL,
      load_kg            REAL,
      actual_rpe         REAL,
      target_rpe         REAL,
      calculated_load_kg REAL,
      intensity_pct      REAL,
      athlete_notes      TEXT,
      coach_notes        TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Schema initialised');
}

module.exports = { pool, query, initSchema };
