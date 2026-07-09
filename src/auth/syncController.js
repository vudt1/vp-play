'use strict';

const { verifyAccessToken } = require('./keycloakVerify');
const { syncUser } = require('../services/userService');

async function syncFromRequest(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.token;
    const verified = await verifyAccessToken(token);
    if (!verified.ok) {
      return res.status(401).json({ code: verified.code, message: verified.message });
    }
    const displayName = req.body?.displayName || verified.player.displayName;
    const user = syncUser({
      pccuid: verified.player.pccuid,
      displayName,
    });
    return res.json({
      pccuid: user.pccuid,
      displayName: user.display_name,
      totalPoints: user.total_points,
    });
  } catch (e) {
    console.error('[vp-play] auth sync failed', e?.message || e);
    return res.status(500).json({ code: 'SYNC_FAILED', message: 'Sync failed' });
  }
}

module.exports = { syncFromRequest };
