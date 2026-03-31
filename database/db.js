const DATABASE_URL = process.env.DATABASE_URL;
const USE_POSTGRES  = !!(DATABASE_URL && DATABASE_URL.startsWith('postgresql'));

// ── PostgreSQL (Supabase / production) ──────────────────────────────────────
let pgPool, pgQuery;
if (USE_POSTGRES) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  pgQuery = async (sql, params = []) => {
    const client = await pgPool.connect();
    try { return await client.query(sql, params); }
    finally { client.release(); }
  };
}

// ── SQLite (local development) ───────────────────────────────────────────────
let sqliteDb, sqliteQuery;
if (!USE_POSTGRES) {
  const { DatabaseSync } = require('node:sqlite');
  const path = require('path');
  const fs   = require('fs');

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  sqliteDb = new DatabaseSync(path.join(dataDir, 'g5pl.db'));
  sqliteDb.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

  function translateSQL(sql) {
    return sql
      .replace(/::\w+/g, '')
      .replace(/\$\d+/g, '?')
      .replace(/\bSERIAL\b/gi, 'INTEGER')
      .replace(/\bBIGSERIAL\b/gi, 'INTEGER')
      .replace(/\bBOOLEAN\b/gi, 'INTEGER')
      .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
      .replace(/\bTIMESTAMP\b/gi, 'TEXT')
      .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")
      .replace(/\bILIKE\b/gi, 'LIKE')
      .replace(/EXTRACT\s*\(\s*DOW\s+FROM\s+([\w.]+)\s*\)/gi, "CAST(strftime('%w', $1) AS TEXT)")
      .replace(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+([\w.]+)\s*\)/gi, "CAST(strftime('%s', $1) AS REAL)");
  }

  sqliteQuery = async (sql, params = []) => {
    params = params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);

    const hasReturning = /\bRETURNING\b/i.test(sql);
    const isInsert     = /^\s*INSERT\b/i.test(sql);
    const isSelect     = /^\s*SELECT\b/i.test(sql);
    const isMulti      = sql.split(';').filter(s => s.trim().length > 0).length > 1;

    let returningAll = false;
    let tableName    = null;
    if (hasReturning) {
      returningAll = /\bRETURNING\s+\*/i.test(sql);
      const m = sql.match(/INSERT\s+INTO\s+(\w+)/i);
      tableName = m ? m[1] : null;
    }

    const sqlNoReturn = hasReturning
      ? sql.replace(/\s+RETURNING\s+[\w*]+\s*$/i, '')
      : sql;
    const translated = translateSQL(sqlNoReturn);

    if (isMulti) { sqliteDb.exec(translated); return { rows: [] }; }
    if (isSelect) { return { rows: sqliteDb.prepare(translated).all(...params) }; }

    const result = sqliteDb.prepare(translated).run(...params);
    if (isInsert && hasReturning) {
      if (returningAll && tableName) {
        const row = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid);
        return { rows: row ? [row] : [] };
      }
      return { rows: [{ id: result.lastInsertRowid }] };
    }
    return { rows: [], rowCount: result.changes };
  };
}

// ── Unified interface ────────────────────────────────────────────────────────
async function query(sql, params = []) {
  return USE_POSTGRES ? pgQuery(sql, params) : sqliteQuery(sql, params);
}

// ── Schema (PostgreSQL-flavoured; SQLite translator handles it locally) ──────
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
  console.log(`Schema initialised (${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'})`);
}

module.exports = { query, initSchema };
