'use strict';

const MODULES = [
  {
    id: 'tienlen',
    name: 'Tiến Lên Miền Nam',
    blurb: 'Game bài truyền thống cực hay',
    iconPath: '/modules/tienlen/icon.svg',
    coverPath: '/img/catalog/tienlen-cover.svg',
    entryPath: '/modules/tienlen/index.html',
    surfaceView: 'app_tienlen',
    kind: 'multiplayer',
    status: 'live',
    featured: true,
    maxSeats: 4,
    socketNamespace: '',
    categoryLabel: '',
    iconSymbol: 'style',
    iconTone: 'primary',
  },
  {
    id: 'caro',
    name: 'Caro',
    blurb: 'Game cờ caro',
    iconPath: '/modules/caro/icon.svg',
    coverPath: '/img/catalog/caro-cover.svg',
    entryPath: '/modules/caro/index.html',
    surfaceView: 'app_tienlen',
    kind: 'multiplayer',
    status: 'live',
    featured: true,
    maxSeats: 2,
    socketNamespace: '/caro',
    categoryLabel: '',
    iconSymbol: 'grid_on',
    iconTone: 'primary',
  },
  {
    id: 'xem-phim',
    name: 'Xem phim',
    blurb: 'Phim điện ảnh & Truyền hình mới nhất',
    iconPath: '',
    coverPath: '/img/catalog/movie-cover.svg',
    entryPath: '',
    kind: 'media',
    status: 'placeholder',
    featured: false,
    categoryLabel: 'Kho phim VP',
    iconSymbol: 'movie',
    iconTone: 'secondary',
  },
  {
    id: 'nghe-nhac',
    name: 'Nghe nhạc',
    blurb: 'Thư viện nhạc lossless chất lượng',
    iconPath: '',
    coverPath: '/img/catalog/music-cover.svg',
    entryPath: '',
    kind: 'media',
    status: 'placeholder',
    featured: false,
    categoryLabel: 'VP Sound',
    iconSymbol: 'music_note',
    iconTone: 'tertiary',
  },
  {
    id: 'tro-choi-nho',
    name: 'Trò chơi nhỏ',
    blurb: 'Giải trí nhanh giữa giờ làm việc',
    iconPath: '',
    coverPath: '',
    entryPath: '',
    kind: 'solo',
    status: 'placeholder',
    featured: false,
    categoryLabel: 'Dân văn phòng',
    iconSymbol: 'joystick',
    iconTone: 'muted',
  },
  {
    id: 'sach-noi',
    name: 'Sách nói',
    blurb: 'Kiến thức và cảm hứng mỗi ngày',
    iconPath: '',
    coverPath: '',
    entryPath: '',
    kind: 'media',
    status: 'placeholder',
    featured: false,
    categoryLabel: 'VP Library',
    iconSymbol: 'menu_book',
    iconTone: 'muted',
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

function getLiveModule(id) {
  const mod = getModule(id);
  if (!mod || mod.status !== 'live') return null;
  return mod;
}

module.exports = { listModules, getModule, getLiveModule };
