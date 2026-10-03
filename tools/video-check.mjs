/* 영상 자리 동작 검사 — guide.js 를 **실제로 실행해서** 여러 경우를 본다.
 *
 * 왜 글자 검사로 끝내지 않는가.
 *   전에는 config.js 에 'youtubeUrl: ""' 라는 글자가 있는지만 봤다. 그래서 영상 주소를
 *   채우자마자 검사가 실패했다. 영상이 잘못된 게 아니라 검사가 '영상 없음' 상태를
 *   정답으로 박아 두었던 것이다. 상태를 박아 두는 대신 **동작**을 본다.
 *
 * 지금 설계
 *   재생은 우리 파일로 한다(config.js 의 videoUrl). 유튜브 embed 를 쓰지 않는 이유는
 *   가이드를 여는 것만으로 방문자 기록이 밖으로 나가지 않게 하기 위해서다.
 *   유튜브는 '유튜브에서 보기' 보조 링크로만 남고, 눌렀을 때만 밖으로 나간다.
 *
 * 무엇을 보는가
 *   videoUrl 이 없거나 바깥 주소면 → 준비 중 안내가 남고 플레이어를 만들지 않는다.
 *   videoUrl 이 있으면            → 안내가 치워지고 <video> 하나가 생긴다.
 *                                   재생 버튼·전체화면이 있고(controls), 자동재생은 없다.
 *   youtubeUrl 이 유효하면        → 보조 링크 <a> 가 영상 옆에 붙는다. iframe 은 안 생긴다.
 *
 * guide.js 는 브라우저 코드라 DOM 이 필요하다. 라이브러리를 들이지 않고, guide.js 가
 * 실제로 쓰는 것만 흉내 낸다 — 흉내가 모자라면 거기서 터지므로 조용히 통과할 수 없다.
 *
 * 실행: node tools/video-check.mjs        (단독)
 *       check.py 가 이 파일을 불러 결과를 함께 찍는다.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GUIDE_JS = join(ROOT, "site/assets/js/guide.js");
const GUIDE_HTML = join(ROOT, "site/guide.html");
const CONFIG_JS = join(ROOT, "site/assets/js/config.js");

/* ── guide.js 가 건드리는 만큼만 흉내 낸 DOM ─────────────────────────── */

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this._text = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = ref == null ? this.children.length : this.children.indexOf(ref);
    this.children.splice(i < 0 ? this.children.length : i, 0, c);
    return c;
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }
  set textContent(v) { this._text = String(v); if (v === "") this.children = []; }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  /** 자손 중 이 태그를 전부 모은다. */
  find(tag) {
    const out = [];
    for (const c of this.children) {
      if (c.tagName === tag.toUpperCase()) out.push(c);
      out.push(...c.find(tag));
    }
    return out;
  }
}

/* guide.js 는 요소에 setAttribute 가 아니라 **속성 대입**도 쓴다
 * (video.src = …, a.href = …). 실제 브라우저는 둘을 서로 비추므로 여기서도
 * 양쪽을 다 본다. 한쪽만 보면 코드가 멀쩡한데 검사만 틀린다. */
const attr = (el, name) =>
  el == null ? undefined : el.attrs[name] !== undefined ? el.attrs[name] : el[name];

/** 준비 중 안내가 든 영상 자리를, 보조 링크가 붙을 바깥 상자에 담아 세운다. */
function makePage() {
  const html = readFileSync(GUIDE_HTML, "utf8");
  const at = html.indexOf('id="guideVideo"');
  if (at < 0) throw new Error("guide.html 에 id=guideVideo 가 없다");
  const inner = html.slice(html.indexOf(">", at) + 1, html.indexOf("</div>", at));

  const parent = new El("section");
  const slot = new El("div");
  slot.setAttribute("data-state", "pending");
  const p = new El("p");
  p.textContent = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  slot.appendChild(p);
  parent.appendChild(slot);
  parent.appendChild(new El("h2"));   // 영상 다음에 오는 내용
  return { parent, slot };
}

/** guide.js 를 주어진 설정으로 한 번 돌리고, 영상 자리와 그 부모를 돌려준다. */
function run(videoUrl, youtubeUrl = "", videoPoster = "") {
  const { parent, slot } = makePage();
  const listeners = [];
  const sandbox = {
    window: { FPLAY_CONFIG: { videoUrl, youtubeUrl, videoPoster, guideUrl: "guide.html", contactEmail: "" } },
    document: {
      readyState: "complete",
      addEventListener: (t, fn) => listeners.push(fn),
      getElementById: (id) => (id === "guideVideo" ? slot : null),
      // 아코디언 쪽은 이 검사의 관심 밖이라 빈 목록을 준다.
      querySelectorAll: () => [],
      createElement: (tag) => new El(tag),
    },
    URL,
  };
  const src = readFileSync(GUIDE_JS, "utf8");
  const fn = new Function(...Object.keys(sandbox), src);
  fn(...Object.values(sandbox));
  for (const l of listeners) l();
  return { parent, slot };
}

