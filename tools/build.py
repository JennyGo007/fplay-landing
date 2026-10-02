# -*- coding: utf-8 -*-
"""
논담 랜딩페이지 — Jaemit 의존성을 걷어내고 독립 배포용 정적 묶음을 만든다.

원칙
  - 원본(_source/index-original.html)은 읽기만 한다. 절대 덮어쓰지 않는다.
  - 화면에 나가는 문구와 줄바꿈은 한 글자도 바꾸지 않는다.
  - PC·모바일 CSS 는 그대로 둔다. 지우는 것은 에디터·미러·런타임 코드뿐이다.
  - 바꾼 자리마다 assert 를 둔다. 원본이 달라지면 조용히 넘어가지 않고 멈춘다.
"""
import io, re, json

ROOT = "C:/DataAnalysis/fplay-landing"
SRC = ROOT + "/_source/index-original.html"
OUT = ROOT + "/site/index.html"

s = io.open(SRC, encoding="utf-8").read()
orig_len = len(s)
log = []


def note(kind, why, n):
    log.append("%s  %-44s %s" % (kind, why, n))


def cut(pattern, why, count=1, flags=0):
    """정규식에 걸리는 부분을 지우고 몇 건을 지웠는지 기록한다."""
    global s
    found = re.findall(pattern, s, flags)
    assert len(found) == count, "%s: %d건 예상, %d건 발견" % (why, count, len(found))
    s = re.sub(pattern, "", s, flags=flags)
    note("삭제", why, "%d건" % count)


def swap(old, new, why, count=1):
    global s
    n = s.count(old)
    assert n == count, "%s: %d건 예상, %d건 발견" % (why, count, n)
    s = s.replace(old, new)
    note("교체", why, "%d건" % count)


def load_faq(path):
    """자주 묻는 질문의 단일 원본을 읽는다.

    faq-data.js 는 브라우저가 그대로 읽는 자바스크립트지만, 배열 부분은 JSON 형태를
    지키도록 써 두었다. 그래서 파이썬도 같은 파일을 읽을 수 있다.
    질문과 답을 여기에 다시 적지 않기 위해서다.
    """
    raw = io.open(path, encoding="utf-8").read()
    data = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
    assert data, "FAQ 원본이 비어 있다"
    ids = [x["id"] for x in data]
    assert len(set(ids)) == len(ids), "FAQ id 가 겹친다"
    for x in data:
        for k in ("id", "question", "shortAnswer", "fullAnswer"):
            assert x.get(k), "FAQ %s 에 %s 가 없다" % (x.get("id"), k)
    return data


def html_escape(text):
    """사용자가 아닌 우리가 쓴 글이라도 HTML 로 그냥 넣지 않는다."""
    return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;"))


# ─────────────────────────────────────────────────────── 1) 에디터·미러 코드
# editor.zaemit.ai 로 fetch/XHR 을 되돌리는 에디터 미러 shim
cut(r'<script>\(function\(\)\{try\{var O="https://editor\.zaemit\.ai".*?</script>',
    "에디터 미러 shim", 1, re.S)
# <base href="//wv...zaemit.ai/"> — 모든 상대경로를 남의 도메인으로 보낸다
cut(r'<base href="//wv1787032945235648\.zaemit\.ai/">', "base href (미러 도메인)")
# window.WEB_ROOT 선언
cut(r'<script>window\.WEB_ROOT="https:\\/\\/wv1787032945235648\.zaemit\.ai\\/";</script>',
    "WEB_ROOT 선언")
# /login·/page/* 를 미러 경로로 다시 쓰는 스크립트 (본문에 2벌 들어 있다)
cut(r'<script type="text/javascript"[^>]*>\s*\n\s*var WEB_ROOT = '
    r'"https:\\/\\/wv1787032945235648\.zaemit\.ai\\/";.*?</script>',
    "WEB_ROOT 리루팅 스크립트", 2, re.S)
# 에디터 캔버스 플래그
cut(r'<script data-node-id="n_mtbgdrc2_9b">window\.WEB_ROOT='
    r'"https://editor\.zaemit\.ai[^<]*</script>', "에디터 캔버스 플래그")
# 웹빌더 모션 런타임 (외부 JS)
cut(r'<script src="/weven_service/asset/js/motion/zaemit-runtime\.js\?v=\d+"[^>]*></script>',
    "zaemit-runtime.js 로드")
