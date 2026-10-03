import {requireAdmin,requireOrigin} from '../../../../lib/auth.mjs';
import {readState,mutate,assertMediaExists} from '../../../../lib/content.mjs';
import {readLimited,upload} from '../../../../lib/media.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function error(e){const status=e.status||(e.name==='ZodError'?400:500);return Response.json({error:status===500?'처리에 실패했습니다. 저장 상태와 서버 설정을 확인해 주세요.':e.name==='ZodError'?e.issues.map(i=>i.message).slice(0,3).join(' / '):e.message},{status,headers:{'Cache-Control':'no-store'}});}
function out(s){return {version:s.version,draft:s.draft,history:s.history.map(({id,at,actor})=>({id,at,actor})),updatedAt:s.updatedAt};}
export async function GET(req,{params}){try{await requireAdmin();if((await params).action!=='state')return new Response(null,{status:404});return Response.json(out(await readState()),{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
export async function POST(req,{params}){
  try{
    const session=await requireAdmin();requireOrigin(req);const {action}=await params;
    if(action==='upload')return Response.json(await upload(req),{headers:{'Cache-Control':'no-store'}});
    if(!['save','publish','restore'].includes(action))return new Response(null,{status:404});
    if(!req.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:415});
    let body;try{body=JSON.parse((await readLimited(req,1024*1024)).toString('utf8'));}catch(e){if(e.status)throw e;throw Object.assign(new Error('요청 형식이 올바르지 않습니다.'),{status:400});}
    if(!Number.isSafeInteger(body.version))throw Object.assign(new Error('저장 버전이 없습니다.'),{status:400});
    if(action==='publish')await assertMediaExists((await readState()).draft);
    return Response.json(out(await mutate(body.version,session.user.email,action,action==='restore'?body.id:body.content)),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return error(e);}
}
