import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {seed,validate,mutate,readState,dataDir,DEFAULT_PLATFORM_URL,platformUrlOf} from '../lib/content.mjs';
import {render,currentNotices} from '../lib/render.mjs';
import {byteRange} from '../lib/files.mjs';
test('content rejects unsafe destinations and tampered editable IDs',()=>{
  for(const u of ['javascript:alert(1)','http://example.com','https://user:pass@example.com'])assert.throws(()=>validate({...seed,platformUrl:u}));
  for(const u of ['../secret.mp4','/etc/test.mp4','https://evil.test/x.mp4','media/x.svg'])assert.throws(()=>validate({...seed,videoUrl:u}));
  const c=structuredClone(seed);c.landing[0].id='other';assert.throws(()=>validate(c));
});
test('content rendering escapes HTML and script payloads',async()=>{
  const c=structuredClone(seed);c.landing[0].text='<img src=x onerror=alert(1)>\n다음 줄';c.guideIntro='<script>alert(1)</script>';
  const h=await render('index.html',c);assert.ok(h.includes('&lt;img'));assert.ok(!h.includes('<img src=x onerror'));
  const g=await render('guide.html',c);assert.ok(g.includes('&lt;script&gt;'));assert.ok(g.includes('data-static-video="true"'));assert.ok(!g.includes('F-Play 튜토리얼 영상을 준비하고 있습니다.'));
});
test('byte ranges include suffix and reject malformed/out of bounds ranges',()=>{
  assert.deepEqual(byteRange('bytes=-1024',55160615),{start:55159591,end:55160614});
  assert.deepEqual(byteRange('bytes=10-20',30),{start:10,end:20});
  for(const h of ['bytes=-0','bytes=99-100','bytes=5-2','bytes=1-3,7-9'])assert.equal(byteRange(h,30),false);
});
test('notices use Korean dates and honor end dates',()=>{
  const c={notices:[{title:'visible',start:'2026-10-04',end:'2026-10-04',pinned:false},{title:'expired',start:'',end:'2026-10-03',pinned:true}]};
  assert.deepEqual(currentNotices(c,new Date('2026-10-03T16:00:00Z')).map(n=>n.title),['visible']);
});
test('draft isolation, conflict detection, history restore, durable storage',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nondam-store-'));process.env.DATA_DIR=dir;
  try{
    const c=structuredClone(seed);c.guideIntro='changed';
    let s=await mutate(0,'test@example.com','save',c);assert.equal(s.published.guideIntro,seed.guideIntro);
    await assert.rejects(mutate(0,'test@example.com','save',c),e=>e.status===409);
    s=await mutate(1,'test@example.com','publish');assert.equal(s.published.guideIntro,'changed');assert.equal(s.history.length,2);
    s=await mutate(2,'test@example.com','restore',s.history[1].id);assert.equal(s.draft.guideIntro,seed.guideIntro);assert.equal(s.published.guideIntro,'changed');
    assert.equal((await readState()).version,3);
  }finally{await rm(dir,{recursive:true,force:true});delete process.env.DATA_DIR;}
});
test('data directory cannot be public repository storage',()=>{
  process.env.DATA_DIR=path.join(process.cwd(),'site/data');assert.throws(dataDir);delete process.env.DATA_DIR;
});

test('guide requests content-versioned script and never embeds YouTube',async()=>{
  const html=await render('guide.html',seed);
  assert.match(html,/src="assets\/js\/guide\.js\?v=[a-f0-9]{16}"/);
  assert.ok(!html.includes('<iframe'));
});

test('guide requests current sizing CSS using its content hash',async()=>{
  const {createHash}=await import('node:crypto');
  const {readFile}=await import('node:fs/promises');
  const hash=createHash('sha256').update(await readFile(new URL('../site/assets/css/page.css',import.meta.url))).digest('hex').slice(0,16);
  const html=await render('guide.html',seed);
  assert.ok(html.includes(`href="assets/css/page.css?v=${hash}"`));
});

// 비어 있던 platformUrl 때문에 **모든** 이용·로그인 링크가 안내 페이지에서 멈춰 있었다.
// 운영에서 실제로 그 상태였다(2026-10-11 확인: FPLAY_CONFIG.platformUrl === "").
test('platform links reach the real platform even when the CMS value is blank',async()=>{
  assert.equal(platformUrlOf({platformUrl:''}),DEFAULT_PLATFORM_URL);
  assert.equal(platformUrlOf({platformUrl:'   '}),DEFAULT_PLATFORM_URL);
  assert.equal(platformUrlOf({}),DEFAULT_PLATFORM_URL);
  // 관리자가 넣은 값이 있으면 그것이 이긴다.
  assert.equal(platformUrlOf({platformUrl:'https://other.test'}),'https://other.test');

  const c=structuredClone(seed);c.platformUrl='';
  const h=await render('index.html',c);
  // 랜딩의 이용·로그인 링크가 더는 안내 페이지에 머물지 않는다.
  assert.ok(!/href="platform.html" data-fplay-link="platform"/.test(h),'아직 안내 페이지로 간다');
  assert.ok(h.includes(`href="${DEFAULT_PLATFORM_URL}" data-fplay-link="platform"`),'실제 주소로 가지 않는다');
  assert.ok(h.includes(`"platformUrl":"${DEFAULT_PLATFORM_URL}"`),'스크립트 설정에도 주소가 없다');
  // 튜토리얼은 제 목적대로 가이드로 간다 — 플랫폼으로 돌리지 않는다.
  assert.ok(h.includes('href="guide.html" data-fplay-link="guide"'),'튜토리얼 링크가 바뀌었다');

  // 안내 페이지는 **자기 자신을 가리키지 않고** 이동 버튼을 보인다.
  const pf=await render('platform.html',c);
  assert.ok(!pf.includes('이용 주소가 아직 연결되지 않았습니다'),'연결 안 됐다고 적는다');
  assert.ok(!/<div class="fp-actions" id="fpEnter" hidden>/.test(pf),'이동 버튼이 숨겨져 있다');
  assert.ok(pf.includes('href="platform.html" data-fplay-link="platform"'),'버튼이 서버 치환 대상에서 빠졌다');
  assert.ok(pf.includes(`"platformUrl":"${DEFAULT_PLATFORM_URL}"`),'버튼이 쓸 주소가 없다');
});

