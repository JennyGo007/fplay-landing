/* 가이드 페이지 동작 — 영상 넣기와 질문 펼치기.
 *
 * 영상 주소는 config.js 의 youtubeUrl 한 곳에서만 온다. 이 파일에도, HTML 에도
 * 주소를 적지 않는다. 주소가 비어 있으면 iframe 을 아예 만들지 않는다.
 * 빈 iframe 은 그 자체로 외부 요청이 되기 때문이다.
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

  function mountVideo() {
    var slot = document.getElementById("guideVideo");
    if (!slot) return;

    var id = videoId(cfg.youtubeUrl);
    if (!id) {
      // 주소가 없거나 유튜브가 아니다. 안내 문구는 HTML 에 이미 있으므로 그대로 둔다.
      slot.setAttribute("data-state", "pending");
      return;
    }

    var frame = document.createElement("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/" + id;
    frame.title = "F-Play 사용 방법 튜토리얼 영상";
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    frame.allowFullscreen = true;
    frame.setAttribute("frameborder", "0");

    slot.setAttribute("data-state", "ready");
    slot.textContent = "";      // 준비 중 안내를 걷어낸다
    slot.appendChild(frame);
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
