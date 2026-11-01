'use strict';
// 처음 안내: 처음 방문한 사람에게 게임 방법을 4단계로 차례차례 보여 줍니다.
// 아래쪽 "처음 안내 다시 보기" 버튼으로 언제든 다시 볼 수 있습니다.
window.DailyLightsTutorial = (function () {
  const Logic = window.DailyLightsLogic;
  const I18n = window.DailyLightsI18n;
  const t = (key, params) => I18n.t(key, params);
  const SEEN_KEY = 'daily-lights-tutorial-seen';
  const STORE_KEY = 'daily-lights-v2'; // game.js 와 같은 저장 키 (기존 사용자인지 확인용)

  const $ = sel => document.querySelector(sel);
  const dialog = $('#tutorial');
  const visualEl = $('#tutorialVisual');
  const nextEl = $('#tutorialNext');
  const prevEl = $('#tutorialPrev');
  let step = 0;

  // ── 그림 만들기 ────────────────────────────────────────

  // 작은 3×3 보드 (on: 켜진 칸 번호 목록)
  function miniBoard(on, label) {
    const board = document.createElement('div');
    board.className = 'tutorial-board';
    board.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('i');
      cell.classList.toggle('on', on.includes(i));
      board.appendChild(cell);
    }
    if (label) {
      const wrap = document.createElement('figure');
      const caption = document.createElement('figcaption');
      caption.textContent = label;
      wrap.append(board, caption);
      return wrap;
    }
    return board;
  }

  // 2단계: 직접 눌러 보는 연습판. 실제 게임과 같은 규칙(logic.js)을 씁니다.
  function practiceBoard() {
    const state = Array(9).fill(false);
    const wrap = document.createElement('div');
    wrap.className = 'tutorial-practice';
    const board = document.createElement('div');
    board.className = 'tutorial-board practice';
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', t('tut.2.aria'));
    const note = document.createElement('p');
    note.className = 'tutorial-note';
    note.setAttribute('aria-live', 'polite');
    note.textContent = t('tut.2.try');

    const cells = Array.from({ length: 9 }, (_, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('aria-label', t('tut.2.cell', { row: Math.floor(i / 3) + 1, col: (i % 3) + 1 }));
      cell.addEventListener('click', () => {
        Logic.press(state, i, 3);
        cells.forEach((c, j) => c.classList.toggle('on', state[j]));
        const lit = state.filter(Boolean).length;
        note.textContent = t(lit === 0 ? 'tut.2.clear' : 'tut.2.nice');
      });
      board.appendChild(cell);
      return cell;
    });
    wrap.append(board, note);
    return wrap;
  }

  function tips(items) {
    const list = document.createElement('ul');
    list.className = 'tutorial-tips';
    for (const [icon, text] of items) {
      const li = document.createElement('li');
      const i = document.createElement('span');
      i.className = 'tip-icon';
      i.setAttribute('aria-hidden', 'true');
      i.textContent = icon;
      const t = document.createElement('span');
      t.textContent = text;
      li.append(i, t);
      list.appendChild(li);
    }
    return list;
  }

  // ── 단계 내용 ──────────────────────────────────────────

  // 각 단계의 그림. 제목·설명은 i18n.js 의 tut.1.title, tut.1.text … 에 있습니다.
  const STEPS = [
    {
      visual: () => {
        const row = document.createElement('div');
        row.className = 'tutorial-compare';
        const arrow = document.createElement('span');
        arrow.className = 'tutorial-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        row.append(miniBoard([0, 2, 4, 5, 7], t('tut.1.from')), arrow, miniBoard([], t('tut.1.to')));
        return row;
      },
    },
    { visual: practiceBoard },
    {
      visual: () => tips([
        ['⬇️', t('tut.3.tip1')],
        ['💡', t('tut.3.tip2')],
        ['🌟', t('tut.3.tip3')],
      ]),
    },
    {
      visual: () => tips([
        ['🕛', t('tut.4.tip1')],
        ['🔥', t('tut.4.tip2')],
        ['🏆', t('tut.4.tip3')],
        ['📅', t('tut.4.tip4')],
      ]),
    },
  ];

  // ── 화면 ───────────────────────────────────────────────

  function render() {
    $('#tutorialTitle').textContent = t(`tut.${step + 1}.title`);
    $('#tutorialText').textContent = t(`tut.${step + 1}.text`);
    $('#tutorialCount').textContent = `${step + 1} / ${STEPS.length}`;
    visualEl.replaceChildren(STEPS[step].visual());
    document.querySelectorAll('#tutorialDots i').forEach((dot, i) => dot.classList.toggle('active', i === step));
    prevEl.hidden = step === 0;
    nextEl.textContent = t(step === STEPS.length - 1 ? 'tut.start' : 'tut.next');
  }

  function go(delta) {
    step = Math.min(Math.max(step + delta, 0), STEPS.length - 1);
    render();
    nextEl.focus();
  }

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 저장이 막혀 있어도 안내는 정상 동작 */ }
  }

  function open() {
    step = 0;
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    nextEl.focus();
  }

  function close() {
    markSeen();
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  // 처음 방문인가? 안내를 이미 봤거나, 이미 플레이한 기록이 있으면(기존 사용자) 처음이 아닙니다.
  function isFirstVisit() {
    let raw = null;
    try {
      if (localStorage.getItem(SEEN_KEY) === '1') return false;
      raw = localStorage.getItem(STORE_KEY);
    } catch (e) { return true; }
    const store = Logic.parseStore(raw, Logic.dateKeyKST());
    const played = Object.keys(store.progress).length > 0
      || Logic.DIFFICULTY_IDS.some(id => Object.keys(store.history[id]).length > 0);
    if (played) { markSeen(); return false; }
    return true;
  }

  nextEl.addEventListener('click', () => (step === STEPS.length - 1 ? close() : go(1)));
  prevEl.addEventListener('click', () => go(-1));
  $('#tutorialSkip').addEventListener('click', close);
  dialog.addEventListener('close', markSeen); // Esc 로 닫아도 "봤음"으로 기록
  dialog.addEventListener('keydown', event => { // 좌우 방향키로 넘기기 (연습판 안에서는 제외)
    if (event.target.closest('.practice')) return;
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  });
  $('#openTutorial').addEventListener('click', open);
  window.addEventListener('daily-lights:language', () => { if (dialog.open) render(); }); // 언어를 바꾸면 다시 그림

  if (isFirstVisit()) open();
  return { open, isFirstVisit };
})();
