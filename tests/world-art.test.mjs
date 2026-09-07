import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ART_WIDTH,ART_HEIGHT,DAY_ART,NIGHT_ART,BUILDINGS } from '../dist/world-art.js';

const cardArtwork={
 read:'./art/building-cards/escape-the-void.webp',
 music:'./art/building-cards/compose-boredom.webp',
 nerd:'./art/building-cards/nerds-farm.webp',
 art:'./art/building-cards/my-world-in-xd.webp',
 great:'./art/building-cards/the-great-cabbage.webp'
};

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

test('each supplied building card uses its dedicated optimized artwork',async()=>{
 for(const [key,source] of Object.entries(cardArtwork)){
  assert.equal(BUILDINGS[key].cardArt,source);
  assert.equal(BUILDINGS[key].cardAspect,4/5);
  const image=await readFile(new URL(`../dist/${source}`,import.meta.url));
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.ok(image.length>50000&&image.length<200000);
 }
 assert.equal(BUILDINGS.pets.cardArt,undefined);
});

for(const [mode,source] of [['day',DAY_ART],['night',NIGHT_ART]]){
 test(`${mode} uses a versioned lossless raster with both repairs baked in`,async()=>{
  const svg=await readFile(new URL(`../dist/cabbageland-wide-${mode}.svg`,import.meta.url),'utf8');
  const panorama=await readFile(new URL(`../dist/${source}`,import.meta.url));
  assert.equal(source,`./art/panorama-${mode}-clean-v2.webp`);
  assert.equal(panorama.toString('ascii',0,4),'RIFF');
  assert.equal(panorama.toString('ascii',8,16),'WEBPVP8L');
  assert.equal(panorama[20],0x2f);
  const dimensions=panorama.readUInt32LE(21);
  assert.equal(1+(dimensions&0x3fff),ART_WIDTH*2);
  assert.equal(1+((dimensions>>>14)&0x3fff),ART_HEIGHT*2);
  assert.match(svg,/width="3966" height="1586" viewBox="0 0 1983 793"/);
  assert.ok(svg.includes(`data:image/webp;base64,${panorama.toString('base64')}`));
  assert.doesNotMatch(svg,/<(?:g|path|rect)\b/);
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
 assert.ok(html.includes('./pixel-world.js?v=ui-icons-1'));
 assert.ok(html.includes('./pixel.css?v=ui-icons-1'));
 assert.ok(world.includes('./world-art.js?v=building-cards-1'));
 assert.ok(world.includes('./pixel-rooms.js?v=ui-icons-1'));
 assert.ok(rooms.includes('./world-art.js?v=building-cards-1'));
});
