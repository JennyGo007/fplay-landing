import { fileTypeFromBuffer } from 'file-type';
import { open,mkdir,rename,unlink } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir } from './content.mjs';

export async function readLimited(request,max){
  const declared=Number(request.headers.get('content-length'));
  if(declared>max)throw Object.assign(new Error('파일 용량 제한을 초과했습니다.'),{status:413});
  const reader=request.body?.getReader();if(!reader)throw Object.assign(new Error('내용이 없습니다.'),{status:400});
  const chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw Object.assign(new Error('용량 제한을 초과했습니다.'),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
export async function upload(request){
  const kind=request.headers.get('x-media-kind');if(!['video','poster'].includes(kind))throw Object.assign(new Error('파일 종류를 확인해 주세요.'),{status:400});
  const max=kind==='video'?80*1024*1024:8*1024*1024;
  const bytes=await readLimited(request,max);
  const type=await fileTypeFromBuffer(bytes);
  const valid=kind==='video'?['video/mp4','video/webm']:['image/jpeg','image/png','image/webp'];
  if(!type||!valid.includes(type.mime))throw Object.assign(new Error('지원하지 않는 파일입니다. 영상은 MP4/WebM, 이미지는 JPG/PNG/WebP만 가능합니다.'),{status:400});
  const dir=path.join(dataDir(),'media');await mkdir(dir,{recursive:true,mode:0o700});
  const name=crypto.randomUUID()+'.'+type.ext;
  const temp=path.join(dir,name+'.tmp'),final=path.join(dir,name);
  const f=await open(temp,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
  await rename(temp,final);return {path:'media/'+name,bytes:bytes.length,mime:type.mime};
}
