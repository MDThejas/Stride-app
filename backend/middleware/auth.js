// ============================================================
//  middleware/auth.js
//  Verifies the Supabase JWT sent by the frontend.
//  Attach as middleware to any protected route.
//
//  Usage in a route file:
//    const auth = require('../middleware/auth');
//    router.get('/', auth, controller.getAll);
// ============================================================
const { createClient } = require('@supabase/supabase-js');

// Use anon key here — we only need to verify the token
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user to request so controllers can use req.user.id
  req.user = user;
  next();
};
