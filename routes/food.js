const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all food items
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, price FROM food ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching food items:', err);
    res.status(500).json({ error: 'Failed to fetch food items.' });
  }
});

module.exports = router;
