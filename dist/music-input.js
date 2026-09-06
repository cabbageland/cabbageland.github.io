import { PIANO_KEYS,STEPS } from './soundtrack.js';

// Use physical piano positions even when Shift or a different keyboard layout is active.
export function pianoKey(event){
 const key=event.code?.startsWith('Key')?event.code.slice(3).toLowerCase():event.key?.toLowerCase();
 return key?.length===1?PIANO_KEYS.indexOf(key):-1;
}
export function acceptsPianoInput(event){
 const target=event.target;
 if(event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return false;
 return !target?.isContentEditable&&!target?.closest?.('textarea,select,input:not([type="range"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
}

// Held keys form one chord; releasing the last key moves to the next column.
export function createNoteEntry(){
 let cursor=0,chordStep=null,advanceOnRelease=false;
 const held=new Set();
 const wrap=step=>(step%STEPS+STEPS)%STEPS;
 function resetHeld(){held.clear();chordStep=null;advanceOnRelease=false;}
 return {
  get step(){return cursor;},
  select(step){resetHeld();cursor=wrap(step);},
  press(key,playhead=null){
   if(held.has(key))return null;
   if(!held.size){chordStep=playhead??cursor;advanceOnRelease=playhead===null;}
   held.add(key);
   return playhead??chordStep;
  },
  release(key){
   if(!held.delete(key)||held.size)return;
   if(advanceOnRelease)cursor=wrap(chordStep+1);
   chordStep=null;advanceOnRelease=false;
  },
  tap(playhead=null){const step=playhead??cursor;if(playhead===null)cursor=wrap(cursor+1);return step;},
  resetHeld
 };
}
