import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot,seed} from './content.mjs';
export const escape=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=s=>escape(s).replace(/\n/g,'<br>');
function paras(s){return s.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${lines(p)}</p>`).join('');}
function video(c){
  if(!c.videoUrl)return '<div class="fp-video" id="guideVideo" data-state="pending"><p class="fp-video__pending">튜토리얼 영상을 준비하고 있습니다.</p></div>';
  return `<div class="fp-video" id="guideVideo" data-state="ready" data-static-video="true"><video controls playsinline preload="metadata" src="${escape(c.videoUrl)}"${c.videoPoster?` poster="${escape(c.videoPoster)}"`:''} title="F-Play 사용 방법 튜토리얼 영상"></video></div><p class="fp-video__aside"><a href="${escape(c.videoUrl)}">영상 파일 직접 열기</a>${c.youtubeUrl?` · <a href="${escape(c.youtubeUrl)}" target="_blank" rel="noopener noreferrer">유튜브에서 보기 (새 창)</a>`:''}</p>`;
}
function faq(c,landing){return c.faq.filter(f=>!landing||f.onLanding).map(f=>`<li class="${landing?'fp-faq__item zs-rn2texfagd-7':'fp-faq-item'}" id="faq-${escape(f.id)}"><button type="button" class="fp-faq__q" id="faq-q-${escape(f.id)}" aria-expanded="true" aria-controls="faq-panel-${escape(f.id)}">${escape(f.question)}</button><div class="fp-faq__a" id="faq-panel-${escape(f.id)}" role="region" aria-labelledby="faq-q-${escape(f.id)}">${paras(landing?f.shortAnswer:f.fullAnswer)}${landing?`<a class="fp-faq__more" href="guide.html#faq-${escape(f.id)}">자세히 알아보기</a>`:''}</div></li>`).join('');}
export function currentNotices(c,now=new Date()){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
  return c.notices.filter(n=>(!n.start||n.start<=day)&&(!n.end||n.end>=day)).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
}
export async function render(file,c,{preview=false}={}){
  let html=await readFile(path.join(projectRoot,'site',file),'utf8');
  for(const match of [...html.matchAll(/href="(assets\/css\/[a-zA-Z0-9_-]+\.css)(?:\?[^"]*)?"/g)]){
    const css=await readFile(path.join(projectRoot,'site',match[1]));
    const version=createHash('sha256').update(css).digest('hex').slice(0,16);
    html=html.replace(match[0],`href="${match[1]}?v=${version}"`);
  }
  if(file==='index.html'){
    for(const b of c.landing){if(b.text===seed.landing.find(x=>x.id===b.id)?.text)continue;const re=new RegExp(`(<${b.tag}\\b[^>]*data-node-id="${b.id}"[^>]*>)[\\s\\S]*?(</${b.tag}>)`);html=html.replace(re,(_,a,z)=>a+lines(b.text)+z);}
    html=html.replace(/(<ul\b[^>]*data-node-id="n_mtbgdrc1_6e"[^>]*>)[\s\S]*?(<\/ul>)/,(_,a,b)=>a+faq(c,true)+b);
    const notices=currentNotices(c);
    if(notices.length)html=html.replace(/<footer\b/,()=>`<section class="cms-notices" aria-label="공지사항"><h2>공지사항</h2>${notices.map(n=>`<details><summary>${n.pinned?'[중요] ':''}${escape(n.title)}</summary>${paras(n.body)}</details>`).join('')}</section><footer`);
  }
  if(file==='guide.html'){
    const script=await readFile(path.join(projectRoot,'site/assets/js/guide.js'));
    const version=createHash('sha256').update(script).digest('hex').slice(0,16);
    html=html.replace(/src="assets\/js\/guide\.js(?:\?[^"]*)?"/g,`src="assets/js/guide.js?v=${version}"`);
    html=html.replace(/<p class="fp-lead">[\s\S]*?<\/p>/,()=>`<p class="fp-lead">${lines(c.guideIntro)}</p>`);
    html=html.replace(/<div class="fp-video"[\s\S]*?(?=\s*<h2>이용 전 안내사항)/,()=>video(c));
    html=html.replace(/(<ul class="fp-faq">)[\s\S]*?(<\/ul>)/,(_,a,b)=>a+faq(c,false)+b);
  }
  if(['privacy.html','terms.html'].includes(file)){
    const key=file.split('.')[0],p=c[key];
    // 처음에는 기존 정책 레이아웃을 유지하고, 관리자가 내용을 수정한 경우에만 교체한다.
    if(JSON.stringify(p)!==JSON.stringify(seed[key]))html=html.replace(/<main>[\s\S]*?<\/main>/,()=>`<main><h1>${key==='privacy'?'개인정보처리방침':'이용약관'}</h1>${p.effectiveDate?`<p>시행일: ${escape(p.effectiveDate)}</p>`:''}<div class="cms-policy">${paras(p.body)}</div></main>`);
  }
  // 관리자 서버가 제공하는 모든 공개 페이지 하단에 고정된 로그인 입구를 표시한다.
  html=html.replace('</footer>','<div class="cms-admin-entry"><a href="/admin">관리자 로그인</a></div></footer>');
  html=html.replace(/contact@fplayground\.com/g,()=>escape(c.contactEmail));
  if(c.platformUrl)html=html.replace(/href="platform.html" data-fplay-link="platform"/g,()=>`href="${escape(c.platformUrl)}" data-fplay-link="platform"`);
  // 서버에서 최신 값을 출력해 이전 config.js 캐시에 의존하지 않는다.
  const config={platformUrl:c.platformUrl,guideUrl:'guide.html',videoUrl:c.videoUrl,videoPoster:c.videoPoster,youtubeUrl:c.youtubeUrl,contactEmail:c.contactEmail};
  html=html.replace('<script src="assets/js/config.js"></script>',()=>`<script>window.FPLAY_CONFIG=${JSON.stringify(config).replace(/</g,'\\u003c')};</script>`);
  html=html.replace('</head>','<style>.cms-admin-entry{padding:0 25px 24px;text-align:right;font-size:13px}.cms-admin-entry a{display:inline-block;padding:8px 4px;color:inherit;text-decoration:underline;text-underline-offset:3px}.cms-admin-entry a:focus-visible{outline:2px solid currentColor;outline-offset:3px}.cms-notices{max-width:1120px;margin:48px auto;padding:24px;color:#212529}.cms-notices details{padding:16px;border-bottom:1px solid #ddd}.cms-notices summary{cursor:pointer;font-weight:700}.cms-policy{overflow-wrap:anywhere}.cms-preview{position:sticky;top:0;z-index:1000;background:#fff0c2;padding:12px;text-align:center;color:#222}</style></head>');
  if(preview)html=html.replace('<body>','<body><div class="cms-preview">관리자 미리보기 · 아직 공개되지 않은 초안입니다.</div>');
  return html;
}
