require('dotenv').config();

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

// Initialise schema then start (or just export for Vercel serverless)
const schemaReady = initSchema().catch(err => {
  console.error('Failed to initialise database:', err.message);
  if (process.env.VERCEL !== '1') process.exit(1);
});

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  schemaReady.then(() => {
    app.listen(PORT, () => {
      console.log(`StrengthTrack running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
