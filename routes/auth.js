const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// Sign Up
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    // Check if username or email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username.trim(), email.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username.trim(), email.trim(), hashedPassword, 'USER']
    );

    let newUser = result.rows[0];
    if (!newUser || !newUser.id) {
      // For SQLite compatibility
      const fetched = await db.query('SELECT id, username, email, role FROM users WHERE username = $1', [username.trim()]);
      newUser = fetched.rows[0];
    }

    // Automatically log in user after sign up
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    };

    res.status(201).json({
      message: 'Account created successfully!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Please enter both username/email and password.' });
    }

    const { rows } = await db.query(
      'SELECT id, username, email, password, role, banned FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [usernameOrEmail.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const user = rows[0];

    // Check if banned
    if (user.banned) {
      return res.status(403).json({ error: 'Your account has been banned by an administrator.' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Login successful!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

// Get Current User
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ user: null });
  }

  try {
    const { rows } = await db.query('SELECT id, username, email, role, banned FROM users WHERE id = $1', [req.session.user.id]);
    if (rows.length === 0 || rows[0].banned) {
      req.session.destroy();
      return res.json({ user: null, banned: true });
    }

    req.session.user.role = rows[0].role;
    res.json({ user: req.session.user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error fetching user session.' });
  }
});

module.exports = router;
