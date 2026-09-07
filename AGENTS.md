# Cabbageland update instructions

## Established owner preferences

- Keep the existing 2D pixel-art world, bilingual English/Chinese controls, English landing default, wide day/night art, and captions below the canvas.
- Preserve all four buildings and their interactive rooms. The reading building and bottom navigation are named "escape-the-void" in both languages, matching the architecture. Keep Reading corner, Mailbox, and My notebook as its interior tabs in that order.
- Keep generated day/night panoramas aligned with the building coordinates in `dist/world-art.js`.
- The music pavilion includes a composer and the owner's personal songs from https://suno.com/@harudegoat. Use verified public song titles and links in `dist/songs.js`.
- Piano keys record notes in the highlighted sequencer column; held keys form chords. Keep this working from the entire composer dialog, including its header.
- Petting Zone labels the dinosaur and has a bottom navigation entry. The Great Cabbage is grandpa Tracy’s home. Both open introductions; the owner will supply the creature content and personal biography. Do not invent them.
- Petting Zone and The Great Cabbage use floating text with outlines around the letters only. Keep backgrounds, boxes, sign borders, and pointer triangles off these labels.
- Petting Zone lettering is smaller to reflect its distance. The Great Cabbage's room portrait includes the entire cabbage and waterfall with breathing room; use its dedicated portraitRect.
- Use the dedicated optimized illustrations in `dist/art/building-cards/` for the room cards of escape-the-void, compose boredom, nerd’s farm, my-world-in-XD, and The Great Cabbage. Preserve their full-resolution originals in `source-art/building-cards/`. Petting Zone continues to use its panorama crop until the owner supplies a matching card.

## Required delivery workflow

The owner explicitly requested that **every future website update be pushed to https://github.com/cabbageland/cabbageland.github.io.git, including all art assets**. This is standing authorization for routine updates to that repository; do not ask for that permission again.

1. Modify the current checkout and validate the changed behavior, JavaScript syntax, translations, and asset references.
2. Include `dist/`, all referenced art, original art, Blender sources/assets, and documentation in the GitHub update. Keep secrets, credentials, scratch files, and deployment archives out of Git.
3. Push the completed source to the existing GitHub repository's `main` branch. Preserve remote changes and history; never force-push. Use the connected GitHub tools when local Git authentication is unavailable. For a Git Data API upload, verify that each returned blob SHA matches the local `git hash-object` result, create a tree based on the current remote tree, and fast-forward the branch to a commit whose parent is its current head.
4. Follow the Sites skills to update the existing Site identified by `.openai/hosting.json`. Retain its current access settings and use its own repository credential only for its own repository.
5. Verify the GitHub branch contains the delivered files and that the Site deployment succeeded before claiming completion. Report any blocked destination clearly.

The root `index.html` forwards GitHub Pages visitors to the authored static app in `dist/`. The Site itself serves `dist/` directly. The two destinations must use the same application and artwork; do not maintain separately edited copies.