# canonical / og:url — 미러 주소를 배포 도메인으로 바꾼다.
# 주석으로 남겨 두지 않는다. 주석은 검색엔진도 SNS 도 읽지 않는다.
SITE_URL = "https://fplayground.com/"
swap('<link rel="canonical" href="https://wv1787032945235648.zaemit.ai/">',
     '<link rel="canonical" href="%s">' % SITE_URL,
     "canonical → 배포 도메인")
swap('<meta property="og:url" content="https://wv1787032945235648.zaemit.ai/">',
     '<meta property="og:url" content="%s">' % SITE_URL,
     "og:url → 배포 도메인")
# 미러 전용 noindex — 실제 배포에서는 색인을 막을 이유가 없다
swap('<meta name="robots" content="noindex,nofollow">',
     '<meta name="robots" content="index,follow">',
     "robots noindex → index")

# 검색·공유용 이름 — 브랜드로 통일한다.
# 웹빌더가 서비스명을 두 번 이어 붙여 "논담 - AI 토론 논술 플랫폼 | 논담 - AI 토론 논술 플랫폼"
# 이 돼 있었다. 검색 결과와 공유 카드에 그대로 나가는 자리라 정리한다.
# 본문 문구는 건드리지 않는다. 여기는 <head> 안의 이름표뿐이다.
SERVICE_NAME = "NONDAM : F-Play"
PAGE_TITLE = SERVICE_NAME + " | AI 토론·논술 플랫폼"
OLD_TITLE = "논담 - AI 토론 논술 플랫폼 | 논담 - AI 토론 논술 플랫폼"
swap("<title>%s</title>" % OLD_TITLE, "<title>%s</title>" % PAGE_TITLE, "title → 브랜드 통일")
swap('<meta property="og:title" content="%s">' % OLD_TITLE,
     '<meta property="og:title" content="%s">' % PAGE_TITLE, "og:title → 브랜드 통일")
swap('<meta name="twitter:title" content="%s">' % OLD_TITLE,
     '<meta name="twitter:title" content="%s">' % PAGE_TITLE, "twitter:title → 브랜드 통일")
swap('<meta property="og:site_name" content="논담 - AI 토론 논술 플랫폼">',
     '<meta property="og:site_name" content="%s">' % SERVICE_NAME,
     "og:site_name → 브랜드 통일")

# ─────────────────────────────────────────────────────── 2) 에디터 캔버스 높이
# window.top.parent 로 에디터 프레임 높이를 읽어 --window-height 에 넣던 코드.
# 그 변수를 읽는 CSS 가 원본에도 한 군데 없다(선언 1회, 사용 0회). 에디터 안에서만
# 쓰던 것이라 통째로 지운다.
assert s.count("--window-height") == 1, "--window-height 가 CSS 에서도 쓰이고 있다"
cut(r'<script type="text/javascript" data-node-id="n_mtbgdrc2_9a">.*?</script>',
    "에디터 캔버스 높이 스크립트", 1, re.S)

# ────────────────────────────────────────────────── 3) 등장 모션 스크립트 통합
# 같은 IntersectionObserver 코드가 섹션마다 9벌 들어 있었다. 하나로 줄인다.
aos = re.findall(r'<script data-node-id="n_mtbgdrc0_[a-i]">/\* wv-domready \*/.*?</script>', s, re.S)
assert len(aos) == 9, "등장 모션 스크립트 9벌 예상, %d벌" % len(aos)
for i, blk in enumerate(aos):
    s = s.replace(blk, "" if i else "<!-- 등장 모션은 assets/js/site.js 하나로 모았다 -->")
note("통합", "등장 모션 스크립트", "9벌 → 1벌")

# ───────────────────────────────────────────────────────── 4) 외부 CSS·폰트
swap('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin="">'
     '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9'
     '/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'
     '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9'
     '/dist/web/static/pretendard-dynamic-subset.min.css">',
     '<link rel="stylesheet" href="assets/css/fonts.css">'
     '<link rel="stylesheet" href="assets/css/motion.css">'
     '<link rel="stylesheet" href="assets/css/site.css">',
     "Pretendard CDN → 로컬 폰트·모션·보완 CSS")
swap('@import url("/weven_service/asset/css/zaemit-motion.css");',
     '/* 모션 규칙은 assets/css/motion.css 로 옮겼다(원본은 웹빌더 서버에서 @import 하던 파일이다). */',
     "모션 CSS @import (웹빌더 서버)", 2)
