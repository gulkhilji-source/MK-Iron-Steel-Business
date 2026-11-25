import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
const dataDir = path.resolve('server/data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'mk-business.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT DEFAULT '',address TEXT DEFAULT '',notes TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT DEFAULT '',address TEXT DEFAULT '',notes TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,party_type TEXT NOT NULL,party_id INTEGER NOT NULL,kind TEXT NOT NULL,description TEXT DEFAULT '',amount REAL NOT NULL,method TEXT DEFAULT 'Cash',reference TEXT DEFAULT '',created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,voided INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER NOT NULL,order_no TEXT NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',total REAL NOT NULL,advance REAL DEFAULT 0,delivery_date TEXT DEFAULT '',status TEXT DEFAULT 'Pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY AUTOINCREMENT,category TEXT NOT NULL,description TEXT DEFAULT '',amount REAL NOT NULL,method TEXT DEFAULT 'Cash',expense_date TEXT DEFAULT CURRENT_DATE,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cash_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,direction TEXT NOT NULL,account TEXT NOT NULL,amount REAL NOT NULL,description TEXT DEFAULT '',entry_date TEXT DEFAULT CURRENT_DATE,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS bills(id INTEGER PRIMARY KEY AUTOINCREMENT,party_type TEXT DEFAULT '',party_id INTEGER,filename TEXT NOT NULL,original_name TEXT NOT NULL,extracted_text TEXT DEFAULT '',corrected_text TEXT DEFAULT '',bill_date TEXT DEFAULT '',total REAL DEFAULT 0,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id INTEGER,details TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);


// WhatsApp integration: customer consent and message history
const customerColumns = db.prepare("PRAGMA table_info(customers)").all();
if (!customerColumns.some(column => column.name === 'whatsapp_opt_in')) {
  db.exec("ALTER TABLE customers ADD COLUMN whatsapp_opt_in INTEGER NOT NULL DEFAULT 0");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    phone TEXT NOT NULL,
    message TEXT DEFAULT '',
    message_type TEXT DEFAULT 'text',
    media_filename TEXT DEFAULT '',
    whatsapp_message_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    error TEXT DEFAULT '',
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);


const count = db.prepare('SELECT COUNT(*) n FROM admins').get().n;
if (!count) {
  const name=process.env.ADMIN_NAME||'Mujahid Khilji', email=process.env.ADMIN_EMAIL||'admin@mk.local', pass=process.env.ADMIN_PASSWORD||'ChangeMe123!';
  db.prepare('INSERT INTO admins(name,email,password_hash) VALUES(?,?,?)').run(name,email,bcrypt.hashSync(pass,10));
}
// TEMPORARY: Reset an existing admin account once
if (process.env.RESET_ADMIN_CREDENTIALS === 'true') {
  const oldEmail = process.env.ADMIN_OLD_EMAIL;
  const newName = process.env.ADMIN_NAME;
  const newEmail = process.env.ADMIN_EMAIL;
  const newPassword = process.env.ADMIN_PASSWORD;

  if (!oldEmail || !newName || !newEmail || !newPassword) {
    throw new Error('Missing admin reset environment variables');
  }

  const result = db.prepare(`
    UPDATE admins
    SET name = ?, email = ?, password_hash = ?
    WHERE email = ?
  `).run(newName, newEmail, bcrypt.hashSync(newPassword, 10), oldEmail);

  console.log(
    result.changes
      ? 'Admin credentials updated successfully.'
      : 'Admin reset failed: old email was not found.'
  );
}

export default db;