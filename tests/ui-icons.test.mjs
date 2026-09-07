import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { UI_ICONS,uiIcon } from '../dist/ui-icons.js';

test('selected supplied UI icons are optimized local WebP assets with alpha',async()=>{
 assert.equal(Object.keys(UI_ICONS).length,2);
 for(const [name,path] of Object.entries(UI_ICONS)){
  const data=await readFile(new URL(`../dist/${path}`,import.meta.url));
  assert.equal(data.toString('ascii',0,4),'RIFF',name);
  assert.equal(data.toString('ascii',8,16),'WEBPVP8L',name);
  const header=data.readUInt32LE(21);
  assert.equal(1+(header&0x3fff),128,name);
  assert.equal(1+((header>>>14)&0x3fff),128,name);
  assert.equal((header>>>28)&1,1,`${name} must retain alpha`);
  assert.ok(data.length<50000,`${name} should stay small enough for navigation`);
 }
});

test('icons are decorative, reserve their dimensions, and reject unknown names',()=>{
 for(const name of Object.keys(UI_ICONS)){
  assert.match(uiIcon(name),/width="24" height="24" alt="" aria-hidden="true"/);
  assert.ok(uiIcon(name).includes(UI_ICONS[name]));
 }
 assert.throws(()=>uiIcon('unknown'),/Unknown UI icon/);
});

test('localized tabs keep their icons outside translated text',async()=>{
 const rooms=await readFile(new URL('../dist/pixel-rooms.js',import.meta.url),'utf8');
 for(const [source,id,key,icon] of [
  [rooms,'reading-tab','reading.readTab','book-detailed']
 ]){
  const button=source.match(new RegExp(`<button[^>]*id="${id}"[^>]*>[\\s\\S]*?</button>`))?.[0];
  assert.ok(button,`${id} exists`);
  assert.ok(button.includes(`uiIcon('${icon}')`));
  assert.ok(button.includes(`<span data-i18n="${key}">`));
  assert.match(button,/<\/span><\/button>$/);
  assert.doesNotMatch(button.split('>')[0],/data-i18n=/);
 }
});
