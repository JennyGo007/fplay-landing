# 논담 홈페이지 · 관리자 편집

소개 홈페이지 디자인을 유지하면서 관리자 전용 Google 로그인과 편집 기능을 추가했습니다.

- 방문자는 가입 없이 홈페이지·가이드·공지·정책을 봅니다.
- 관리자는 `/admin`에서 초안을 저장하고 미리본 뒤 공개합니다.
- 영상은 HTML에 직접 포함되어 자바스크립트가 꺼져도 표시됩니다.
- 영상·포스터 업로드, FAQ·소개 문구·공지·정책·연락처 편집, 게시 이력 복원을 지원합니다.
- 운영 데이터와 미디어는 저장소 밖의 영구 `DATA_DIR`에 보관합니다.

**시작:** `npm ci` → `.env.local` 설정 → `npm run dev`.
기존 8099 미리보기 서버와 동시에 실행하지 않습니다.

**필수 운영 설정과 보안·백업 안내:** [docs/ADMIN.md](docs/ADMIN.md).

아래는 기존 정적 묶음의 제작 기록입니다. `site/`만 정적 호스팅하면 관리자 기능은 동작하지 않습니다.

---

# 논담(NONDAM : F-Play) 랜딩페이지 — 독립 배포용 정적 묶음

웹빌더(Jaemit / zaemit.ai)에서 내보낸 HTML 한 장을, 빌더 서버 없이도 그대로 도는
정적 페이지 묶음으로 바꾼 것이다. 플랫폼 저장소(`C:\DataAnalysis\debate-platform`)와
분리된 폴더이며, git 저장소가 아니다.

## 폴더

```
_source/    원본 보존. 읽기만 한다.
              index-original.html   내려받은 파일 그대로(바이트 동일)
              SOURCE.txt            원본 경로·크기·시각·sha256
site/       ← 이것만 배포하면 된다
tools/      원본에서 site/ 를 만들어 내는 스크립트와 검사기
_vendor/    비교용으로 받아 둔 빌더 원본 파일 2개. 배포에 들어가지 않는다.
```

## 배포

`site/` 폴더 전체를 그대로 올린다. 빌드 과정도, 서버 코드도, 외부 CDN 도 필요 없다.
정적 호스팅이면 어디든 된다.

로컬에서 그대로 확인하려면:

```
cd site
python -m http.server 8123
```

## 주소 설정 — 고칠 곳은 한 파일뿐이다

`site/assets/js/config.js` 의 세 줄이 전부다.

```js
window.FPLAY_CONFIG = {
  platformUrl: "",   // F-Play 플랫폼 시작 화면
  guideUrl: "",      // F-Play 사용법(튜토리얼)
  contactEmail: "contact@fplayground.com",
};
```

비어 있으면 링크는 각각 `platform.html` · `guide.html` 안내 페이지로 간다.
주소를 채우면 그 순간부터 실제 주소로 간다. 다시 빌드할 필요가 없다.

배포 도메인이 정해지면 `site/index.html` 의 `<head>` 주석 두 곳(`canonical`, `og:url`)도
함께 열어 주면 된다.

## 링크가 어디로 가는가

| 링크 | 목적지 |
|---|---|
| 로고 | `index.html` |
| 서비스 소개 / 이용 방법 / 안전·프라이버시 / 도입 안내 / 도입 문의 | 같은 페이지 안 `#about` `#how` `#safety` `#adopt` `#contact` |
| 로그인 · 무료로 시작 · 회원가입 | `platformUrl` (미설정 시 `platform.html`) |
| 튜토리얼 시작 | `guideUrl` (미설정 시 `guide.html`) |
| 모바일 메뉴의 서비스 화면 8개 | `platformUrl` — 모두 로그인 뒤에 쓰는 화면이다 |
| 개인정보처리방침 | `privacy.html` |
| 이용약관 | `terms.html` |
| 문의 폼 보내기 | `contactEmail` 로 메일 앱을 연다 |

`이용 방법`(`#how`)과 `튜토리얼 시작`(사용법 페이지)은 서로 다른 것이다.
앞은 랜딩페이지 안의 소개 섹션이고, 뒤는 플랫폼 사용법 문서다.

## 다시 만들기

원본을 손대지 않고 `site/index.html` 과 안내 페이지를 다시 생성한다.

```
python tools/pages.py     # platform / guide / privacy / terms
python tools/build.py     # index.html
python tools/check.py     # 배포 전 검사 (실패하면 종료 코드 1)
```

`build.py` 는 바꾸는 자리마다 건수를 `assert` 로 확인한다.
원본이 달라지면 조용히 넘어가지 않고 그 자리에서 멈춘다.

## 아직 하지 않은 것

- 배포, DNS 변경
- `privacy.html` · `terms.html` 의 법률 검토 (두 페이지에 초안 표시가 있다)
- 문의 폼의 서버 접수 (지금은 메일 앱을 연다)