/* ── 검사 ────────────────────────────────────────────────────────────── */

const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok, detail });

const PENDING_MARK = "F-Play 튜토리얼 영상을 준비하고 있습니다.";
const LOCAL = "assets/video/fplay-tutorial-720p.mp4";
const YT = "https://youtu.be/hLXLIDa3YDQ";
const YT_ID = "hLXLIDa3YDQ";
const POSTER = "assets/images/guide-video-poster.jpg";

/* 경우 1 — 영상 파일이 지정되지 않았다 */
{
  const { parent, slot } = run("", YT);
  check("영상이 없으면 플레이어를 만들지 않는다", slot.find("video").length === 0,
        slot.find("video").length + "개 생성됨");
  check("영상이 없으면 준비 중 안내가 남는다", slot.textContent.includes(PENDING_MARK),
        "안내 문구가 사라졌다");
  check("영상이 없으면 자리 상태가 pending 이다", slot.getAttribute("data-state") === "pending",
        "data-state=" + slot.getAttribute("data-state"));
  check("영상이 없으면 유튜브 보조 링크도 달지 않는다", parent.find("a").length === 0,
        parent.find("a").length + "개");
}

/* 경우 2 — 영상 파일이 있다. 핵심 경우. */
{
  const { slot } = run(LOCAL, "");
  const vs = slot.find("video");
  check("영상이 있으면 <video> 가 하나 생긴다", vs.length === 1, vs.length + "개");
  const v = vs[0];
  check("우리 파일을 그대로 재생한다", attr(v, "src") === LOCAL, String(attr(v, "src")));
  check("재생 버튼·전체화면이 있다(controls)", attr(v, "controls") === true,
        "controls=" + attr(v, "controls"));
  check("**자동재생하지 않는다**", !attr(v, "autoplay") && !attr(v, "muted"),
        "autoplay=" + attr(v, "autoplay") + " muted=" + attr(v, "muted"));
  check("첫 장면만 미리 받는다(preload=metadata)", attr(v, "preload") === "metadata",
        "preload=" + attr(v, "preload"));
  check("모바일에서 전체화면으로 튀지 않는다(playsInline)", attr(v, "playsInline") === true,
        "playsInline=" + attr(v, "playsInline"));
  check("준비 중 안내가 치워진다", !slot.textContent.includes(PENDING_MARK),
        "안내가 영상과 함께 남아 있다");
  check("자리 상태가 ready 로 바뀐다", slot.getAttribute("data-state") === "ready",
        "data-state=" + slot.getAttribute("data-state"));
  check("유튜브 iframe 을 만들지 않는다", slot.find("iframe").length === 0,
        slot.find("iframe").length + "개");
}

/* 경우 3 — 포스터. 없으면 재생 전에 검은 사각형만 보인다.
 * 이 영상은 어두운 타이틀로 시작해서, 포스터가 없으면 "영상이 없다" 로 보이기 쉽다. */
{
  const { slot } = run(LOCAL, "", POSTER);
  const v = slot.find("video")[0];
  check("포스터를 지정하면 재생 전 장면이 걸린다", attr(v, "poster") === POSTER,
        String(attr(v, "poster")));
}
{
  const { slot } = run(LOCAL, "", "");
  const v = slot.find("video")[0];
  check("포스터가 없어도 플레이어는 만들어진다", !!v && !attr(v, "poster"),
        "poster=" + (v && attr(v, "poster")));
}
for (const [why, url] of [
  ["바깥 호스트", "https://evil.example.com/a.jpg"],
  ["상위 디렉터리", "../secret.png"],
  ["절대경로", "/a.jpg"],
  ["그림이 아닌 확장자", "assets/images/a.exe"],
]) {
  const { slot } = run(LOCAL, "", url);
  const v = slot.find("video")[0];
  check("포스터를 거절한다 — " + why, !!v && !attr(v, "poster"),
        "poster=" + (v && attr(v, "poster")));
}

/* 경우 4 — 유튜브는 보조 링크로만 */
{
  const { parent, slot } = run(LOCAL, YT);
  const links = parent.find("a");
  check("유튜브가 보조 링크 하나로 붙는다", links.length === 1, links.length + "개");
  const a = links[0];
  check("보조 링크는 iframe 이 아니라 <a> 다",
        !!a && a.tagName === "A" && parent.find("iframe").length === 0,
        a ? a.tagName : "링크 없음");
  check("보조 링크가 그 영상으로 간다",
        !!a && attr(a, "href") === "https://www.youtube.com/watch?v=" + YT_ID,
        a ? String(attr(a, "href")) : "");
  check("보조 링크는 새 창 + noopener 다",
        !!a && attr(a, "target") === "_blank" && String(attr(a, "rel")).includes("noopener"),
        a ? attr(a, "target") + " / " + attr(a, "rel") : "");
  check("보조 링크가 영상 자리 바깥(형제)에 붙는다", slot.find("a").length === 0,
        "영상 자리 안에 들어갔다");
}

