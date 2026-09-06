import { ARTIST_URL,ARTIST_NAME,SONGS } from './songs.js';
import { localize,setText,setAttributeText } from './i18n.js';
import { STEPS,HIGH_MIDI,PIANO_KEYS,noteName,frequency,rowFor,emptyScore,exampleScore,shuffleScore,readComposition,compositionData,renderSoundtrack } from './soundtrack.js';
import { pianoKey,acceptsPianoInput,createNoteEntry } from './music-input.js';

const STORAGE_KEY='cabbageland:pixel:soundtrack';
export function createMusicRoom({content,audio,toast}){
 let saved=null;
 try{saved=readComposition(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{}
 const music={...(saved||{grid:exampleScore(),bpm:96,octave:4}),step:0,playhead:0,timer:null,playing:false};
 const entry=createNoteEntry();
 let mounted=false,exporting=false,dirty=!saved,startRequest=0;
 function pause(){
  startRequest++;
  releaseKeys();
  clearInterval(music.timer);music.timer=null;music.playing=false;
  if(!mounted)return;
  const button=content.querySelector('#play-music');setText(button,'music.play');button?.setAttribute('aria-pressed','false');
  content.querySelectorAll('.playhead').forEach(el=>el.classList.remove('playhead'));
  setText(content.querySelector('.music-status'),'music.ready');
 }
 function changed(){dirty=true;setText(content.querySelector('#composition-status'),'music.unsaved');}
 function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(compositionData(music)));dirty=false;setText(content.querySelector('#composition-status'),'music.saved');toast('music.savedToast');}
  catch{setText(content.querySelector('#composition-status'),'music.saveError');toast('music.saveError');}
 }
 function syncEntry(){
  content.querySelectorAll('.seq-cell').forEach(button=>{
   button.classList.toggle('entry-column',+button.dataset.step===entry.step);
   button.classList.toggle('playhead',music.playing&&+button.dataset.step===music.playhead);
   button.setAttribute('aria-pressed',String(music.grid[+button.dataset.row][+button.dataset.step]));
  });
  content.querySelectorAll('[data-entry-step]').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.entryStep===entry.step)));
  setText(content.querySelector('#entry-status'),'music.entry',{step:String(entry.step+1).padStart(2,'0')});
 }
 function playPiano(midi,step=entry.tap(music.playing?music.playhead:null)){
  music.grid[rowFor(midi)][step]=true;changed();syncEntry();
  audio.note(frequency(midi),.55,.07);
  const button=content.querySelector(`[data-midi="${midi}"]`);
  if(button){button.classList.add('playing');setTimeout(()=>button.classList.remove('playing'),170);}
 }
 function renderBank(){
  const grid=content.querySelector('#sequence');grid.replaceChildren();
  const base=(music.octave+1)*12;
  for(let midi=base+11;midi>=base;midi--){
   const row=rowFor(midi),label=document.createElement('span');label.className='seq-note-label';label.textContent=noteName(midi);grid.append(label);
   for(let step=0;step<STEPS;step++){
    const button=document.createElement('button');button.className='seq-cell'+(step%4===0?' beat-start':'')+([1,3,6,8,10].includes(midi%12)?' accidental':'');
    button.dataset.row=row;button.dataset.step=step;setAttributeText(button,'aria-label','music.cell',{note:noteName(midi),step:step+1});button.setAttribute('aria-pressed',String(music.grid[row][step]));
    button.onclick=()=>{entry.select(step);music.grid[row][step]=!music.grid[row][step];syncEntry();if(music.grid[row][step])audio.note(frequency(midi),.22,.04);changed();};grid.append(button);
   }
  }
  grid.append(document.createElement('span'));for(let step=0;step<STEPS;step++){const label=document.createElement('button');label.className='step-label';label.dataset.entryStep=step;label.textContent=step+1;setAttributeText(label,'aria-label','music.chooseStep',{step:step+1});label.onclick=()=>{entry.select(step);syncEntry();};grid.append(label);}
  content.querySelector('#octave-value').textContent=`C${music.octave} – B${music.octave}`;
  content.querySelector('#octave-down').disabled=music.octave===3;content.querySelector('#octave-up').disabled=music.octave===5;
  const piano=content.querySelector('.piano');piano.replaceChildren();
  for(let i=0;i<12;i++){const midi=base+i,button=document.createElement('button');button.dataset.midi=midi;button.className=[1,3,6,8,10].includes(i)?'accidental':'';button.innerHTML=`<b>${noteName(midi)}</b><small>${PIANO_KEYS[i].toUpperCase()}</small>`;setAttributeText(button,'aria-label','music.note',{note:noteName(midi)});button.onclick=()=>playPiano(midi);piano.append(button);}
  syncEntry();
 }
 function changeOctave(delta){const next=Math.max(3,Math.min(5,music.octave+delta));if(next===music.octave)return;music.octave=next;renderBank();changed();}
 function tick(){
  const step=music.step,rows=music.grid.flatMap((row,index)=>row[step]?[index]:[]),volume=Math.min(.055,.48/Math.max(1,rows.length));
  music.playhead=step;
  content.querySelectorAll('.seq-cell').forEach(button=>button.classList.toggle('playhead',+button.dataset.step===step));
  for(const row of rows)audio.note(frequency(HIGH_MIDI-row),60/music.bpm*.55,volume);
  setText(content.querySelector('.music-status'),'music.progress',{step:String(step+1).padStart(2,'0')});music.step=(step+1)%STEPS;
 }
 async function start(){const request=++startRequest,ctx=audio.ensure();if(!ctx)return;try{if(ctx.state!=='running')await ctx.resume();}catch{return;}if(request!==startRequest||ctx.state!=='running'||!mounted||content.querySelector('#composer-panel')?.hidden||music.playing)return;releaseKeys();music.playing=true;const button=content.querySelector('#play-music');setText(button,'common.pause');button.setAttribute('aria-pressed','true');tick();music.timer=setInterval(tick,30000/music.bpm);}
 function releaseKeys(){entry.resetHeld();content.querySelectorAll('.piano .playing').forEach(button=>button.classList.remove('playing'));}
 function keyup(event){entry.release(event.code||event.key.toLowerCase());if(mounted)syncEntry();}
 function visibility(){if(document.hidden)releaseKeys();}
 function keyboard(event){
  if(!mounted||!content.closest('dialog')?.open||document.hidden||content.querySelector('#composer-panel')?.hidden||!acceptsPianoInput(event))return;
  const i=pianoKey(event);
  if(i>=0){event.preventDefault();const step=entry.press(event.code||event.key.toLowerCase(),music.playing?music.playhead:null);if(step!==null)playPiano((music.octave+1)*12+i,step);return;}
  if(event.target.matches?.('input'))return;
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();changeOctave(event.key==='ArrowUp'?1:-1);}
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();entry.select(entry.step+(event.key==='ArrowRight'?1:-1));syncEntry();}
 }
 async function download(){
  if(exporting)return;
  if(!music.grid.some(row=>row.some(Boolean))){setText(content.querySelector('#composition-status'),'music.empty');toast('music.empty');return;}
  exporting=true;
  const button=content.querySelector('#download-music');button.disabled=true;button.setAttribute('aria-busy','true');setText(button,'music.exporting');
  const snapshot=compositionData(music);
  try{
   const blob=await renderSoundtrack(snapshot),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`cabbageland-soundtrack-${snapshot.bpm}bpm.wav`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setText(content.querySelector('#composition-status'),'music.downloaded');toast('music.downloaded');
  }catch{setText(content.querySelector('#composition-status'),'music.exportError');toast('music.exportError');}
  finally{exporting=false;const currentButton=content.querySelector('#download-music');if(currentButton){currentButton.disabled=false;currentButton.removeAttribute('aria-busy');setText(currentButton,'music.download');}}
 }
 function mount(){
  mounted=true;
  content.innerHTML=`<span class="eyebrow" data-i18n="music.eyebrow"></span><h2 id="music-room-heading" data-i18n="music.title"></h2>
  <div class="tabs music-tabs" role="tablist" data-i18n-aria-label="music.tabs"><button id="composer-tab" role="tab" aria-controls="composer-panel" aria-selected="true" data-music-tab="composer-panel" data-i18n="music.composeTab"></button><button id="songs-tab" role="tab" aria-controls="songs-panel" aria-selected="false" tabindex="-1" data-music-tab="songs-panel" data-i18n="music.songsTab"></button></div>
  <div id="composer-panel" class="music-panel" role="tabpanel" aria-labelledby="composer-tab"><p class="intro" data-i18n="music.intro"></p>
  <div class="octave-controls"><button id="octave-down" class="pixel-button" data-i18n="music.lower"></button><output id="octave-value" aria-live="polite"></output><button id="octave-up" class="pixel-button" data-i18n="music.higher"></button></div>
  <div class="instrument"><div class="instrument-top"><span>CABBAGE-16</span><span class="music-status" data-i18n="music.ready"></span></div><div class="sequence-scroll"><div class="sequencer" id="sequence" role="group" data-i18n-aria-label="music.sequence"></div></div><div class="entry-guide"><output id="entry-status"></output><span data-i18n="music.entryHint"></span></div></div>
  <div class="music-controls"><div class="action-row"><button id="play-music" class="pixel-button primary" aria-pressed="false" data-i18n="music.play"></button><button id="music-preset" class="pixel-button" data-i18n="music.preset"></button><button id="shuffle-music" class="pixel-button" data-i18n="music.shuffle"></button><button id="clear-music" class="pixel-button" data-i18n="common.clear"></button></div><label class="tempo" for="tempo"><span data-i18n="music.tempo"></span><input id="tempo" type="range" min="50" max="160" value="${music.bpm}" step="1"><output id="tempo-value">${music.bpm}</output></label></div>
  <div class="piano-scroll"><div class="piano" role="group" data-i18n-aria-label="music.piano"></div></div><p class="rule-note" data-i18n="music.keys"></p>
  <div class="soundtrack-save"><div class="action-row"><button id="save-music" class="pixel-button" data-i18n="music.save"></button><button id="download-music" class="pixel-button primary" data-i18n="${exporting?'music.exporting':'music.download'}" ${exporting?'disabled aria-busy="true"':''}></button></div><p id="composition-status" role="status" data-i18n="${dirty?'music.unsaved':'music.loaded'}"></p><p class="rule-note" data-i18n="music.saveHint"></p></div></div>
  <div id="songs-panel" class="music-panel" role="tabpanel" aria-labelledby="songs-tab" hidden><div class="song-portfolio-top"><span class="song-artist">${ARTIST_NAME}</span><a class="pixel-button" href="${ARTIST_URL}" target="_blank" rel="noopener noreferrer" data-i18n="songs.profile"></a></div><div class="song-list" id="song-list"></div><p class="rule-note" data-i18n="songs.hint"></p></div>`;
  const list=content.querySelector('#song-list');
  SONGS.forEach((song,index)=>{const entry=document.createElement('a');entry.className='song-entry';entry.href=song.url;entry.target='_blank';entry.rel='noopener noreferrer';const number=document.createElement('span');number.className='song-number';number.textContent=String(index+1).padStart(2,'0');const title=document.createElement('h3');title.textContent=song.title;const listen=document.createElement('span');listen.className='song-listen';setText(listen,'songs.listen');entry.append(number,title,listen);list.append(entry);});
  localize(content);renderBank();
  const tabs=[...content.querySelectorAll('[data-music-tab]')];
  function selectTab(selected){
   for(const tab of tabs){const on=tab===selected;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;content.querySelector('#'+tab.dataset.musicTab).hidden=!on;}
   const isSongs=selected.id==='songs-tab';if(isSongs)pause();setText(content.querySelector('#music-room-heading'),isSongs?'songs.title':'music.title');
  }
  tabs.forEach((tab,index)=>{tab.onclick=()=>selectTab(tab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();};});
  content.querySelector('#octave-down').onclick=()=>changeOctave(-1);content.querySelector('#octave-up').onclick=()=>changeOctave(1);
  content.querySelector('#play-music').onclick=()=>music.playing?pause():start();
  content.querySelector('#music-preset').onclick=()=>{pause();music.grid=exampleScore();music.octave=4;music.step=0;entry.select(0);renderBank();changed();};
  content.querySelector('#shuffle-music').onclick=()=>{pause();music.grid=shuffleScore(music.octave);music.step=0;entry.select(0);renderBank();changed();};
  content.querySelector('#clear-music').onclick=()=>{pause();music.grid=emptyScore();music.step=0;entry.select(0);renderBank();changed();};
  content.querySelector('#tempo').oninput=event=>{music.bpm=+event.target.value;content.querySelector('#tempo-value').textContent=music.bpm;changed();if(music.playing){clearInterval(music.timer);music.timer=setInterval(tick,30000/music.bpm);}};
  content.querySelector('#save-music').onclick=save;content.querySelector('#download-music').onclick=download;
  document.addEventListener('keydown',keyboard);document.addEventListener('keyup',keyup);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',releaseKeys);
  return ()=>{pause();mounted=false;document.removeEventListener('keydown',keyboard);document.removeEventListener('keyup',keyup);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',releaseKeys);};
 }
 return {mount,pause};
}
