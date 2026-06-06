// ============================================================
//  routes/activities.js
//  All routes: /api/activities
// ============================================================
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/activities');

router.get('/',       auth, controller.getAll);    // GET  /api/activities
router.post('/',      auth, controller.create);    // POST /api/activities
router.delete('/:id', auth, controller.remove);    // DELETE /api/activities/:id

module.exports = router;
