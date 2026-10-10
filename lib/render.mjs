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
  // 지금 누가 쓸 수 있는지 — **관리자 콘텐츠가 아니라 코드에 둔다.**
  // 편집 가능한 자리에 두면 실수로 지워질 수 있고, 그러면 참여 대상을 밝히지 않은 채
  // 사이트가 돌아간다. 확정되지 않은 것(보관기간·외부 AI 처리 조건)은 적지 않는다.
  const pilotNotice = '<section class="cms-pilot" aria-label="시범 운영 안내">'
    + '<h2>지금은 제한된 시범 운영입니다</h2>'
    + '<p><strong>사전 승인된 성인 참여자</strong>를 대상으로만 시범 운영하고 있습니다.'
    + ' 승인 전에는 수업을 만들거나 참여할 수 없습니다.</p>'
    + '<p>이번 시범 운영에서는 <strong>AI 기능을 켜지 않았습니다.</strong>'
    + ' 아래 소개에 적힌 AI 기능은 준비된 것이며, 지금 제공되는 상태가 아닙니다.</p>'
    + '<p>학교·청소년 활동 등으로 넓히는 것은 <strong>앞으로의 계획</strong>이며,'
    + ' 현재 참여 대상이 아닙니다. 도입을 검토하신다면 문의로 알려 주세요.</p>'
    + '</section>';

  // 관리자 서버가 제공하는 모든 공개 페이지 하단에 고정된 로그인 입구를 표시한다.
  // 이름은 '홈페이지 관리' 다 — F-Play 에도 /admin 이 있어서, 그냥 '관리자 로그인' 이면
  // 어느 쪽 관리 화면인지 알 수 없다. 여기는 **홈페이지 내용**을 고치는 자리다.
  const businessInfo='<section class="cms-business-info" aria-label="사업자정보"><p><strong>청화당</strong> · 대표자: 진화정 · 사업자등록번호: 535-08-03488</p><p>사업장 주소: 전남광주통합특별시 남구 제석로80번길 36, 304-201</p><p>문의: <a href="mailto:contact@fplayground.com">contact@fplayground.com</a></p></section>';
  // 안내 페이지는 **서버에서도** 상태를 맞춘다. 스크립트만 믿으면 JS 가 꺼진 브라우저에서
  // 주소가 연결돼 있는데도 "연결되지 않았습니다" 가 보인다 — 틀린 안내다.
  if(file==='platform.html'){
    if(c.platformUrl){
      html=html.replace('<div class="fp-actions" id="fpEnter" hidden>','<div class="fp-actions" id="fpEnter">');
      html=html.replace(/<div class="fp-note" id="fpTarget">[\s\S]*?<\/div>/,'');
    }
  }
  if(['index.html','guide.html','platform.html'].includes(file))html=html.replace(/<footer\b/,()=>pilotNotice+'<footer');
  if(file==='index.html'){
    html=html.replace(/<div class="nd-footer__legal"/,businessInfo+'<div class="nd-footer__legal"');
    html=html.replace(/(<footer\b[\s\S]*?<a\b[^>]*href="guide.html"[^>]*>튜토리얼<\/a>)/, '$1<a href="/admin">홈페이지 관리</a>');
  }else{
    html=html.replace('</footer>',businessInfo+'<div class="cms-admin-entry"><a href="/admin">홈페이지 관리</a></div></footer>');
  }
  html=html.replace(/contact@fplayground\.com/g,()=>escape(c.contactEmail));
  if(c.platformUrl)html=html.replace(/href="platform.html" data-fplay-link="platform"/g,()=>`href="${escape(c.platformUrl)}" data-fplay-link="platform"`);
  // 서버에서 최신 값을 출력해 이전 config.js 캐시에 의존하지 않는다.
  const config={platformUrl:c.platformUrl,guideUrl:'guide.html',videoUrl:c.videoUrl,videoPoster:c.videoPoster,youtubeUrl:c.youtubeUrl,contactEmail:c.contactEmail};
  html=html.replace('<script src="assets/js/config.js"></script>',()=>`<script>window.FPLAY_CONFIG=${JSON.stringify(config).replace(/</g,'\\u003c')};</script>`);
  html=html.replace('</head>','<style>.cms-business-info{max-width:1120px;margin:0 auto;padding:24px 25px 12px;font-size:13px;line-height:1.8;overflow-wrap:anywhere;text-align:left}.nd-footer .cms-business-info{max-width:1480px;padding:0 25px 24px;color:#ADB5BD;box-sizing:content-box}.cms-business-info p{margin:0 0 4px}.cms-business-info a{color:inherit;text-decoration:underline;text-underline-offset:3px}.cms-admin-entry{padding:0 25px 24px;text-align:right;font-size:13px}.cms-admin-entry a{display:inline-block;padding:8px 4px;color:inherit;text-decoration:underline;text-underline-offset:3px}.cms-admin-entry a:focus-visible{outline:2px solid currentColor;outline-offset:3px}.cms-notices{max-width:1120px;margin:48px auto;padding:24px;color:#212529}.cms-notices details{padding:16px;border-bottom:1px solid #ddd}.cms-notices summary{cursor:pointer;font-weight:700}.cms-policy{overflow-wrap:anywhere}.cms-preview{position:sticky;top:0;z-index:1000;background:#fff0c2;padding:12px;text-align:center;color:#222}.cms-pilot{max-width:1120px;margin:40px auto;padding:20px 24px;border:2px solid #C92A2A;border-radius:10px;background:#FFF5F5;color:#212529}.cms-pilot h2{margin:0 0 8px;font-size:17px}.cms-pilot p{margin:0 0 6px;font-size:14px;line-height:1.75}</style></head>');
  if(preview)html=html.replace('<body>','<body><div class="cms-preview">관리자 미리보기 · 아직 공개되지 않은 초안입니다.</div>');
  return html;
}