# 파비콘 — 임시로 쓰던 論 글자 SVG 를 지우고 공식 연꽃 자산을 건다.
# 브라우저 탭과 모바일 홈 화면에 실제로 쓰이는 <link> 만 넣는다.
swap('<link rel="icon" href="/favicon.ico" type="image/x-icon">',
     '<link rel="icon" href="assets/brand/favicon.ico" sizes="any">'
     '<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/favicon-32.png">'
     '<link rel="icon" type="image/png" sizes="16x16" href="assets/brand/favicon-16.png">'
     '<link rel="apple-touch-icon" href="assets/brand/apple-touch-icon.png">',
     "favicon → 공식 연꽃 자산")

# ───────────────────────────────────────────────────────────────── 5) 이미지
IMAGES = json.load(io.open(ROOT + "/tools/images.json", encoding="utf-8"))
for local, remote in IMAGES:
    esc = remote.replace("&", "&amp;")
    n = s.count('src="%s"' % esc)
    assert n == 1, "이미지 %s: 1건 예상, %d건" % (local, n)
    s = s.replace('src="%s"' % esc, 'src="assets/images/%s"' % local)
note("교체", "이미지 원격 → 로컬", "%d건" % len(IMAGES))

# ─────────────────────────────────────────────────── 6) 섹션에 앵커 id 붙이기
# 한 장짜리 랜딩이라, /page/* 로 나가던 메뉴를 같은 페이지 섹션으로 되돌린다.
ANCHORS = [
    ("n_mtbgdrc0_1x", "about"),    # WHY 논담 — 서비스 소개
    ("n_mtbgdrc0_3a", "safety"),   # AI MODERATION — 안전·프라이버시
    ("n_mtbgdrc0_40", "how"),      # HOW IT WORKS — 이용 방법
    ("n_mtbgdrc1_52", "adopt"),    # WHO IT'S FOR — 도입 안내
    ("n_mtbgdrc1_73", "contact"),  # CONTACT — 기관·단체 이용 신청 폼
]
for node, anchor in ANCHORS:
    m = re.search(r'<section (data-zs-scope="[^"]+")([^>]*data-node-id="%s")' % node, s)
    assert m, "앵커 대상 섹션 %s 을 찾지 못했다" % node
    s = s[:m.start()] + '<section id="%s" %s%s' % (anchor, m.group(1), m.group(2)) + s[m.end():]
note("추가", "섹션 앵커 id", "%d건" % len(ANCHORS))

# ───────────────────────────────────────────────────────────────── 7) 링크
# 플랫폼 주소가 정해지기 전이라 기본 목적지는 안내 페이지다.
# assets/js/config.js 의 값 하나만 채우면 site.js 가 실제 주소로 바꿔 준다.
PLATFORM = 'href="platform.html" data-fplay-link="platform"'
GUIDE = 'href="guide.html" data-fplay-link="guide"'
LINKS = [
    # (원래 href, 링크 글자, 바꿀 속성, 건수)
    ("/login", "로그인", PLATFORM, 3),
    ("/sign-up", "무료로 시작", PLATFORM, 1),
    ("/sign-up", "회원가입", PLATFORM, 1),
    ("/sign-up", "튜토리얼 시작", GUIDE, 1),
    ("/page/about", "서비스 소개", 'href="#about"', 2),
    ("/page/how", "이용 방법", 'href="#how"', 2),
    ("/page/safety", "안전·프라이버시", 'href="#safety"', 2),
    ("/page/pricing", "도입 안내", 'href="#adopt"', 2),
    ("/page/contact", "도입 문의", 'href="#contact"', 2),
    ("/privacy", "개인정보처리방침", 'href="privacy.html"', 1),
    ("/terms", "이용약관", 'href="terms.html"', 1),
    # 로그인해야 열리는 서비스 화면들 — 모바일 메뉴에만 보인다.
    ("/page/topics", "논제와 자료", PLATFORM, 1),
    ("/page/debate", "토론방", PLATFORM, 1),
    ("/page/essay", "논술 제출", PLATFORM, 1),
    ("/page/study", "학습 홈", PLATFORM, 1),
    ("/page/teacher", "교사 진행 안내", PLATFORM, 1),
    ("/page/report", "토론 리포트", PLATFORM, 1),
    ("/page/issues", "쟁점 보드", PLATFORM, 1),
    ("/page/my-study", "내 학습 기록", PLATFORM, 1),
]
total = 0
for href, label, new_attr, count in LINKS:
    pat = re.compile(r'href="%s"([^>]*)>%s</a>' % (re.escape(href), re.escape(label)))
    hits = pat.findall(s)
    assert len(hits) == count, "링크 %s(%s): %d건 예상, %d건" % (href, label, count, len(hits))
    s = pat.sub(lambda mm: "%s%s>%s</a>" % (new_attr, mm.group(1), label), s)
    total += count
