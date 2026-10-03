# -*- coding: utf-8 -*-
"""
안내·약관 페이지를 만든다.

랜딩페이지에서 나가던 링크 중, 같은 페이지 안의 섹션으로 돌릴 수 없는 것들의 도착지다.
빈 링크(href="#")나 없는 주소를 남기지 않으려고 만든다.

  platform.html  로그인·무료로 시작·회원가입 — F-Play 플랫폼 시작 화면
  guide.html     튜토리얼 시작 — F-Play 사용법
  privacy.html   개인정보처리방침
  terms.html     이용약관

platform·guide 는 플랫폼 주소가 정해지기 전까지 쓰는 임시 안내다.
assets/js/config.js 에 주소를 넣으면 랜딩의 링크가 그 주소로 바로 넘어가고,
이 두 페이지는 더 이상 거치지 않는다.
"""
import io, json, re
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = str(Path(__file__).resolve().parent.parent / "site")


def load_faq(path):
    """자주 묻는 질문의 단일 원본. tools/build.py 와 같은 파일을 읽는다."""
    raw = io.open(path, encoding="utf-8").read()
    data = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
    assert data, "FAQ 원본이 비어 있다"
    return data


def esc(text):
    """우리가 쓴 글이라도 HTML 로 그냥 넣지 않는다."""
    return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;"))


FAQ = load_faq(ROOT + "/assets/js/faq-data.js")

SHELL = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} | NONDAM : F-Play</title>
<meta name="description" content="{desc}">
<meta name="robots" content="{robots}">
<link rel="icon" href="assets/brand/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/brand/favicon-16.png">
<link rel="apple-touch-icon" href="assets/brand/apple-touch-icon.png">
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/page.css">
</head>
<body>
<header class="fp-head">
  <div class="fp-head__inner">
    <a class="fp-logo" href="index.html"><img src="assets/brand/icon-192.png" alt="연꽃 심벌" width="192" height="192">NONDAM : F-Play</a>
    <a class="fp-back" href="index.html">← 랜딩페이지로</a>
  </div>
</header>

<main>
{body}
</main>

<footer class="fp-foot">
  <div class="fp-foot__inner">
    <span>© <span id="fpYear">2026</span> NONDAM : F-Play. All rights reserved.</span>
    <a href="index.html#contact">도입 문의</a>
    <a href="privacy.html">개인정보처리방침</a>
    <a href="terms.html">이용약관</a>
  </div>
</footer>
<script>
/* 연도는 해마다 손대지 않도록 표시할 때 채운다. */
(function(){{var y=document.getElementById("fpYear");if(y){{y.textContent=new Date().getFullYear();}}}})();
</script>
<script src="assets/js/config.js"></script>
<script src="assets/js/faq-data.js"></script>
<script>
/* config.js 에 주소가 채워지면 이 안내 페이지 대신 실제 주소로 바로 보낸다.
   비어 있으면 아무 일도 하지 않는다. */
(function(){{
  var cfg = window.FPLAY_CONFIG || {{}};
  var key = {cfgkey};
  if (!key) return;
  var url = (cfg[key] || "").trim();
  if (!url) return;
  var box = document.getElementById("fpTarget");
  if (box) {{
    box.textContent = "주소가 설정되어 있습니다: " + url;
  }}
}})();
</script>{extra_script}
</body>
</html>
"""

PLACEHOLDER_NOTE = """  <div class="fp-note" id="fpTarget">
    <strong>주소는 아직 정해지지 않았습니다.</strong>
    확정되면 <code>assets/js/config.js</code> 의 <code>{key}</code> 한 줄만 채우면 됩니다.
    그때부터 랜딩페이지의 링크는 이 안내 페이지를 거치지 않고 곧바로 해당 주소로 갑니다.
  </div>
  <div class="fp-actions">
    <a class="fp-btn fp-btn--ghost" href="index.html">랜딩페이지로 돌아가기</a>
    <a class="fp-btn fp-btn--ghost" href="index.html#contact">도입 문의하기</a>
  </div>
