const db = require('../db');

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    const { rows } = await db.query('SELECT banned, role FROM users WHERE id = $1', [req.session.user.id]);
    if (rows.length === 0) {
      req.session.destroy();
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    if (rows[0].banned) {
      req.session.destroy();
      return res.status(403).json({ error: 'Your account has been banned by an administrator.' });
    }

    // Keep session role updated if admin updated it
    req.session.user.role = rows[0].role;
    next();
  } catch (err) {
    console.error('Error in auth middleware:', err);
    return res.status(500).json({ error: 'Server authentication error.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to access this resource.' });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
