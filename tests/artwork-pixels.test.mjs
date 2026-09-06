import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

let sharp;
try{sharp=createRequire(import.meta.url)('sharp');}catch{}
const root=fileURLToPath(new URL('../dist/art/',import.meta.url));
const repairs=[{left:2540,top:752,right:2620,bottom:834},{left:2996,top:944,right:3080,bottom:1032}];

for(const mode of ['day','night']){
 test(`${mode} repair leaves every pixel outside the two signs unchanged`,{skip:!sharp&&'Install Sharp to run pixel checks'},async()=>{
  const original=await sharp(`${root}panorama-${mode}-2x.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const cleaned=await sharp(`${root}panorama-${mode}-clean-v2.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(cleaned.info,original.info);
  let changed=0;
  for(let row=0;row<original.info.height;row++){
   for(let column=0;column<original.info.width;column++){
    const offset=(row*original.info.width+column)*3;
    const differs=original.data[offset]!==cleaned.data[offset]||original.data[offset+1]!==cleaned.data[offset+1]||original.data[offset+2]!==cleaned.data[offset+2];
    if(!differs)continue;
    assert.ok(repairs.some(rect=>column>=rect.left&&column<rect.right&&row>=rect.top&&row<rect.bottom),`Unexpected change at ${column},${row}`);
    changed++;
   }
  }
  assert.ok(changed>1500);
 });

 test(`${mode} code icon has exactly three connected green strokes`,{skip:!sharp&&'Install Sharp to run pixel checks'},async()=>{
  const {data,info}=await sharp(`${root}panorama-${mode}-clean-v2.webp`).extract({left:2540,top:752,width:80,height:82}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const pixels=new Set();
  for(let index=0;index<info.width*info.height;index++){
   const offset=index*3;
   if(data[offset]>140&&data[offset+1]>185&&data[offset+2]<140)pixels.add(index);
  }
  let components=0;
  while(pixels.size){
   const seed=pixels.values().next().value;
   const pending=[seed];
   pixels.delete(seed);
   components++;
   while(pending.length){
    const current=pending.pop(),column=current%info.width,row=Math.floor(current/info.width);
    for(let vertical=-1;vertical<=1;vertical++)for(let horizontal=-1;horizontal<=1;horizontal++){
     const nextColumn=column+horizontal,nextRow=row+vertical;
     if(nextColumn<0||nextColumn>=info.width||nextRow<0||nextRow>=info.height)continue;
     const neighbor=nextRow*info.width+nextColumn;
     if(pixels.delete(neighbor))pending.push(neighbor);
    }
   }
  }
  assert.equal(components,3);
 });
}
