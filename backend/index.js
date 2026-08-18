require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- API Routes ---

// Dashboard Stats
app.get('/api/dashboard/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM appointments WHERE date(start_time) = date(?)) as todayAppointments,
      (SELECT SUM(price) FROM appointments WHERE date(start_time) = date(?) AND status = 'completed') as todayRevenue,
      (SELECT COUNT(*) FROM customers) as totalCustomers
  `;
  db.get(query, [today, today], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// Appointments
app.get('/api/appointments', (req, res) => {
  const query = `
    SELECT a.*, c.name as customerName 
    FROM appointments a 
    LEFT JOIN customers c ON a.customer_id = c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/appointments', (req, res) => {
  const { customer_id, service, start_time, end_time, price, notes } = req.body;
  const query = `INSERT INTO appointments (customer_id, service, start_time, end_time, price, notes) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [customer_id, service, start_time, end_time, price, notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/appointments/:id', (req, res) => {
  const { service, start_time, end_time, price, notes, status } = req.body;
  const { id } = req.params;

  db.get("SELECT status, price FROM appointments WHERE id = ?", [id], (err, oldApp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldApp) return res.status(404).json({ error: 'Appointment not found' });

    const query = `UPDATE appointments SET service = ?, start_time = ?, end_time = ?, price = ?, notes = ?, status = ? WHERE id = ?`;
    db.run(query, [service, start_time, end_time, price, notes, status, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // 自動記錄收入：如果狀態變更為 completed
      if (oldApp.status !== 'completed' && status === 'completed') {
        // 預設收入項目 ID 為 1
        db.run("INSERT INTO transactions (type, item_id, amount, notes) VALUES (?, ?, ?, ?)", 
          ['income', 1, price, `自動記錄：預約編號 ${id} 完成收入`]);
      }

      res.json({ message: 'Appointment updated successfully' });
    });
  });
});

app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM appointments WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment deleted successfully' });
  });
});

// Customers
app.get('/api/customers', (req, res) => {
  db.all("SELECT * FROM customers", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, notes } = req.body;
  db.run("INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)", [name, phone, email, notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/customers/:id', (req, res) => {
  const { name, phone, email, notes } = req.body;
  const { id } = req.params;
  db.run("UPDATE customers SET name = ?, phone = ?, email = ?, notes = ? WHERE id = ?", [name, phone, email, notes, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer updated successfully' });
  });
});

app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM customers WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully' });
  });
});

// Products
app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', (req, res) => {
  const { name, price, stock_quantity } = req.body;
  db.run("INSERT INTO products (name, price, stock_quantity) VALUES (?, ?, ?)", [name, price, stock_quantity], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// Staff
app.get('/api/staff', (req, res) => {
  db.all("SELECT * FROM staff", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/staff', (req, res) => {
  const { name, title } = req.body;
  db.run("INSERT INTO staff (name, title) VALUES (?, ?)", [name, title], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// Transactions & Items
app.get('/api/income_items', (req, res) => {
  db.all("SELECT * FROM income_items", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/expense_items', (req, res) => {
  db.all("SELECT * FROM expense_items", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/transactions', (req, res) => {
  const { startDate, endDate } = req.query;
  let query = `
    SELECT t.*, 
           CASE 
             WHEN t.type = 'income' THEN i.name 
             ELSE e.name 
           END as itemName,
           a.service as serviceName,
           c.name as customerName
    FROM transactions t
    LEFT JOIN income_items i ON t.type = 'income' AND t.item_id = i.id
    LEFT JOIN expense_items e ON t.type = 'expense' AND t.item_id = e.id
    LEFT JOIN appointments a ON t.notes LIKE ('%預約編號 ' || a.id || '%')
    LEFT JOIN customers c ON a.customer_id = c.id
  `;
  const params = [];

  if (startDate && endDate) {
    query += ` WHERE date(t.date) BETWEEN date(?) AND date(?)`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY t.date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions', (req, res) => {
  const { type, item_id, amount, notes, date } = req.body;
  const sqlDate = date || new Date().toISOString();
  db.run("INSERT INTO transactions (type, item_id, amount, notes, date) VALUES (?, ?, ?, ?, ?)", [type, item_id, amount, notes, sqlDate], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/transactions/:id', (req, res) => {
  const { amount, notes } = req.body;
  const { id } = req.params;
  db.run("UPDATE transactions SET amount = ?, notes = ? WHERE id = ?", [amount, notes, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction updated successfully' });
  });
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM transactions WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction deleted successfully' });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access from mobile using your IP on port ${PORT}`);
});
