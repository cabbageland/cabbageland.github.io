// A warm, continuous noise bed with a quiet stereo layer of moving water.
// Long buffers and an overlapping seam keep the stream free of clicks.
export function synthesizeStream(sampleRate,duration=28,seed=0xCA88A6E){
 const random=()=>{
  seed|=0;seed=seed+0x6D2B79F5|0;
  let n=Math.imul(seed^seed>>>15,1|seed);
  n=n+Math.imul(n^n>>>7,61|n)^n;
  return ((n^n>>>14)>>>0)/4294967296;
 };
 const length=Math.floor(duration*sampleRate),overlap=Math.floor(2*sampleRate),total=length+overlap;
 const channels=[new Float32Array(total),new Float32Array(total)];
 const coefficient=frequency=>1-Math.exp(-2*Math.PI*frequency/sampleRate);
 const warm=coefficient(820),rumble=coefficient(48),ripple=coefficient(1900),soft=coefficient(360);
 let brown=0,bed=0,low=0;
 const water=[0,0],waterLow=[0,0];
 for(let i=0;i<total;i++){
  const time=i/sampleRate;
  brown=.9975*brown+.045*(random()*2-1);
  bed+=warm*(brown-bed);
  low+=rumble*(bed-low);
  const current=.93+.035*Math.sin(time*.47)+.025*Math.sin(time*1.07);
  for(let channel=0;channel<2;channel++){
   water[channel]+=ripple*((random()*2-1)-water[channel]);
   waterLow[channel]+=soft*(water[channel]-waterLow[channel]);
   const eddy=.11+.027*Math.sin(time*.71+channel*1.6)+.02*Math.sin(time*1.37+channel);
   channels[channel][i]=(bed-low)*.70*current+(water[channel]-waterLow[channel])*eddy;
  }
 }
 // Small overlapping, damped resonances suggest bubbles and shallow ripples.
 // Their soft attacks and low level avoid foreground drip or bell sounds.
 for(let time=0;time<duration+2;time+=.035+random()*.14){
  const start=Math.floor(time*sampleRate),seconds=.13+random()*.2;
  const count=Math.floor(seconds*sampleRate),frequency=480+random()**2*1250;
  const strength=.008+random()*.024,pan=.2+random()*.6,drift=.12+random()*.22;
  const left=Math.cos(pan*Math.PI/2),right=Math.sin(pan*Math.PI/2);
  let phase=random()*Math.PI*2;
  for(let j=0;j<count&&start+j<total;j++){
   const elapsed=j/sampleRate,progress=j/count;
   phase+=2*Math.PI*frequency*(1+drift*(1-Math.exp(-progress*3)))/sampleRate;
   const envelope=(1-Math.exp(-elapsed*90))*Math.exp(-elapsed*19)*(1-progress)**2;
   const value=Math.sin(phase)*envelope*strength;
   channels[0][start+j]+=value*left;
   channels[1][start+j]+=value*right;
  }
 }
 const output=channels.map(channel=>{
  const data=new Float32Array(length);
  for(let i=0;i<length;i++){
   const angle=Math.min(1,i/overlap)*Math.PI/2;
   data[i]=i<overlap?channel[length+i]*Math.cos(angle)+channel[i]*Math.sin(angle):channel[i];
  }
  const mean=data.reduce((sum,value)=>sum+value,0)/length;
  for(let i=0;i<length;i++)data[i]-=mean;
  return data;
 });
 let squareSum=0,peak=0;
 for(const channel of output)for(const value of channel){squareSum+=value*value;peak=Math.max(peak,Math.abs(value));}
 const rms=Math.sqrt(squareSum/(2*length));
 const gain=Math.min(.16/Math.max(rms,.001),.62/Math.max(peak,.001));
 for(const channel of output)for(let i=0;i<length;i++)channel[i]*=gain;
 return output;
}

export function createStreamSound(context){
 const channels=synthesizeStream(context.sampleRate);
 const buffer=context.createBuffer(2,channels[0].length,context.sampleRate);
 channels.forEach((channel,index)=>buffer.copyToChannel(channel,index));
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=buffer;source.loop=true;gain.gain.value=0;
 source.connect(gain);gain.connect(context.destination);source.start();
 return {gain,source};
}
