'use strict';
// 사이트 부가 기능: 후원 버튼, 방문자 통계 (설정은 site-config.js), 앱 설치·오프라인(PWA)
// 게임 코드와 분리되어 있어서, 게임에 문제가 생겨도 영향을 주고받지 않습니다.
window.DailyLightsSite = (function () {
  const ANALYTICS_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
  const LOCAL_HOSTS = ['', 'localhost', '127.0.0.1', '[::1]']; // '' = 파일로 직접 연 경우
  const INSTALL_DISMISSED_KEY = 'daily-lights-install-dismissed';

  // https:// 주소만 허용합니다. (오타나 javascript: 같은 위험한 주소 방지)
  function safeHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch (e) { return null; }
  }

  // 방문자가 브라우저에서 "추적 거부"를 켰다면 통계를 보내지 않습니다.
  function visitorOptedOut() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  function showDonation(config) {
    const url = safeHttpsUrl(config.donationUrl || '');
    document.querySelectorAll('.donate-link').forEach(link => {
      link.hidden = !url;
      if (!url) return;
      link.href = url;
      link.textContent = config.donationLabel || '☕ 개발자 응원하기';
    });
  }

  // 반환값: 통계 스크립트를 불러왔는지 (테스트용)
  function startAnalytics(config, hostname) {
    const token = config.cloudflareAnalyticsToken || '';
    if (!/^[A-Za-z0-9]{16,64}$/.test(token)) return false; // 비어 있거나 형식이 이상하면 끔
    if (LOCAL_HOSTS.includes(hostname)) return false;      // 내 PC에서 테스트할 때는 집계하지 않음
    if (visitorOptedOut()) return false;
    if (document.querySelector(`script[src="${ANALYTICS_SRC}"]`)) return true; // 이미 불러옴

    const script = document.createElement('script');
    script.defer = true;
    script.src = ANALYTICS_SRC;
    script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
    document.head.appendChild(script);
    document.querySelector('#privacyNote').textContent = '쿠키 없는 익명 방문 통계만 사용';
    return true;
  }

  function apply(config, hostname = location.hostname) {
    showDonation(config || {});
    return startAnalytics(config || {}, hostname);
  }

  // ── 앱처럼 설치하기 (PWA) ───────────────────────────────

  // 배포된 버전인가? (배포할 때 app-version 의 __VERSION__ 이 커밋 번호로 바뀝니다)
  // 개발 중에 서비스 워커가 켜지면 고친 코드 대신 저장된 옛 파일이 보여 헷갈리므로, 배포 버전에서만 켭니다.
  function isDeployedBuild() {
    const meta = document.querySelector('meta[name="app-version"]');
    return Boolean(meta && meta.content && !meta.content.startsWith('__'));
  }

  // 인터넷 없이도 열리도록 서비스 워커(sw.js) 등록. 반환값: 등록을 시도했는지
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !isDeployedBuild()) return false;
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('오프라인 기능을 켜지 못했어요.', e));
    return true;
  }

  // 이미 설치된 앱으로 열었는가?
  function isInstalledApp() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // 데스크톱 모드 아이패드
  }

  function installDismissed() {
    try { return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'; } catch (e) { return false; }
  }

  let installPrompt = null; // 크롬·엣지·안드로이드가 넘겨주는 "설치 창 띄우기" 객체

  // mode: 'prompt' = 설치 버튼 / 'ios' = 아이폰 설치 방법 안내 (아이폰은 설치 버튼 기능이 없음)
  function showInstall(mode) {
    const card = document.querySelector('#installCard');
    if (isInstalledApp() || installDismissed()) { card.hidden = true; return false; }
    document.querySelector('#installButton').hidden = mode !== 'prompt';
    document.querySelector('#installHelp').textContent = mode === 'ios'
      ? 'Safari 아래쪽 공유 버튼(□↑)을 누르고 "홈 화면에 추가"를 고르세요.'
      : '홈 화면에서 바로 열고, 인터넷이 없어도 플레이할 수 있어요.';
    card.hidden = false;
    return true;
  }

  function hideInstall(remember) {
    document.querySelector('#installCard').hidden = true;
    if (remember) { try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch (e) { /* 저장 못 해도 괜찮음 */ } }
  }

  function setUpInstall() {
    document.querySelector('#installButton').addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      hideInstall(false);
    });
    document.querySelector('#installClose').addEventListener('click', () => hideInstall(true)); // "다시 보지 않기"

    if (!isDeployedBuild()) return; // 카드를 자동으로 띄우는 것은 배포된 버전에서만
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault(); // 브라우저 기본 안내 대신 우리 카드로 안내
      installPrompt = event;
      showInstall('prompt');
    });
    window.addEventListener('appinstalled', () => hideInstall(false));
    if (isIOS()) showInstall('ios');
  }

  apply(window.DailyLightsConfig);
  registerServiceWorker();
  setUpInstall();
  return { apply, showInstall, isDeployedBuild };
})();
