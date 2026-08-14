const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Place a new order (Require logged-in user)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { items } = req.body; // Array of { food_id, quantity }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one food item.' });
    }

    // Filter valid items with positive integer quantities
    const validItems = items.filter(i => i.food_id && parseInt(i.quantity, 10) > 0);

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Invalid item quantities provided.' });
    }

    // Create order record
    const userId = req.session.user.id;
    const orderRes = await db.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id',
      [userId, 'Pending']
    );

    let orderId = orderRes.rows[0]?.id;
    if (!orderId) {
      const fetchedOrder = await db.query(
        'SELECT id FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      orderId = fetchedOrder.rows[0].id;
    }

    // Insert order items
    for (const item of validItems) {
      const foodId = parseInt(item.food_id, 10);
      const quantity = parseInt(item.quantity, 10);
      await db.query(
        'INSERT INTO order_items (order_id, food_id, quantity) VALUES ($1, $2, $3)',
        [orderId, foodId, quantity]
      );
    }

    res.status(201).json({
      message: 'Order placed successfully!',
      orderId: orderId,
      status: 'Pending'
    });
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ error: 'Failed to place order.' });
  }
});

// Get user's own orders (User/Chef/Admin for their own orders)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const ordersRes = await db.query(
      'SELECT id, status, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );

    const orders = ordersRes.rows;

    for (let order of orders) {
      const itemsRes = await db.query(
        `SELECT oi.id, oi.quantity, f.id as food_id, f.name, f.price 
         FROM order_items oi 
         JOIN food f ON oi.food_id = f.id 
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsRes.rows;
      order.total = itemsRes.rows.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    }

    res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: 'Failed to fetch your orders.' });
  }
});

// Get ALL orders (Role: CHEF, ADMIN)
router.get('/', requireAuth, requireRole('CHEF', 'ADMIN'), async (req, res) => {
  try {
    const ordersRes = await db.query(
      `SELECT o.id, o.user_id, u.username, u.email, o.status, o.created_at 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       ORDER BY o.id DESC`
    );

    const orders = ordersRes.rows;

    for (let order of orders) {
      const itemsRes = await db.query(
        `SELECT oi.id, oi.quantity, f.name, f.price 
         FROM order_items oi 
         JOIN food f ON oi.food_id = f.id 
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsRes.rows;
      order.total = itemsRes.rows.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    }

    res.json(orders);
  } catch (err) {
    console.error('Error fetching all orders:', err);
    res.status(500).json({ error: 'Failed to fetch all orders.' });
  }
});

// Update order status (Role: CHEF, ADMIN)
router.patch('/:id/status', requireAuth, requireRole('CHEF', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Preparing', 'Ready'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Pending, Preparing, or Ready.' });
    }

    const checkOrder = await db.query('SELECT id FROM orders WHERE id = $1', [id]);
    if (checkOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);

    res.json({ message: 'Order status updated successfully.', orderId: id, status });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

module.exports = router;
