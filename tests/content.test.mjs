import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {seed,validate,mutate,readState,dataDir} from '../lib/content.mjs';
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
