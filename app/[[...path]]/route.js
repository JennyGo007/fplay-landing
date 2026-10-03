import path from 'node:path';
import {publicState,readState,dataDir,projectRoot} from '../../lib/content.mjs';
import {render} from '../../lib/render.mjs';
import {fileResponse} from '../../lib/files.mjs';
import {requireAdmin} from '../../lib/auth.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req,{params}){
  try{
    const parts=(await params).path||[],file=parts.join('/')||'index.html';
    if(parts.some(p=>p.startsWith('.')||p.includes('\\')||p.includes('/')))return new Response(null,{status:404});
    const preview=new URL(req.url).searchParams.get('preview')==='draft';
    if(preview)await requireAdmin();
    const state=preview?await readState():await publicState(),content=preview?state.draft:state.published;
    if(['index.html','guide.html','platform.html','privacy.html','terms.html'].includes(file))return new Response(req.method==='HEAD'?null:await render(file,content,{preview}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',...(preview?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
    if(file.startsWith('assets/'))return fileResponse(path.join(projectRoot,'site'),file,req);
    if(file.startsWith('media/')){
      // 미게시 업로드는 주소를 알아도 관리자만 조회할 수 있다.
      let privateFile=false;
      if(![content.videoUrl,content.videoPoster].includes(file)){await requireAdmin();privateFile=true;}
      return fileResponse(path.join(dataDir(),'media'),file.slice(6),req,{privateFile});
    }
    return new Response('페이지를 찾을 수 없습니다.',{status:404});
  }catch(e){return new Response(e.status===401?'관리자 로그인이 필요합니다.':'페이지를 불러올 수 없습니다.',{status:e.status||500,headers:{'Cache-Control':'no-store'}});}
}
export const HEAD=GET;
