'use strict';
// 설정: 효과음, 진동, 언어. 상단 ⚙️ 버튼으로 여는 창과 저장된 설정값을 관리합니다.
// 다른 파일은 DailyLightsSettings.muted / vibrate() 를 쓰고,
// 언어가 바뀌면 'daily-lights:language' 이벤트를 받아 화면 문구를 다시 그립니다.
window.DailyLightsSettings = (function () {
  const I18n = window.DailyLightsI18n;
  const KEY = 'daily-lights-settings-v1'; // 예전 버전({ muted })과 같은 키 → 효과음 설정 그대로 유지
  const $ = sel => document.querySelector(sel);
  const dialog = $('#settings');

  // 진동: 안드로이드 크롬 등은 지원, 아이폰(Safari 계열)은 지원하지 않음
  const vibrationSupported = typeof navigator.vibrate === 'function';

  const prefs = load();

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    const browserLangs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ko'];
    return {
      muted: saved.muted === true,
      vibration: saved.vibration !== false, // 처음에는 켜짐
      lang: I18n.LANGS.includes(saved.lang) ? saved.lang : I18n.detectLang(browserLangs),
    };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* 저장이 막혀 있어도 이번 방문 동안은 동작 */ }
  }

  // 진동 (지원하지 않거나 꺼 두었으면 아무 일도 안 함). pattern: 밀리초 숫자 또는 [진동, 쉼, 진동, ...]
  function vibrate(pattern) {
    if (!vibrationSupported || !prefs.vibration) return;
    try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  }

  function setLanguage(lang) {
    if (!I18n.LANGS.includes(lang)) return;
    prefs.lang = lang;
    save();
    I18n.setLang(lang);
    I18n.applyDom();
    paint();
    window.dispatchEvent(new CustomEvent('daily-lights:language', { detail: lang }));
  }

  // ── 설정 창 ────────────────────────────────────────────

  function paint() {
    $('#settingSound').checked = !prefs.muted;
    const vibrationEl = $('#settingVibration');
    vibrationEl.checked = vibrationSupported && prefs.vibration;
    vibrationEl.disabled = !vibrationSupported;
    $('#vibrationHelp').textContent = I18n.t(vibrationSupported ? 'set.vibrationHelp' : 'set.vibrationUnsupported');
    document.querySelectorAll('input[name="language"]').forEach(input => { input.checked = input.value === prefs.lang; });
  }

  function open() {
    paint();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  $('#openSettings').addEventListener('click', open);
  $('#closeSettings').addEventListener('click', close);
  $('#settingSound').addEventListener('change', event => {
    prefs.muted = !event.target.checked;
    save();
    window.dispatchEvent(new CustomEvent('daily-lights:sound', { detail: !prefs.muted }));
  });
  $('#settingVibration').addEventListener('change', event => {
    prefs.vibration = event.target.checked;
    save();
    vibrate(20); // 켰을 때 바로 느껴지도록
  });
  document.querySelectorAll('input[name="language"]').forEach(input => {
    input.addEventListener('change', () => setLanguage(input.value));
  });
  $('#settingsTutorial').addEventListener('click', () => {
    close();
    if (window.DailyLightsTutorial) window.DailyLightsTutorial.open();
  });

  // 시작할 때 저장된 언어로 화면 문구를 맞춥니다.
  I18n.setLang(prefs.lang);
  I18n.applyDom();

  return {
    get muted() { return prefs.muted; },
    get vibrationSupported() { return vibrationSupported; },
    vibrate, setLanguage, open, close,
  };
})();
