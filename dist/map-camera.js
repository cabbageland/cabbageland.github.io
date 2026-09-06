import { ART_WIDTH, ART_HEIGHT } from './world-art.js';
export { ART_WIDTH, ART_HEIGHT } from './world-art.js';
// Fill the frame at the minimum zoom; only outer scenery may be cropped.
export const fitScale=({width,height})=>Math.max(width/ART_WIDTH,height/ART_HEIGHT);

export function constrainView(view,size){
 const scale=Math.max(fitScale(size),Math.min(view.s,fitScale(size)*4));
 const width=ART_WIDTH*scale,height=ART_HEIGHT*scale;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 return {
  s:scale,
  x:width<=size.width?(size.width-width)/2:clamp(view.x,size.width-width,0),
  y:height<=size.height?(size.height-height)/2:clamp(view.y,size.height-height,0)
 };
}
export function fitView(size){
 const s=fitScale(size);
 return {s,x:(size.width-ART_WIDTH*s)/2,y:(size.height-ART_HEIGHT*s)/2};
}
export function zoomView(view,size,factor,point){
 const s=Math.max(fitScale(size),Math.min(view.s*factor,fitScale(size)*4));
 return constrainView({s,x:point.x-(point.x-view.x)*s/view.s,y:point.y-(point.y-view.y)*s/view.s},size);
}
export function resizeView(view,previous,next){
 if(!previous.width||!previous.height)return fitView(next);
 const relativeZoom=view.s/fitScale(previous),s=fitScale(next)*relativeZoom;
 const centerX=(previous.width/2-view.x)/view.s,centerY=(previous.height/2-view.y)/view.s;
 return constrainView({s,x:next.width/2-centerX*s,y:next.height/2-centerY*s},next);
}
