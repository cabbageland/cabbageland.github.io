// User-supplied artwork, prepared with genuine alpha for light and dark surfaces.
export const UI_ICONS=Object.freeze({
 cabbage:'./art/ui-icons/cabbage.webp',
 gramophone:'./art/ui-icons/gramophone.webp',
 'book-detailed':'./art/ui-icons/book-detailed.webp',
 'code-tile':'./art/ui-icons/code-tile.webp',
 palette:'./art/ui-icons/palette.webp',
 sprout:'./art/ui-icons/sprout.webp',
 brush:'./art/ui-icons/brush.webp',
 'music-note':'./art/ui-icons/music-note.webp',
 code:'./art/ui-icons/code.webp',
 book:'./art/ui-icons/book.webp'
});

// Decorative only: the adjacent localized text remains the accessible label.
export function uiIcon(name){
 if(!Object.hasOwn(UI_ICONS,name))throw new Error(`Unknown UI icon: ${name}`);
 return `<img class="pixel-icon" src="${UI_ICONS[name]}" width="24" height="24" alt="" aria-hidden="true" decoding="async" draggable="false">`;
}
