'use strict';

const { getDb } = require('../config/db');

function syncUser({ pccuid, displayName }) {
  if (!pccuid) throw new Error('pccuid required');
  const db = getDb();
  const now = new Date().toISOString();
  const name = displayName || pccuid;
  const existing = db.prepare('SELECT pccuid FROM users WHERE pccuid = ?').get(pccuid);
  if (existing) {
    db.prepare(
      'UPDATE users SET display_name = ?, updated_at = ? WHERE pccuid = ?'
    ).run(name, now, pccuid);
  } else {
    db.prepare(
      'INSERT INTO users (pccuid, display_name, total_points, updated_at) VALUES (?, ?, 0, ?)'
    ).run(pccuid, name, now);
  }
  return getUser(pccuid);
}

function getUser(pccuid) {
  return getDb().prepare('SELECT * FROM users WHERE pccuid = ?').get(pccuid) || null;
}

function applyPoints(deltas) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    'UPDATE users SET total_points = total_points + ?, updated_at = ? WHERE pccuid = ?'
  );
  const tx = db.transaction((entries) => {
    for (const [pccuid, delta] of entries) {
      stmt.run(delta, now, pccuid);
    }
  });
  tx(Object.entries(deltas));
}

function topRanks(limit = 10) {
  return getDb()
    .prepare(
      'SELECT pccuid, display_name, total_points, updated_at FROM users ORDER BY total_points DESC, updated_at ASC LIMIT ?'
    )
    .all(limit);
}

module.exports = { syncUser, getUser, applyPoints, topRanks };
