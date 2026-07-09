'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { env } = require('./env');

let db;

function getDb() {
  if (db) return db;
  const dir = path.dirname(env.databasePath);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(env.databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      pccuid TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      total_points INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
