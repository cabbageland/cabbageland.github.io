import { readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Package generated head repairs with the existing panorama for every image view.
// The underlying raster art is embedded intact; only the small repaired area overlays it.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const crop={x:824,y:516,width:96,height:82};
for(const mode of ['day','night']){
 const [panorama,patch]=await Promise.all([
  readFile(resolve(root,`dist/cabbageland-wide-${mode}.png`)),
  readFile(resolve(root,`dist/art/farmer-head-${mode}.png`))
 ]);
 if(panorama.readUInt32BE(16)!==1983||panorama.readUInt32BE(20)!==793)throw new Error('Unexpected panorama dimensions');
 const pw=patch.readUInt32BE(16),ph=patch.readUInt32BE(20);
 if(Math.abs(pw/ph-crop.width/crop.height)>.02)throw new Error(`Unexpected ${mode} head patch aspect ratio: ${pw}×${ph}`);
 const {x,y,width:w,height:h}=crop;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1983" height="793" viewBox="0 0 1983 793">
 <title>Cabbageland — ${mode==='day'?'Daylight':'After dark'}</title>
 <defs>
  <linearGradient id="fade-x"><stop stop-color="white" stop-opacity="0"/><stop offset=".083333" stop-color="white"/><stop offset=".916667" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <linearGradient id="fade-y" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".097561" stop-color="white"/><stop offset=".902439" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <mask id="edge-x" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#fade-x)"/></mask>
  <mask id="edge-y" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#fade-y)"/></mask>
 </defs>
 <image width="1983" height="793" href="data:image/png;base64,${panorama.toString('base64')}"/>
 <g mask="url(#edge-x)"><image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" mask="url(#edge-y)" href="data:image/png;base64,${patch.toString('base64')}"/></g>
</svg>\n`;
 await writeFile(resolve(root,`dist/cabbageland-wide-${mode}.svg`),svg);
 console.log(`Assembled ${mode} artwork with ${pw}×${ph} generated head repair.`);
}