"""

PAGES = {}

PAGES["platform.html"] = dict(
    title="F-Play 플랫폼 시작 화면",
    desc="논담 랜딩페이지에서 F-Play 플랫폼으로 이동하는 안내 페이지입니다.",
    robots="noindex,follow",
    cfgkey='"platformUrl"',
    body="""  <p class="fp-kicker">LOGIN</p>
  <h1>F-Play 플랫폼 시작 화면</h1>
  <p class="fp-lead">
    로그인과 수업 개설은 랜딩페이지가 아니라 F-Play 플랫폼에서 합니다.
    교사는 계정으로 로그인해 수업을 만들고, 학생은 교사가 발급한 초대코드로 들어갑니다.
  </p>
"""
    + PLACEHOLDER_NOTE.format(key="platformUrl")
    + """
  <h2>여기로 오게 되는 링크</h2>
  <ul>
    <li>헤더와 푸터의 <b>로그인</b></li>
    <li>헤더의 <b>무료로 시작</b>, 푸터의 <b>회원가입</b></li>
    <li>모바일 메뉴의 서비스 화면 링크 — 논제와 자료, 토론방, 논술 제출, 학습 홈,
        교사 진행 안내, 토론 리포트, 쟁점 보드, 내 학습 기록</li>
  </ul>
  <p>모두 로그인한 뒤에 쓰는 화면이라 시작 화면 한 곳으로 모았습니다.</p>
