# Icon transparency repairs

Mode: built-in image_gen. Use case: background-extraction.

Each `{subject}-original.jpeg` in this directory was the sole edit target.
Accepted outputs are retained as `{subject}.png` with their generated alpha intact.
All eight passed an RGBA check, alpha=0 at all four corners, clear background,
visible foreground, and visual inspection before mechanical web export.

## Cabbage test

Remove the checkerboard background from this cabbage icon. Return the same icon on a genuinely transparent background (RGBA PNG), including alpha=0 outside the object. Preserve its pixel-art silhouette and internal colors/details. No checkerboard, white matte, border, or new elements.

## Remaining seven

The same prompt was used with `cabbage` replaced by the exact subject below,
one edit per original source image:

- gramophone
- code-tile
- palette
- brush
- music-note
- code
- book

## Book targeted retry

The first book result was opaque and rejected. Input for the successful retry
was the original book JPEG again, not the rejected output:

Cut out this pixel-art book. Delete all background pixels so the empty canvas has real PNG transparency. Keep the book itself unchanged. Output a transparent PNG, not a picture of a transparency grid.
