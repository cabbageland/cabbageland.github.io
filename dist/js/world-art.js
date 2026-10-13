// Artwork around the map. The map itself (pieces, water, hit areas) comes from world/layers/layers.js,
// generated from world/scene.json.
export const LAYER_DIR = './world/layers/';

// Room portraits. aspect is width / height; contain = transparent illustration shown on paper.
export const CARDS = {
  read: { cardArt: './art/cards/escape-the-void.webp', cardAspect: 4 / 5 },
  music: { cardArt: './art/cards/compose-boredom.webp', cardAspect: 4 / 5 },
  nerd: { cardArt: './art/cards/nerds-farm.webp', cardAspect: 4 / 5 },
  art: { cardArt: './art/cards/my-world-in-xd.webp', cardAspect: 4 / 5 },
  pets: { cardArt: './art/cards/petting-zone.webp', cardAspect: 1, contain: true },
  great: { cardArt: './art/cards/the-great-cabbage.webp', cardAspect: 4 / 5 },
};

// Where the floating landmark names sit on the map (scene units).
export const LANDMARKS = { pets: [716, 214], great: [1030, 6] };

// Works shown in my-world-in-XD's gallery.
export const GALLERY = [
  { src: './art/gallery/day-signs.webp', width: 3968, height: 1586, title: 'art.dayTitle', caption: 'art.origin', alt: 'art.originalAlt', label: 'art.openOriginal' },
  { src: './art/gallery/night.webp', width: 3966, height: 1586, title: 'art.nightTitle', caption: 'art.nightCaption', alt: 'art.nightAlt', label: 'art.openNight' },
  { src: './art/gallery/island.webp', width: 3072, height: 2048, title: 'art.islandTitle', caption: 'art.islandCaption', alt: 'art.islandAlt', label: 'art.openIsland' },
];

// Tracy's gallery in my-world-in-XD: a wall of small frames in year order; a click opens the viewer.
// cat sorts each work into one of the wall's groups: 'comic', 'paint' (paintings and drawings) or 'digital'.
// Text lives in translations.js under portfolio.<id>.title / .meta / .note / .alt (meta and note only when flagged here).
// Images in art/portfolio/: s/<id>.webp for the wall, m/<id>.webp (mw pixels wide) and <id>.webp (w pixels wide, the full
// size) for the viewer; originals are kept in art/source/portfolio/. year is used for sorting and the little tag.
// kind 'set' = several pictures under one label (<id>-1, <id>-2, …); kind 'book' = pages turned in the book reader,
// chapters = the page each chapter starts on.
export const PORTFOLIO_GROUPS = ['comic', 'paint', 'digital'];
export const PORTFOLIO = [
  {id: 'pavilion', year: 2017, cat: 'paint', meta: true, note: true, w: 1800, h: 1356, mw: 1100},
  {id: 'iguana', year: 2017, cat: 'paint', meta: true, w: 1352, h: 1800, mw: 826},
  {id: 'belizian-boat', year: 2018, cat: 'paint', meta: true, w: 1406, h: 1093, mw: 1100},
  {id: 'heron', year: 2018, cat: 'paint', meta: true, w: 1357, h: 1069, mw: 1100},
  {id: 'knight-dairy', year: 2018, cat: 'comic', meta: true, note: true, w: 1648, h: 2000, mw: 906},
  {id: 'tools', year: 2018, cat: 'paint', meta: true, note: true, w: 1800, h: 1301, mw: 1100},
  {id: 'neurotic-cat', year: 2018, cat: 'comic', meta: true, note: true, kind: 'book', pages: [[1534, 2000], [1553, 2000], [1486, 2000], [1475, 2000], [1426, 2000], [1447, 2000], [1423, 2000], [1422, 2000]], chapters: [1, 3, 5, 7]},
  {id: 'rabbit-head-screw', year: 2019, cat: 'paint', meta: true, note: true, w: 1800, h: 1354, mw: 1100},
  {id: 'intolerance', year: 2019, cat: 'paint', meta: true, w: 657, h: 1112, mw: 650},
  {id: 'mirror-girl', year: 2019, cat: 'paint', meta: true, note: true, w: 1685, h: 1259, mw: 1100},
  {id: 'mom', year: 2019, cat: 'paint', meta: true, w: 1487, h: 1097, mw: 1100},
  {id: 'dad', year: 2019, cat: 'paint', meta: true, w: 1114, h: 1392, mw: 880},
  {id: 'photosynthesis', year: 2019, cat: 'paint', meta: true, note: true, w: 1800, h: 1200, mw: 1100},
  {id: 'aposematic', year: 2019, cat: 'paint', meta: true, note: true, w: 908, h: 1210, mw: 825},
  {id: 'more-of-the-same-dad', year: 2020, cat: 'paint', meta: true, w: 1141, h: 1141, mw: 1100},
  {id: 'digital-red', year: 2020, cat: 'digital', meta: true, w: 1335, h: 1001, mw: 1100},
  {id: 'digital-alley', year: 2020, cat: 'digital', meta: true, w: 1216, h: 1800, mw: 743},
  {id: 'digital-lamp', year: 2020, cat: 'digital', meta: true, w: 1001, h: 1335, mw: 825},
  {id: 'nezha', year: 2020, cat: 'digital', meta: true, note: true, kind: 'set', images: [[890, 668], [890, 668], [890, 668], [890, 668], [890, 668], [890, 668]], mw: 890},
  {id: 'rabbit', year: 2023, cat: 'digital', meta: true, w: 900, h: 900, mw: 900},
  {id: 'cat-plate', year: 2026, cat: 'paint', meta: true, w: 1800, h: 1350, mw: 1100},
];
