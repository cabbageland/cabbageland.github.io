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
