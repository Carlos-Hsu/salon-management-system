const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data', 'salon.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  // Existing Tables
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    service TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    price INTEGER,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers (id)
  )`);

  // New Tables for Expanded Features
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT
  )`);

  // 收支相關表
  db.run(`CREATE TABLE IF NOT EXISTS income_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expense_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  // 插入初始收支項目
  db.get("SELECT COUNT(*) as count FROM income_items", [], (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO income_items (name) VALUES ('服務收入'), ('產品銷售')");
      db.run("INSERT INTO expense_items (name) VALUES ('人事支出'), ('產品進貨'), ('房租水電')");
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'income' or 'expense'
    item_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  )`);

  // Seed Initial Data if empty
  db.get("SELECT COUNT(*) as count FROM customers", [], (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      console.log('Seeding initial testing data...');
      
      // Insert Customers
      db.run(`INSERT INTO customers (name, phone, email, notes) VALUES 
        ('林雅婷', '0912345678', 'yating@gmail.com', '習慣固定剪髮+深層護髮，頭皮易敏感'),
        ('陳冠宇', '0923456789', 'guanyu@gmail.com', '偏好清爽短髮，固定每個月底修剪一次'),
        ('張明達', '0934567890', 'mingda@gmail.com', '喜好染時尚灰棕色，注重造型定型')`);

      // Get customer IDs and insert Appointments
      db.all("SELECT id FROM customers", [], (err, rows) => {
        if (err || rows.length < 3) return;
        const c1 = rows[0].id;
        const c2 = rows[1].id;
        const c3 = rows[2].id;

        const today = new Date();
        const formatDate = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

        const t1_start = new Date(today.setHours(10, 0, 0, 0));
        const t1_end = new Date(today.setHours(11, 0, 0, 0));

        const t2_start = new Date(today.setDate(today.getDate() + 1));
        t2_start.setHours(14, 0, 0, 0);
        const t2_end = new Date(t2_start);
        t2_end.setHours(16, 30, 0, 0);

        db.run(`INSERT INTO appointments (customer_id, service, start_time, end_time, status, price, notes) VALUES 
          (?, '剪髮', ?, ?, 'pending', 800, '客戶今天想修薄一點'),
          (?, '染髮', ?, ?, 'pending', 2500, '使用冷色調染劑')`,
          [c1, formatDate(t1_start), formatDate(t1_end), c2, formatDate(t2_start), formatDate(t2_end)]
        );
      });
    }
  });

  console.log('Database tables initialized and seeded');
});

module.exports = db;
