import { readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const sharp=createRequire(import.meta.url)('sharp');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const mode of ['day','night']){
 const panorama=await readFile(resolve(root,`dist/art/panorama-${mode}-2x.webp`));
 if(panorama.toString('ascii',0,4)!=='RIFF'||panorama.toString('ascii',8,16)!=='WEBPVP8 ')throw new Error(`Unexpected ${mode} artwork format`);
 if((panorama.readUInt16LE(26)&0x3fff)!==3966||(panorama.readUInt16LE(28)&0x3fff)!==1586)throw new Error(`Unexpected ${mode} artwork dimensions`);
 const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="3966" height="1586" viewBox="0 0 1983 793">
 <defs>
  <linearGradient id="code-plaque" x2="0" y2="1"><stop stop-color="#102c3b"/><stop offset="1" stop-color="#071820"/></linearGradient>
  <linearGradient id="gallery-plaque" x2="0" y2="1"><stop stop-color="${mode==='day'?'#443723':'#50351f'}"/><stop offset="1" stop-color="${mode==='day'?'#322c20':'#35251a'}"/></linearGradient>
  <linearGradient id="palette-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${mode==='day'?'#ffe17b':'#ffe09a'}"/><stop offset=".5" stop-color="#f8aa36"/><stop offset="1" stop-color="#d57623"/></linearGradient>
 </defs>
 <g id="nerd-code-symbol" aria-label="&lt;/&gt;" transform="matrix(1 .065 -.025 1 1273 379)">
  <rect x="-1" y="-1" width="35" height="33" rx="2" fill="#081d28" stroke="#385363" stroke-width="1.5"/>
  <rect width="33" height="31" rx="1.5" fill="url(#code-plaque)" stroke="#537888" stroke-width=".8"/>
  <path d="M 10 10 L 4.5 15.5 L 10 21 M 19 7.5 L 14 23.5 M 23 10 L 28.5 15.5 L 23 21" fill="none" stroke="${mode==='day'?'#b4ed43':'#d0ff68'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
 </g>
 <g id="gallery-palette-symbol" aria-label="Artist palette">
  <path d="M 1500 474 L 1538 478 L 1537 513 L 1499 509 Z" fill="url(#gallery-plaque)"/>
  <g transform="matrix(1 .07 -.025 1 1502 476)">
   <path d="M 17 1 C 8 0 1 7 1 17 C 1 27 9 33 18 33 C 25 33 29 28 25 25 C 23 23 23 21 27 20 C 31 19 34 19 34 14 C 34 6 25 1 17 1 Z" fill="url(#palette-gold)" stroke="#30231b" stroke-width="1.3" stroke-linejoin="round"/>
   <path d="M 4 14 C 6 6 11 4 18 4" fill="none" stroke="#ffeaae" stroke-width="1" stroke-linecap="round"/>
   <circle cx="12" cy="8" r="3" fill="#487dbb" stroke="#345885" stroke-width=".6"/>
   <circle cx="25" cy="10" r="2.7" fill="#65bfd0" stroke="#337d8c" stroke-width=".6"/>
   <circle cx="6" cy="19" r="2.6" fill="#63a76b" stroke="#3b7550" stroke-width=".6"/>
   <circle cx="14" cy="27" r="2.7" fill="#cf6250" stroke="#984338" stroke-width=".6"/>
   <ellipse cx="19" cy="18" rx="2.8" ry="3.5" fill="${mode==='day'?'#3a3021':'#422d1c'}" stroke="#be752e" stroke-width=".8"/>
  </g>
 </g>
</svg>\n`;
 const cleaned=await sharp(panorama).composite([{input:Buffer.from(overlay)}]).removeAlpha().webp({lossless:true,effort:6}).toBuffer();
 await writeFile(resolve(root,`dist/art/panorama-${mode}-clean-v2.webp`),cleaned);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="3966" height="1586" viewBox="0 0 1983 793">
 <title>Cabbageland — ${mode==='day'?'Daylight':'After dark'}</title>
 <image width="1983" height="793" href="data:image/webp;base64,${cleaned.toString('base64')}"/>
</svg>\n`;
 await writeFile(resolve(root,`dist/cabbageland-wide-${mode}.svg`),svg);
 console.log(`Baked clean code and palette icons into ${mode} artwork at 3966×1586.`);
}
