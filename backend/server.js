// ============================================================
//  server.js — STRIDE Backend Entry Point
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── Middleware ───────────────────────────────────────────
app.use(cors({ origin: '*' })); // Tighten this in production
app.use(express.json());

// ── Routes ───────────────────────────────────────────────
app.use('/api/activities', require('./routes/activities'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/profile', require('./routes/profile'));

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// ── Test email route ─────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(400).json({
        error: 'RESEND_API_KEY not set'
      });
    }

    const { sendTestEmail } = require('./services/weeklyEmail');
    const { userId, authEmail, summaryEmail } = req.body;

    await sendTestEmail(
      userId,
      authEmail,
      summaryEmail
    );

    res.json({
      success: true,
      message: `Test email sent to ${summaryEmail || authEmail}`
    });
  } catch (error) {
    console.error('Test email error:', error);

    res.status(500).json({
      error: error.message || 'Failed to send test email'
    });
  }
});

// ── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    error: 'Something went wrong'
  });
});

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`STRIDE backend running on http://localhost:${PORT}`);

  // Start weekly email scheduler
  if (process.env.RESEND_API_KEY) {
    try {
      const { startScheduler } = require('./services/weeklyEmail');
      startScheduler();
      console.log('✅ Weekly email scheduler started');
    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
    }
  } else {
    console.log('⚠️ RESEND_API_KEY not set — weekly emails disabled');
  }
});