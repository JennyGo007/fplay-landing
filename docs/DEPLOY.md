# 논담 홈페이지 공개 배포

목표 주소는 `https://fplayground.com`, 관리자는 `https://fplayground.com/admin` 이다.
**배포됐다.** 아래 0장이 실제 상태이고, 0-1장이 다시 올릴 때 밟는 절차다.
그 뒤 1~4장은 처음 고를 때 쓴 기준이라 참고로 남겨 둔다.

## 0. 지금 상태 (2026-10-10 실측)

```
호스팅            AWS Lightsail `nondam-homepage` (서울) · 43.200.113.168
                  한 서버에 컨테이너 셋 — nondam(8099) · cheonghwadang(3001) · caddy(80/443)
                  Caddy 가 HTTPS 를 맡고 `nondam:8099` 로 넘긴다. 두 사이트는 분리돼 있다.
fplayground.com   위 IP. http 308 → https 200
저장소            JennyGo007/fplay-landing, master — **서버에도 사본이 있다** `/srv/nondam`
영구 디스크       /srv/nondam-data → 컨테이너의 /data (state.json · media/)
비밀값            /srv/nondam-config/nondam.env (600 root:root). 저장소에 넣지 않는다.
검사              tools/check.py 137건 / npm test 11건
```

## 0-1. 다시 올리기

```bash
# ① 로컬에서 검사하고 올린다
python tools/check.py && npm test && git push origin master

# ② 서버에서 받아 빌드한다 (이전 이미지는 지우지 않는다 — 되돌릴 길)
ssh ubuntu@43.200.113.168
cd /srv/nondam && git fetch origin && git merge --ff-only origin/master
SHA=$(git rev-parse --short HEAD)
sudo docker tag nondam-homepage:latest "nondam-homepage:rollback-$(docker inspect nondam   --format '{{.Config.Image}}' | cut -d: -f2)"
sudo docker build -t "nondam-homepage:$SHA" .

# ③ 교체한다. **운영 데이터(/srv/nondam-data)는 건드리지 않는다.**
sudo cp -a /srv/nondam-data/state.json "/srv/nondam-data-backup/state-$(date -u +%Y%m%dT%H%M%SZ).json"
sudo docker stop nondam && sudo docker rm nondam
sudo docker run -d --name nondam --restart unless-stopped   --network nondam-net --env-file /srv/nondam-config/nondam.env   -v /srv/nondam-data:/data "nondam-homepage:$SHA"
sudo docker tag "nondam-homepage:$SHA" nondam-homepage:latest

# ④ 확인
curl -sI https://fplayground.com | head -1
```

**되돌리기**: `docker stop nondam && docker rm nondam` 뒤 ③의 `run` 을
`nondam-homepage:rollback-<이전SHA>` 로 한 번 더 돌린다. 운영 데이터는 그대로다.

**주의 둘.**
· `docker run` 에 **명령을 덧붙이지 않는다.** 이미지의 CMD 가 `start:container` 이고
  그것이 `0.0.0.0` 에 붙는다. 전에는 run 쪽에서 덮어 썼는데 그 지식이 적혀 있지 않아,
  평범하게 다시 띄운 순간 **502** 가 났다.
· 서버 저장소에서 `sudo git` 을 쓰지 않는다. root 소유 파일이 섞여 다음 `git fetch` 가
  `Permission denied` 로 막힌다(실제로 그랬다). 섞였으면
  `sudo chown -R ubuntu:ubuntu /srv/nondam` 으로 되돌린다.

## 1. 이 앱이 호스팅에 요구하는 것

`docs/ADMIN.md` 가 못박은 전제다. 고르는 기준이 되므로 먼저 적는다.

- **영구 디스크.** 관리자가 쓴 글은 `DATA_DIR/state.json`, 업로드는 `DATA_DIR/media` 에
  **파일로** 저장한다. 디스크가 임시면 재배포·재시작마다 사라진다.
- **단일 인스턴스.** 파일 잠금으로 동시 쓰기를 막는 구조라 여러 개로 늘릴 수 없다.
  늘리려면 데이터베이스·공유 저장소로 먼저 바꿔야 한다.
- **서버리스 불가.** Vercel·Netlify Functions·Cloudflare Workers 처럼 요청마다
  새 디스크를 주는 환경에는 이 방식 그대로 올리면 안 된다.
- Node 22.14 이상, HTTPS 역방향 프록시 뒤에서 운영.

## 2. 옮겨야 할 것

