/*! zaemit-runtime v3.9 — 행 캐스케이드(카드통짜·프레임구제·lift48·aos행 채널이관·착지 크롤 컷) + 줌 마킹(2.4s) + hover 1.08 + 마우스 tilt + 스무스 스크롤 + ready 역게이트 + 3단 모션 스위치
 *  계약: html[data-zs-motion]=단일 SSOT / 부모 off>자식 / html[data-zs-scroll="smooth"]=명시적 opt-in
 *  래퍼 계약: [data-zs-mouse-layer]는 런타임 전용 — 에디터 직렬화/저장 경로에서 제외 (GPT R2, 가이드 문서화)
 *  배치: <head> 동기 로드 (ready를 파싱 직후 선언 → 폴백 깜빡임 제로)
 */
(function () {
  'use strict';
  var de = document.documentElement;

  /* [R1] ready 역게이트 */
  de.setAttribute('data-zs-runtime', 'ready');
  de.setAttribute('data-zs-motion-v', '3');
  if (!de.hasAttribute('data-zs-motion')) de.setAttribute('data-zs-motion', 'on');

  function pageOff() { return de.getAttribute('data-zs-motion') === 'off'; }
  function isMotionOff(el) {
    if (pageOff()) return true;
    return !!(el.closest && el.closest('[data-zs-motion="off"]'));
  }
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── [V3] 블록 유닛 등장 + 이미지 줌 (GPT 조건부GO 2026-07-11)
     - 기존 .zs-aos 개별 등장 폐기: 전량 zs-in 일괄 부여(상태 셀렉터 호환) + CSS 중립화 병행
     - 유닛 = .zs-page-block(합본) / 폴백 = body 직계 visible layout 요소(header·footer·sticky·fixed·hidden 제외)
     - fixed/overlay 보유 유닛 → data-zs-unit-flat (opacity-only 강등)
     - zs-motion-unit / data-zs-unit-flat 은 런타임 전용 — 에디터 직렬화/저장 제외 (래퍼 계약 동일) */
  var UNIT_STAGGER = 150, ROW_STAGGER = 160, BASE_DELAY = 150, ROW_DUR = 1300, ZOOM_DUR = 2400, CLEAN_PAD = 300, LIFT = 48, EPS = 0.5;
  function neutralizeAOS() {
    var els = document.querySelectorAll('.zs-aos');
    for (var i = 0; i < els.length; i++) els[i].classList.add('zs-in');
  }
  function visibleKid(el) {
    if (!el.tagName || { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, LINK: 1 }[el.tagName]) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    var cs; try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (cs.position === 'fixed' || cs.position === 'sticky') return false;
    return true; /* v3.6: height 필터 제거 — 이미지 의존 높이 프레임(로드 전 0px) 구제 */
  }
  function kidsOf(el) {
    var out = [], c = el.children;
    for (var i = 0; i < c.length; i++) if (visibleKid(c[i])) out.push(c[i]);
    return out;
  }
  /* 행 수집: 래퍼 체인(자식 1개)을 타고 내려가 첫 다분기 컨테이너의 직계들 = 행.
     role=image/video 프레임·selfbg 루트에서 하강 중단(배경·프레임은 통짜 1행). 행수 상한 6. */
  function isPainted(el) {
    var cs; try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.backgroundImage !== 'none') return true;
    var bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(bg)) return true;
    if (parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0) return true;
    return cs.boxShadow !== 'none';
  }
  function isMedia(el) {
    var r = el.getAttribute && el.getAttribute('data-zs-role');
    return r === 'image' || r === 'video';
  }
  function collectRows(unit) {
    var cur = unit, kids;
    for (var d = 0; d < 8; d++) {
      kids = kidsOf(cur);
      if (kids.length === 1) {
        var k = kids[0];
        if (cur !== unit && (isPainted(k) || isMedia(k))) return [k];  /* 카드·프레임 = 통짜 1행 (블록 루트는 면제) */
        cur = k; continue;
      }
      if (kids.length >= 2) return kids;
      break;
    }
    return cur === unit ? kidsOf(unit) : [cur];
  }
  function hasFixed(el) {
    var all = el.getElementsByTagName('*');
    if (all.length > 600) return false;
    for (var i = 0; i < all.length; i++) {
      try { if (getComputedStyle(all[i]).position === 'fixed') return true; } catch (e) {}
    }
    return false;
  }
  function clipAncestor(el, stopAt) {
    var cur = el.parentElement;
    while (cur && cur !== stopAt && cur !== document.documentElement) {
      var cs = getComputedStyle(cur);
      if (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowY === 'hidden' || cs.overflowY === 'clip') return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  function markZoom(unit) {
    var frames = unit.querySelectorAll('[data-zs-role="image"], [data-zs-role="video"]');
    for (var i = 0; i < frames.length; i++) {
      var fr = frames[i];
      if (fr.closest && fr.closest('[aria-hidden="true"]')) continue;
      var media = null;
      if (fr.tagName === 'IMG' || fr.tagName === 'VIDEO') media = fr;
      else {
        var cands = fr.querySelectorAll('img, video');
        for (var j = 0; j < cands.length; j++) {
          if (!cands[j].closest('[aria-hidden="true"]')) { media = cands[j]; break; }
        }
      }
      if (media) {
        media.classList.remove('zs-aos'); media.classList.remove('zs-in');  /* v3.7: aos 잔재가 줌·hover 채널 잠그는 것 방지 */
        media.setAttribute('data-zs-zoom', '');
      }
    }
  }
  function prepRows(unit) {
    markZoom(unit);
    var rows = collectRows(unit);
    if (!rows.length) rows = [unit];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (hasFixed(r)) r.setAttribute('data-zs-row-flat', '');  /* 클립 판정 제거 — 마스크 리빌 허용(v3.5) */
      r.classList.remove('zs-in');                              /* v3.7: 구 aos 중립화(zs-in) 선점 해제 — 행 채널 소유권 이관 */
      r.classList.add('zs-motion-row');
    }
    return rows;
  }
  function revealRow(el, delay) {
    el.style.willChange = 'opacity, transform';
    if (delay > 0) el.style.transitionDelay = delay + 'ms';
    el.classList.add('zs-in');
    var cleaned = false;
    function clean() {
      if (cleaned) return; cleaned = true;
      el.style.transitionDelay = '';
      el.style.willChange = '';
      el.removeEventListener('transitionend', onEnd);
    }
    function onEnd(ev) { if (ev.target === el && ev.propertyName === 'opacity') clean(); }  /* v3.8: 최장 채널=op(1.3s), flat 행도 발화 */
    el.addEventListener('transitionend', onEnd);
    setTimeout(clean, ROW_DUR + delay + CLEAN_PAD);
  }
  function revealUnit(unit, baseDelay) {
    var rows = unit.__zsRows || [unit];
    var rs = rows.length > 1 ? Math.min(ROW_STAGGER, Math.round(900 / (rows.length - 1))) : 0;
    unit.classList.add('zs-in');                                  /* 이미지 줌 트리거 */
    for (var i = 0; i < rows.length; i++) revealRow(rows[i], baseDelay + i * rs);
    var total = ZOOM_DUR + baseDelay + (rows.length - 1) * rs + CLEAN_PAD;
    setTimeout(function () { unit.classList.add('zs-settled'); }, total);   /* hover 채널 복원 */
  }
  function settleAll(unit) {
    unit.classList.add('zs-in'); unit.classList.add('zs-settled');
    var rows = unit.__zsRows || [];
    for (var i = 0; i < rows.length; i++) rows[i].classList.add('zs-in');
  }
  function collectUnits() {
    var units = Array.prototype.slice.call(document.querySelectorAll('.zs-page-block'));
    if (units.length) return units;
    var out = [], kids = document.body.children, SKIP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, LINK: 1, HEADER: 1, FOOTER: 1 };
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (SKIP[el.tagName]) continue;
      if (visibleKid(el)) out.push(el);
    }
    return out;
  }
  /* [고아 행 sweep] 숨김(CSS .zs-motion-row{opacity:0})은 클래스 전체를 대상으로 하지만, 노출(revealUnit)은
     런타임이 구조로 유도한 unit.__zsRows 만 켠다. 두 기준이 어긋나 __zsRows 에 안 든 .zs-motion-row 는
     (① collectRows 가 한 겹만/카드 통짜로 잡아 중첩 누락 ② .zs-page-block 밖이라 유닛에 안 잡힘) 영영 opacity:0.
     추적 집합(__zsRows)에 없는 것 = 고아 → 즉시 zs-in. 추적 행은 제외되어 스크롤 캐스케이드는 그대로 보존. */
  function sweepOrphanRows(units) {
    for (var i = 0; i < units.length; i++) {
      var rr = units[i].__zsRows || [];
      for (var j = 0; j < rr.length; j++) rr[j].__zsTracked = 1;
      units[i].__zsTracked = 1;                                  /* 유닛 자체가 행인 경우(prepRows 폴백) 포함 */
    }
    var all = document.querySelectorAll('.zs-motion-row');
    for (var k = 0; k < all.length; k++) {
      if (!all[k].__zsTracked && !all[k].classList.contains('zs-in')) all[k].classList.add('zs-in');
    }
  }
  function bootUnits() {
    neutralizeAOS();
    var units = collectUnits();
    for (var i = 0; i < units.length; i++) {
      units[i].classList.add('zs-motion-unit');
      units[i].__zsRows = prepRows(units[i]);
    }
    sweepOrphanRows(units);                                      /* __zsRows 확정 직후 = 고아 판별 시점 */
    // 검토 브리지 컨텍스트(펼친 iframe)에서는 스크롤이 없어 IO 트리거가 성립하지 않는다
    // (rootMargin 하단 -18% 때문에 페이지 끝자락은 영영 안 나타난다) — 전부 즉시 정착.
    if (reduce || pageOff() || window.__wvReviewBridgeLoaded || !('IntersectionObserver' in window)) {
      for (var j = 0; j < units.length; j++) settleAll(units[j]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      var batch = [];
      for (var k = 0; k < entries.length; k++) {
        var en = entries[k];
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        if (isMotionOff(en.target)) { settleAll(en.target); continue; }
        batch.push(en.target);
      }
      for (var m = 0; m < batch.length; m++) revealUnit(batch[m], BASE_DELAY + m * UNIT_STAGGER);
    }, { threshold: 0.1, rootMargin: '0px 0px -18% 0px' });
    for (var n = 0; n < units.length; n++) {
      if (isMotionOff(units[n])) { settleAll(units[n]); continue; }
      /* 초기 뷰포트에 이미 걸친 유닛은 크기 무관 즉시 등장 — 페이지 전체를 감싼 대형 유닛(.zs-page-block 부재 시
         body 직계 폴백)은 높이가 커서 IO threshold(0.1)를 못 넘겨 영영 안 켜지던 모바일 백지 사고 봉합. 화면 밖만 IO 위임. */
      var box = units[n].getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) revealUnit(units[n], BASE_DELAY);
      else io.observe(units[n]);
    }
    /* [미발화 유닛 폴백] 0-height(IO intersectionRatio 영영 0)·대형(threshold 0.1 미달)·끝자락(rootMargin -18% 로
       마지막 18% 는 트리거존 진입 불가)로 IO 가 못 켜는 유닛 구제. 위치 기반(top < 82%vh = IO 트리거점과 동일)이라
       정상 유닛 타이밍은 안 바뀌고(IO 가 먼저 켬), IO 가 놓친 것만 스크롤/로드 시 보완. 전부 켜지면 리스너 해제. */
    var sweepPending = false;
    function sweepUnfired() {
      var vh = window.innerHeight;
      var atBottom = (vh + (window.scrollY || window.pageYOffset || 0)) >= (document.documentElement.scrollHeight - 4);
      var remain = 0;
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.classList.contains('zs-in')) continue;
        if (isMotionOff(u)) { settleAll(u); continue; }
        var b = u.getBoundingClientRect();
        if (b.height === 0 || atBottom || (b.bottom > 0 && b.top < vh * 0.82)) { io.unobserve(u); revealUnit(u, BASE_DELAY); }
        else remain++;
      }
      if (!remain) { window.removeEventListener('scroll', onScroll); window.removeEventListener('load', sweepUnfired); }
    }
    function onScroll() { if (sweepPending) return; sweepPending = true; requestAnimationFrame(function () { sweepPending = false; sweepUnfired(); }); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', sweepUnfired);
    sweepUnfired();                                              /* 스크롤 불가(짧은 페이지)에서도 끝자락/0-height 즉시 구제 */
  }

  /* ── [B] 마우스 tilt: 래퍼 idempotent + lerp + fine pointer 한정 (GPT R2) ── */
  var tilts = [], tiltRAF = false;
  function ensureLayer(el) {
    var ex = null;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling)
      if (c.hasAttribute && c.hasAttribute('data-zs-mouse-layer')) { ex = c; break; }
    if (ex) return ex;
    var layer = document.createElement('div');
    layer.setAttribute('data-zs-mouse-layer', '');
    layer.style.willChange = 'transform';
    layer.style.transformStyle = 'preserve-3d';
    while (el.firstChild) layer.appendChild(el.firstChild);
    el.appendChild(layer);
    if (!el.style.perspective) el.style.perspective = '800px';
    return layer;
  }
  function tiltStep() {
    var active = false;
    for (var i = 0; i < tilts.length; i++) {
      var t = tilts[i];
      if (isMotionOff(t.el) || reduce) { if (t.cx || t.cy) { t.cx = t.cy = t.tx = t.ty = 0; t.layer.style.transform = ''; } continue; }
      t.cx += (t.tx - t.cx) * 0.12; t.cy += (t.ty - t.cy) * 0.12;
      if (Math.abs(t.tx - t.cx) < 0.01 && Math.abs(t.ty - t.cy) < 0.01) { t.cx = t.tx; t.cy = t.ty; }
      else active = true;
      t.layer.style.transform = (t.cx || t.cy) ? 'rotateX(' + (-t.cy) + 'deg) rotateY(' + t.cx + 'deg)' : '';
    }
    if (active) requestAnimationFrame(tiltStep); else tiltRAF = false;
  }
  function wakeTilt() { if (!tiltRAF) { tiltRAF = true; requestAnimationFrame(tiltStep); } }
  function bootTilt() {
    if (reduce) return;
    var fine = false;
    try { fine = window.matchMedia('(pointer: fine)').matches; } catch (e) {}
    if (!fine) return;
    var els = document.querySelectorAll('[data-zs-mouse="tilt"]');
    for (var i = 0; i < els.length; i++) (function (el) {
      var layer = ensureLayer(el);
      var max = parseFloat(el.getAttribute('data-zs-mouse-max')) || 6;
      var t = { el: el, layer: layer, tx: 0, ty: 0, cx: 0, cy: 0 };
      tilts.push(t);
      el.addEventListener('pointermove', function (ev) {
        if (isMotionOff(el)) return;
        var r = el.getBoundingClientRect();
        t.tx = ((ev.clientX - r.left) / r.width * 2 - 1) * max;
        t.ty = ((ev.clientY - r.top) / r.height * 2 - 1) * max;
        wakeTilt();
      });
      el.addEventListener('pointerleave', function () { t.tx = 0; t.ty = 0; wakeTilt(); });
    })(els[i]);
  }

  /* ── [C] 스무스 스크롤: opt-in 시에만 리스너 등록 + deltaMode 정규화 (GPT R3) ── */
  function bootScroll() {
    if (reduce) return;
    if (de.getAttribute('data-zs-scroll') !== 'smooth') return;
    var target = window.scrollY || 0, cur = target, running = false, EASE = 0.1, expected = null;
    function maxScroll() { return Math.max(0, de.scrollHeight - window.innerHeight); }
    function norm(e) {
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      return d;
    }
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;                       /* 줌 제스처 통과 */
      if (pageOff()) return;                       /* 모션 off = 네이티브 */
      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + norm(e)));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: false });
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (expected !== null && Math.abs(y - expected) <= 1.5) { expected = null; return; }  /* 러너 자신의 스크롤 */
      target = cur = y; expected = null;                 /* 외부 개입(키보드·앵커·드래그): running 중에도 즉시 승복 */
    }, { passive: true });
    function step() {
      cur += (target - cur) * EASE;
      if (Math.abs(target - cur) < 0.5) { cur = target; expected = cur; window.scrollTo(0, cur); running = false; return; }
      expected = cur; window.scrollTo(0, cur);
      requestAnimationFrame(step);
    }
  }

  /* 프리뷰/에디터 신호 */
  window.addEventListener('message', function (ev) {
    var m = ev && ev.data;
    if (!m || m.type !== 'ZAEMIT_MOTION') return;
    de.setAttribute('data-zs-motion', m.value === 'off' ? 'off' : 'on');
  });

  function boot() { bootUnits(); bootTilt(); bootScroll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