/* 경우 4-1 — 주소에 질의문자열을 붙이지 않는다.
 * 한때 ?v=2 로 판을 구분했는데, 브라우저가 **예전 guide.js 를 캐시에 들고 있으면**
 * 그 코드는 ?v= 를 모르고 거절해서, 영상이 있는데도 '준비 중' 으로 떨어졌다.
 * 판 구분은 파일 **이름**으로 한다. 이름이 바뀌면 옛 코드도 그냥 받아들인다. */
for (const [why, url] of [
  ["판 번호 질의문자열", LOCAL + "?v=2"],
  ["다른 질의문자열", LOCAL + "?evil=1"],
]) {
  const { slot } = run(url, "");
  check("질의문자열이 붙은 주소를 거절한다 — " + why, slot.find("video").length === 0,
        "video " + slot.find("video").length + "개");
}

/* 경우 5 — 거절해야 하는 영상 주소. 남의 서버로 요청이 나가는 길을 막는다. */
for (const [why, url] of [
  ["바깥 호스트", "https://evil.example.com/a.mp4"],
  ["스킴 없는 바깥 주소", "//evil.example.com/a.mp4"],
  ["절대경로", "/etc/passwd.mp4"],
  ["상위 디렉터리 빠져나가기", "../../secret.mp4"],
  ["javascript 스킴", "javascript:alert(1)"],
  ["data 스킴", "data:video/mp4;base64,AAAA"],
  ["영상이 아닌 확장자", "assets/video/x.exe"],
]) {
  const { parent, slot } = run(url, "");
  check("거절한다 — " + why,
        slot.find("video").length === 0 && slot.textContent.includes(PENDING_MARK)
        && parent.find("a").length === 0,
        "video " + slot.find("video").length + "개");
}

/* 경우 6 — 유튜브 주소가 엉뚱하면 보조 링크를 달지 않는다 */
for (const [why, url] of [
  ["유튜브가 아닌 호스트", "https://evil.example.com/watch?v=" + YT_ID],
  ["유튜브를 닮은 호스트", "https://youtube.com.evil.example/watch?v=" + YT_ID],
  ["id 길이가 다르다", "https://youtu.be/tooshort"],
]) {
  const { parent } = run(LOCAL, url);
  check("보조 링크를 달지 않는다 — " + why, parent.find("a").length === 0,
        parent.find("a").length + "개");
}

/* 경우 7 — **지금 config.js 에 적혀 있는 값**. 위는 가상의 주소였고 이것은 실물이다. */
{
  const cfg = readFileSync(CONFIG_JS, "utf8");
  const mv = /videoUrl:\s*"([^"]*)"/.exec(cfg);
  const my = /youtubeUrl:\s*"([^"]*)"/.exec(cfg);
  check("config.js 에서 videoUrl 을 찾는다", mv !== null);
  if (mv) {
    const url = mv[1];
    const mp = /videoPoster:\s*"([^"]*)"/.exec(cfg);
    const { slot } = run(url, my ? my[1] : "", mp ? mp[1] : "");
    const vs = slot.find("video");
    const pending = vs.length === 0 && slot.textContent.includes(PENDING_MARK);
    const ready = vs.length === 1 && !slot.textContent.includes(PENDING_MARK)
      && attr(vs[0], "controls") === true && !attr(vs[0], "autoplay");
    check("지금 설정으로 두 상태 중 하나가 온전히 나온다", pending || ready,
          url === "" ? "빈 값인데 준비 중 안내가 안 나온다"
                     : "주소를 적었는데 플레이어가 안 만들어졌다: " + url);
    if (url !== "") {
      const file = join(ROOT, "site", url.split("?")[0]);
      const there = existsSync(file);
      check("설정한 영상 파일이 실제로 있다", there, url);
      if (there) {
        const bytes = statSync(file).size;
        if (mp && mp[1]) {
          const pf = join(ROOT, "site", mp[1].split("?")[0]);
          check("설정한 포스터 그림이 실제로 있다", existsSync(pf), mp[1]);
        }
        check("영상 파일이 비어 있지 않다", bytes > 0);
        console.error("  (현재 영상: " + url + " · " + (bytes / 1048576).toFixed(1) + " MB)");
      }
    }
  }
}

/* ── 출력 ────────────────────────────────────────────────────────────── */

if (process.argv[2] === "--json") {
  process.stdout.write(JSON.stringify(results));
} else {
  for (const r of results) console.log((r.ok ? "  PASS  " : "  FAIL  ") + r.label
    + (r.ok || !r.detail ? "" : " — " + r.detail));
  const bad = results.filter((r) => !r.ok).length;
  console.log("통과 " + (results.length - bad) + "건 / 실패 " + bad + "건");
}
process.exit(results.some((r) => !r.ok) ? 1 : 0);
