/* 가이드 페이지 동작 — 영상 넣기와 질문 펼치기.
 *
 * 영상은 **우리 파일을 직접 재생**한다(config.js 의 videoUrl).
 * 유튜브 embed 를 쓰지 않는 이유 — 페이지를 여는 것만으로 방문자 기록이
 * 밖으로 나가지 않게 하기 위해서다. 유튜브는 ‘유튜브에서 보기’ 보조 링크로만 남긴다.
 *
 * 주소는 config.js 한 곳에서만 온다. 이 파일에도, HTML 에도 주소를 적지 않는다.
 * 주소가 비어 있으면 플레이어를 아예 만들지 않고 준비 중 안내를 그대로 둔다.
 *
 * 자동재생은 하지 않는다. 보는 사람이 재생 버튼을 눌렀을 때만 재생된다.
 */
(function () {
  "use strict";

  var cfg = window.FPLAY_CONFIG || {};

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /* ── 유튜브 주소에서 영상 id 만 꺼낸다 ────────────────────────────────
   * 받아들이는 형태
   *   https://www.youtube.com/watch?v=ID
   *   https://youtu.be/ID
   *   https://www.youtube.com/embed/ID
   *   https://www.youtube.com/shorts/ID
   *   https://www.youtube-nocookie.com/embed/ID
   *
   * 그 밖의 도메인은 전부 거절한다. 주소를 그대로 iframe 에 넣지 않고, 꺼낸 id 로
   * embed 주소를 우리가 다시 만든다. 남의 주소가 그대로 들어가는 길을 막기 위해서다.
   * id 는 영문·숫자·하이픈·밑줄 11자다. 이 모양이 아니면 쓰지 않는다.
   */
  var HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
               "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"];
  var ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function videoId(raw) {
    var url;
    try {
      url = new URL(String(raw || "").trim());
    } catch (e) {
      return null; // 주소 모양이 아니면 여기서 끝
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (HOSTS.indexOf(url.hostname.toLowerCase()) < 0) return null;

    var id = null;
    var path = url.pathname.replace(/^\/+/, "");
    if (url.hostname.toLowerCase().indexOf("youtu.be") >= 0) {
      id = path.split("/")[0];
    } else if (path.indexOf("embed/") === 0 || path.indexOf("shorts/") === 0) {
      id = path.split("/")[1];
    } else if (path === "watch") {
      id = url.searchParams.get("v");
    }
    return id && ID_RE.test(id) ? id : null;
  }

  /* 재생할 영상 파일 주소를 고른다.
   * 이 묶음 안의 상대경로만 받는다 — 바깥 주소(https://, //, 스킴 포함)를
   * 그대로 넣으면 남의 서버에 요청을 보내게 되고, 그러면 방문자 기록이
   * 밖으로 나간다. 상위 디렉터리로 빠져나가는 ../ 도 막는다. */
  /* 주소 끝의 ?v=... 는 **판 번호**다. 파일을 새로 올리면 이 값을 바꾼다.
   * 그래야 브라우저가 들고 있던 옛 사본을 쓰지 않고 다시 받아 간다.
   * (받아 둔 사본이 중간에 끊긴 것이면 재생이 안 되는데, 주소가 같으면
   *  브라우저는 서버에 묻지도 않아서 고쳐도 고쳐지지 않는 것처럼 보인다.)
   * 캐시를 끄는 것이 아니다 — 같은 판은 그대로 캐시된다. */
  function splitVersion(v) {
    var q = v.indexOf("?");
    if (q < 0) return { path: v, ok: true };
    var query = v.slice(q + 1);
    return { path: v.slice(0, q), ok: /^v=[A-Za-z0-9._-]{1,32}$/.test(query) };
  }

  function localVideo(raw) {
    var v = String(raw || "").trim();
    if (!v) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return null;  // http: javascript: data: …
    if (v.indexOf("//") === 0 || v.indexOf("\\") >= 0) return null;
    if (v.charAt(0) === "/" || v.indexOf("../") >= 0) return null;
    var p = splitVersion(v);
    if (!p.ok) return null;
    if (!/\.(mp4|webm|ogv)$/i.test(p.path)) return null;
    return v;
  }

  /** 포스터도 같은 규칙으로 고른다. 확장자만 그림으로 바꾼다. */
  function localPoster(raw) {
    var v = String(raw || "").trim();
    if (!v) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return null;
    if (v.indexOf("//") === 0 || v.indexOf("\\") >= 0) return null;
    if (v.charAt(0) === "/" || v.indexOf("../") >= 0) return null;
    var p = splitVersion(v);
    if (!p.ok) return null;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(p.path)) return null;
    return v;
  }

  function mountVideo() {
    var slot = document.getElementById("guideVideo");
    if (!slot) return;

    var src = localVideo(cfg.videoUrl);
    if (!src) {
      // 영상이 없다. 안내 문구는 HTML 에 이미 있으므로 그대로 둔다.
      slot.setAttribute("data-state", "pending");
      return;
    }

    var video = document.createElement("video");
    video.src = src;
    video.controls = true;          // 재생 버튼·전체화면·음량은 브라우저 기본 컨트롤로 준다
      // 직접 만든 버튼보다 키보드·화면낭독기 대응이 확실하고, 기기마다 익숙한 모양이다.
    // 포스터가 없으면 재생 전에 검은 사각형만 보인다.
    // 이 영상은 어두운 타이틀로 시작해서 더 그렇게 보였다.
    var poster = localPoster(cfg.videoPoster);
    if (poster) video.poster = poster;
    video.preload = "metadata";     // 첫 장면과 길이만 미리 받는다. 본편은 누를 때 받는다.
    video.playsInline = true;       // 모바일에서 전체화면으로 튀어오르지 않게
    video.setAttribute("controlslist", "nodownload");
    video.title = "F-Play 사용 방법 튜토리얼 영상";
    // 자동재생하지 않는다. autoplay·muted 를 일부러 넣지 않는다.

    slot.setAttribute("data-state", "ready");
    slot.textContent = "";          // 준비 중 안내를 걷어낸다
    slot.appendChild(video);

    // 유튜브는 보조 링크로만. 누를 때만 밖으로 나간다.
    var id = videoId(cfg.youtubeUrl);
    if (!id) return;
    var aside = document.createElement("p");
    aside.className = "fp-video__aside";
    var a = document.createElement("a");
    a.href = "https://www.youtube.com/watch?v=" + id;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "유튜브에서 보기 (새 창)";
    aside.appendChild(a);
    if (slot.parentNode) slot.parentNode.insertBefore(aside, slot.nextSibling);
  }

  /* ── 질문 접고 펴기 ───────────────────────────────────────────────────
   * 질문과 답은 이미 HTML 에 들어 있다. 이 코드가 돌지 않으면 전부 펼쳐진 채 남는다.
   * <button> 이라 Enter·Space 는 브라우저 기본 동작으로 처리된다. */
  function accordion() {
    var buttons = document.querySelectorAll(".fp-faq__q");
    if (!buttons.length) return;

    var pairs = [];
    Array.prototype.forEach.call(buttons, function (btn) {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      pairs.push([btn, panel]);
      setOpen(btn, panel, false);
      btn.addEventListener("click", function () {
        setOpen(btn, panel, btn.getAttribute("aria-expanded") !== "true");
      });
    });

    // guide.html#faq-{id} 로 바로 들어온 경우 그 답을 펼쳐서 보여 준다.
    function openFromHash() {
      var id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      var btn = target.querySelector(".fp-faq__q");
      var panel = btn && document.getElementById(btn.getAttribute("aria-controls"));
      if (!btn || !panel) return;
      setOpen(btn, panel, true);
      target.scrollIntoView({ block: "start" });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
  }

  function setOpen(btn, panel, open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  }

  /* ── 플랫폼 주소 ──────────────────────────────────────────────────── */
  function links() {
    var url = (cfg.platformUrl || "").trim();
    if (!url) return;
    var nodes = document.querySelectorAll('[data-fplay-link="platform"]');
    Array.prototype.forEach.call(nodes, function (a) {
      a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  ready(function () {
    links();
    mountVideo();
    accordion();
  });
})();
