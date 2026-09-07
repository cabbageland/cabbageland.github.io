// Mechanical web export only. Input PNGs must already be genuine alpha cutouts.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { UI_ICONS } from '../dist/ui-icons.js';
const sharp=createRequire(import.meta.url)('sharp');

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/prepare-ui-icons.mjs <cutout-directory>');
const destination=new URL('../dist/art/ui-icons/',import.meta.url);
await mkdir(destination,{recursive:true});
let total=0;
for(const name of Object.keys(UI_ICONS)){
 const source=sharp(resolve(input,`${name}.png`));
 if(!(await source.metadata()).hasAlpha)throw new Error(`${name}: transparent input required`);
 const {data,info}=await source.trim({background:'#00000000',threshold:1})
  .resize(120,120,{fit:'inside',kernel:'nearest'})
  .toBuffer({resolveWithObject:true});
 const x=128-info.width,y=128-info.height;
 const output=sharp(data).extend({left:Math.floor(x/2),right:Math.ceil(x/2),
  top:Math.floor(y/2),bottom:Math.ceil(y/2),background:'#00000000'});
 const result=await output.clone().webp({lossless:true,effort:6})
  .toFile(new URL(`${name}.webp`,destination).pathname);
 total+=result.size;
 console.log(`${name}: ${result.width}×${result.height}, ${result.size} bytes`);
}
console.log(`Total WebP payload: ${total} bytes`);
