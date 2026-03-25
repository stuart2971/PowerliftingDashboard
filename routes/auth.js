const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, role, name } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password, and role are required' });
  }
  if (!['coach', 'athlete'].includes(role)) {
    return res.status(400).json({ error: 'role must be coach or athlete' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const userResult = await query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email.toLowerCase().trim(), hash, role]
    );
    const user = userResult.rows[0];

    let athleteProfileId = null;
    if (role === 'athlete') {
      const profileName = name || email.split('@')[0];
      const profileResult = await query(
        'INSERT INTO athlete_profiles (user_id, name) VALUES ($1, $2) RETURNING id',
        [user.id, profileName]
      );
      athleteProfileId = profileResult.rows[0].id;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role, athleteProfileId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ token, user: { id: user.id, email: user.email, role, athleteProfileId } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    let athleteProfileId = null;
    if (user.role === 'athlete') {
      const profileResult = await query(
        'SELECT id FROM athlete_profiles WHERE user_id = $1',
        [user.id]
      );
      athleteProfileId = profileResult.rows[0]?.id ?? null;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, athleteProfileId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, athleteProfileId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
