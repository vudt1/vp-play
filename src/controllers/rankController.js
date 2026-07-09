'use strict';

const { getTop } = require('../services/rankService');

function listRanks(req, res) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const rows = getTop(limit);
    res.json(
      rows.map((r) => ({
        pccuid: r.pccuid,
        displayName: r.display_name,
        totalPoints: r.total_points,
      }))
    );
  } catch (e) {
    res.status(500).json({ code: 'RANK_FAILED', message: 'Could not load ranks' });
  }
}

module.exports = { listRanks };
