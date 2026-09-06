import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ART_WIDTH,ART_HEIGHT,DAY_ART,NIGHT_ART,BUILDINGS } from '../dist/world-art.js';

test('higher-resolution artwork preserves the existing map coordinates',()=>{
 assert.equal(ART_WIDTH,1983);
 assert.equal(ART_HEIGHT,793);
 for(const building of Object.values(BUILDINGS)){
  for(const rect of [building.rect,building.portraitRect].filter(Boolean)){
   const [left,top,width,height]=rect;
   assert.ok(left>=0&&top>=0&&left+width<=ART_WIDTH&&top+height<=ART_HEIGHT);
  }
 }
});

for(const [mode,source] of [['day',DAY_ART],['night',NIGHT_ART]]){
 test(`${mode} panorama embeds 2x artwork with an exact vector code symbol`,async()=>{
  const svg=await readFile(new URL(`../dist/${source}`,import.meta.url),'utf8');
  const panorama=await readFile(new URL(`../dist/art/panorama-${mode}-2x.webp`,import.meta.url));
  assert.equal(panorama.toString('ascii',0,4),'RIFF');
  assert.equal(panorama.toString('ascii',8,16),'WEBPVP8 ');
  assert.equal(panorama.readUInt16LE(26)&0x3fff,ART_WIDTH*2);
  assert.equal(panorama.readUInt16LE(28)&0x3fff,ART_HEIGHT*2);
  assert.match(svg,/width="3966" height="1586" viewBox="0 0 1983 793"/);
  assert.ok(svg.includes(`data:image/webp;base64,${panorama.toString('base64')}`));
  assert.match(svg,/id="nerd-code-symbol" aria-label="&lt;\/&gt;"/);
  assert.match(svg,/M 10 10 L 4\.5 15\.5 L 10 21 M 19 7\.5 L 14 23\.5 M 23 10 L 28\.5 15\.5 L 23 21/);
  assert.equal((svg.match(/<image /g)||[]).length,1);
 });
}

test('the landing map, rooms, gallery, and highlights share the corrected artwork',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../dist/pixel.css',import.meta.url),'utf8');
 const rooms=await readFile(new URL('../dist/pixel-rooms.js',import.meta.url),'utf8');
 const world=await readFile(new URL('../dist/pixel-world.js',import.meta.url),'utf8');
 assert.ok(html.includes(`src="${DAY_ART}"`));
 assert.ok(css.includes(`url('${DAY_ART}')`));
 assert.ok(css.includes(`url('${NIGHT_ART}')`));
 assert.match(rooms,/import \{ ART_WIDTH, ART_HEIGHT, DAY_ART, NIGHT_ART \}/);
 assert.match(world,/import \{ ART_WIDTH, ART_HEIGHT, DAY_ART, NIGHT_ART, BUILDINGS \}/);
});
