const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All admin endpoints require ADMIN role
router.use(requireAuth, requireRole('ADMIN'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, email, role, banned FROM users ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Ban or Unban user
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { banned } = req.body;

    if (typeof banned !== 'boolean') {
      return res.status(400).json({ error: 'Invalid payload. "banned" must be a boolean.' });
    }

    // Prevent admin from banning themselves
    if (targetUserId === req.session.user.id) {
      return res.status(400).json({ error: 'You cannot ban your own admin account.' });
    }

    const checkUser = await db.query('SELECT id, username, role FROM users WHERE id = $1', [targetUserId]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update banned status (handles PostgreSQL boolean and SQLite integer 1/0)
    const bannedVal = db.isPg() ? banned : (banned ? 1 : 0);
    await db.query('UPDATE users SET banned = $1 WHERE id = $2', [bannedVal, targetUserId]);

    res.json({
      message: `User ${checkUser.rows[0].username} has been ${banned ? 'banned' : 'unbanned'}.`,
      userId: targetUserId,
      banned: banned
    });
  } catch (err) {
    console.error('Error updating ban status:', err);
    res.status(500).json({ error: 'Failed to update ban status.' });
  }
});

module.exports = router;
