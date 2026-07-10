'use strict';

const { topRanks } = require('./userService');

const AVATAR_PALETTE = [
  '#3a4a60',
  '#458fff',
  '#de7507',
  '#31353b',
  '#262a30',
  '#005cbc',
];

function getTop(limit = 10) {
  return topRanks(limit);
}

function avatarInitial(displayName, pccuid) {
  const raw = String(displayName || pccuid || '?').trim();
  if (!raw) return '?';
  return raw.charAt(0).toLocaleUpperCase('vi');
}

function avatarBg(pccuid) {
  const s = String(pccuid || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function getTopBoard(limit = 10) {
  const size = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const rows = getTop(size);
  const board = rows.map((r, i) => ({
    rank: i + 1,
    placeholder: false,
    pccuid: r.pccuid,
    displayName: r.display_name,
    totalPoints: r.total_points,
    initial: avatarInitial(r.display_name, r.pccuid),
    avatarBg: avatarBg(r.pccuid),
  }));
  while (board.length < size) {
    const rank = board.length + 1;
    board.push({
      rank,
      placeholder: true,
      pccuid: null,
      displayName: 'Unknown user',
      totalPoints: null,
      initial: null,
      avatarBg: null,
    });
  }
  return board;
}

module.exports = { getTop, getTopBoard, avatarInitial, avatarBg };
