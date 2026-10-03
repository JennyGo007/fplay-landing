/* ┌──────────────────────────────────────────────────────────────────────┐
 * │  여기 세 줄만 고치면 된다. 다른 파일은 건드릴 필요가 없다.              │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * platformUrl  F-Play 플랫폼 시작 화면 주소.
 *              '로그인' 과 가이드 페이지의 'F-Play 시작하기' 가 이 주소로 간다.
 *              비워 두면 platform.html 안내 페이지로 간다.
 *
 * youtubeUrl   가이드 페이지에 넣을 튜토리얼 영상 주소.
 *              일반 주소(watch?v=), 단축 주소(youtu.be), embed 주소를 모두 받는다.
 *              비워 두면 영상 자리에 준비 중 안내만 나온다. 빈 iframe 도,
 *              외부 요청도 만들지 않는다. 유튜브가 아닌 주소는 무시한다.
 *
 * contactEmail 문의 폼과 푸터에 쓰는 메일 주소.
 *
 * guideUrl     '튜토리얼 시작' 이 가는 곳. 이 묶음 안의 guide.html 이다.
 *              바깥 주소(https://... 로 시작하거나 // 로 시작하는 것)는 받지 않는다.
 *              영상으로 바로 보내지 않고 안내 페이지를 거치게 하는 것이 계약이라,
 *              바깥 주소를 넣어도 무시하고 guide.html 로 간다.
 */
window.FPLAY_CONFIG = {
  platformUrl: "",
  guideUrl: "guide.html",
  youtubeUrl: "https://youtu.be/hLXLIDa3YDQ",
  contactEmail: "contact@fplayground.com",
};
