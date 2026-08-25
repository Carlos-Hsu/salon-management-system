const { normalizeInterval, surchargeAmount, assertTransition, collision } = require('./domain');

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
async function getService(db, id) {
  const service = await db.get('SELECT * FROM services WHERE id=? AND active=1', [id]);
  if (!service) fail('Service not found', 404);
  return service;
}
async function productsTotal(db, products = []) {
  let total = 0; const lines = [];
  for (const requested of products) {
    const quantity = Number(requested.quantity);
    const product = await db.get('SELECT * FROM products WHERE id=?', [requested.product_id]);
    if (!product) fail('Product not found', 404);
    if (!Number.isInteger(quantity) || quantity <= 0) fail('Product quantity must be positive');
    lines.push({ product_id: product.id, quantity, unit_price: product.price });
    total += product.price * quantity;
  }
  return { total, lines };
}
async function effectiveSurcharge(db, body) {
  if (body.surcharge_type != null) return [body.surcharge_type, Number(body.surcharge_value || 0)];
  const rows = await db.all("SELECT key,value FROM settings WHERE key LIKE 'holiday_surcharge_%'");
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return [settings.holiday_surcharge_type || 'none', Number(settings.holiday_surcharge_value || 0)];
}
async function appointmentView(db, id) {
  return db.get(`SELECT a.*, c.name customerName, s.name service_name, s.duration_minutes,
    COALESCE((SELECT SUM(quantity*unit_price) FROM appointment_products ap WHERE ap.appointment_id=a.id),0) product_total
    FROM appointments a JOIN customers c ON c.id=a.customer_id LEFT JOIN services s ON s.id=a.service_id WHERE a.id=?`, [id]);
}

async function createAppointment(db, body) {
  const service = await getService(db, body.service_id);
  if (!await db.get('SELECT id FROM customers WHERE id=?', [body.customer_id])) fail('Customer not found', 404);
  const startDate = new Date(body.start_time);
  if (Number.isNaN(startDate.valueOf())) fail('Invalid start_time');
  const endDate = new Date(startDate.valueOf() + service.duration_minutes * 60000);
  const [start, end] = normalizeInterval(startDate, endDate);
  const stylistId = 1; // One-person salon: the owner is the single persisted scheduling resource.
  const conflict = await collision(db, stylistId, start, end);
  if (conflict) fail(`Time conflicts with ${conflict.type} ${conflict.id}`, 409);
  const productData = await productsTotal(db, body.products);
  const [surchargeType, surchargeValue] = await effectiveSurcharge(db, body);
  surchargeAmount(service.price + productData.total, surchargeType, surchargeValue);
  const result = await db.run(`INSERT INTO appointments
    (customer_id,stylist_id,service_id,service,start_time,end_time,status,price,surcharge_type,surcharge_value,notes)
    VALUES (?,?,?,?,?,?,'pending',?,?,?,?)`,
    [body.customer_id, stylistId, service.id, service.name, start, end, service.price, surchargeType, surchargeValue, body.notes || null]);
  for (const line of productData.lines) await db.run('INSERT INTO appointment_products VALUES (?,?,?,?)', [result.lastID, line.product_id, line.quantity, line.unit_price]);
  return appointmentView(db, result.lastID);
}

async function updateAppointment(db, id, body) {
  const old = await db.get('SELECT * FROM appointments WHERE id=?', [id]);
  if (!old) fail('Appointment not found', 404);
  const nextStatus = body.status || old.status;
  assertTransition(old.status, nextStatus);
  const service = await getService(db, body.service_id || old.service_id);
  const startDate = new Date(body.start_time || old.start_time);
  if (Number.isNaN(startDate.valueOf())) fail('Invalid start_time');
  const [start, end] = normalizeInterval(startDate, new Date(startDate.valueOf() + service.duration_minutes * 60000));
  if (nextStatus !== 'cancelled') {
    const conflict = await collision(db, old.stylist_id, start, end, id);
    if (conflict) fail(`Time conflicts with ${conflict.type} ${conflict.id}`, 409);
  }
  const [surchargeType, surchargeValue] = body.surcharge_type == null
    ? [old.surcharge_type || 'none', old.surcharge_value || 0]
    : [body.surcharge_type, Number(body.surcharge_value || 0)];
  await db.transaction(async () => {
    const current = await db.get('SELECT status FROM appointments WHERE id=?', [id]);
    if (!current || current.status !== old.status) fail('Appointment changed concurrently', 409);
    await db.run(`UPDATE appointments SET service_id=?,service=?,start_time=?,end_time=?,status=?,price=?,
      surcharge_type=?,surcharge_value=?,notes=? WHERE id=?`, [service.id, service.name, start, end, nextStatus,
      service.price, surchargeType, surchargeValue, body.notes ?? old.notes, id]);
    if (nextStatus === 'completed' && old.status !== 'completed') {
      const product = await db.get('SELECT COALESCE(SUM(quantity*unit_price),0) total FROM appointment_products WHERE appointment_id=?', [id]);
      const lines = await db.all('SELECT * FROM appointment_products WHERE appointment_id=?', [id]);
      for (const line of lines) {
        const changed = await db.run('UPDATE products SET stock_quantity=stock_quantity-? WHERE id=? AND stock_quantity>=?', [line.quantity, line.product_id, line.quantity]);
        if (!changed.changes) fail('Insufficient product stock', 409);
        const current = await db.get('SELECT stock_quantity FROM products WHERE id=?', [line.product_id]);
        await db.run(`INSERT INTO product_stock_adjustments(product_id,quantity_delta,resulting_quantity,reason)
          VALUES (?,?,?,?)`, [line.product_id, -line.quantity, current.stock_quantity, `Completed appointment ${id}`]);
      }
      const subtotal = service.price + product.total;
      const surcharge = surchargeAmount(subtotal, surchargeType, surchargeValue);
      const total = subtotal + surcharge;
      const order = await db.run('INSERT OR IGNORE INTO orders(appointment_id,subtotal,surcharge,total) VALUES (?,?,?,?)', [id, subtotal, surcharge, total]);
      const savedOrder = order.lastID || (await db.get('SELECT id FROM orders WHERE appointment_id=?', [id])).id;
      await db.run(`INSERT OR IGNORE INTO transactions(type,item_id,amount,notes,source_type,source_id)
        VALUES ('income',1,?,'Appointment completion','order',?)`, [total, savedOrder]);
    }
  });
  return appointmentView(db, id);
}

module.exports = { createAppointment, updateAppointment, appointmentView };
