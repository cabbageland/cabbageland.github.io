// Folded-paper icons from the art library, with genuine alpha for light and dark surfaces.
export const UI_ICONS = Object.freeze({
  cabbage: './art/icons/cabbage.png',
  sprout: './art/icons/cabbage.png',
  gramophone: './art/icons/gramophone.png',
  'music-note': './art/icons/gramophone.png',
  book: './art/icons/book.png',
  'book-detailed': './art/icons/book.png',
  code: './art/icons/code-monitor.png',
  'code-tile': './art/icons/code-monitor.png',
  palette: './art/icons/palette.png',
  brush: './art/icons/palette.png',
  dino: './art/icons/dinosaur.png',
});

// Decorative only: the adjacent localized text remains the accessible label.
export function uiIcon(name) {
  if (!Object.hasOwn(UI_ICONS, name)) throw new Error(`Unknown UI icon: ${name}`);
  return `<img class="paper-icon" src="${UI_ICONS[name]}" width="26" height="26" alt="" aria-hidden="true" decoding="async" draggable="false">`;
}
