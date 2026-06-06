// ============================================================
//  routes/profile.js
//  All routes: /api/profile
// ============================================================
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/profile');

router.get('/',  auth, controller.getProfile);   // GET /api/profile
router.put('/',  auth, controller.updateProfile); // PUT /api/profile

module.exports = router;
