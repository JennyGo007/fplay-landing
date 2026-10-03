import {stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import path from 'node:path';
const types={'.mp4':'video/mp4','.webm':'video/webm','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export function byteRange(header,size){
  if(!header)return null;
  const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return false;
  let start,end;
  if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return false;start=Math.max(0,size-n);end=size-1;}
  else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{start,end}:false;
}
export async function fileResponse(base,name,req,{privateFile=false}={}){
  try{
    const ext=path.extname(name).toLowerCase();if(!types[ext])return new Response(null,{status:404});
    const resolvedBase=await realpath(base),file=await realpath(path.join(base,name));
    if(!file.startsWith(resolvedBase+path.sep))return new Response(null,{status:404});
    const info=await stat(file);if(!info.isFile())return new Response(null,{status:404});
    const range=byteRange(req.headers.get('range'),info.size);
    const headers={'Content-Type':types[ext],'Accept-Ranges':'bytes','Cache-Control':privateFile?'private, no-store':'no-cache','X-Content-Type-Options':'nosniff'};
    if(range===false)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${info.size}`}});
    const start=range?.start??0,end=range?.end??info.size-1;
    headers['Content-Length']=String(end-start+1);if(range)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    return new Response(req.method==='HEAD'?null:Readable.toWeb(createReadStream(file,{start,end})),{status:range?206:200,headers});
  }catch(e){if(['ENOENT','ENOTDIR'].includes(e.code))return new Response(null,{status:404});throw e;}
}
