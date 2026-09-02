const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../database');
const { createApp } = require('../app');

async function apiServer(t) {
  const db = openDatabase(':memory:');
  await db.ready;
  const app = createApp(db);
  const server = await new Promise((resolve, reject) => {
    const server = app.listen(0);
    server.once('error', reject);
    server.once('listening', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  });
  return { db, url: `http://127.0.0.1:${server.address().port}/api` };
}

const json = value => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

test('appointment API derives duration/price and reports overlap as 409', async t => {
  const { db, url } = await apiServer(t);
  const customer = await db.run("INSERT INTO customers(name) VALUES ('Client')");
  const service = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Color',90,2500)");
  const payload = { customer_id: customer.lastID, service_id: service.lastID, start_time: '2031-02-03T10:00:00Z' };
  let response = await fetch(`${url}/appointments`, { method: 'POST', ...json(payload) });
  assert.equal(response.status, 201);
  const appointment = await response.json();
  assert.equal(appointment.price, 2500);
  assert.equal(new Date(appointment.end_time) - new Date(appointment.start_time), 90 * 60000);
  response = await fetch(`${url}/appointments`, { method: 'POST', ...json({ ...payload, start_time: '2031-02-03T11:00:00Z' }) });
  assert.equal(response.status, 409);
});

test('customer DELETE permanently removes customers and their appointment history', async t => {
  const { db, url } = await apiServer(t);
  const customer = await db.run("INSERT INTO customers(name,phone) VALUES ('History Client','0912000000')");
  const service = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Cut',60,900)");
  const appointment = await db.run(`INSERT INTO appointments(customer_id,service_id,start_time,end_time,status,price)
    VALUES (?,?,?,?,?,?)`, [customer.lastID, service.lastID, '2031-02-03T10:00:00Z', '2031-02-03T11:00:00Z', 'completed', 900]);
  const order = await db.run('INSERT INTO orders(appointment_id,subtotal,surcharge,total) VALUES (?,?,?,?)', [appointment.lastID, 900, 0, 900]);
  await db.run(`INSERT INTO transactions(type,item_id,amount,source_type,source_id)
    VALUES ('income',1,?,'order',?)`, [900, order.lastID]);

  const response = await fetch(`${url}/customers/${customer.lastID}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal(await db.get('SELECT id FROM customers WHERE id=?', [customer.lastID]), undefined);
  assert.equal(await db.get('SELECT id FROM appointments WHERE id=?', [appointment.lastID]), undefined);
  assert.equal(await db.get('SELECT id FROM orders WHERE id=?', [order.lastID]), undefined);
  assert.equal(await db.get('SELECT id FROM transactions WHERE source_id=?', [order.lastID]), undefined);

  const customersResponse = await fetch(`${url}/customers`);
  assert.equal(customersResponse.status, 200);
  assert.deepEqual(await customersResponse.json(), []);
  const statsResponse = await fetch(`${url}/dashboard/stats`);
  assert.equal((await statsResponse.json()).totalCustomers, 0);
});

test('deleting a completed appointment voids income and restores checkout stock exactly once', async t => {
  const { db, url } = await apiServer(t);
  const customer = await db.run("INSERT INTO customers(name) VALUES ('Client')");
  const service = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Cut',60,900)");
  const product = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Wax',100,5)");
  let response = await fetch(`${url}/appointments`, { method: 'POST', ...json({ customer_id:customer.lastID, service_id:service.lastID, start_time:'2031-02-03T10:00:00Z', products:[{product_id:product.lastID,quantity:2}] }) });
  const appointment = await response.json();
  for (const status of ['confirmed', 'in_service', 'completed']) {
    response = await fetch(`${url}/appointments/${appointment.id}`, { method: 'PUT', ...json({ status }) });
    assert.equal(response.status, 200);
  }
  assert.equal((await db.get('SELECT stock_quantity FROM products WHERE id=?', [product.lastID])).stock_quantity, 3);
  assert.equal((await db.get('SELECT SUM(amount) amount FROM transactions WHERE voided_at IS NULL')).amount, 1100);

  response = await fetch(`${url}/appointments/${appointment.id}`, { method: 'PUT', ...json({ status:'completed', notes:'mobile correction' }) });
  assert.equal(response.status, 200);
  assert.equal((await db.get('SELECT notes FROM appointments WHERE id=?', [appointment.id])).notes, 'mobile correction');
  response = await fetch(`${url}/appointments/${appointment.id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);

  const archived = await db.get('SELECT deleted_at FROM appointments WHERE id=?', [appointment.id]);
  const order = await db.get('SELECT id,status,voided_at FROM orders WHERE appointment_id=?', [appointment.id]);
  const transaction = await db.get('SELECT voided_at FROM transactions WHERE source_type=? AND source_id=?', ['order', order.id]);
  assert.ok(archived.deleted_at);
  assert.equal(order.status, 'voided'); assert.ok(order.voided_at); assert.ok(transaction.voided_at);
  assert.equal((await db.get('SELECT stock_quantity FROM products WHERE id=?', [product.lastID])).stock_quantity, 5);
  assert.equal((await db.get("SELECT COUNT(*) count FROM product_stock_adjustments WHERE reason LIKE 'Voided order %'")).count, 1);

  response = await fetch(`${url}/transactions`);
  assert.deepEqual(await response.json(), []);
  response = await fetch(`${url}/dashboard/stats`);
  assert.equal((await response.json()).todayRevenue, 0);
  response = await fetch(`${url}/appointments/${appointment.id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal((await db.get('SELECT stock_quantity FROM products WHERE id=?', [product.lastID])).stock_quantity, 5);
});

test('service active accepts numeric zero and can be restored', async t => {
  const { db, url } = await apiServer(t);
  const service = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Cut',60,900)");
  const value = { name: 'Cut', duration_minutes: 60, price: 900 };

  let response = await fetch(`${url}/services/${service.lastID}`, { method: 'PUT', ...json({ ...value, active: 0 }) });
  assert.equal(response.status, 200);
  assert.equal((await db.get('SELECT active FROM services WHERE id=?', [service.lastID])).active, 0);

  response = await fetch(`${url}/services/${service.lastID}`, { method: 'PUT', ...json({ ...value, active: 1 }) });
  assert.equal(response.status, 200);
  assert.equal((await db.get('SELECT active FROM services WHERE id=?', [service.lastID])).active, 1);
});

test('product PUT accepts active=0 and audits inline stock changes', async t => {
  const { db, url } = await apiServer(t);
  const product = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Dye',500,10)");
  const response = await fetch(`${url}/products/${product.lastID}`, { method: 'PUT', ...json({ name: 'Dye', price: 550, stock_quantity: 12, vendor_name: 'MUJI Supply', active: 0 }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await db.get('SELECT price,stock_quantity,vendor_name,active FROM products WHERE id=?', [product.lastID]), { price: 550, stock_quantity: 12, vendor_name: 'MUJI Supply', active: 0 });
  assert.deepEqual(await db.get('SELECT quantity_delta,resulting_quantity FROM product_stock_adjustments WHERE product_id=?', [product.lastID]), { quantity_delta: 2, resulting_quantity: 12 });
});

test('product stock adjustment is atomic, auditable, and rejects negative results', async t => {
  const { db, url } = await apiServer(t);
  const product = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Oil',300,10)");
  let response = await fetch(`${url}/products/${product.lastID}/adjust`, { method: 'POST', ...json({ quantity_delta: 10, reason: '進貨' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stock_quantity, 20);
  response = await fetch(`${url}/products/${product.lastID}/history`);
  const history = await response.json();
  assert.equal(history.length, 1);
  assert.deepEqual({ delta: history[0].quantity_delta, result: history[0].resulting_quantity, reason: history[0].reason }, { delta: 10, result: 20, reason: '進貨' });

  response = await fetch(`${url}/products/${product.lastID}/adjust`, { method: 'POST', ...json({ quantity_delta: -21 }) });
  assert.equal(response.status, 409);
  assert.equal((await db.get('SELECT stock_quantity FROM products WHERE id=?', [product.lastID])).stock_quantity, 20);
  assert.equal((await db.get('SELECT COUNT(*) count FROM product_stock_adjustments WHERE product_id=?', [product.lastID])).count, 1);
});

test('product DELETE hard-deletes only products without order or stock history', async t => {
  const { db, url } = await apiServer(t);
  const unused = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Unused',100,0)");
  let response = await fetch(`${url}/products/${unused.lastID}`, { method: 'DELETE' });
  assert.equal(response.status, 204);

  const used = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Historic',100,2)");
  await db.run("INSERT INTO product_stock_adjustments(product_id,quantity_delta,resulting_quantity,reason) VALUES (?,?,?,?)", [used.lastID, 2, 2, 'Initial count']);
  response = await fetch(`${url}/products/${used.lastID}`, { method: 'DELETE' });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /停用.*歷史/);
  assert.ok(await db.get('SELECT id FROM products WHERE id=?', [used.lastID]));
});

test('service DELETE hard-deletes only unreferenced services', async t => {
  const { db, url } = await apiServer(t);
  const unused = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Unused',30,500)");
  let response = await fetch(`${url}/services/${unused.lastID}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal(await db.get('SELECT id FROM services WHERE id=?', [unused.lastID]), undefined);

  const customer = await db.run("INSERT INTO customers(name) VALUES ('Client')");
  const used = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Historic',45,800)");
  await db.run(`INSERT INTO appointments(customer_id,service_id,start_time,end_time,status,price)
    VALUES (?,?,?,?,?,?)`, [customer.lastID, used.lastID, '2031-02-03T10:00:00Z', '2031-02-03T10:45:00Z', 'completed', 800]);
  response = await fetch(`${url}/services/${used.lastID}`, { method: 'DELETE' });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /停用.*歷史/);
  assert.ok(await db.get('SELECT id FROM services WHERE id=?', [used.lastID]));
});
