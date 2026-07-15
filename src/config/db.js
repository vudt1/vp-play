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
  // Merge leftover WAL from a previous hard kill before serving traffic.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (_) {
    /* best-effort */
  }
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

function checkpointDb() {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (_) {
    /* best-effort */
  }
}

function closeDb() {
  if (!db) return;
  checkpointDb();
  db.close();
  db = null;
}

module.exports = { getDb, checkpointDb, closeDb };
