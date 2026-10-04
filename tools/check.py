# -*- coding: utf-8 -*-
"""
배포 전 검사 — 통과/실패를 한 줄씩 찍는다. 하나라도 실패하면 종료 코드가 1이다.

  1. Jaemit(zaemit) URL·스크립트가 남았는가
  2. 외부 호스트에서 받아오는 것이 있는가
  3. 로컬 자원(이미지·폰트·CSS·JS)이 실제로 있는가
  4. 링크가 깨지지 않는가 (파일 · 같은 페이지 앵커)
  5. 이미지·폰트 파일이 실제 파일인가
  6. 공식 연꽃 브랜드가 제대로 붙었는가
  7. CTA 와 메타데이터가 계약대로인가
  8. 브랜드 교체분 말고는 원본 문구·구조가 그대로인가
"""
import io, os, re, sys, html, json

# 콘솔이 cp949 면 — 같은 문자에서 출력이 터졌다. 검사가 할 말이 생겼을 때
# 하필 죽는 셈이라, 읽을 수 있는 형태로 바꿔 써서라도 보고하게 한다.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = "C:/DataAnalysis/fplay-landing"
SITE = ROOT + "/site"
SRC = ROOT + "/_source/index-original.html"
BRAND_DIR = SITE + "/assets/brand"
# 새 공식 원형 연꽃 자산. 이전 자산은 nondam-lotus/ 에 그대로 남겨 두었다.
BRAND_ORIG = "C:/DataAnalysis/brand-assets/nondam-lotus-tile/derived"
BRAND_PREV = "C:/DataAnalysis/brand-assets/nondam-lotus/original"
SITE_URL = "https://fplayground.com/"

fails = []
oks = 0


def check(label, ok, detail=""):
    global oks
    if ok:
        oks += 1
        print("  PASS  " + label)
    else:
        fails.append(label + (" — " + detail if detail else ""))
        print("  FAIL  " + label + (" — " + detail if detail else ""))


def walk(d):
    out = []
    for base, _dirs, files in os.walk(d):
        for f in files:
            out.append(os.path.join(base, f).replace("\\", "/"))
    return sorted(out)


ALL = walk(SITE)
TEXT = [p for p in ALL if os.path.splitext(p)[1].lower() in (".html", ".css", ".js", ".svg", ".json", ".txt")]
HTML = [p for p in ALL if p.lower().endswith(".html")]


def read(p):
    return io.open(p, encoding="utf-8").read()


def code_only(src):
    """주석을 걷어낸 실제 코드. 주석은 브라우저가 실행하지도, 받아오지도 않는다."""
    src = re.sub(r"<!--.*?-->", " ", src, flags=re.S)
    src = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    src = re.sub(r"(?m)^\s*//.*$", " ", src)
    return src


def no_scripts(src):
    """<script> 안쪽을 뺀다. 문자열 이어붙이기를 링크로 오해하지 않기 위해서다."""
    return re.sub(r"<script[^>]*>.*?</script>", " ", src, flags=re.S)


rel = lambda p: p[len(SITE) + 1:]
idx = read(SITE + "/index.html")

# ───────────────────────────────────────────────────────── 1) Jaemit 흔적
print("\n[1] Jaemit 흔적")
PAT = re.compile(r"zaemit|jaemit|weven_service|wv1787032945235648|site-mirror|WV_CANVAS|WEB_ROOT", re.I)
hits = []
for p in TEXT:
    for m in PAT.finditer(code_only(read(p))):
        hits.append("%s: %s" % (rel(p), m.group(0)))
check("실행 코드에 남은 URL·스크립트·전역변수 0건", not hits, "; ".join(hits[:6]))
n_all = sum(len(PAT.findall(read(p))) for p in TEXT)
print("  참고  주석에만 남은 이름 언급 %d건 (브라우저가 읽지도 실행하지도 않는다)" % (n_all - len(hits)))
print("  참고  zs-* 클래스 이름 %d건은 원본 디자인 계약이라 유지"
      % sum(len(re.findall(r"\bzs-[a-z0-9-]+", read(p))) for p in HTML))

