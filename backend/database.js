const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { migrate } = require('./schema');

function openDatabase(filename = path.resolve(__dirname, 'data', 'salon.db')) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const raw = new sqlite3.Database(filename);
  let transactionTail = Promise.resolve();
  const db = {
    raw,
    run(sql, params = []) {
      return new Promise((resolve, reject) => raw.run(sql, params, function (error) {
        if (error) reject(error); else resolve({ lastID: this.lastID, changes: this.changes });
      }));
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => raw.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => raw.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
    },
    exec(sql) { return new Promise((resolve, reject) => raw.exec(sql, (error) => error ? reject(error) : resolve())); },
    transaction(work) {
      const pending = transactionTail.then(async () => {
        await db.exec('BEGIN IMMEDIATE');
        try { const result = await work(); await db.exec('COMMIT'); return result; }
        catch (error) { await db.exec('ROLLBACK'); throw error; }
      });
      transactionTail = pending.catch(() => undefined);
      return pending;
    },
    close() { return new Promise((resolve, reject) => raw.close((error) => error ? reject(error) : resolve())); }
  };
  db.ready = migrate(db);
  return db;
}

module.exports = { openDatabase };
