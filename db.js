const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
require('dotenv').config();

let isPg = false;
let pgPool = null;
let sqliteDb = null;

async function initDb() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000
      });
      // Test connection
      await pool.query('SELECT 1');
      isPg = true;
      pgPool = pool;
      console.log('✅ [Database] Connected to PostgreSQL!');
      await setupTables();
      await seedInitialData();
      return;
    } catch (err) {
      console.log('⚠️ [Database] PostgreSQL connection failed:', err.message);
      console.log('🔄 [Database] Falling back to SQLite for local development/preview...');
    }
  } else {
    console.log('ℹ️ [Database] No DATABASE_URL provided. Using SQLite...');
  }

  // Fallback to SQLite
  sqliteDb = new sqlite3.Database('./database.sqlite', async (err) => {
    if (err) {
      console.error('❌ [Database] SQLite connection error:', err.message);
    } else {
      console.log('✅ [Database] Connected to SQLite (database.sqlite)!');
      await setupTables();
      await seedInitialData();
    }
  });
}

async function query(sql, params = []) {
  if (isPg) {
    const res = await pgPool.query(sql, params);
    return { rows: res.rows, rowCount: res.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      // Replace $1, $2 with ? for SQLite compatibility
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      const trimmed = sqliteSql.trim().toUpperCase();

      if (trimmed.startsWith('SELECT') || trimmed.includes('RETURNING')) {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) return reject(err);
          // Standardize BOOLEAN values in SQLite (1/0 to true/false for 'banned' column)
          const sanitizedRows = (rows || []).map(row => {
            if ('banned' in row) {
              row.banned = Boolean(row.banned);
            }
            return row;
          });
          resolve({ rows: sanitizedRows, rowCount: sanitizedRows.length });
        });
      } else {
        sqliteDb.run(sqliteSql, params, function (err) {
          if (err) return reject(err);
          resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
        });
      }
    });
  }
}

async function setupTables() {
  if (isPg) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'USER',
        banned BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS food (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        food_id INTEGER NOT NULL REFERENCES food(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1
      );
    `);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.serialize(() => {
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER',
            banned INTEGER NOT NULL DEFAULT 0
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS food (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            food_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (food_id) REFERENCES food(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}

async function seedInitialData() {
  try {
    // 1. Seed Food Items
    const foodCheck = await query('SELECT COUNT(*) as count FROM food');
    const foodCount = parseInt(foodCheck.rows[0].count || foodCheck.rows[0]['COUNT(*)'] || 0, 10);

    if (foodCount === 0) {
      console.log('🍔 [Database] Seeding default food items...');
      const defaultFoods = [
        ['Burger', 8.99],
        ['Pizza', 12.50],
        ['Fries', 3.99],
        ['Pasta', 10.99],
        ['Cola', 2.50]
      ];
      for (const [name, price] of defaultFoods) {
        await query('INSERT INTO food (name, price) VALUES ($1, $2)', [name, price]);
      }
      console.log('✅ [Database] Food items seeded.');
    }

    // 2. Seed Accounts if missing
    const userCheck = await query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userCheck.rows[0].count || userCheck.rows[0]['COUNT(*)'] || 0, 10);

    if (userCount === 0) {
      console.log('👥 [Database] Seeding default user accounts...');
      const adminPass = await bcrypt.hash('admin123', 10);
      const chefPass = await bcrypt.hash('chef123', 10);
      const userPass = await bcrypt.hash('user123', 10);

      await query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@restaurant.com', adminPass, 'ADMIN']
      );
      await query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['chef', 'chef@restaurant.com', chefPass, 'CHEF']
      );
      await query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['user', 'user@restaurant.com', userPass, 'USER']
      );
      console.log('✅ [Database] Default accounts created (admin, chef, user).');
    }
  } catch (err) {
    console.error('❌ [Database] Seeding error:', err.message);
  }
}

// Initialize database
initDb();

module.exports = {
  query,
  isPg: () => isPg
};