note("교체", "메뉴·푸터 링크", "%d건" % total)

# 로고(맨 앞 <a href="/">)
swap('<a class="nd-logo" href="/"', '<a class="nd-logo" href="index.html"', "로고 링크")
# 동의문 안의 빈 링크 href="#"
swap('<a href="#" data-zs-role="link" data-zs-typo="caption"',
     '<a href="privacy.html" target="_blank" rel="noopener" data-zs-role="link" data-zs-typo="caption"',
     "동의문의 빈 링크 → 개인정보처리방침")

# ──────────────────────────────────────────── 8) 브랜드 — 연꽃 심벌과 서비스명
#
# 공식 결정: 청화당 · NONDAM : F-Play · F-Play by 청화당 이 같은 연꽃 심벌을 쓴다.
# 랜딩페이지의 공식 서비스명은 정확히 "NONDAM : F-Play" 다.
#
# 임시로 쓰던 論 글자를 공식 심벌 이미지로 바꾼다. 심벌은 서비스명 왼쪽에 두고,
# 크기(헤더 30px · 푸터 28px)는 건드리지 않아 헤더 높이와 정렬이 그대로다.
LOGO_ALT = "연꽃 심벌"

swap('<span class="nd-logo__mark" aria-hidden="true" data-node-id="n_mtbgdrc0_m">論</span>'
     '<span class="nd-logo__text" data-node-id="n_mtbgdrc0_n">논담'
     '<em data-node-id="n_mtbgdrc0_p">NONDAM</em></span>',
     '<img class="nd-logo__mark" src="assets/brand/icon-192.png" alt="%s" '
     'width="192" height="192" data-node-id="n_mtbgdrc0_m">'
     '<span class="nd-logo__text" data-node-id="n_mtbgdrc0_n">%s</span>'
     % (LOGO_ALT, SERVICE_NAME),
     "헤더 브랜드 → 연꽃 + 서비스명")

# 푸터 CSS 는 `.nd-flogo span` 처럼 태그 이름으로 잡는다. span 을 없애면 규칙이
# 빗나가므로 span 은 그대로 두고 그 안에 이미지를 넣는다.
swap('<span aria-hidden="true" data-node-id="n_mtbgdrc1_8j">論</span>논담 '
     '<em data-node-id="n_mtbgdrc1_8l">NONDAM</em>',
     '<span data-node-id="n_mtbgdrc1_8j">'
     '<img src="assets/brand/icon-192.png" alt="%s" width="192" height="192">'
     '</span>%s' % (LOGO_ALT, SERVICE_NAME),
     "푸터 브랜드 → 연꽃 + 서비스명")

# 심벌 뒤에 있던 파란 사각형을 없앤다. 글자를 넣으려고 둔 상자였고,
# 연꽃은 투명 배경이라 상자가 있으면 파란 판 위에 얹힌 꼴이 된다.
# 상자 크기(30px·28px)는 그대로 두어 헤더 높이·모바일 정렬이 흔들리지 않는다.
swap("border-radius:9px;background:#3B5BDB;color:#fff;font-size:15px;font-weight:700;",
     "object-fit:contain;font-size:15px;font-weight:700;",
     "헤더 심벌 뒤 파란 사각형 제거", 2)
swap("border-radius:9px;background:#3B5BDB;display:flex;align-items:center;"
     "justify-content:center;font-size:14px",
     "display:flex;align-items:center;justify-content:center;font-size:14px",
     "푸터 심벌 뒤 파란 사각형 제거", 2)

# ─────────────────────────────────────── 9) CTA — 튜토리얼 시작으로 통일
#
# '무료로 시작'·'회원가입' 은 가입 절차가 따로 없는 지금 구조와 맞지 않는다.
# 행동 유도 버튼은 모두 '튜토리얼 시작'(guideUrl) 으로 모으고,
# 플랫폼(platformUrl) 으로 가는 것은 '로그인' 뿐이다.
swap('<a class="nd-btn nd-btn--dark" href="platform.html" data-fplay-link="platform" '
     'data-node-id="n_mtbgdrc0_y">무료로 시작</a>',
     '<a class="nd-btn nd-btn--dark" href="guide.html" data-fplay-link="guide" '
     'data-node-id="n_mtbgdrc0_y">튜토리얼 시작</a>',
     "헤더 CTA: 무료로 시작 → 튜토리얼 시작")
