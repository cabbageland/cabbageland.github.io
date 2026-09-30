# Cabbageland

A bilingual paper-cut pop-up world for books, letters, music, experiments, and art. The wide day/night panorama is cut into paper pieces that move like stop-motion (12 fps idle, 24 fps reactions and water); clicking a place makes it bounce, scatter paper bits and play a small sound before its room opens.

## Project

- `dist/` — the complete static website. No build step or API key is needed to serve it.
- `dist/index.html`, `dist/css/paper.css` — page shell and paper UI (day and night themes; the map fills the window between the header and footer).
- `dist/js/paper-stage.js` — the cut-paper animation engine (Canvas 2D): pieces, water, drifting paper clouds, Cabbageclaw, bursts. `dist/js/world.js` — camera, hit testing, day/night, rooms and navigation. `dist/js/paper-sound.js` — click sounds and the music box.
- `dist/world/scene.json` — everything that can be tuned: paper pieces and pivots, motions, click reactions, water, emitters, Cabbageclaw's path. `dist/world/rebuild.sh` regenerates `dist/world/layers/` from `dist/world/source/` (macOS: Swift, Vision, MetalFX; `cwebp` for WebP). See `dist/README.md`.
- `dist/world/source/` — the day, signed-day and night panoramas (1983 × 793) and their AI-upscaled `hd/` copies (Real-ESRGAN x4plus, 3966 × 1586).
- `dist/art/` — room cards, gallery images, icons and Cabbageclaw as WebP; originals in `dist/art/source/`. Older pixel-edition art (`dist/art/panorama-*`, `building-cards/`, `ui-icons/`, `farmer-head-*`) is kept for reference.
- `dist/js/music-room.js`, `music-input.js`, `soundtrack.js` — three-octave composer, keyboard recording, Shuffle, saved compositions, and WAV export.
- `dist/js/songs.js` — verified public songs from [haru de’goat on Suno](https://suno.com/@harudegoat).
- `dist/js/books.js` — the Reading corner's book links.
- `dist/js/translations.js` — English and Chinese interface text. The landing page defaults to English; `?lang=zh` opens Chinese.
- `blender/` — original 3D source scene, render, and creation scripts, retained with the art assets.
- `AGENTS.md` — project conventions and the owner's standing requirement to push every update to this repository.

Serve the project with any static HTTP server. The root entrypoint opens `dist/`; the app can also be served directly from `dist/`.

## Keyboard composition

Open compose boredom and use A W S E D F T G Y H U J to play and record notes. Hold keys together to enter a chord in one column; releasing the last key advances the input column. Click a step number or press left/right to select another column. Up/down changes octave. During playback, new notes are recorded at the current playhead. Piano buttons also add notes to the score. Shortcuts work throughout the open composer dialog and stay inactive in text fields, the songs tab, and other rooms.

## Upcoming introductions

The dinosaur's Petting Zone and The Great Cabbage (grandpa Tracy’s home) are interactive landmarks. Petting Zone also has a bottom navigation entry. Their bilingual introductory copy lives under `pets.*` and `great.*` in `dist/js/translations.js`; replace the coming-soon text when the owner supplies the creature descriptions and personal introduction.

## GitHub Pages

The root `index.html` and `.nojekyll` support GitHub Pages with `main` and `/ (root)` selected as the publishing source. The application assets remain in `dist/` to match the Sites deployment.

## Local saves

Notebook entries and saved compositions live in the visitor's browser. WAV downloads contain four loops of all notes in the composition. GitHub stores the application source and art, not visitors' browser data.