""",
)

# ── 가이드 페이지 ─────────────────────────────────────────────────────────
#
# 준비 중 안내였던 자리를 실제 사용 안내 페이지로 채운다.
# 순서: 브랜드 → 제목·소개 → 영상 → 이용 전 안내 → 자주 묻는 질문 → 전환 → 정책
#
# 질문과 답은 site/assets/js/faq-data.js 하나에서만 온다. 여기에 글을 적지 않는다.
# 답을 빌드할 때 HTML 로 넣어 두는 이유는, 자바스크립트가 막혀도 질문·답·이동
# 경로가 그대로 보이게 하기 위해서다. 자바스크립트는 접고 펴는 일만 한다.

VIDEO_PENDING = (
    "F-Play 튜토리얼 영상을 준비하고 있습니다.\n"
    "플랫폼의 최종 화면이 완성된 뒤 실제 이용 방법을 영상으로 안내해 드리겠습니다."
)

def video_html():
    """설정에서 플레이어를 미리 생성해 JS 없이도 영상이 보이게 한다."""
    raw = Path(ROOT, "assets/js/config.js").read_text(encoding="utf-8")
    def setting(key):
        found = re.search(r'^\s*' + re.escape(key) + r':\s*("(?:[^"\\]|\\.)*")', raw, re.M)
        return json.loads(found.group(1)) if found else ""
    def local(value, extensions):
        value = value.strip()
        if not re.fullmatch(r'[A-Za-z0-9_-]+(?:/[A-Za-z0-9_.-]+)*\.(?:' + extensions + r')', value, re.I):
            return ""
        if ".." in value:
            return ""
        return value
    src = local(setting("videoUrl"), "mp4|webm|ogv")
    if not src:
        lines = VIDEO_PENDING.split("\n")
        return ('<div class="fp-video" id="guideVideo" data-state="pending">'
                '<p class="fp-video__pending"><strong>' + esc(lines[0]) + '</strong>'
                + esc(lines[1]) + '</p></div>')
    poster = local(setting("videoPoster"), "jpg|jpeg|png|webp")
    poster_attr = ' poster="' + esc(poster) + '"' if poster else ""
    result = ('<div class="fp-video" id="guideVideo" data-state="ready" data-static-video="true">'
              '<video controls playsinline preload="metadata" title="F-Play 사용 방법 튜토리얼 영상"'
              ' src="' + esc(src) + '"' + poster_attr + '>'
              '이 브라우저에서는 영상을 재생할 수 없습니다.</video></div>'
              '<p class="fp-video__aside"><a href="' + esc(src) + '">영상 파일 직접 열기</a></p>')
    try:
        url = urlsplit(setting("youtubeUrl"))
        hosts = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"}
        parts = url.path.strip("/").split("/")
        vid = ""
        if url.scheme in ("http", "https") and url.hostname in hosts:
            if url.hostname in ("youtu.be", "www.youtu.be"):
                vid = parts[0]
            elif parts[0] in ("embed", "shorts") and len(parts) > 1:
                vid = parts[1]
            elif url.path == "/watch":
                vid = parse_qs(url.query).get("v", [""])[0]
        if re.fullmatch(r'[A-Za-z0-9_-]{11}', vid):
            result += ('<p class="fp-video__aside"><a href="https://www.youtube.com/watch?v='
                       + vid + '" target="_blank" rel="noopener noreferrer">유튜브에서 보기 (새 창)</a></p>')
    except ValueError:
        pass
    return result


NOTICES = [
    "학생은 회원가입을 하지 않습니다. 교사가 전달한 초대코드로 바로 참여합니다.",
    "학생에게 실명이나 민감한 개인정보 입력을 요구하지 않습니다.",
    "학원·단체는 플랫폼 관리자의 승인을 받은 기관 관리자 또는 단체장 계정을 통해 이용합니다.",
    "소속 교사는 승인된 기관 관리자의 허락이나 초대를 받아 권한을 부여받습니다.",
    "AI는 토론을 대신하거나 정답을 정하지 않습니다. 진행을 돕고 결과물 정리를 거듭니다.",
    "결과물은 제공되는 기능과 권한 범위 안에서 내려받을 수 있습니다.",
]

PENDING_POLICY = [
    "개인정보와 결과물의 최종 보관기간 — 정책 확정 후 안내",
    "이용요금과 환불 조건 — 도입 상담 시 안내",
    "AI 제공업체의 구체적인 데이터 처리 정책 — 정책 확정 후 안내",
    "기관별 계약 조건 — 도입 상담 시 안내",
]


def faq_html(items):
    """가이드 페이지의 질문 목록. 답은 줄바꿈 기준으로 문단을 나눈다."""
    out = ['<ul class="fp-faq">']
    for x in items:
        paras = "".join(
            "<p>%s</p>" % esc(t.strip())
            for t in x["fullAnswer"].split("\n")
            if t.strip()
        )
        out.append(
            '<li id="faq-%s">'
            '<button type="button" class="fp-faq__q" id="faq-q-%s" '
            'aria-expanded="true" aria-controls="faq-panel-%s">%s</button>'
            '<div class="fp-faq__a" id="faq-panel-%s" role="region" '
            'aria-labelledby="faq-q-%s">%s</div>'
            "</li>"
            % (x["id"], x["id"], x["id"], esc(x["question"]), x["id"], x["id"], paras)
        )
    out.append("</ul>")
    return "\n  ".join(out)


GUIDE_BODY = """  <p class="fp-kicker">GUIDE</p>
  <h1>F-Play 사용 방법</h1>
  <p class="fp-lead">
    수업을 만들고, 초대코드를 나눠 주고, 토론을 진행하고, 결과물을 정리하기까지.
    처음 쓰시는 분이 화면을 따라올 수 있도록 정리했습니다.
    서비스가 어떤 흐름인지 먼저 보고 싶으시면
    <a href="index.html#how">랜딩페이지의 이용 방법</a>을 봐 주세요.
  </p>

  <h2>영상으로 보기</h2>
  {video_markup}

  <h2>이용 전 안내사항</h2>
  <p>수업을 시작하기 전에 이것만 알고 계시면 됩니다.</p>
  <ul class="fp-notice-list">
    {notices}
  </ul>
  <div class="fp-note fp-draft">
    <strong>아직 정해지지 않은 것</strong>
    아래 항목은 확정 전이라 숫자나 조건을 적어 두지 않았습니다.
    정해지는 대로 이 페이지에서 알려 드리겠습니다.
    <ul class="fp-notice-list">
      {pending}
    </ul>
  </div>

  <h2>자주 묻는 질문</h2>
  <p>질문을 누르면 답이 펼쳐집니다.</p>
  {faq}

  <h2>이용 시작하기</h2>
  <p>
    F-Play 를 쓰시려면 먼저 기관 승인을 받으셔야 합니다.
    이미 권한이 있으시면 바로 시작하실 수 있습니다.
  </p>
  <div class="fp-actions">
    <a class="fp-btn" href="platform.html" data-fplay-link="platform">F-Play 시작하기</a>
    <a class="fp-btn fp-btn--ghost" href="index.html#adopt">기관·단체 이용 신청</a>
    <a class="fp-btn fp-btn--ghost" href="index.html#contact">도입 문의</a>
  </div>

  <h2>정책과 이동</h2>
  <div class="fp-actions">
    <a class="fp-btn fp-btn--ghost" href="privacy.html">개인정보처리방침</a>
    <a class="fp-btn fp-btn--ghost" href="terms.html">이용약관</a>
    <a class="fp-btn fp-btn--ghost" href="index.html">논담 홈페이지로 돌아가기</a>
  </div>