swap('<a href="platform.html" data-fplay-link="platform" '
     'data-node-id="n_mtbgdrc2_93">회원가입</a>',
     '<a href="guide.html" data-fplay-link="guide" '
     'data-node-id="n_mtbgdrc2_93">튜토리얼 시작</a>',
     "푸터: 회원가입 → 튜토리얼 시작")

# ────────────────────────────────────────────────── 10) FAQ — 펼치는 목록으로
#
# 원래는 질문만 적힌 카드 여섯 장이었다. 눌러도 아무 일이 없었다.
# 질문을 버튼으로 바꾸고, 그 자리에서 짧은 답이 펼쳐지게 한다.
# 더 긴 답은 가이드 페이지의 같은 질문으로 보낸다.
#
# 질문과 답은 site/assets/js/faq-data.js 한 곳에서만 온다. 여기에 글을 적지 않는다.
# 답을 빌드할 때 HTML 로 넣어 두는 이유는, 자바스크립트가 막혀도 질문과 답과
# 이동 경로가 그대로 보이게 하기 위해서다. 자바스크립트는 접고 펴는 일만 한다.
FAQ = load_faq(ROOT + "/site/assets/js/faq-data.js")
landing_faq = [x for x in FAQ if x.get("onLanding")]
assert len(landing_faq) == 6, "랜딩 FAQ 6개 예상, %d개" % len(landing_faq)

faq_lis = re.findall(r'<li class="zs-rn2texfagd-(?:7|10|13|16|19|22)"[^>]*>.*?</li>', s, re.S)
assert len(faq_lis) == 6, "FAQ 카드 6장 예상, %d장" % len(faq_lis)

for li, item in zip(faq_lis, landing_faq):
    q = re.search(r'<p class="zs-rn2texfagd-\d+"[^>]*>(.*?)</p>', li, re.S).group(1)
    assert q == item["question"], "카드 순서가 데이터와 어긋난다: %r vs %r" % (q, item["question"])
    inner = li[li.index(">") + 1: li.rindex("</li>")]
    open_tag = li[: li.index(">") + 1].replace('class="', 'class="fp-faq__item ', 1)
    new_li = (
        open_tag
        + '<button type="button" class="fp-faq__q" id="faq-q-%s" '
          'aria-expanded="true" aria-controls="faq-panel-%s">%s</button>'
          % (item["id"], item["id"], inner)
        + '<div class="fp-faq__a" id="faq-panel-%s" role="region" aria-labelledby="faq-q-%s">'
          '<p>%s</p>'
          '<a class="fp-faq__more" href="guide.html#faq-%s">자세히 알아보기</a>'
          '</div>' % (item["id"], item["id"], html_escape(item["shortAnswer"]), item["id"])
        + "</li>"
    )
    s = s.replace(li, new_li)
note("교체", "FAQ 카드 → 펼치는 목록", "%d장" % len(faq_lis))

# ──────────────────────────────────────────────────────────────── 11) 문의 폼
swap('action="#" method="post" novalidate=""',
     'action="#" method="post" novalidate="" data-fplay-form="contact"',
     "문의 폼에 처리 표식 추가")

# ────────────────────────────────────────────────────── 11) 로컬 스크립트 연결
swap("</body>",
     '<script src="assets/js/config.js"></script>\n'
     '<script src="assets/js/faq-data.js"></script>\n'
     '<script src="assets/js/site.js"></script>\n</body>',
     "로컬 스크립트 연결")

# ──────────────────────────────────────────────── 12) 원본 CSS 주석의 빌더 표기
# 렌더에는 영향이 없는 주석이지만, 배포본에 빌더 이름을 남길 이유가 없다.
swap("/* zaemit-render.css — 렌더 계약 정적 스냅샷",
     "/* 렌더 계약 정적 스냅샷", "렌더 CSS 주석의 빌더 표기", 2)
swap("/* zaemit-editor.css — 에디터가 생성하는 공통 스타일의 단일 소스",
     "/* 공통 스타일의 단일 소스", "에디터 CSS 주석의 빌더 표기", 1)

io.open(OUT, "w", encoding="utf-8", newline="").write(s)
print("\n".join(log))
print("-" * 62)
print("원본 %d자 → 결과 %d자 (%+d)" % (orig_len, len(s), len(s) - orig_len))
