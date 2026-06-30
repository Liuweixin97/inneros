import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'inneros.db');
const password = process.env.INITIAL_OWNER_PASSWORD;

if (!password || password.length < 8) {
  console.error('INITIAL_OWNER_PASSWORD must be set and at least 8 characters');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
const now = new Date().toISOString();
const passwordHash = await bcrypt.hash(password, 12);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const columns = db.prepare('PRAGMA table_info(users)').all();
if (!columns.some((column) => column.name === 'username')) {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT');
}

db.prepare(`
  INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
  VALUES ('liuweixin', '刘炜鑫', 'liuweixin', 'liuweixin@inneros.local', ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    username = excluded.username,
    password_hash = excluded.password_hash,
    updated_at = excluded.updated_at
`).run(passwordHash, now, now);

console.log('Seeded owner user: liuweixin');