# ────────────────────────────────────────────────────── 2) 외부 호스트 의존
print("\n[2] 외부 호스트 의존")
# canonical 과 og:url 은 '이 페이지의 주소' 를 알리는 선언이다. 받아오는 자원이 아니다.
DECLARE = re.compile(r'<link[^>]*rel="canonical"[^>]*>|<meta[^>]*property="og:url"[^>]*>')
ext = []
for p in TEXT:
    body = DECLARE.sub(" ", code_only(read(p)))
    for m in re.finditer(r'(?:src|href|action)\s*=\s*["\'](https?:)?//([^"\'/]+)', body):
        ext.append("%s: %s" % (rel(p), m.group(2)))
    for m in re.finditer(r'(?:@import\s+)?url\(["\']?(https?:)?//([^)"\']+)', body):
        ext.append("%s: url() %s" % (rel(p), m.group(2)))
# 유튜브 주소는 예외다. 영상은 우리 파일로 재생하므로 페이지를 여는 것만으로는
# 밖으로 요청이 나가지 않는다. 이 주소는 ‘유튜브에서 보기’ 보조 링크에 들어가는 값이고,
# 방문자가 **눌렀을 때만** 나간다. 불러오는 자원이 아니다.
# 영상을 서버가 미리 그려 넣도록 바꾸면서 같은 링크가 guide.html 에도 생겼다.
# guide.js 는 설정으로 영상을 붙일 때 쓰는 대비 경로다. 둘 다 <a> 다.
YT_OK = {"assets/js/guide.js: www.youtube.com", "guide.html: www.youtube.com"}
yt = [x for x in ext if x in YT_OK]
ext = [x for x in ext if x not in YT_OK]
check("페이지를 여는 것만으로 받아오는 외부 자원 0건", not ext, "; ".join(ext[:6]))
# 몇 곳인지 세는 것보다 '불러오지 않는다'를 직접 보는 편이 낫다.
# iframe·script·img 로 들어가는 순간 그건 실제로 나가는 요청이다.
embeds = [rel(p) for p in HTML
          if re.search(r"<(?:iframe|script|img)[^>]*youtu", read(p), re.I)]
check("유튜브는 눌러야 나가는 보조 링크뿐이다 (embed 0건)",
      len(yt) == len(YT_OK) and not embeds,
      "링크 %d건; embed %s" % (len(yt), embeds or "없음"))
print("  참고  SVG 네임스페이스 %d건은 네트워크 요청이 아니다"
      % sum(read(p).count("http://www.w3.org/2000/svg") for p in TEXT))

# ─────────────────────────────────────────────────────── 3) 로컬 자원 존재
print("\n[3] 로컬 자원 존재")
missing = []
for p in HTML:
    src = no_scripts(read(p))
    for m in re.finditer(r'(?:src|href)\s*=\s*"(?!https?:|//|mailto:|#|data:)([^"]+)"', src):
        t = m.group(1).split("#")[0].split("?")[0]
        if not t:
            continue
        f = os.path.normpath(os.path.join(os.path.dirname(p), t)).replace("\\", "/")
        if not os.path.isfile(f):
            missing.append("%s → %s" % (rel(p), t))
for css in [p for p in ALL if p.endswith(".css")]:
    for m in re.finditer(r'url\(["\']?(?!https?:|//|data:)([^)"\']+)', read(css)):
        f = os.path.normpath(os.path.join(os.path.dirname(css), m.group(1))).replace("\\", "/")
        if not os.path.isfile(f):
            missing.append("%s → %s" % (rel(css), m.group(1)))
check("참조하는 로컬 파일이 모두 있다", not missing, "; ".join(missing[:6]))

# ─────────────────────────────────────────────────────────────── 4) 링크
print("\n[4] 링크")
empty, badanchor = [], []
for p in HTML:
    src = no_scripts(read(p))
    ids = set(re.findall(r'\bid="([^"]+)"', read(p)))
    for m in re.finditer(r'<a\b[^>]*href="([^"]*)"', src):
        h = m.group(1)
        if h in ("", "#"):
            empty.append('%s: href="%s"' % (rel(p), h))
        elif h.startswith("#") and h[1:] not in ids:
            badanchor.append("%s: %s" % (rel(p), h))
        elif "#" in h and not h.startswith(("http", "mailto:")):
            f, frag = h.split("#", 1)
            tgt = os.path.normpath(os.path.join(os.path.dirname(p), f)).replace("\\", "/")
            if os.path.isfile(tgt) and frag not in set(re.findall(r'\bid="([^"]+)"', read(tgt))):
                badanchor.append("%s: %s" % (rel(p), h))
