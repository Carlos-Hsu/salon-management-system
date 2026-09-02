const STATUSES = ['pending', 'confirmed', 'in_service', 'completed', 'cancelled'];

async function migrate(db) {
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT,
      email TEXT, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stylists (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO stylists(id, name) VALUES (1, 'Owner');
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
      price INTEGER NOT NULL CHECK(price >= 0), active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
      active INTEGER NOT NULL DEFAULT 1, vendor_name TEXT
    );
    CREATE TABLE IF NOT EXISTS product_stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,
      quantity_delta INTEGER NOT NULL, resulting_quantity INTEGER NOT NULL CHECK(resulting_quantity >= 0),
      reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
      stylist_id INTEGER NOT NULL DEFAULT 1, service_id INTEGER,
      service TEXT, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', price INTEGER NOT NULL DEFAULT 0,
      surcharge_type TEXT, surcharge_value INTEGER, notes TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(stylist_id) REFERENCES stylists(id), FOREIGN KEY(service_id) REFERENCES services(id)
    );
    CREATE TABLE IF NOT EXISTS appointment_products (
      appointment_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL CHECK(unit_price >= 0), PRIMARY KEY(appointment_id, product_id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS block_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT, stylist_id INTEGER NOT NULL DEFAULT 1,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, reason TEXT,
      FOREIGN KEY(stylist_id) REFERENCES stylists(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings(key,value) VALUES ('holiday_surcharge_type','none');
    INSERT OR IGNORE INTO settings(key,value) VALUES ('holiday_surcharge_value','0');
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER NOT NULL UNIQUE,
      subtotal INTEGER NOT NULL, surcharge INTEGER NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', voided_at TEXT, void_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    );
    CREATE TABLE IF NOT EXISTS income_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS expense_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    INSERT OR IGNORE INTO income_items(id,name) VALUES (1,'服務收入'),(2,'產品銷售');
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, item_id INTEGER NOT NULL,
      amount INTEGER NOT NULL, date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, notes TEXT,
      source_type TEXT, source_id INTEGER, voided_at TEXT, void_reason TEXT
    );
  `);

  // Upgrade databases created by the original prototype without destroying user data.
  const columns = await db.all('PRAGMA table_info(appointments)');
  const additions = [
    ['stylist_id', 'INTEGER NOT NULL DEFAULT 1'], ['service_id', 'INTEGER'],
    ['surcharge_type', 'TEXT'], ['surcharge_value', 'INTEGER'],
    ['created_at', 'TEXT'], ['deleted_at', 'TEXT']
  ];
  for (const [name, definition] of additions) {
    if (!columns.some((column) => column.name === name)) await db.run(`ALTER TABLE appointments ADD COLUMN ${name} ${definition}`);
  }
  const customerColumns = await db.all('PRAGMA table_info(customers)');
  if (!customerColumns.some((column) => column.name === 'deleted_at')) {
    await db.run('ALTER TABLE customers ADD COLUMN deleted_at TEXT');
  }
  const productColumns = await db.all('PRAGMA table_info(products)');
  for (const [name, definition] of [['active', 'INTEGER NOT NULL DEFAULT 1'], ['vendor_name', 'TEXT']]) {
    if (!productColumns.some((column) => column.name === name)) await db.run(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
  }
  // Keep this outside the initial schema block as well so upgrades are idempotent.
  await db.exec(`CREATE TABLE IF NOT EXISTS product_stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,
    quantity_delta INTEGER NOT NULL, resulting_quantity INTEGER NOT NULL CHECK(resulting_quantity >= 0),
    reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id));
    CREATE INDEX IF NOT EXISTS product_stock_adjustments_product_idx
      ON product_stock_adjustments(product_id, created_at DESC);`);
  const orderColumns = await db.all('PRAGMA table_info(orders)');
  for (const [name, definition] of [['voided_at', 'TEXT'], ['void_reason', 'TEXT']]) {
    if (!orderColumns.some((column) => column.name === name)) await db.run(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
  }
  const transactionColumns = await db.all('PRAGMA table_info(transactions)');
  for (const [name, definition] of [['source_type', 'TEXT'], ['source_id', 'INTEGER'], ['voided_at', 'TEXT'], ['void_reason', 'TEXT']]) {
    if (!transactionColumns.some((column) => column.name === name)) await db.run(`ALTER TABLE transactions ADD COLUMN ${name} ${definition}`);
  }
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_unique
    ON transactions(source_type, source_id) WHERE source_type IS NOT NULL;
    CREATE INDEX IF NOT EXISTS appointments_slot_idx ON appointments(stylist_id,start_time,end_time,status);`);
  await db.run(`INSERT OR IGNORE INTO services(name,duration_minutes,price)
                SELECT DISTINCT service, 60, COALESCE(price,0) FROM appointments WHERE service IS NOT NULL`);
  await db.run(`UPDATE appointments SET service_id=(SELECT id FROM services WHERE services.name=appointments.service)
                WHERE service_id IS NULL`);
}

module.exports = { migrate, STATUSES };
