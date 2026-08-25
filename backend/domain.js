const TRANSITIONS = {
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['in_service', 'cancelled']),
  in_service: new Set(['completed', 'cancelled']),
  completed: new Set(), cancelled: new Set()
};

function normalizeInterval(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!start || !end || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate >= endDate) {
    const error = new Error('start_time must be before end_time'); error.status = 400; throw error;
  }
  return [startDate.toISOString(), endDate.toISOString()];
}

function surchargeAmount(subtotal, type, value) {
  const amount = Number(value || 0);
  if (!Number.isInteger(subtotal) || subtotal < 0 || !Number.isInteger(amount) || amount < 0) throw Object.assign(new Error('Invalid surcharge'), { status: 400 });
  if (type === 'none' || !type) return 0;
  if (type === 'percent') return Math.round(subtotal * amount / 100);
  if (type === 'fixed') return amount;
  throw Object.assign(new Error('surcharge_type must be none, percent, or fixed'), { status: 400 });
}

function assertTransition(from, to) {
  if (from === to) return 'unchanged';
  if (!TRANSITIONS[from]?.has(to)) throw Object.assign(new Error(`Illegal status transition: ${from} -> ${to}`), { status: 409 });
  return 'changed';
}

async function collision(db, stylistId, start, end, excludeId) {
  const params = [stylistId, end, start];
  let excluded = '';
  if (excludeId) { excluded = ' AND id <> ?'; params.push(excludeId); }
  const appointment = await db.get(`SELECT id FROM appointments WHERE stylist_id=? AND status <> 'cancelled' AND deleted_at IS NULL
    AND datetime(start_time) < datetime(?) AND datetime(end_time) > datetime(?)${excluded} LIMIT 1`, params);
  const block = await db.get(`SELECT id FROM block_times WHERE stylist_id=?
    AND datetime(start_time) < datetime(?) AND datetime(end_time) > datetime(?) LIMIT 1`, [stylistId, end, start]);
  return appointment ? { type: 'appointment', id: appointment.id } : block ? { type: 'block', id: block.id } : null;
}

module.exports = { normalizeInterval, surchargeAmount, assertTransition, collision };