// 모바일 메뉴의 이용 링크 11개를 한 줄에 `flex:1` 로 욱여넣어 글자가 세로로 한 자씩
// 찍히고 '튜토리얼' 이 잘려 있었다.
test('mobile menu wraps entry links instead of squeezing them into one row',async()=>{
  const h=await render('index.html',structuredClone(seed));
  assert.ok(!/\.nd-nav__auth[^{]*\{display:flex;gap:10px/.test(h),'여전히 한 줄에 욱여넣는다');
  assert.ok(h.includes('flex-wrap:wrap'),'줄바꿈이 없다');
  assert.ok(h.includes('min-height:48px'),'손가락으로 누를 크기가 아니다');
  assert.ok(!/\.nd-nav__auth a[^{]*\{flex:1;/.test(h),'링크가 아직 같은 비율로 쪼개진다');
  // `.nd-nav a{color:#212529}` 가 `.nd-btn--dark{color:#fff}` 를 이겨 **검은 단추에 검은 글씨**였다.
  assert.ok(h.includes('.nd-nav__auth a.nd-btn--dark'),'어두운 단추의 글자색을 되돌리지 않았다');
});

// 요금 안내는 **판매가 아니다.** 금액이 확정되기 전에 숫자나 결제 버튼이 새어 나가면
// 그것이 곧 판매 약속이 된다. 그래서 '없어야 하는 것' 을 먼저 못 박는다.
test('pricing section shows four plans without prices or a working payment button',async()=>{
  const h=await render('index.html',structuredClone(seed));
  assert.ok(h.includes('id="pricing"'),'요금 구획이 없다');
  assert.equal((h.match(/id="pricing"/g)||[]).length,1,'요금 구획이 두 번 들어갔다');

  // 네 유형이 모두 있다.
  for(const name of ['Starter','Pro','Course Pack','Organization Pack'])
    assert.ok(h.includes(name),'요금제 유형이 없다: '+name);
  for(const who of ['개인·공부방','학원·토론기관','학교·대학','기관·협회'])
    assert.ok(h.includes(who),'대상 표기가 없다: '+who);

  // **준비 중**임을 먼저 말한다.
  assert.ok(h.includes('요금 확정·결제 준비 중'),'준비 중 안내가 없다');
  assert.ok(h.includes('현재 판매 중인 상품이 아니며'),'판매 중이 아니라는 말이 없다');

  // 확정되지 않은 금액을 적지 않는다. 구획 안에서만 본다(다른 구획의 숫자와 섞지 않게).
  const sec=h.slice(h.indexOf('id="pricing"'),h.indexOf('</section>',h.indexOf('id="pricing"')));
  assert.equal(/[0-9][0-9,]*\s*(원|만원|KRW)/i.test(sec),false,'확정되지 않은 금액이 적혀 있다');
  // 동작하는 결제 버튼을 두지 않는다 — 문의 버튼 하나뿐이다.
  for(const bad of ['결제하기','구매하기','지금 결제','카드 결제','신용카드'])
    assert.equal(sec.includes(bad),false,'결제 버튼 문구가 있다: '+bad);
  assert.equal(/<form|<button/.test(sec),false,'구획 안에 폼·버튼이 있다');
  assert.ok(sec.includes('>요금·도입 문의하기</a>'),'문의 버튼 문구가 다르다');
  assert.ok(sec.includes('href="#contact"'),'문의 버튼이 문의 구획으로 가지 않는다');

  // 달란트·결제 상태를 플랫폼 정책과 같은 말로 적는다.
  assert.ok(sec.includes('현재 추가 사용 결제나 후불 청구는 제공하지 않습니다'),'후불 미제공 안내가 없다');
  assert.ok(sec.includes('지금은 온라인 결제를 받지 않습니다'),'결제 미제공 안내가 없다');
});

// 푸터 하나로는 찾지 못한다 — PC 기준 문서 6,500px 아래에 있는 구획이다.
test('pricing is reachable from the top menu and the footer service group',async()=>{
  const h=await render('index.html',structuredClone(seed));
  // 상단 메뉴(=모바일 메뉴)에 있고, '도입 문의' 앞에 선다.
  const nav=h.slice(h.indexOf('<nav class="nd-nav"'),h.indexOf('</nav>'));
  assert.ok(nav.includes('href="#pricing"'),'상단 메뉴에 요금 안내가 없다');
  assert.ok(nav.indexOf('href="#pricing"')<nav.indexOf('>도입 문의<'),'요금 안내가 도입 문의 뒤에 있다');
  // 푸터는 '서비스' 묶음 안이다 — 로그인·튜토리얼 줄이 아니다.
  const foot=h.slice(h.indexOf('<footer'));
  const svc=foot.slice(foot.indexOf('>서비스</h4>'),foot.indexOf('>신뢰</h4>'));
  assert.ok(svc.includes('href="#pricing"'),'푸터 서비스 묶음에 요금 안내가 없다');
  // 전체에 딱 두 군데다 — 같은 링크가 더 늘면 어디를 눌러야 할지 흐려진다.
  assert.equal((h.match(/href="#pricing"/g)||[]).length,2,'요금 링크 수가 달라졌다');
});