check('빈 링크(href="" 또는 "#") 0건', not empty, "; ".join(empty[:6]))
check("가리키는 앵커가 실제로 있다", not badanchor, "; ".join(badanchor[:6]))
n_src = len(re.findall(r"<a\b[^>]*href=", read(SRC)))
n_out = len(re.findall(r"<a\b[^>]*href=", idx))
# 자주 묻는 질문 여섯 곳에 '자세히 알아보기' 가 하나씩 붙었다. 그 밖에는 늘지 않는다.
check("링크가 원본 %d개 + 자세히 알아보기 6개다" % n_src, n_out == n_src + 6,
      "원본 %d / 결과 %d" % (n_src, n_out))

# ────────────────────────────────────────────────────── 5) 이미지·폰트 파일
print("\n[5] 이미지·폰트 파일")
MAGIC = {b"\xff\xd8\xff": "JPEG", b"\x89PNG": "PNG", b"GIF8": "GIF", b"<svg": "SVG", b"\x00\x00\x01\x00": "ICO"}
bad = []
imgs = [p for p in ALL if "/assets/images/" in p or "/assets/brand/" in p]
for p in imgs:
    head = open(p, "rb").read(8)
    kind = next((v for k, v in MAGIC.items() if head.startswith(k)), None)
    if kind is None or os.path.getsize(p) < 400:
        bad.append("%s (%d bytes)" % (rel(p), os.path.getsize(p)))
check("이미지 %d개가 모두 정상 파일" % len(imgs), not bad, "; ".join(bad))
used = set()
for p in HTML + [q for q in ALL if q.endswith(".css")]:
    used |= set(re.findall(r"assets/(?:images|brand)/([^\"')\s]+)", read(p)))
have = set(os.path.basename(p) for p in imgs)
check("쓰는 이미지가 모두 파일로 있다", not (used - have), ", ".join(sorted(used - have)))
if have - used:
    print("  참고  참조되지 않는 파일: %s" % ", ".join(sorted(have - used)))
font = SITE + "/assets/fonts/PretendardVariable.woff2"
check("폰트 파일이 있다", os.path.isfile(font) and os.path.getsize(font) > 100000)
check("폰트 라이선스 원문이 함께 있다", os.path.isfile(SITE + "/assets/fonts/PretendardVariable-OFL.txt"))

