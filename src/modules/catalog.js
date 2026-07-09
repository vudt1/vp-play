'use strict';

const MODULES = [
  {
    id: 'tienlen',
    name: 'Tiến Lên Miền Nam',
    blurb: '3 phòng · tối đa 4 người · realtime',
    iconPath: '/modules/tienlen/icon.svg',
    entryPath: '/modules/tienlen/index.html',
    kind: 'multiplayer',
  },
];

function listModules() {
  return MODULES.map((m) => ({ ...m }));
}

function getModule(id) {
  if (!id) return null;
  const found = MODULES.find((m) => m.id === id);
  return found ? { ...found } : null;
}

module.exports = { listModules, getModule };
