import test from 'node:test';
import assert from 'node:assert/strict';
import { pianoKey,acceptsPianoInput,createNoteEntry } from '../dist/music-input.js';
import { PIANO_KEYS } from '../dist/soundtrack.js';

test('physical piano positions survive Shift and alternate keyboard layouts',()=>{
 for(const [index,key] of [...PIANO_KEYS].entries()){
  assert.equal(pianoKey({code:'Key'+key.toUpperCase(),key:key.toUpperCase()}),index);
  assert.equal(pianoKey({code:'Key'+key.toUpperCase(),key:'unrelated'}),index);
  assert.equal(pianoKey({key}),index);
 }
 assert.equal(pianoKey({code:'ArrowUp',key:'ArrowUp'}),-1);
 assert.equal(pianoKey({code:'Space',key:' '}),-1);
});

test('header controls allow piano shortcuts, while text entry and system shortcuts do not',()=>{
 const button={isContentEditable:false,closest:()=>null};
 assert.equal(acceptsPianoInput({target:button}),true);
 for(const flag of ['defaultPrevented','repeat','isComposing','ctrlKey','metaKey','altKey'])assert.equal(acceptsPianoInput({target:button,[flag]:true}),false);
 assert.equal(acceptsPianoInput({target:{isContentEditable:true}}),false);
 assert.equal(acceptsPianoInput({target:{closest:()=>({tagName:'TEXTAREA'})}}),false);
});

test('successive notes advance through the sixteen columns and wrap',()=>{
 const input=createNoteEntry();
 for(let step=0;step<18;step++){
  assert.equal(input.press('KeyA'),step%16);
  assert.equal(input.step,step%16);
  input.release('KeyA');
  assert.equal(input.step,(step+1)%16);
 }
});

test('overlapping held notes form one chord and advance only on the last release',()=>{
 const input=createNoteEntry();input.select(5);
 assert.equal(input.press('KeyA'),5);
 assert.equal(input.press('KeyD'),5);
 assert.equal(input.press('KeyG'),5);
 assert.equal(input.press('KeyA'),null);
 input.release('KeyD');input.release('KeyA');
 assert.equal(input.step,5);
 input.release('KeyG');assert.equal(input.step,6);
 input.release('KeyG');assert.equal(input.step,6);
});

test('live input follows the current playhead without advancing the paused cursor',()=>{
 const input=createNoteEntry();input.select(11);
 assert.equal(input.press('KeyA',0),0);
 assert.equal(input.press('KeyD',1),1);
 input.release('KeyA');input.release('KeyD');
 assert.equal(input.tap(2),2);assert.equal(input.step,11);
});

test('on-screen keys record consecutive columns and respect selected steps',()=>{
 const input=createNoteEntry();
 assert.equal(input.tap(),0);assert.equal(input.tap(),1);
 input.select(15);assert.equal(input.tap(),15);assert.equal(input.step,0);
 input.select(-1);assert.equal(input.step,15);
 input.select(16);assert.equal(input.step,0);
});

test('losing focus or closing the room clears held notes without a phantom advance',()=>{
 const input=createNoteEntry();input.select(4);input.press('KeyA');input.resetHeld();
 input.release('KeyA');assert.equal(input.step,4);
 assert.equal(input.press('KeyA'),4);input.release('KeyA');assert.equal(input.step,5);
 input.press('KeyD');input.select(9);input.release('KeyD');assert.equal(input.step,9);
});
