'use strict';
// 사이트 설정: 여기 값만 채우면 후원 버튼과 방문자 통계가 켜집니다.
// 비워 두면(빈 문자열) 해당 기능은 화면에 나타나지 않고 아무것도 불러오지 않습니다.
window.DailyLightsConfig = {
  // 후원 링크 (https:// 로 시작해야 함)
  //   예) Buy Me a Coffee: 'https://buymeacoffee.com/내아이디'
  //   예) Ko-fi:           'https://ko-fi.com/내아이디'
  //   (토스 아이디 toss.me 링크는 서비스가 종료되어 쓸 수 없습니다)
  donationUrl: '',
  // 버튼 문구를 직접 정하려면 적으세요. 비워 두면 언어에 맞게 "☕ 개발자 응원하기 / Support the developer"
  donationLabel: '',

  // Cloudflare Web Analytics 토큰 (쿠키 없는 익명 방문 통계)
  //   Cloudflare 대시보드 → Analytics & Logs → Web Analytics → 사이트 추가 → 안내 코드의 "token" 값
  //   이 값은 원래 웹페이지에 공개되는 값이라 GitHub 에 올려도 괜찮습니다.
  cloudflareAnalyticsToken: '3068620acaf2450c8da236d89f346232',
};
