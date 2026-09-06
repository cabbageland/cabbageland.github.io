import { readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const mode of ['day','night']){
 const panorama=await readFile(resolve(root,`dist/art/panorama-${mode}-2x.webp`));
 if(panorama.toString('ascii',0,4)!=='RIFF'||panorama.toString('ascii',8,16)!=='WEBPVP8 ')throw new Error(`Unexpected ${mode} artwork format`);
 if((panorama.readUInt16LE(26)&0x3fff)!==3966||(panorama.readUInt16LE(28)&0x3fff)!==1586)throw new Error(`Unexpected ${mode} artwork dimensions`);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="3966" height="1586" viewBox="0 0 1983 793">
 <title>Cabbageland — ${mode==='day'?'Daylight':'After dark'}</title>
 <defs>
  <linearGradient id="code-plaque" x2="0" y2="1"><stop stop-color="#102c3b"/><stop offset="1" stop-color="#071820"/></linearGradient>
 </defs>
 <image width="1983" height="793" href="data:image/webp;base64,${panorama.toString('base64')}"/>
 <g id="nerd-code-symbol" aria-label="&lt;/&gt;" transform="matrix(1 .065 -.025 1 1273 379)">
  <rect x="-1" y="-1" width="35" height="33" rx="2" fill="#081d28" stroke="#385363" stroke-width="1.5"/>
  <rect width="33" height="31" rx="1.5" fill="url(#code-plaque)" stroke="#537888" stroke-width=".8"/>
  <path d="M 10 10 L 4.5 15.5 L 10 21 M 19 7.5 L 14 23.5 M 23 10 L 28.5 15.5 L 23 21" fill="none" stroke="${mode==='day'?'#b4ed43':'#d0ff68'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
 </g>
</svg>\n`;
 await writeFile(resolve(root,`dist/cabbageland-wide-${mode}.svg`),svg);
 console.log(`Assembled ${mode} artwork at 3966×1586 with a scalable </> symbol.`);
}
