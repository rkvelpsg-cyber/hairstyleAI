export function captureFrame(video:HTMLVideoElement){
  const c=document.createElement("canvas"); c.width=video.videoWidth||1080; c.height=video.videoHeight||1920;
  const x=c.getContext("2d"); if(!x) throw new Error("Canvas unavailable");
  x.drawImage(video,0,0,c.width,c.height); return c.toDataURL("image/jpeg",.92);
}
