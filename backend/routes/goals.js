// ============================================================
//  routes/goals.js
//  All routes: /api/goals
// ============================================================
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/goals');

router.get('/',       auth, controller.getAll);    // GET  /api/goals
router.post('/',      auth, controller.create);    // POST /api/goals
router.put('/:id',    auth, controller.update);    // PUT  /api/goals/:id
router.delete('/:id', auth, controller.remove);    // DELETE /api/goals/:id

module.exports = router;