# ───────────────────────────────────────────────────── 6) 공식 연꽃 브랜드
print("\n[6] 공식 연꽃 브랜드")
NEED = ["favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "icon-192.png"]
miss = [n for n in NEED if not os.path.isfile(BRAND_DIR + "/" + n)]
check("공식 로고 파일 %d개가 모두 있다" % len(NEED), not miss, ", ".join(miss))

diff = [n for n in NEED
        if not os.path.isfile(BRAND_ORIG + "/" + n)
        or open(BRAND_ORIG + "/" + n, "rb").read() != open(BRAND_DIR + "/" + n, "rb").read()]
check("복사본이 공식 원본과 바이트 단위로 같다(재압축·크롭 없음)", not diff, ", ".join(diff))

# 이전 연꽃 자산이 남아 있으면 안 된다. 파일 이름이 같으므로 내용으로 가린다.
stale = [n for n in NEED
         if os.path.isfile(BRAND_PREV + "/" + n)
         and open(BRAND_PREV + "/" + n, "rb").read() == open(BRAND_DIR + "/" + n, "rb").read()]
check("이전 연꽃 자산 참조 0건", not stale, ", ".join(stale))


def png_alpha(path):
    """PNG 가 투명을 담고 있는지 — 색 방식이 알파 포함이거나 팔레트 tRNS 가 있으면 참."""
    raw = open(path, "rb").read()
    pos, ctype, trns = 8, None, False
    while pos + 8 <= len(raw):
        ln = int.from_bytes(raw[pos:pos + 4], "big")
        typ = raw[pos + 4:pos + 8]
        if typ == b"IHDR":
            ctype = raw[pos + 17]
        elif typ == b"tRNS":
            trns = True
        elif typ == b"IEND":
            break
        pos += 12 + ln
    return (ctype in (4, 6) or trns), ctype


opaque = []
for n in [x for x in NEED if x.endswith(".png")]:
    ok, ct = png_alpha(BRAND_DIR + "/" + n)
    if not ok:
        opaque.append("%s(color=%s)" % (n, ct))
check("로고 PNG 가 투명 배경을 유지한다", not opaque, ", ".join(opaque))

check("임시 論 파비콘 0건",
      not os.path.exists(SITE + "/assets/images/favicon.svg") and "favicon.svg" not in idx,
      "favicon.svg 가 남아 있다")
check("본문에 論 글자 0건", "論" not in idx, "論 이 남아 있다")

head = idx[idx.index('class="nd-logo"'):][:520]
check("헤더: 연꽃 심벌이 서비스명 왼쪽에 온다",
      "assets/brand/icon-192.png" in head
      and head.index("assets/brand/icon-192.png") < head.index("NONDAM : F-Play"))
foot = idx[idx.index('class="nd-flogo"'):][:420]
check("푸터: 연꽃 심벌이 서비스명 왼쪽에 온다",
      "assets/brand/icon-192.png" in foot
      and foot.index("assets/brand/icon-192.png") < foot.index("NONDAM : F-Play"))
check("로고 이미지에 대체 텍스트가 있다", idx.count('alt="연꽃 심벌"') == 2,
      "%d건" % idx.count('alt="연꽃 심벌"'))
check("심벌 뒤 배경 사각형이 없다", "background:#3B5BDB" not in idx, "파란 사각형 규칙이 남아 있다")
check("심벌 상자 크기가 원본 그대로다(헤더 30px · 푸터 28px)",
      "width:30px;height:30px" in idx and "width:28px;height:28px" in idx)
check("PC·모바일이 같은 마크업 하나를 쓴다(심벌 이미지 2개뿐)",
      idx.count("assets/brand/icon-192.png") == 2,
      "%d건" % idx.count("assets/brand/icon-192.png"))
check("브랜드 링크가 랜딩 첫 화면으로 간다", '<a class="nd-logo" href="index.html"' in idx)
sub = [p for p in HTML if not p.endswith("index.html")]
check("안내·약관 페이지도 같은 공식 파비콘을 쓴다",
      all("assets/brand/favicon.ico" in read(p) for p in sub))

# ────────────────────────────────────────────────────── 7) CTA·메타데이터
print("\n[7] CTA·메타데이터")
check("'무료로 시작' 0건", "무료로 시작" not in idx)
check("'회원가입' 0건", "회원가입" not in idx)
tut = re.findall(r"<a[^>]*>튜토리얼</a>", idx)
check("'튜토리얼' CTA %d건이 모두 guide 로 간다" % len(tut),
      len(tut) >= 2 and all('data-fplay-link="guide"' in t for t in tut))
lin = re.findall(r"<a[^>]*>로그인</a>", idx)
check("'로그인' %d건이 모두 platform 으로 간다" % len(lin),
      len(lin) >= 1 and all('data-fplay-link="platform"' in t for t in lin))
check("platform 으로 가는 것은 로그인과 서비스 화면 링크뿐이다",
      idx.count('data-fplay-link="platform"') == len(lin) + 8,
      "platform %d건 / 로그인 %d건" % (idx.count('data-fplay-link="platform"'), len(lin)))
check("canonical 이 주석이 아니라 실제 값이다",
      '<link rel="canonical" href="%s">' % SITE_URL in idx)
check("og:url 이 주석이 아니라 실제 값이다",
      '<meta property="og:url" content="%s">' % SITE_URL in idx)
check("서비스명이 정확히 'NONDAM : F-Play' 다",
      "NONDAM : F-Play" in idx and "F-Play by 청화당" not in idx)

# ────────────────────────────────────────────── 8) 브랜드 교체분 외 원본 보존
print("\n[8] 브랜드 교체분 외 원본 보존")


def visible(doc):
    """스크립트·스타일·주석을 걷어낸 뒤 남는 글자를 그대로 뽑는다."""
    b = doc[doc.index("<body"):]
    b = re.sub(r"<script\b[^>]*>.*?</script>", "", b, flags=re.S)
    b = re.sub(r"<style\b[^>]*>.*?</style>", "", b, flags=re.S)
    b = re.sub(r"<!--.*?-->", "", b, flags=re.S)
    parts = [html.unescape(t) for t in re.split(r"<[^>]+>", b)]
    return [t for t in (x.strip("\r") for x in parts) if t.strip()]


# 이번 작업에서 바꾸기로 한 조각만 적는다. 앞에서부터 한 번씩 적용한다.
# 여기 없는 문구가 하나라도 달라지면 아래 비교에서 걸린다.
BRAND_EDITS = [
    ("論", None),                  # 헤더 심벌 → 이미지
    ("논담", "NONDAM : F-Play"),    # 헤더 서비스명
    ("NONDAM", None),              # 헤더 부제
    ("무료로 시작", "튜토리얼"),  # 헤더 CTA
    ("튜토리얼 시작", "튜토리얼"),  # 히어로 CTA — 세 버튼 문구를 짧게 통일(502eca2)
    ("論", None),                  # 푸터 심벌 → 이미지
    ("논담 ", "NONDAM : F-Play"),   # 푸터 서비스명
    ("NONDAM", None),              # 푸터 부제
    ("회원가입", "튜토리얼"),    # 푸터 CTA
    # AI 소개 제목을 두 줄로 나눔. <br> 로 나뉘므로 조각 하나가 둘이 된다.
    # 검사를 느슨하게 푸는 대신, 바뀜 모양을 그대로 적어 그대로인지 계속 본다.
    ("AI는 심판하지 않습니다 토론을 도와줍니다 ",
     ["AI는 심판하지 않습니다", "토론을 도와줍니다"]),
]
want = list(visible(read(SRC)))
for old, new in BRAND_EDITS:
    k = want.index(old)
    if new is None:
        want.pop(k)          # 조각을 없앤다(글자 → 이미지 등)
    elif isinstance(new, list):
        want[k:k + 1] = new  # 조각 하나를 여럿으로 나눈다(<br> 로 줄 나눔)
    else:
        want[k] = new        # 조각을 다른 말로 바꾼다
got = visible(idx)

# 원본 조각이 하나도 빠지지 않고 순서대로 남아 있는지 본다.
# 사라지거나 글자가 달라지면 여기서 걸린다.
it = iter(got)
lost = [t for t in want if not any(u == t for u in it)]
check("원본 문구 %d조각이 순서 그대로 남아 있다" % len(want), not lost,
      "빠진 첫 조각: %r" % (lost[0][:40] if lost else ""))

# 늘어난 조각은 전부 자주 묻는 질문에서 온 것이어야 한다.
FAQ_RAW = read(SITE + "/assets/js/faq-data.js")
FAQ_ITEMS = json.loads(FAQ_RAW[FAQ_RAW.index("["):FAQ_RAW.rindex("]") + 1])
ALLOWED_NEW = set(x["shortAnswer"] for x in FAQ_ITEMS if x.get("onLanding"))
ALLOWED_NEW.add("자세히 알아보기")
left = list(want)
extra = []
for t in got:
    if left and left[0] == t:
        left.pop(0)
    else:
        extra.append(t)
odd = [t for t in extra if t not in ALLOWED_NEW]
check("늘어난 문구 %d조각이 모두 질문 원본에서 왔다" % len(extra), not odd,
      "출처 없는 조각: %r" % (odd[0][:40] if odd else ""))


s_src = read(SRC)
check("<style> 블록 수가 원본과 같다",
      s_src.count("<style") == idx.count("<style"),
      "%d vs %d" % (s_src.count("<style"), idx.count("<style")))
c_src = len(re.findall(chr(92) + 's' + 'class="', s_src))
c_out = len(re.findall(chr(92) + 's' + 'class="', idx))
# 질문 여섯 개마다 버튼·답 영역·링크가 하나씩 생겼다(6 x 3 = 18).
check("class 수가 원본 %d개 + 질문 상자 18개다" % c_src, c_out == c_src + 18,
      "원본 %d / 결과 %d" % (c_src, c_out))
check("<img> 수가 원본 + 브랜드 심벌 2개다",
      idx.count("<img") == s_src.count("<img") + 2,
      "원본 %d / 결과 %d" % (s_src.count("<img"), idx.count("<img")))
check("미디어쿼리 수가 원본과 같다",
      s_src.count("@media") == idx.count("@media"),
      "%d vs %d" % (s_src.count("@media"), idx.count("@media")))

# ────────────────────────────────────────── 9) 가이드 페이지·자주 묻는 질문
print("\n[9] 가이드 페이지와 자주 묻는 질문")

FAQ_SRC = SITE + "/assets/js/faq-data.js"
raw_faq = read(FAQ_SRC)
FAQ = json.loads(raw_faq[raw_faq.index("["):raw_faq.rindex("]") + 1])
landing_faq = [x for x in FAQ if x.get("onLanding")]
guide = read(SITE + "/guide.html")

check("자주 묻는 질문 원본이 한 파일이다", os.path.isfile(FAQ_SRC))
check("질문 %d개 · 랜딩 노출 %d개" % (len(FAQ), len(landing_faq)),
      len(FAQ) >= 12 and len(landing_faq) == 6)
ids = [x["id"] for x in FAQ]
check("질문 id 가 겹치지 않는다", len(set(ids)) == len(ids))
check("모든 질문이 짧은 답과 상세 답을 함께 가진다",
      all(x.get("question") and x.get("shortAnswer") and x.get("fullAnswer") for x in FAQ))

# 명세서가 요구한 12개 질문이 모두 들어 있는지
REQUIRED = ["who-can-use", "individual-teacher", "organization-approval", "teacher-permission",
            "student-account", "student-real-name", "invite-code", "result-download",
            "ai-role", "privacy", "pricing", "support"]
missing_q = [q for q in REQUIRED if q not in ids]
check("요구된 질문 12개가 모두 있다", not missing_q, ", ".join(missing_q))

# 단일 원본 — 답 글이 HTML 소스에 손으로 적혀 있지 않고 데이터에서 온 것인지
dup = []
for x in FAQ:
    if x.get("onLanding") and x["shortAnswer"] not in idx:
        dup.append("랜딩 누락 " + x["id"])
    if x["fullAnswer"].split("\n")[0].strip() not in guide:
        dup.append("가이드 누락 " + x["id"])
check("두 페이지의 글이 모두 원본에서 나왔다", not dup, "; ".join(dup[:4]))
# 랜딩에는 상세 답이 들어가지 않는다(두 벌 관리 방지)
leaked = [x["id"] for x in FAQ if x["fullAnswer"].split("\n")[0].strip() in idx
          and x["fullAnswer"].split("\n")[0].strip() != x["shortAnswer"]]
check("랜딩에 상세 답을 복사해 두지 않았다", not leaked, ", ".join(leaked[:4]))

# 랜딩 아코디언
for x in landing_faq:
    pass
check("랜딩 질문이 버튼이다", idx.count('class="fp-faq__q"') == 6,
      "%d개" % idx.count('class="fp-faq__q"'))
check("랜딩 질문에 aria-expanded·aria-controls 가 있다",
      idx.count('aria-expanded=') >= 6 and idx.count('aria-controls="faq-panel-') == 6)
check("랜딩 답 영역이 질문과 연결돼 있다",
      all(('id="faq-panel-%s"' % x["id"]) in idx and ('aria-labelledby="faq-q-%s"' % x["id"]) in idx
          for x in landing_faq))
bad_more = [x["id"] for x in landing_faq
            if ('href="guide.html#faq-%s"' % x["id"]) not in idx]
check("'자세히 알아보기' 가 정확한 가이드 앵커로 간다", not bad_more, ", ".join(bad_more))
check("'자세히 알아보기' 가 질문 수만큼 있다", idx.count("자세히 알아보기") == 6,
      "%d개" % idx.count("자세히 알아보기"))

# 가이드 앵커가 실제로 존재하는지
no_anchor = [x["id"] for x in FAQ if ('id="faq-%s"' % x["id"]) not in guide]
check("가이드에 질문 %d개의 앵커가 모두 있다" % len(FAQ), not no_anchor, ", ".join(no_anchor[:4]))

# 자바스크립트가 죽어도 보이는지 — 기본 상태가 펼침이어야 한다
check("자바스크립트 없이도 답이 보인다(기본 펼침)",
      'aria-expanded="true"' in idx and "hidden" not in
      idx[idx.index('class="fp-faq__a"'): idx.index('class="fp-faq__a"') + 80],
      "기본이 접힘 상태다")
check("가이드도 기본 펼침이다", guide.count('aria-expanded="true"') == len(FAQ))

# 영상
check("영상 자리가 16:9 를 지킨다", "aspect-ratio: 16 / 9" in read(SITE + "/assets/css/page.css"))
# 주소가 비었는지를 보지 **않는다.** 예전에는 'youtubeUrl: ""' 라는 글자를 찾았고, 그래서
# 영상을 연결하자마자 검사가 실패했다. 영상이 잘못된 게 아니라 검사가 '영상 없음' 을
# 정답으로 박아 둔 것이었다. 상태 대신 **동작**을 본다 — 아래 video-check.mjs 연결 부분.
check("guide.html 에 미리 박아 둔 iframe 이 없다(JS 가 만든다)", "<iframe" not in guide)
_video_cfg = re.search(r'videoUrl:\s*"([^\"]*)"', read(SITE + "/assets/js/config.js"))
if _video_cfg and _video_cfg.group(1):
    check("영상 설정 시 JS 없이도 플레이어가 HTML 에 있다",
          '<video ' in guide and 'data-static-video="true"' in guide
          and 'src="' + _video_cfg.group(1) + '"' in guide
          and "F-Play 튜토리얼 영상을 준비하고 있습니다." not in guide)
else:
    check("영상 미설정 시 준비 중 안내가 보인다",
          "F-Play 튜토리얼 영상을 준비하고 있습니다." in guide and '<video ' not in guide)


# 진단용 장치는 배포물에 들어가지 않는다.
# 재생이 안 되던 원인을 찾을 때 미리보기 서버에 진단 페이지와 보고 수집(POST)을
# 잠시 붙였다. 그것들은 scratchpad 의 도구 안에만 있고 site/ 에는 없다.
# 실수로 흘러들어 오면 방문자 기록을 받는 경로가 공개되므로 여기서 막는다.
_diag_hits = []
for _p in walk(SITE):
    _r = rel(_p)
    if _r.endswith((".html", ".js", ".css", ".json", ".txt")):
        _t = read(_p)
        for _mark in ("__diag", "diag-report", "diag.html", "cachebust"):
            if _mark in _t:
                _diag_hits.append(_r + ":" + _mark)
check("배포물에 진단 페이지·로그 수집 흔적이 없다", not _diag_hits, "; ".join(_diag_hits[:4]))
check("배포물에 서버로 보내는 fetch/XHR 가 없다",
      not any(("fetch(" in read(_p) or "XMLHttpRequest" in read(_p))
              for _p in walk(SITE) if rel(_p).endswith((".js", ".html"))),
      "방문자 동작을 서버로 보내는 코드가 있다")

gjs = read(SITE + "/assets/js/guide.js")
# 주석은 벗어낸다. "autoplay 를 넣지 않는다" 같은 설명 때문에
# "autoplay 가 있다"로 읽히면, 멀쩡한 코드를 검사가 잡는다.
gjs_code = re.sub(r"/\*.*?\*/", " ", gjs, flags=re.S)
gjs_code = re.sub(r"(?m)//.*$", " ", gjs_code)
check("유튜브 주소만 받아들인다(호스트 확인)", "HOSTS" in gjs_code and "youtube.com" in gjs_code)
check("영상 id 모양을 확인한다", "ID_RE" in gjs_code and "{11}" in gjs_code)
check("영상은 우리 파일로 재생한다(iframe 을 아예 만들지 않는다)",
      'createElement("video")' in gjs_code and 'createElement("iframe")' not in gjs_code)
check("묶음 안의 상대경로만 재생한다(바깥 주소·상위 경로 거절)",
      "function localVideo" in gjs_code and 'indexOf("../")' in gjs_code)
check("재생 버튼·전체화면을 주고 자동재생은 하지 않는다",
      "video.controls = true" in gjs_code
      and "autoplay" not in gjs_code and ".muted" not in gjs_code)
check("처음부터 전체를 내려받지 않는다(preload=metadata)",
      'video.preload = "metadata"' in gjs_code)
check("유튜브는 새 창 보조 링크로만 남는다",
      'a.target = "_blank"' in gjs_code and "noopener" in gjs_code
      and "fp-video__aside" in gjs_code)
check("영상 자리에 <video> 스타일이 있다",
      ".fp-video video" in read(SITE + "/assets/css/page.css"))

# 위까지는 소스에 그 낱말이 있는가를 본 것이다. 아래는 guide.js 를 **실제로 돌려**
# 주소가 비었을 때와 있을 때 화면이 어떻게 되는지 두 경우를 모두 본다.
# node 가 필요하고, 없으면 조용히 넘기지 않고 실패로 알린다 —
# 건너뛴 것을 통과로 읽으면 검사가 있나 마나다.
import subprocess
try:
    _p = subprocess.run(["node", ROOT + "/tools/video-check.mjs", "--json"],
                        capture_output=True, text=True, encoding="utf-8", timeout=120)
    _rows = json.loads(_p.stdout) if _p.stdout.strip() else []
except FileNotFoundError:
    _rows = None
    check("영상 동작 검사를 돌렸다", False, "node 를 찾지 못했다")
except Exception as _e:
    _rows = None
    check("영상 동작 검사를 돌렸다", False, str(_e)[:80])
if _rows is not None:
    check("영상 동작 검사가 비어 있지 않다", len(_rows) > 0, "0건")
    for _r in _rows:
        check("[영상] " + _r["label"], _r["ok"], _r.get("detail", ""))

# 튜토리얼 버튼
tut_links = re.findall(r'<a[^>]*data-fplay-link="guide"[^>]*>', idx)
check("'튜토리얼' %d건이 모두 guide.html 로 간다" % len(tut_links),
      len(tut_links) >= 2 and all('href="guide.html"' in t for t in tut_links))
sjs = read(SITE + "/assets/js/site.js")
check("튜토리얼 버튼을 외부 주소로 돌리지 못한다", "function isInside(" in sjs)
check("설정의 guideUrl 이 로컬 guide.html 이다",
      'guideUrl: "guide.html"' in read(SITE + "/assets/js/config.js"))

# 가이드 하단 전환
for label, href in [("F-Play 시작하기", 'data-fplay-link="platform"'),
                    ("기관·단체 이용 신청", 'href="index.html#adopt"'),
                    ("도입 문의", 'href="index.html#contact"'),
                    ("논담 홈페이지로 돌아가기", 'href="index.html"'),
                    ("개인정보처리방침", 'href="privacy.html"'),
                    ("이용약관", 'href="terms.html"')]:
    seg = re.search(r'<a[^>]*>' + re.escape(label) + r'</a>', guide)
    check("가이드 전환: %s" % label, bool(seg) and href in seg.group(0))
# '회원가입' 이라는 낱말은 답변 본문에 나온다("학생은 회원가입을 하지 않습니다").
# 막아야 하는 것은 낱말이 아니라 회원가입으로 보내는 버튼·링크다.
signup_links = re.findall(r"<a[^>]*>[^<]*회원가입[^<]*</a>", guide)
check("가이드에 회원가입 버튼·링크가 없다", not signup_links, "; ".join(signup_links[:2]))
check("시작 버튼이 'F-Play 시작하기' 다", "F-Play 시작하기" in guide)

# 사용자 입력을 HTML 로 넣지 않는다
check("문의 폼 알림이 사용자 입력을 HTML 로 넣지 않는다",
      "status.textContent" in sjs and "+ name +" not in sjs.split("status.innerHTML")[1][:200]
      if "status.innerHTML" in sjs else True)

print("\n" + "=" * 62)
print("통과 %d건 / 실패 %d건" % (oks, len(fails)))
for f in fails:
    print("  - " + f)
sys.exit(1 if fails else 0)
