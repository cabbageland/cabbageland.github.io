// Mechanical web export only. Input PNGs must already be genuine alpha cutouts.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { UI_ICONS } from '../dist/ui-icons.js';
const sharp=createRequire(import.meta.url)('sharp');

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/prepare-ui-icons.mjs <cutout-directory>');
const selected=process.argv.slice(3);
const names=selected.length?selected:Object.keys(UI_ICONS);
if(names.some(name=>!Object.hasOwn(UI_ICONS,name)))throw new Error('Unknown UI icon');
const destination=new URL('../dist/art/ui-icons/',import.meta.url);
await mkdir(destination,{recursive:true});
let total=0;
for(const name of names){
 const source=sharp(resolve(input,`${name}.png`));
 if(!(await source.metadata()).hasAlpha)throw new Error(`${name}: transparent input required`);
 // A PNG extension (or an all-opaque alpha channel) does not prove transparency.
 const pixels=await source.clone().ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=pixels.info;
 let transparent=0,foreground=0;
 for(let i=channels-1;i<pixels.data.length;i+=channels){
  const alpha=pixels.data[i];
  if(alpha===0)transparent++;
  if(alpha>=240)foreground++;
 }
 const corners=[0,width-1,(height-1)*width,width*height-1];
 if(corners.some(i=>pixels.data[i*channels+channels-1]!==0)||
  transparent<width*height*.1||foreground<width*height*.01){
  throw new Error(`${name}: cutout must have clear background and visible foreground`);
 }
 const {data,info}=await source.trim({background:'#00000000',threshold:1})
  .resize(120,120,{fit:'inside',kernel:'nearest'})
  .toBuffer({resolveWithObject:true});
 const x=128-info.width,y=128-info.height;
 const output=sharp(data).extend({left:Math.floor(x/2),right:Math.ceil(x/2),
  top:Math.floor(y/2),bottom:Math.ceil(y/2),background:'#00000000'});
 const result=await output.clone().webp({lossless:true,effort:6})
  .toFile(new URL(`${name}.webp`,destination).pathname);
 if(name==='cabbage')await output.resize(64,64,{kernel:'nearest'}).png()
  .toFile(new URL('favicon.png',destination).pathname);
 total+=result.size;
 console.log(`${name}: ${result.width}×${result.height}, ${result.size} bytes`);
}
console.log(`Total WebP payload: ${total} bytes`);
