// ============================================================
//  server.js — STRIDE Backend Entry Point
//  Run: npm run dev
// ============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middleware ───────────────────────────────────────────
app.use(cors({ origin: '*' }));   // Tighten this in production
app.use(express.json());

// ── Routes ───────────────────────────────────────────────
app.use('/api/activities', require('./routes/activities'));
app.use('/api/goals',      require('./routes/goals'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/profile',    require('./routes/profile'));

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`STRIDE backend running on http://localhost:${PORT}`);
});
