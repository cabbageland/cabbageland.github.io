# Supplied UI icons

Original JPEG uploads are preserved here without alteration. The website uses
128 × 128 lossless WebP copies in `dist/art/ui-icons/`, with transparent padding
and fixed display dimensions. Only the detailed book and sprout passed the
transparent-background extraction check. Other originals are retained for a
future transparent PNG replacement; their existing UI equivalents stay unchanged.
Map panoramas, building coordinates, and building card illustrations are unchanged.

The two accepted full-resolution cutouts are preserved as `book-detailed.png`
and `sprout.png`. Exact built-in edit prompts for all ten attempts are recorded
in `extraction-prompts.json`. To repeat only the mechanical web export, run
`node scripts/prepare-ui-icons.mjs source-art/ui-icons` with Sharp available.

| Asset | Uploaded filename | Status / placement |
| --- | --- | --- |
| cabbage | E0E1B21C-53BA-47C9-AE5F-4741F486C1CB(1).jpeg | Pending transparent source |
| gramophone | 57A36EB5-809B-4BB3-A498-C10893D8FDDE.jpeg | Pending transparent source |
| book-detailed | C3C7D614-E3F8-439E-A925-E74F96607FA3.jpeg | Reading navigation and Reading corner tab |
| code-tile | 9278B7BD-8E3D-487E-9DF1-918E31EFD19B.jpeg | Pending transparent source |
| palette | 8F1B52BF-47F0-4981-8D94-3538E785719D.jpeg | Pending transparent source |
| sprout | 2EB9A9EF-C351-407C-BAF2-1BBE4E65EA30.jpeg | Map caption and growth-experiment heading |
| brush | F46E5FDC-BAAA-4804-97E3-2710FA558CA2.jpeg | Pending transparent source |
| music-note | 69BFEE18-DE4D-4106-906A-C3417CAC402B.jpeg | Pending transparent source |
| code | 1EEBCC38-522B-423F-A92B-D941C9905953.jpeg | Pending transparent source |
| book | 461EEB26-1C0D-4154-8FE2-40C2BEFA15DD.jpeg | Pending transparent source |

The source JPEG checkerboards are actual pixels, not transparency. Each selected
cutout was prepared using the built-in image editing tool with this instruction:
remove only the checkerboard background, preserve the supplied pixel icon's
silhouette, colors and details, retain the complete object, and output genuine
alpha with no new elements, shadows, frames or text. Final assets are mechanically
trimmed, sized with consistent padding, and losslessly encoded for the web.

Icons are decorative beside existing English/Chinese labels. Translation targets
remain on text spans, never their icon-containing buttons. Functional controls
retain their original accessible names, pressed states, and keyboard behavior.
