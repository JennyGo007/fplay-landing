/* 랜딩페이지 동작 — 전부 이 파일 하나다. 외부에서 받아오는 것은 없다.
 *
 *   1) 등장 모션      스크롤해서 들어오면 떠오르며 나타난다.
 *   2) 링크 연결      설정에 플랫폼 주소가 있으면 '로그인' 을 그리로 보낸다.
 *                     주소의 출처는 **관리자 화면**('연결·연락처' 탭)이고, 서버가
 *                     FPLAY_CONFIG 로 내려 준다. config.js 는 정적 기본값일 뿐이다.
 *   3) 문의 폼        메일 앱을 열어 내용을 채워 준다.
 *   4) 자주 묻는 질문  질문을 눌러 답을 접고 편다.
 *
 * 헤더 메뉴 열고 닫기와 푸터 연도는 원본 인라인 스크립트를 그대로 두었다.
 * 외부 서버에 기대는 코드가 없어 손댈 이유가 없었다.
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

  /* ── 1) 등장 모션 ─────────────────────────────────────────────────────
   * 감추는 CSS 는 html[data-fp-motion="on"] 아래에만 있다. 관찰을 시작할 수 있을
   * 때에만 이 속성을 붙인다. 여기까지 못 오면 내용은 처음부터 다 보인다. */
  function reveal() {
    var els = document.querySelectorAll(".zs-aos");
    if (!els.length) return;

    if (!("IntersectionObserver" in window)) return; // 관찰 못 하면 그냥 다 보인다

    document.documentElement.setAttribute("data-fp-motion", "on");

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("zs-in");
          io.unobserve(en.target);
        });
      },
      { threshold: 0.12 }
    );

    Array.prototype.forEach.call(els, function (el) {
      io.observe(el);
    });

    // 관찰이 어떤 이유로든 안 걸렸을 때를 대비한 보험. 3초 뒤에는 무조건 보인다.
    window.setTimeout(function () {
      Array.prototype.forEach.call(els, function (el) {
        el.classList.add("zs-in");
      });
    }, 3000);
  }

  /* ── 2) 링크 연결 ─────────────────────────────────────────────────────
   * 플랫폼 주소가 정해지면 '로그인' 을 그 주소로 보낸다. 비어 있으면
   * platform.html 안내 페이지 그대로다.
   *
   * '튜토리얼' 은 guideUrl 로 가되, 이 묶음 안의 상대 경로만 받는다.
   * 바깥 주소를 넣어도 무시하고 기본값 guide.html 을 그대로 둔다. 영상이나 다른
   * 사이트로 곧장 보내지 않고 안내 페이지를 거치게 하는 것이 계약이기 때문이다. */
  function isInside(url) {
    // http(s):// 로 시작하거나 // 로 시작하면 바깥이다.
    return !!url && !/^[a-z][a-z0-9+.-]*:/i.test(url) && url.slice(0, 2) !== "//";
  }

  function links() {
    var platform = (cfg.platformUrl || "").trim();
    if (platform) {
      each('[data-fplay-link="platform"]', function (a) {
        a.setAttribute("href", platform);
        // 플랫폼은 별도 서비스다. 랜딩을 닫지 않고 새 탭에서 연다.
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      });
    }
    var guide = (cfg.guideUrl || "").trim();
    if (isInside(guide)) {
      each('[data-fplay-link="guide"]', function (a) {
        a.setAttribute("href", guide);
      });
    }
  }

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* ── 4) 자주 묻는 질문 — 접고 펴기 ────────────────────────────────────
   * 질문과 답은 빌드할 때 이미 HTML 에 들어가 있다(faq-data.js 가 원본).
   * 여기서는 접고 펴는 일만 한다. 이 코드가 돌지 않으면 전부 펼쳐진 채로 남아,
   * 자바스크립트가 막혀도 질문과 답과 '자세히 알아보기' 가 그대로 보인다.
   *
   * <button> 이라 Enter·Space 와 키보드 이동이 브라우저 기본 동작으로 된다.
   * 따로 keydown 을 붙이지 않는다. */
  function faqAccordion() {
    var buttons = document.querySelectorAll(".fp-faq__q");
    if (!buttons.length) return;

    Array.prototype.forEach.call(buttons, function (btn) {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;

      // 접을 수 있게 된 지금부터 접는다. 그 전에는 펼쳐진 상태가 기본이다.
      setOpen(btn, panel, false);

      btn.addEventListener("click", function () {
        setOpen(btn, panel, btn.getAttribute("aria-expanded") !== "true");
      });
    });
  }

  function setOpen(btn, panel, open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  }

  /* ── 3) 문의 폼 ───────────────────────────────────────────────────────
   * 받는 서버가 아직 없다. 입력한 내용을 그대로 담아 메일 앱을 연다.
   * 메일 앱이 없더라도 주소와 내용을 화면에 남겨 두어 직접 보낼 수 있게 한다. */
  function contactForm() {
    var form = document.querySelector('[data-fplay-form="contact"]');
    if (!form) return;

    var email = (cfg.contactEmail || "").trim();
    var status = document.createElement("p");
    status.className = "fp-form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);

    function value(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? String(el.value || "").trim() : "";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var consent = form.querySelector('[name="consent"]');
      var name = value("name");
      var message = value("message");

      if (!name || !message || (consent && !consent.checked)) {
        status.setAttribute("data-state", "warn");
        status.textContent = "이름, 문의 내용, 개인정보 수집 동의를 확인해 주세요.";
        return;
      }
      if (!email) {
        status.setAttribute("data-state", "warn");
        status.textContent = "지금은 문의를 받을 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
        return;
      }

      var body = [
        "이름: " + name,
        "연락처: " + value("phone"),
        "이메일: " + value("email"),
        "",
        "문의 내용",
        message,
      ].join("\n");

      var href =
        "mailto:" +
        email +
        "?subject=" +
        encodeURIComponent("[논담] 도입 문의 - " + name) +
        "&body=" +
        encodeURIComponent(body);

      status.setAttribute("data-state", "ok");
      status.textContent = "메일 앱에 문의 내용을 담았습니다. 창이 열리지 않으면 ";
      var emailLink = document.createElement("a");
      emailLink.href = "mailto:" + email;
      emailLink.textContent = email;
      status.appendChild(emailLink);
      status.appendChild(document.createTextNode(" 로 직접 보내주세요."));
      window.location.href = href;
    });
  }

  ready(function () {
    links();
    faqAccordion();
    contactForm();
    reveal();
  });
})();
