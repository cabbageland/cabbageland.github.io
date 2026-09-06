# Cabbageland

A bilingual interactive pixel world for books, letters, music, experiments, and art.

## Project

- `dist/` — the complete static website, including JavaScript, styles, and artwork. No build step or API key is required.
- `dist/world-art.js` — day/night artwork paths and building coordinates.
- `dist/art/farmer-head-*.png` — generated close-up repairs for the farmer. `node scripts/build-world-art.mjs` assembles the SVG panoramas used by the map, room portraits, and gallery; the base PNG artwork stays intact.
- `dist/music-room.js`, `dist/music-input.js`, and `dist/soundtrack.js` — three-octave composer, keyboard recording, Shuffle, saved compositions, and WAV export.
- `dist/songs.js` — verified public songs from [haru de’goat on Suno](https://suno.com/@harudegoat).
- `dist/books.js` — the Reading corner's book links.
- `dist/translations.js` — English and Chinese interface text. The landing page defaults to English; `?lang=zh` opens Chinese.
- `blender/` — original 3D source scene, render, and creation scripts, retained with the art assets.
- `AGENTS.md` — project conventions and the owner's standing requirement to push every update to this repository.

Serve the project with any static HTTP server. The root entrypoint opens `dist/`; the app can also be served directly from `dist/`.

## Keyboard composition

Open compose boredom and use A W S E D F T G Y H U J to play and record notes. Hold keys together to enter a chord in one column; releasing the last key advances the input column. Click a step number or press left/right to select another column. Up/down changes octave. During playback, new notes are recorded at the current playhead. Piano buttons also add notes to the score. Shortcuts work throughout the open composer dialog and stay inactive in text fields, the songs tab, and other rooms.

## Upcoming introductions

The dinosaur's Petting Zone and The Great Cabbage (grandpa Tracy’s home) are interactive landmarks. Petting Zone also has a bottom navigation entry. Their bilingual introductory copy lives under `pets.*` and `great.*` in `dist/translations.js`; replace the coming-soon text when the owner supplies the creature descriptions and personal introduction.

## GitHub Pages

The root `index.html` and `.nojekyll` support GitHub Pages with `main` and `/ (root)` selected as the publishing source. The application assets remain in `dist/` to match the Sites deployment.

## Local saves

Notebook entries and saved compositions live in the visitor's browser. WAV downloads contain four loops of all notes in the composition. GitHub stores the application source and art, not visitors' browser data.