```
코드            저장소 (23 MB, 이 중 영상 18 MB)
영구 디스크     DATA_DIR 전체 — state.json(초안·게시본·게시 이력) + media/
환경변수        NEXTAUTH_URL / NEXTAUTH_SECRET / GOOGLE_CLIENT_ID /
                GOOGLE_CLIENT_SECRET / ADMIN_EMAILS / (선택)ADMIN_GOOGLE_SUBS / DATA_DIR
```

디스크는 1 GB 로 시작해도 충분하다. 영상은 저장소에 들어 있고,
`DATA_DIR` 에는 관리자가 올린 파일만 쌓인다. 업로드 상한은 영상 80 MB · 포스터 8 MB다.

## 3. 운영 환경변수

로컬과 **다른 값**이 되는 것은 둘뿐이다.

```
NEXTAUTH_URL=https://fplayground.com      ← 로컬은 http://127.0.0.1:8099
DATA_DIR=/data                            ← 영구 디스크를 붙인 경로
```

나머지(`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`)는
로컬 `.env.local` 의 값을 그대로 쓴다. **운영용 `NEXTAUTH_SECRET` 은 새로 만드는 쪽을 권한다** —
로컬과 같은 값을 쓰면 한쪽이 새면 양쪽이 샌다.

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

비밀값은 저장소에 넣지 않는다. 호스팅의 환경변수 화면에만 넣는다.

## 4. Google OAuth — 운영 주소 추가

Google Cloud Console → **API 및 서비스 → 사용자 인증 정보 → (해당 OAuth 2.0 클라이언트 ID)**

**승인된 리디렉션 URI** 에 아래를 **추가**한다. 로컬 것을 지우지 않는다 — 둘 다 두면 로컬 확인도 계속 된다.

```
https://fplayground.com/api/auth/callback/google      ← 추가
http://127.0.0.1:8099/api/auth/callback/google        ← 유지
```

**승인된 JavaScript 원본**

```
https://fplayground.com
```

주소가 한 글자라도 다르면 `redirect_uri_mismatch` 가 난다. 끝에 슬래시를 붙이지 않는다.

외부 사용자에게 공개하는 앱이 아니므로 OAuth 동의 화면은 **내부/테스트** 로 두고
`ADMIN_EMAILS` 계정을 테스트 사용자에 넣어 두면 충분하다.

## 5. DNS — 호스팅케이알

도메인이 호스팅케이알에 있으므로 그쪽 DNS 관리 화면에서 바꾼다.
현재 파킹용 A 레코드를 **지우고** 호스팅이 알려주는 값으로 바꾼다.

- 호스팅이 IP 를 주면: `A` 레코드 `@` → 그 IP, `A` 또는 `CNAME` 로 `www` 도 같이
- 호스팅이 도메인을 주면(Render·Fly 등): `CNAME` 으로 `www`, 루트(`@`)는 각 서비스가 안내하는
  ALIAS/ANAME 또는 전용 A 레코드

전파에 보통 수십 분, 길면 하루가 걸린다. **HTTPS 인증서는 DNS 가 먼저 가리켜야 발급된다.**

## 6. 배포 후 확인 (실제 공개 전 필수)

```
[ ] https://fplayground.com/            홈페이지가 열리고 자물쇠(HTTPS) 표시
[ ] https://fplayground.com/guide.html  영상 포스터가 보이고 재생된다
[ ] https://fplayground.com/admin       Google 로그인 화면
[ ] 허용된 계정으로 로그인 → 편집 화면
[ ] 허용되지 않은 계정으로 로그인 → 거절
[ ] 초안 저장 → 공개 반영 → 방문자 화면에 반영
[ ] 로그아웃 후 /admin 접근 → 다시 로그인 요구
[ ] 로그아웃 후 /api/admin/publish 직접 호출 → 401
[ ] 서버 재시작 → 저장한 내용이 그대로 있다 (영구 디스크 확인)
[ ] DATA_DIR 백업 → 복원 연습
[ ] 실제 PC·휴대폰에서 영상 재생
```

마지막 두 줄은 한 번 겪어 두지 않으면 사고 때 쓸 수 없다.

## 7. 백업

`DATA_DIR` **전체**를 정기적으로 저장소 밖에 복사한다. 게시 이력은 백업이 아니다.
백업에는 관리자 이메일과 미게시 자료가 들어 있으므로 비공개로 보관한다.
배포나 코드 업데이트가 이 폴더를 덮어쓰지 않도록 둔다.

`scripts/backup-data.mjs` 가 `DATA_DIR` 을 통째로 zip 으로 뜬다.
