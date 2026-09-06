export const STEPS=16,LOW_MIDI=48,HIGH_MIDI=83;
export const PITCHES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const PIANO_KEYS='awsedftgyhuj';
export const noteName=midi=>PITCHES[midi%12]+(Math.floor(midi/12)-1);
export const frequency=midi=>440*2**((midi-69)/12);
export const rowFor=midi=>HIGH_MIDI-midi;
export const emptyScore=()=>Array.from({length:HIGH_MIDI-LOW_MIDI+1},()=>Array(STEPS).fill(false));
export function exampleScore(){
 const grid=emptyScore(),melody=[60,64,67,69,67,64,62,64,60,64,69,67,64,62,60,67];
 melody.forEach((midi,step)=>grid[rowFor(midi)][step]=true);
 return grid;
}
export function shuffleScore(octave=4,random=Math.random){
 const grid=emptyScore(),base=(Math.max(3,Math.min(5,octave))+1)*12,scale=[0,2,4,7,9];
 let note=Math.floor(random()*scale.length);
 for(let step=0;step<STEPS;step++){
  if(step%4!==0&&random()<.2)continue;
  note=(note+Math.floor(random()*5)-2+scale.length)%scale.length;
  grid[rowFor(base+scale[note])][step]=true;
  if(step%4===0&&random()<.45)grid[rowFor(base+scale[(note+2)%scale.length])][step]=true;
 }
 return grid;
}
export function readComposition(value){
 if(!value||value.version!==1||!Number.isInteger(value.bpm)||value.bpm<50||value.bpm>160||![3,4,5].includes(value.octave))return null;
 if(!Array.isArray(value.grid)||value.grid.length!==36||!value.grid.every(row=>Array.isArray(row)&&row.length===STEPS&&row.every(cell=>typeof cell==='boolean')))return null;
 return {bpm:value.bpm,octave:value.octave,grid:value.grid.map(row=>[...row])};
}
export function compositionData(music){return {version:1,bpm:music.bpm,octave:music.octave,grid:music.grid.map(row=>[...row])};}
export function scheduleTone(ctx,f,duration=.45,volume=.07,at=ctx.currentTime){
 const gain=ctx.createGain(),oscillator=ctx.createOscillator();
 oscillator.type='triangle';oscillator.frequency.value=f;
 gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.009);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(at);oscillator.stop(at+duration+.02);
 oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}
export function scoreEvents(score,loops=4){
 const events=[],stepTime=30/score.bpm,duration=60/score.bpm*.55;
 for(let loop=0;loop<loops;loop++)for(let step=0;step<STEPS;step++){
  const rows=score.grid.flatMap((row,index)=>row[step]?[index]:[]),volume=Math.min(.055,.48/Math.max(1,rows.length));
  for(const row of rows)events.push({frequency:frequency(HIGH_MIDI-row),at:(loop*STEPS+step)*stepTime,duration,volume});
 }
 return {events,duration:loops*STEPS*stepTime+duration+.05};
}
export function encodeWav(buffer){
 const channels=buffer.numberOfChannels,frames=buffer.length,bytes=frames*channels*2;
 const output=new ArrayBuffer(44+bytes),view=new DataView(output);
 const word=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
 word(0,'RIFF');view.setUint32(4,36+bytes,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,bytes,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
 for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++){const sample=Math.max(-1,Math.min(1,data[ch][i]));view.setInt16(44+(i*channels+ch)*2,Math.round(sample*(sample<0?32768:32767)),true);}
 return output;
}
export async function renderSoundtrack(score){
 const Context=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
 if(!Context)throw new Error('Offline audio is unavailable');
 const {events,duration}=scoreEvents(score),sampleRate=44100;
 const ctx=new Context(1,Math.ceil(duration*sampleRate),sampleRate);
 for(const e of events)scheduleTone(ctx,e.frequency,e.duration,e.volume,e.at);
 return new Blob([encodeWav(await ctx.startRendering())],{type:'audio/wav'});
}
