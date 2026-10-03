import { z } from 'zod';
import { readFile, writeFile, mkdir, rename, open, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const projectRoot = process.cwd();
export const seed = JSON.parse(await readFile(path.join(projectRoot, 'content/initial.json'), 'utf8'));
const text = (n) => z.string().max(n);
const localAsset = (ext) => z.string().max(200).refine(s => s === '' || (new RegExp(`^(?:assets/|media/)[A-Za-z0-9_/-]+\\.(?:${ext})$`, 'i').test(s)), '업로드한 파일을 선택해 주세요.');
const https = z.string().max(1000).refine(s => { if (!s) return true; try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }, 'https://로 시작하는 올바른 주소를 입력해 주세요.');
const date = z.string().refine(s => s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s), '날짜를 확인해 주세요.');
const block = z.object({id:text(80),tag:z.enum(['h1','h2','p']),label:text(100),text:text(4000)}).strict();
const faq = z.object({id:z.string().regex(/^[a-z0-9-]{1,80}$/),question:text(300),onLanding:z.boolean(),shortAnswer:text(1000),fullAnswer:text(6000)}).strict();
const notice = z.object({id:z.string().regex(/^[a-z0-9-]{1,80}$/),title:text(200),body:text(12000),start:date,end:date,pinned:z.boolean()}).strict().refine(n=>!n.start||!n.end||n.start<=n.end,'종료일은 시작일 이후여야 합니다.');
export const schema = z.object({
  landing:z.array(block).length(seed.landing.length), guideIntro:text(3000), faq:z.array(faq).max(80), notices:z.array(notice).max(100),
  privacy:z.object({effectiveDate:date,body:text(50000)}).strict(), terms:z.object({effectiveDate:date,body:text(50000)}).strict(),
  videoUrl:localAsset('mp4|webm'), videoPoster:localAsset('jpg|jpeg|png|webp'), youtubeUrl:https.refine(s=>!s||/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//.test(s),'유튜브 주소를 입력해 주세요.'),platformUrl:https, contactEmail:z.string().email().max(254)
}).strict().superRefine((v,c)=>{
  if(v.landing.some((b,i)=>b.id!==seed.landing[i].id||b.tag!==seed.landing[i].tag||b.label!==seed.landing[i].label)) c.addIssue({code:'custom',message:'편집 항목 구조가 변경되었습니다.'});
  for(const k of ['faq','notices']) if(new Set(v[k].map(x=>x.id)).size!==v[k].length)c.addIssue({code:'custom',message:`${k}: 중복 항목이 있습니다.`});
});
export function validate(value){return schema.parse(value);}
export function dataDir(){
  const raw=process.env.DATA_DIR;
  if(!raw||!path.isAbsolute(raw))throw new Error('DATA_DIR must be an absolute persistent directory outside the repository.');
  const resolved=path.resolve(raw),rel=path.relative(projectRoot,resolved);
  if(rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw new Error('DATA_DIR must be outside the repository.');
  return resolved;
}
export async function readState(){
  try {return JSON.parse(await readFile(path.join(dataDir(),'state.json'),'utf8'));}
  catch(e){if(e.code==='ENOENT')return {version:0,draft:structuredClone(seed),published:structuredClone(seed),history:[]};throw e;}
}
export async function publicState(){if(!process.env.DATA_DIR)return {published:seed};return readState();}
export async function mutate(expected,actor,action,content){
  const dir=dataDir();await mkdir(dir,{recursive:true,mode:0o700});
  const lock=path.join(dir,'write.lock');let handle;
  try{handle=await open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Object.assign(new Error('다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.'),{status:409});throw e;}
  try {
    const s=await readState();if(expected!==s.version)throw Object.assign(new Error('다른 창에서 수정되었습니다. 새로 불러온 뒤 다시 저장해 주세요.'),{status:409});
    const next=structuredClone(s);
    if(action==='save')next.draft=validate(content);
    else if(action==='publish'){
      if(!next.history.length)next.history.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:'초기 홈페이지',content:structuredClone(next.published)});
      next.published=validate(next.draft);
      next.history.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor,content:structuredClone(next.published)});
    }else if(action==='restore'){
      const old=next.history.find(h=>h.id===content);if(!old)throw Object.assign(new Error('해당 게시 이력이 없습니다.'),{status:404});next.draft=validate(old.content);
    }else throw new Error('Unknown action');
    next.version++;next.updatedAt=new Date().toISOString();next.updatedBy=actor;
    const tmp=path.join(dir,`state-${crypto.randomUUID()}.tmp`);
    const out=await open(tmp,'wx',0o600);try {await out.writeFile(JSON.stringify(next,null,2));await out.sync();}finally{await out.close();}
    await rename(tmp,path.join(dir,'state.json'));return next;
  }finally{await handle.close();await unlink(lock);}
}

export async function assertMediaExists(content){
  for(const key of ['videoUrl','videoPoster']){
    const name=content[key];if(!name)continue;
    const base=name.startsWith('media/')?path.join(dataDir(),'media'):path.join(projectRoot,'site');
    const target=name.startsWith('media/')?path.join(base,name.slice(6)):path.join(base,name);
    const actual=await realpath(target), actualBase=await realpath(base);
    if(!actual.startsWith(actualBase+path.sep))throw new Error('허용되지 않은 파일 위치입니다.');
  }
}
