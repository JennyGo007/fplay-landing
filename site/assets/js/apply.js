/* 기관 도입 신청서 — 입력한 내용을 메일 앱에 담는다.
 *
 * 받는 서버를 두지 않는다. 랜딩의 문의 폼과 같은 방식이다.
 *   · 어디에도 저장하지 않는다. 사업자등록번호 같은 값이 우리 서버를 거치지 않는다.
 *   · 보냈는지 아닌지를 이 페이지는 알 수 없다. 그래서 '접수·전송 완료' 로 말하지 않는다.
 *     메일 앱에 담았다는 사실까지만 적는다.
 *
 * 체크 둘은 **보내기를 막는 조건**이다. 특히 '위의 사실과 다름없습니다' 는
 * 나중에 서류와 어긋났을 때 무엇을 근거로 등록했는지 가리는 자리라, 본문에도 함께 적는다.
 */
(function () {
  "use strict";

  var cfg = window.FPLAY_CONFIG || {};

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var form = document.querySelector('[data-fplay-form="apply"]');
    if (!form) return;

    var email = (cfg.contactEmail || "").trim();

    var status = document.createElement("p");
    status.className = "fp-form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);

    function val(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? String(el.value || "").trim() : "";
    }
    function checked(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return !!(el && el.checked);
    }
    function warn(text, focusName) {
      status.setAttribute("data-state", "warn");
      status.textContent = text;
      var el = focusName ? form.querySelector('[name="' + focusName + '"]') : null;
      if (el && el.focus) el.focus();
    }

    // 모양만 본다. 주소가 실제로 쓰이는지는 수락할 때 로그인 계정과 맞대어 보고 가려진다.
    function emailLooksOk(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }

    var REQUIRED = [
      { name: "org", label: "기관 이름" },
      { name: "kind", label: "기관 유형" },
      { name: "rep", label: "대표 이름" },
      { name: "repEmail", label: "대표 이메일" },
      { name: "manager", label: "담당자 이름" },
      { name: "managerGoogle", label: "담당자 구글 로그인 이메일" },
      { name: "managerPhone", label: "담당자 연락처" },
    ];

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      for (var i = 0; i < REQUIRED.length; i += 1) {
        if (!val(REQUIRED[i].name)) {
          warn(REQUIRED[i].label + "을(를) 채워 주세요.", REQUIRED[i].name);
          return;
        }
      }
      if (!emailLooksOk(val("repEmail"))) {
        warn("대표 이메일의 모양을 확인해 주세요.", "repEmail");
        return;
      }
      if (!emailLooksOk(val("managerGoogle"))) {
        warn("담당자 구글 로그인 이메일의 모양을 확인해 주세요.", "managerGoogle");
        return;
      }
      if (!checked("truth")) {
        warn("'위의 사실과 다름없습니다' 를 확인해 주세요.", "truth");
        return;
      }
      if (!checked("consent")) {
        warn("개인정보 수집 및 이용 동의를 확인해 주세요.", "consent");
        return;
      }
      if (!email) {
        warn("지금은 신청을 받을 수 없습니다. 잠시 뒤 다시 시도해 주세요.");
        return;
      }

      // 운영자가 그대로 보고 등록 화면에 옮겨 적을 수 있게 **칸 순서를 맞춰** 적는다.
      var lines = [
        "[계약 주체]",
        "기관 이름: " + val("org"),
        "기관 유형: " + val("kind"),
        "사업자등록번호: " + (val("regno") || "(없음)"),
        "",
        "[계약서상 대표]",
        "이름: " + val("rep"),
        "이메일: " + val("repEmail"),
        "연락처: " + (val("repPhone") || "(없음)"),
        "",
        "[운영 담당자]",
        "이름: " + val("manager"),
        "구글 로그인 이메일: " + val("managerGoogle"),
        "연락처: " + val("managerPhone"),
        "",
        "[이용 계획]",
        "예상 규모: " + (val("scale") || "(없음)"),
        "시작 희망: " + (val("startAt") || "(없음)"),
        "덧붙일 말: " + (val("note") || "(없음)"),
        "",
        "[확인]",
        "위의 사실과 다름없습니다: 예",
        "개인정보 수집·이용 동의: 예",
        "",
        "[첨부해 주실 서류]",
        "· 사업자등록증 사본 (필수)",
        "· 통장 사본 (대금 정산이 필요한 경우)",
        "",
        "※ 이 메일에 파일로 붙여 보내 주세요. 신청 페이지에서는 파일을 올릴 수 없습니다.",
      ];

      var href =
        "mailto:" +
        email +
        "?subject=" +
        encodeURIComponent("[논담] 기관 도입 신청 - " + val("org")) +
        "&body=" +
        encodeURIComponent(lines.join("\n"));

      // 보냈다고 말하지 않는다 — 메일 앱이 열렸는지조차 이 페이지는 알 수 없다.
      status.setAttribute("data-state", "ok");
      status.textContent = "";
      status.appendChild(document.createTextNode(
        "메일 앱에 신청 내용을 담았습니다. 사업자등록증 사본을 첨부해 보내 주세요. 창이 열리지 않으면 ",
      ));
      // 되살리는 고리에는 **채운 내용을 그대로** 담는다. 빈 주소만 주면 처음부터 다시 써야 한다.
      var again = document.createElement("a");
      again.href = href;
      again.setAttribute("data-fplay-mailto", "apply");
      again.textContent = "다시 열기";
      status.appendChild(again);
      status.appendChild(document.createTextNode(" 를 누르거나 " + email + " 로 직접 보내 주세요."));

      // 자동으로 메일 앱을 연다. 다만 **자동 검사가 돌 때는 열지 않는다** —
      // 검사를 돌릴 때마다 개발자 컴퓨터에 메일 창이 떠오른다(실제로 그랬다).
      // navigator.webdriver 는 사람이 쓰는 브라우저에서는 늘 false 다.
      if (!navigator.webdriver) window.location.href = href;
    });
  });
})();
