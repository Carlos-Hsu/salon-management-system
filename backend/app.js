const express = require('express');
const cors = require('cors');
const { createAppointment, updateAppointment, archiveAppointment } = require('./salon-service');
const { normalizeInterval, collision } = require('./domain');

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res)).catch(next); }
function integer(value, name, min = 0) {
  const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min) throw Object.assign(new Error(`${name} must be an integer >= ${min}`), { status: 400 }); return parsed;
}

function createApp(db) {
  const app = express(); app.use(cors()); app.use(express.json());
  app.use((_req, _res, next) => db.ready.then(() => next(), next));

  app.get('/api/dashboard/stats', asyncRoute(async (_req, res) => res.json(await db.get(`SELECT
    (SELECT COUNT(*) FROM appointments WHERE deleted_at IS NULL AND date(start_time)=date('now') AND status<>'cancelled') todayAppointments,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE voided_at IS NULL AND type='income' AND date(date)=date('now')),0) todayRevenue,
    (SELECT COUNT(*) FROM customers) totalCustomers`))));

  app.get('/api/appointments', asyncRoute(async (req, res) => {
    const conditions = ['a.deleted_at IS NULL']; const params = [];
    if (req.query.start && req.query.end) { conditions.push('datetime(a.start_time)<datetime(?) AND datetime(a.end_time)>datetime(?)'); params.push(req.query.end, req.query.start); }
    res.json(await db.all(`SELECT a.*,c.name customerName,s.name service_name,s.duration_minutes,
      COALESCE((SELECT SUM(quantity*unit_price) FROM appointment_products ap WHERE ap.appointment_id=a.id),0) product_total
      FROM appointments a JOIN customers c ON c.id=a.customer_id LEFT JOIN services s ON s.id=a.service_id
      WHERE ${conditions.join(' AND ')} ORDER BY a.start_time`, params));
  }));
  app.post('/api/appointments', asyncRoute(async (req, res) => res.status(201).json(await createAppointment(db, req.body))));
  app.put('/api/appointments/:id', asyncRoute(async (req, res) => res.json(await updateAppointment(db, Number(req.params.id), req.body))));
  app.patch('/api/appointments/:id', asyncRoute(async (req, res) => res.json(await updateAppointment(db, Number(req.params.id), req.body))));
  app.delete('/api/appointments/:id', asyncRoute(async (req, res) => {
    await archiveAppointment(db, Number(req.params.id));
    res.status(204).end();
  }));

  app.get('/api/services', asyncRoute(async (_req, res) => res.json(await db.all('SELECT * FROM services ORDER BY name'))));
  app.post('/api/services', asyncRoute(async (req, res) => {
    const result = await db.run('INSERT INTO services(name,duration_minutes,price) VALUES (?,?,?)', [req.body.name, integer(req.body.duration_minutes, 'duration_minutes', 1), integer(req.body.price, 'price')]);
    res.status(201).json({ id: result.lastID });
  }));
  app.put('/api/services/:id', asyncRoute(async (req, res) => {
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    const result = await db.run('UPDATE services SET name=?,duration_minutes=?,price=?,active=? WHERE id=?', [req.body.name, integer(req.body.duration_minutes, 'duration_minutes', 1), integer(req.body.price, 'price'), active, req.params.id]);
    if (!result.changes) return res.status(404).json({ error: 'Service not found' }); res.json({ ok: true });
  }));
  app.delete('/api/services/:id', asyncRoute(async (req, res) => {
    const service = await db.get('SELECT id FROM services WHERE id=?', [req.params.id]);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    const result = await db.run(`DELETE FROM services WHERE id=?
      AND NOT EXISTS (SELECT 1 FROM appointments WHERE service_id=?)`, [req.params.id, req.params.id]);
    if (!result.changes) return res.status(409).json({ error: '此服務已有預約紀錄，請改為停用以保留歷史資料。' });
    res.status(204).end();
  }));

  app.get('/api/block-times', asyncRoute(async (_req, res) => res.json(await db.all('SELECT * FROM block_times ORDER BY start_time'))));
  app.post('/api/block-times', asyncRoute(async (req, res) => {
    const [start, end] = normalizeInterval(req.body.start_time, req.body.end_time);
    const conflict = await collision(db, 1, start, end); if (conflict) throw Object.assign(new Error(`Time conflicts with ${conflict.type} ${conflict.id}`), { status: 409 });
    const result = await db.run('INSERT INTO block_times(stylist_id,start_time,end_time,reason) VALUES (1,?,?,?)', [start, end, req.body.reason || null]);
    res.status(201).json({ id: result.lastID, start_time: start, end_time: end });
  }));
  app.put('/api/block-times/:id', asyncRoute(async (req, res) => {
    const [start, end] = normalizeInterval(req.body.start_time, req.body.end_time);
    const appointment = await db.get(`SELECT id FROM appointments WHERE stylist_id=1 AND status<>'cancelled' AND deleted_at IS NULL
      AND datetime(start_time)<datetime(?) AND datetime(end_time)>datetime(?) LIMIT 1`, [end, start]);
    const other = await db.get(`SELECT id FROM block_times WHERE id<>? AND stylist_id=1 AND datetime(start_time)<datetime(?) AND datetime(end_time)>datetime(?)`, [req.params.id, end, start]);
    if (appointment || other) throw Object.assign(new Error('Block time conflicts with existing schedule'), { status: 409 });
    const result = await db.run('UPDATE block_times SET start_time=?,end_time=?,reason=? WHERE id=?', [start, end, req.body.reason || null, req.params.id]);
    if (!result.changes) return res.status(404).json({ error: 'Block time not found' }); res.json({ ok: true });
  }));
  app.delete('/api/block-times/:id', asyncRoute(async (req, res) => { await db.run('DELETE FROM block_times WHERE id=?', [req.params.id]); res.status(204).end(); }));

  app.get('/api/customers', asyncRoute(async (_req, res) => res.json(await db.all(`SELECT c.*,
    (SELECT MAX(a.start_time) FROM appointments a WHERE a.customer_id=c.id AND a.status='completed' AND a.deleted_at IS NULL) last_visit,
    COALESCE((SELECT o.total FROM orders o JOIN appointments a ON a.id=o.appointment_id WHERE a.customer_id=c.id AND o.voided_at IS NULL ORDER BY o.created_at DESC LIMIT 1),0) last_spend
    FROM customers c ORDER BY c.name`))));
  app.get('/api/customers/:id/history', asyncRoute(async (req, res) => res.json(await db.all(`SELECT a.*,s.name service_name,o.total
    FROM appointments a LEFT JOIN services s ON s.id=a.service_id LEFT JOIN orders o ON o.appointment_id=a.id WHERE a.customer_id=? AND a.deleted_at IS NULL ORDER BY a.start_time DESC`, [req.params.id]))));
  app.post('/api/customers', asyncRoute(async (req, res) => { if (!req.body.name) throw Object.assign(new Error('Name required'), { status: 400 }); const result = await db.run('INSERT INTO customers(name,phone,email,notes) VALUES (?,?,?,?)', [req.body.name, req.body.phone || '', req.body.email || '', req.body.notes || '']); res.status(201).json({ id: result.lastID }); }));
  app.put('/api/customers/:id', asyncRoute(async (req, res) => { await db.run('UPDATE customers SET name=?,phone=?,email=?,notes=? WHERE id=?', [req.body.name, req.body.phone || '', req.body.email || '', req.body.notes || '', req.params.id]); res.json({ ok: true }); }));
  app.delete('/api/customers/:id', asyncRoute(async (req, res) => { try { await db.run('DELETE FROM customers WHERE id=?', [req.params.id]); res.status(204).end(); } catch { throw Object.assign(new Error('Customer has appointment history'), { status: 409 }); } }));

  app.get('/api/products', asyncRoute(async (_req, res) => res.json(await db.all('SELECT * FROM products ORDER BY name'))));
  app.post('/api/products', asyncRoute(async (req, res) => {
    if (!String(req.body.name || '').trim()) throw Object.assign(new Error('Product name required'), { status: 400 });
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    const result = await db.run(`INSERT INTO products(name,price,stock_quantity,active,vendor_name)
      VALUES (?,?,?,?,?)`, [String(req.body.name).trim(), integer(req.body.price, 'price'), integer(req.body.stock_quantity, 'stock_quantity'), active, String(req.body.vendor_name || '').trim() || null]);
    res.status(201).json({ id: result.lastID });
  }));
  app.put('/api/products/:id', asyncRoute(async (req, res) => {
    if (!String(req.body.name || '').trim()) throw Object.assign(new Error('Product name required'), { status: 400 });
    const stock = integer(req.body.stock_quantity, 'stock_quantity');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    await db.transaction(async () => {
      const old = await db.get('SELECT stock_quantity FROM products WHERE id=?', [req.params.id]);
      if (!old) throw Object.assign(new Error('Product not found'), { status: 404 });
      await db.run(`UPDATE products SET name=?,price=?,stock_quantity=?,active=?,vendor_name=? WHERE id=?`,
        [String(req.body.name).trim(), integer(req.body.price, 'price'), stock, active, String(req.body.vendor_name || '').trim() || null, req.params.id]);
      const delta = stock - old.stock_quantity;
      if (delta) await db.run(`INSERT INTO product_stock_adjustments(product_id,quantity_delta,resulting_quantity,reason)
        VALUES (?,?,?,'Inline stock edit')`, [req.params.id, delta, stock]);
    });
    res.json({ ok: true });
  }));
  app.post('/api/products/:id/adjust', asyncRoute(async (req, res) => {
    const delta = Number(req.body.quantity_delta);
    if (!Number.isInteger(delta) || delta === 0) throw Object.assign(new Error('quantity_delta must be a non-zero signed integer'), { status: 400 });
    const result = await db.transaction(async () => {
      const changed = await db.run(`UPDATE products SET stock_quantity=stock_quantity+?
        WHERE id=? AND stock_quantity+?>=0`, [delta, req.params.id, delta]);
      if (!changed.changes) {
        const exists = await db.get('SELECT id FROM products WHERE id=?', [req.params.id]);
        throw Object.assign(new Error(exists ? 'Resulting stock cannot be below zero' : 'Product not found'), { status: exists ? 409 : 404 });
      }
      const product = await db.get('SELECT stock_quantity FROM products WHERE id=?', [req.params.id]);
      await db.run(`INSERT INTO product_stock_adjustments(product_id,quantity_delta,resulting_quantity,reason)
        VALUES (?,?,?,?)`, [req.params.id, delta, product.stock_quantity, String(req.body.reason || 'Manual stock adjustment').trim() || 'Manual stock adjustment']);
      return product;
    });
    res.json(result);
  }));
  app.get('/api/products/:id/history', asyncRoute(async (req, res) => {
    const product = await db.get('SELECT id FROM products WHERE id=?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(await db.all(`SELECT id,product_id,quantity_delta,resulting_quantity,reason,created_at
      FROM product_stock_adjustments WHERE product_id=? ORDER BY id DESC`, [req.params.id]));
  }));
  app.delete('/api/products/:id', asyncRoute(async (req, res) => {
    const product = await db.get('SELECT id FROM products WHERE id=?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const referenced = await db.get(`SELECT 1 referenced FROM appointment_products WHERE product_id=?
      UNION ALL SELECT 1 FROM product_stock_adjustments WHERE product_id=? LIMIT 1`, [req.params.id, req.params.id]);
    if (referenced) return res.status(409).json({ error: '此產品已有訂單或庫存紀錄，請改為停用以保留歷史資料。' });
    await db.run('DELETE FROM products WHERE id=?', [req.params.id]);
    res.status(204).end();
  }));

  app.get('/api/settings/surcharge', asyncRoute(async (_req, res) => { const rows = await db.all("SELECT key,value FROM settings WHERE key LIKE 'holiday_surcharge_%'"); res.json(Object.fromEntries(rows.map(r => [r.key.replace('holiday_surcharge_', ''), r.key.endsWith('value') ? Number(r.value) : r.value]))); }));
  app.put('/api/settings/surcharge', asyncRoute(async (req, res) => { const type = req.body.type; if (!['none','percent','fixed'].includes(type)) throw Object.assign(new Error('Invalid surcharge type'), { status: 400 }); const value = integer(req.body.value, 'value'); await db.run("UPDATE settings SET value=? WHERE key='holiday_surcharge_type'", [type]); await db.run("UPDATE settings SET value=? WHERE key='holiday_surcharge_value'", [String(value)]); res.json({ type, value }); }));

  app.get('/api/income_items', asyncRoute(async (_req, res) => res.json(await db.all('SELECT * FROM income_items'))));
  app.get('/api/expense_items', asyncRoute(async (_req, res) => res.json(await db.all('SELECT * FROM expense_items'))));
  app.get('/api/transactions', asyncRoute(async (req, res) => { const conditions=['t.voided_at IS NULL']; const params=[]; if(req.query.startDate&&req.query.endDate){conditions.push('date(t.date) BETWEEN date(?) AND date(?)');params.push(req.query.startDate,req.query.endDate);} res.json(await db.all(`SELECT t.*,CASE WHEN t.type='income' THEN i.name ELSE e.name END itemName FROM transactions t LEFT JOIN income_items i ON t.type='income' AND i.id=t.item_id LEFT JOIN expense_items e ON t.type='expense' AND e.id=t.item_id WHERE ${conditions.join(' AND ')} ORDER BY t.date DESC`,params)); }));
  app.post('/api/transactions', asyncRoute(async (req,res)=>{const result=await db.run('INSERT INTO transactions(type,item_id,amount,date,notes) VALUES (?,?,?,?,?)',[req.body.type,req.body.item_id,integer(req.body.amount,'amount'),req.body.date||new Date().toISOString(),req.body.notes||'']);res.status(201).json({id:result.lastID});}));
  app.put('/api/transactions/:id', asyncRoute(async(req,res)=>{await db.run('UPDATE transactions SET amount=?,notes=? WHERE id=?',[integer(req.body.amount,'amount'),req.body.notes||'',req.params.id]);res.json({ok:true});}));
  app.delete('/api/transactions/:id', asyncRoute(async(req,res)=>{await db.run('DELETE FROM transactions WHERE id=?',[req.params.id]);res.status(204).end();}));

  app.use((error, _req, res, _next) => { if (process.env.NODE_ENV !== 'test') console.error(error.message); res.status(error.status || (error.code?.startsWith('SQLITE_CONSTRAINT') ? 400 : 500)).json({ error: error.message }); });
  return app;
}
module.exports = { createApp };
