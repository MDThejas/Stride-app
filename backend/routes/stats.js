// ============================================================
//  routes/stats.js
//  All routes: /api/stats
// ============================================================
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/stats');

router.get('/', auth, controller.getSummary);   // GET /api/stats

module.exports = router;
