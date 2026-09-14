import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
let promise:Promise<FaceDetector>|null=null;
async function detector(){
  if(!promise) promise=(async()=>{const v=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");return FaceDetector.createFromOptions(v,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"},runningMode:"IMAGE",minDetectionConfidence:.55});})();
  return promise;
}
async function img(src:string){const i=new Image();i.crossOrigin="anonymous";i.src=src;await i.decode();return i;}

export async function lockFaceOnly(originalSrc:string, generatedSrc:string){
  try{
    const [o,g,d]=await Promise.all([img(originalSrc),img(generatedSrc),detector()]);
    const a=d.detect(o).detections[0]?.boundingBox; const b=d.detect(g).detections[0]?.boundingBox;
    if(!a||!b) return {image:generatedSrc,applied:false};
    const out=document.createElement("canvas"); out.width=o.naturalWidth; out.height=o.naturalHeight; const ctx=out.getContext("2d"); if(!ctx) return {image:generatedSrc,applied:false}; ctx.drawImage(o,0,0);
    const sx=b.originX-b.width*.55, sy=b.originY-b.height*.80, sw=b.width*2.10, sh=b.height*2.25;
    const dx=a.originX-a.width*.55, dy=a.originY-a.height*.80, dw=a.width*2.10, dh=a.height*2.25;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(dx+dw*.5,dy+dh*.5,dw*.5,dh*.5,0,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(g,sx,sy,sw,sh,dx,dy,dw,dh);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.originX+a.width*.5,a.originY+a.height*.54,a.width*.44,a.height*.49,0,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(o,0,0);
    ctx.restore();
    return {image:out.toDataURL("image/jpeg",.94),applied:true};
  }catch(e){console.warn("Face lock failed",e);return {image:generatedSrc,applied:false};}
}