"""

PAGES["guide.html"] = dict(
    title="F-Play 사용 방법",
    desc="F-Play 사용 방법과 자주 묻는 질문을 정리했습니다. 초대코드 참여, 기관 승인, "
         "AI 의 역할, 개인정보 보호 기준을 확인하실 수 있습니다.",
    robots="index,follow",
    cfgkey="null",
    script="guide",
    body=GUIDE_BODY.format(
        video_markup=video_html(),
        notices="\n    ".join("<li>%s</li>" % esc(t) for t in NOTICES),
        pending="\n      ".join("<li>%s</li>" % esc(t) for t in PENDING_POLICY),
        faq=faq_html(FAQ),
    ),
)

PAGES["privacy.html"] = dict(
    title="개인정보처리방침",
    desc="논담 랜딩페이지 문의 폼에서 수집하는 개인정보의 항목과 이용·보관 기준입니다.",
    robots="index,follow",
    cfgkey="null",
    body="""  <p class="fp-kicker">PRIVACY</p>
  <h1>개인정보처리방침</h1>
  <p class="fp-lead">
    이 방침은 <b>이 랜딩페이지</b>에서 수집하는 정보에 대한 것입니다.
    F-Play 플랫폼에 로그인한 뒤의 학습 데이터는 플랫폼의 방침을 따릅니다.
  </p>

  <div class="fp-note fp-draft">
    <strong>초안입니다. 법률 검토 전입니다.</strong>
    아래 내용은 랜딩페이지가 실제로 하는 일을 그대로 적은 것입니다.
    서비스 정식 공개 전에 검토를 거쳐 확정해야 합니다.
  </div>

  <h2>1. 수집하는 항목</h2>
  <p>도입 문의 폼을 보낼 때, 입력한 내용만 수집합니다.</p>
  <table>
    <tr><th>이름</th><td>필수. 답변 시 호칭으로 씁니다.</td></tr>
    <tr><th>연락처</th><td>필수. 회신 수단입니다.</td></tr>
    <tr><th>이메일</th><td>선택. 회신 수단입니다.</td></tr>
    <tr><th>문의 내용</th><td>필수. 소속 기관, 학급 규모, 과목과 시기 등 직접 적은 내용입니다.</td></tr>
  </table>
  <p>
    그 밖에 자동으로 모으는 것은 없습니다. 이 페이지에는 광고·분석 스크립트,
    추적 픽셀, 쿠키 배너가 없습니다. 방문 기록을 따로 남기지 않습니다.
  </p>

  <h2>2. 수집 방법</h2>
  <p>
    문의 폼은 서버로 내용을 보내지 않습니다. <b>보내기</b>를 누르면 입력한 내용을 담아
    사용하는 기기의 메일 앱을 엽니다. 실제 발송은 본인이 확인한 뒤에 이루어집니다.
    보내지 않고 창을 닫으면 아무 곳에도 남지 않습니다.
  </p>

  <h2>3. 이용 목적</h2>
  <p>문의에 답변하고 도입을 안내하는 목적으로만 씁니다. 다른 목적에 쓰지 않습니다.</p>

  <h2>4. 보관과 파기</h2>
  <p>답변이 끝나면 파기합니다. 별도의 데이터베이스에 쌓아 두지 않습니다.</p>

  <h2>5. 제3자 제공과 위탁</h2>
  <p>제공하거나 위탁하지 않습니다. 학습 데이터를 외부 AI 학습에 제공하지 않습니다.</p>

  <h2>6. 이용자의 권리</h2>
  <p>
    보낸 문의의 열람·정정·삭제를 요청할 수 있습니다.
    아래 문의 주소로 알려 주시면 처리합니다.
  </p>

  <h2>7. 문의</h2>
  <p>
    개인정보 관련 문의: <a href="mailto:contact@fplayground.com">contact@fplayground.com</a><br>
    도입 문의는 <a href="index.html#contact">랜딩페이지의 문의 양식</a>을 이용해 주세요.
  </p>

  <h2>8. 변경</h2>
  <p>내용이 바뀌면 이 페이지에서 알립니다. 확정판에는 시행일을 함께 적습니다.</p>
