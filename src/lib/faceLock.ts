import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
let promise:Promise<FaceDetector>|null=null;
async function detector(){
  if(!promise) promise=(async()=>{const v=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");return FaceDetector.createFromOptions(v,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"},runningMode:"IMAGE",minDetectionConfidence:.55});})();
  return promise;
}
async function img(src:string){const i=new Image();i.crossOrigin="anonymous";i.src=src;await i.decode();return i;}

// Hair must be allowed to change, so this protects the INNER FACE only.
export async function lockFaceOnly(originalSrc:string, generatedSrc:string){
  try{
    const [o,g,d]=await Promise.all([img(originalSrc),img(generatedSrc),detector()]);
    const a=d.detect(o).detections[0]?.boundingBox; const b=d.detect(g).detections[0]?.boundingBox;
    if(!a||!b) return {image:generatedSrc,applied:false};
    const out=document.createElement("canvas"); out.width=g.naturalWidth; out.height=g.naturalHeight; const ctx=out.getContext("2d"); if(!ctx) return {image:generatedSrc,applied:false}; ctx.drawImage(g,0,0);
    const sx=a.originX+a.width*.10, sy=a.originY+a.height*.14, sw=a.width*.80, sh=a.height*.82;
    const dx=b.originX+b.width*.10, dy=b.originY+b.height*.14, dw=b.width*.80, dh=b.height*.82;
    const patch=document.createElement("canvas"); patch.width=Math.max(1,Math.round(dw)); patch.height=Math.max(1,Math.round(dh)); const p=patch.getContext("2d"); if(!p)return {image:generatedSrc,applied:false};
    p.drawImage(o,sx,sy,sw,sh,0,0,patch.width,patch.height);
    p.globalCompositeOperation="destination-in";
    const grad=p.createRadialGradient(patch.width*.5,patch.height*.5,Math.min(patch.width,patch.height)*.30,patch.width*.5,patch.height*.5,Math.max(patch.width,patch.height)*.58);
    grad.addColorStop(0,"rgba(255,255,255,1)"); grad.addColorStop(.78,"rgba(255,255,255,1)"); grad.addColorStop(1,"rgba(255,255,255,0)"); p.fillStyle=grad; p.fillRect(0,0,patch.width,patch.height); p.globalCompositeOperation="source-over";
    ctx.drawImage(patch,dx,dy,dw,dh);
    return {image:out.toDataURL("image/jpeg",.94),applied:true};
  }catch(e){console.warn("Face lock failed",e);return {image:generatedSrc,applied:false};}
}
