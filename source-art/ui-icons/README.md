# Supplied UI icons

Original JPEG uploads are preserved here without alteration. The website uses
128 × 128 lossless WebP copies in `dist/art/ui-icons/`, with transparent padding
and fixed display dimensions. All ten icons have passed the real-alpha
transparent-background check and are integrated into matching interface controls.
Map panoramas, building coordinates, and building card illustrations are unchanged.

Accepted full-resolution cutouts are preserved as `{asset}.png`. The first edit
attempts are recorded in `extraction-prompts.json`; successful repairs of the
remaining eight are documented in `repair-prompts.md`. To repeat only the mechanical web export, run
`node scripts/prepare-ui-icons.mjs source-art/ui-icons` with Sharp available.

| Asset | Uploaded filename | Status / placement |
| --- | --- | --- |
| cabbage | E0E1B21C-53BA-47C9-AE5F-4741F486C1CB(1).jpeg | Branding, loader, favicon, Great Cabbage introduction |
| gramophone | 57A36EB5-809B-4BB3-A498-C10893D8FDDE.jpeg | Music navigation and personal songs tab |
| book-detailed | C3C7D614-E3F8-439E-A925-E74F96607FA3.jpeg | Reading navigation |
| code-tile | 9278B7BD-8E3D-487E-9DF1-918E31EFD19B.jpeg | Lab navigation |
| palette | 8F1B52BF-47F0-4981-8D94-3538E785719D.jpeg | Art navigation and gallery tab |
| sprout | 2EB9A9EF-C351-407C-BAF2-1BBE4E65EA30.jpeg | Map caption |
| brush | F46E5FDC-BAAA-4804-97E3-2710FA558CA2.jpeg | Drawing tab |
| music-note | 69BFEE18-DE4D-4106-906A-C3417CAC402B.jpeg | Ambient music control and composer tab |
| code | 1EEBCC38-522B-423F-A92B-D941C9905953.jpeg | Lab experiment heading |
| book | 461EEB26-1C0D-4154-8FE2-40C2BEFA15DD.jpeg | Reading corner tab |

The source JPEG checkerboards are actual pixels, not transparency. Each selected
cutout was prepared using the built-in image editing tool with this instruction:
remove only the checkerboard background, preserve the supplied pixel icon's
silhouette, colors and details, retain the complete object, and output genuine
alpha with no new elements, shadows, frames or text. These are image-editing
outputs, not pixel-identical extractions; minor details can differ from the originals.
Final assets are mechanically trimmed, sized with consistent padding, and losslessly
encoded for the web. The ten WebPs total 120,596 bytes. The code heading restores
a subtle green glow in CSS; it is not baked into the transparent source PNG.

Icons are decorative beside existing English/Chinese labels. Translation targets
remain on text spans, never their icon-containing buttons. Functional controls
retain their original accessible names, pressed states, and keyboard behavior.
