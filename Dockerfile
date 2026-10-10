# 논담 홈페이지 운영 이미지
#
# 이 앱은 파일로 저장한다(DATA_DIR/state.json, DATA_DIR/media).
# 그래서 **영구 디스크를 붙인 단일 인스턴스**가 전제다 — docs/ADMIN.md 참고.
# 서버리스 임시 디스크에 올리면 재배포·재시작 때 관리자가 쓴 글과 업로드가 사라진다.
# 여러 개로 늘리려면 파일 저장을 데이터베이스·공유 저장소로 바꿔야 한다.
#
# 빌드:  docker build -t nondam-homepage .
# 실행:  docker run -d --name nondam -p 8099:8099 \
#          -v /srv/nondam-data:/data \
#          --env-file .env.production \
#          nondam-homepage
#        (.env.production 에 DATA_DIR=/data 를 둔다)

FROM node:22.14-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.14-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드 단계에서는 비밀값이 필요 없다. 넣지도 않는다 —
# 이미지 레이어에 남으면 이미지를 가진 사람이 전부 읽을 수 있다.
RUN npm run build

FROM node:22.14-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# 루트로 돌리지 않는다. 업로드를 받는 서버라 더욱 그렇다.
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/site ./site
COPY --from=build /app/content ./content
COPY --from=build /app/lib ./lib
COPY --from=build /app/app ./app
# 영구 디스크를 여기에 붙인다. 이미지 안에 두지 않는다.
RUN mkdir -p /data && chown -R app:app /data /app
USER app
VOLUME ["/data"]
EXPOSE 8099
# **컨테이너는 0.0.0.0 에 붙어야 한다.** `start` 는 127.0.0.1 로 묶여 있어서,
# 그대로 띄우면 컨테이너 안 loopback 만 듣고 역방향 프록시가 닿지 못한다 → 502.
# 전에는 `docker run` 쪽에서 명령을 덮어 해결했는데, 그 지식이 어디에도 적혀 있지 않아
# 평범하게 다시 띄우는 순간 사이트가 내려갔다(실제로 그랬다). 이미지가 스스로 맞게 뜬다.
#
# `start` 는 로컬 확인용으로 127.0.0.1 을 유지한다 — 개발 중에 바깥으로 열지 않는다.
CMD ["npm", "run", "start:container"]
