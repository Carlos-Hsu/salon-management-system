const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../database');
const { createAppointment, updateAppointment } = require('../salon-service');
const { normalizeInterval, surchargeAmount } = require('../domain');

async function fixture(t) {
  const db = openDatabase(':memory:'); await db.ready;
  t.after(() => db.close());
  const customer = await db.run("INSERT INTO customers(name,phone) VALUES ('A','1')");
  const service = await db.run("INSERT INTO services(name,duration_minutes,price) VALUES ('Cut',60,1001)");
  const product = await db.run("INSERT INTO products(name,price,stock_quantity) VALUES ('Wax',99,2)");
  return { db, customer_id: customer.lastID, service_id: service.lastID, product_id: product.lastID };
}
const base = (f,start='2030-01-01T10:00:00.000Z') => ({ customer_id:f.customer_id,service_id:f.service_id,start_time:start,status:'pending' });

test('collision rejects overlap but permits adjacency, cancelled slots, and self update', async t => {
  const f=await fixture(t); const first=await createAppointment(f.db,base(f));
  await assert.rejects(createAppointment(f.db,base(f,'2030-01-01T10:59:00.000Z')),/conflicts/);
  const adjacent=await createAppointment(f.db,base(f,'2030-01-01T11:00:00.000Z')); assert.ok(adjacent.id);
  await updateAppointment(f.db,first.id,{...first,start_time:'2030-01-01T09:30:00.000Z'});
  await updateAppointment(f.db,first.id,{status:'cancelled'});
  const replacement=await createAppointment(f.db,base(f,'2030-01-01T09:30:00.000Z')); assert.ok(replacement.id);
});

test('invalid intervals and blocks are rejected', async t => {
  assert.throws(()=>normalizeInterval('bad','2030-01-01'),/before/);
  assert.throws(()=>normalizeInterval('2030-01-01','2030-01-01'),/before/);
  const f=await fixture(t); await f.db.run("INSERT INTO block_times(start_time,end_time) VALUES ('2030-01-01T10:00:00.000Z','2030-01-01T11:00:00.000Z')");
  await assert.rejects(createAppointment(f.db,base(f)),/block/);
});

test('surcharge uses integer minor units and deterministic rounding', () => {
  assert.equal(surchargeAmount(1001,'percent',10),100);
  assert.equal(surchargeAmount(1005,'percent',10),101);
  assert.equal(surchargeAmount(1001,'fixed',77),77);
  assert.equal(surchargeAmount(1001,'none',999),0);
  assert.throws(()=>surchargeAmount(100,'percent',-1),/Invalid/);
});

test('state machine rejects skipping, reversal, and terminal changes', async t => {
  const f=await fixture(t); const app=await createAppointment(f.db,base(f));
  await assert.rejects(updateAppointment(f.db,app.id,{status:'completed'}),/Illegal/);
  await updateAppointment(f.db,app.id,{status:'confirmed'});
  await assert.rejects(updateAppointment(f.db,app.id,{status:'pending'}),/Illegal/);
  await updateAppointment(f.db,app.id,{status:'cancelled'});
  await assert.rejects(updateAppointment(f.db,app.id,{status:'confirmed'}),/Illegal/);
});

test('completion creates exactly one order/income and decrements stock once', async t => {
  const f=await fixture(t); const app=await createAppointment(f.db,{...base(f),products:[{product_id:f.product_id,quantity:1}],surcharge_type:'percent',surcharge_value:10});
  await updateAppointment(f.db,app.id,{status:'confirmed'}); await updateAppointment(f.db,app.id,{status:'in_service'});
  const completions = await Promise.allSettled([updateAppointment(f.db,app.id,{status:'completed'}), updateAppointment(f.db,app.id,{status:'completed'})]);
  assert.equal(completions.filter(result => result.status === 'fulfilled').length, 1);
  await updateAppointment(f.db,app.id,{status:'completed'});
  assert.equal((await f.db.get('SELECT COUNT(*) count FROM orders')).count,1);
  const tx=await f.db.get('SELECT COUNT(*) count,MAX(amount) amount FROM transactions'); assert.equal(tx.count,1); assert.equal(tx.amount,1210);
  assert.equal((await f.db.get('SELECT stock_quantity FROM products WHERE id=?',[f.product_id])).stock_quantity,1);
});
