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

// Tracy's portfolio, shown in my-world-in-XD in the same frames as the gallery above.
// Text lives in translations.js under portfolio.<id>.title / .meta / .note / .alt (meta and note only when flagged here).
// Images: art/portfolio/<id>.webp is the full size a click opens, art/portfolio/m/<id>.webp the size shown in the room;
// originals are kept in art/source/portfolio/. w, h = full-size pixels.
// kind 'set' = several pictures under one label (<id>-1, <id>-2, …); kind 'book' = pages turned in the book reader,
// chapters = the page each chapter starts on.
export const PORTFOLIO = [
  {id: 'belizian-boat', meta: true, w: 1406, h: 1093},
  {id: 'rabbit-head-screw', meta: true, note: true, w: 1800, h: 1354},
  {id: 'heron', meta: true, w: 1357, h: 1069},
  {id: 'intolerance', meta: true, w: 657, h: 1112},
  {id: 'mirror-girl', meta: true, note: true, w: 1685, h: 1259},
  {id: 'mom', meta: true, w: 1487, h: 1097},
  {id: 'dad', meta: true, w: 1114, h: 1392},
  {id: 'more-of-the-same-dad', meta: true, w: 1141, h: 1141},
  {id: 'photosynthesis', meta: true, note: true, w: 1800, h: 1200},
  {id: 'aposematic', meta: true, note: true, w: 908, h: 1210},
  {id: 'digital-red', meta: true, w: 1335, h: 1001},
  {id: 'digital-alley', meta: true, w: 1216, h: 1800},
  {id: 'digital-lamp', meta: true, w: 1001, h: 1335},
  {id: 'nezha', meta: true, note: true, kind: 'set', images: [[890, 668], [890, 668], [890, 668], [890, 668], [890, 668], [890, 668]]},
  {id: 'knight-dairy', meta: true, note: true, w: 1648, h: 2000},
  {id: 'neurotic-cat', meta: true, note: true, kind: 'book', pages: [[1534, 2000], [1553, 2000], [1486, 2000], [1475, 2000], [1426, 2000], [1447, 2000], [1423, 2000], [1422, 2000]], chapters: [1, 3, 5, 7]},
  {id: 'rabbit', w: 900, h: 900},
  {id: 'cat-plate', w: 1800, h: 1350},
  {id: 'tools', meta: true, note: true, w: 1800, h: 1301},
  {id: 'pavilion', meta: true, note: true, w: 1800, h: 1356},
  {id: 'iguana', meta: true, w: 1352, h: 1800},
];
