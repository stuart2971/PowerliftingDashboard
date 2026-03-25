require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  console.error('Set it in your .env file or Railway dashboard.');
  console.error('Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./database/db');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/athletes', require('./routes/athletes'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/sessions', require('./routes/sessions'));

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`G5 Powerlifting Dashboard running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialise database:', err.message);
    process.exit(1);
  }
})();