""",
)

PAGES["terms.html"] = dict(
    title="이용약관",
    desc="논담 랜딩페이지 이용에 관한 약관입니다.",
    robots="index,follow",
    cfgkey="null",
    body="""  <p class="fp-kicker">TERMS</p>
  <h1>이용약관</h1>
  <p class="fp-lead">
    이 약관은 <b>이 랜딩페이지</b>를 보고 문의하는 것에 대한 것입니다.
    F-Play 플랫폼 계정과 수업 이용에 대한 약관은 플랫폼에서 따로 동의하게 됩니다.
  </p>

  <div class="fp-note fp-draft">
    <strong>초안입니다. 법률 검토 전입니다.</strong>
    사업자 정보, 요금, 환불, 분쟁 해결 조항은 아직 확정되지 않았습니다.
    확정 전에는 이 페이지의 내용을 계약 근거로 쓸 수 없습니다.
  </div>

  <h2>1. 이 페이지가 하는 일</h2>
  <p>
    논담(F-Play)이 어떤 서비스인지 소개하고, 도입 문의를 받는 곳입니다.
    이 페이지에서는 회원 가입도, 결제도 하지 않습니다.
  </p>

  <h2>2. 문의</h2>
  <p>
    문의는 답변을 위한 것이며, 문의를 보냈다고 해서 계약이 성립하거나
    이용 자격이 생기지는 않습니다. 도입 조건은 회신 뒤 따로 정합니다.
  </p>

  <h2>3. 게시된 내용</h2>
  <p>
    소개 문구와 수치는 작성 시점 기준입니다. 서비스가 바뀌면 예고 없이 수정될 수 있습니다.
    실제 제공 범위는 도입 협의에서 확정합니다.
  </p>

  <h2>4. 저작권</h2>
  <p>
    이 페이지의 글과 화면 구성에 대한 권리는 논담(F-Play)에 있습니다.
    사진은 각 제공처의 라이선스를 따르고, 본문 글꼴 Pretendard 는
    SIL Open Font License 1.1 을 따릅니다(<code>assets/fonts/PretendardVariable-OFL.txt</code>).
  </p>

  <h2>5. 책임의 한계</h2>
  <p>
    소개 내용은 참고 자료입니다. 이 페이지의 내용만 믿고 내린 판단의 결과에 대해서는
    책임지지 않습니다. 도입 전에 문의로 확인해 주세요.
  </p>

  <h2>6. 문의</h2>
  <p>
    <a href="mailto:contact@fplayground.com">contact@fplayground.com</a> /
    <a href="index.html#contact">랜딩페이지의 문의 양식</a>
  </p>

  <h2>7. 변경</h2>
  <p>약관이 바뀌면 이 페이지에서 알립니다. 확정판에는 시행일을 함께 적습니다.</p>
""",
)

for name, p in PAGES.items():
    extra = p.get("script")
    extra_tag = ""
    if extra:
        version = sha256(Path(ROOT, 'assets/js/' + extra + '.js').read_bytes()).hexdigest()[:16]
        extra_tag = chr(10) + '<script src="assets/js/' + extra + '.js?v=' + version + '"></script>'
    html = SHELL.format(
        title=p["title"], desc=p["desc"], robots=p["robots"],
        cfgkey=p["cfgkey"], body=p["body"], extra_script=extra_tag,
    )
    css_version = sha256(Path(ROOT, 'assets/css/page.css').read_bytes()).hexdigest()[:16]
    html = html.replace('href="assets/css/page.css"', 'href="assets/css/page.css?v=' + css_version + '"')
    io.open(ROOT + "/" + name, "w", encoding="utf-8", newline="").write(html)
    print("%-16s %6d bytes" % (name, len(html.encode("utf-8"))))
