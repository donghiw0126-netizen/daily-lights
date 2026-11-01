'use strict';
// 처음 안내: 처음 방문한 사람에게 게임 방법을 4단계로 차례차례 보여 줍니다.
// 아래쪽 "처음 안내 다시 보기" 버튼으로 언제든 다시 볼 수 있습니다.
window.DailyLightsTutorial = (function () {
  const Logic = window.DailyLightsLogic;
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
    board.setAttribute('aria-label', '연습용 3×3 보드');
    const note = document.createElement('p');
    note.className = 'tutorial-note';
    note.setAttribute('aria-live', 'polite');
    note.textContent = '👆 가운데 칸을 눌러 보세요.';

    const cells = Array.from({ length: 9 }, (_, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('aria-label', `${Math.floor(i / 3) + 1}행 ${(i % 3) + 1}열`);
      cell.addEventListener('click', () => {
        Logic.press(state, i, 3);
        cells.forEach((c, j) => c.classList.toggle('on', state[j]));
        const lit = state.filter(Boolean).length;
        note.textContent = lit === 0
          ? '모두 꺼졌어요! 같은 칸을 두 번 누르면 원래대로 돌아와요.'
          : '좋아요! 누른 칸과 상하좌우가 함께 바뀌었죠?';
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

  const STEPS = [
    {
      title: '모든 불을 끄면 성공!',
      text: '빛나는 타일을 하나도 남김없이 꺼 보세요. 적게 누를수록 좋은 기록이에요.',
      visual: () => {
        const row = document.createElement('div');
        row.className = 'tutorial-compare';
        const arrow = document.createElement('span');
        arrow.className = 'tutorial-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        row.append(miniBoard([0, 2, 4, 5, 7], '시작'), arrow, miniBoard([], '성공'));
        return row;
      },
    },
    {
      title: '누르면 십자 모양으로 바뀌어요',
      text: '칸을 누르면 그 칸과 위·아래·양옆의 불이 함께 켜지거나 꺼져요. 직접 눌러 보세요!',
      visual: practiceBoard,
    },
    {
      title: '이렇게 풀어 보세요',
      text: '막막할 때 써 보는 요령이에요.',
      visual: () => tips([
        ['⬇️', '윗줄에 켜진 불이 있으면 바로 아랫칸을 누르세요. 한 줄씩 내려가며 정리해요.'],
        ['💡', '막히면 힌트 버튼! 정답으로 가는 다음 칸을 알려 줘요.'],
        ['🌟', '힌트 없이 최소 횟수로 풀면 퍼펙트예요.'],
      ]),
    },
    {
      title: '매일 새로운 퍼즐',
      text: '초급 3×3부터 시작해 보세요. 친구들과 같은 퍼즐로 기록을 비교할 수 있어요.',
      visual: () => tips([
        ['🕛', '매일 자정(한국 시간)에 새 퍼즐이 나와요.'],
        ['🔥', '매일 풀면 연속 성공 기록이 쌓여요.'],
        ['🏆', '자신 있다면 6×6 일일 퀘스트에 도전! 힌트 없이 정해진 횟수 안에 풀어야 해요.'],
        ['📅', '놓친 날은 📊 기록의 달력에서 다시 풀 수 있어요.'],
      ]),
    },
  ];

  // ── 화면 ───────────────────────────────────────────────

  function render() {
    const s = STEPS[step];
    $('#tutorialTitle').textContent = s.title;
    $('#tutorialText').textContent = s.text;
    $('#tutorialCount').textContent = `${step + 1} / ${STEPS.length}`;
    visualEl.replaceChildren(s.visual());
    document.querySelectorAll('#tutorialDots i').forEach((dot, i) => dot.classList.toggle('active', i === step));
    prevEl.hidden = step === 0;
    nextEl.textContent = step === STEPS.length - 1 ? '시작하기' : '다음';
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

  if (isFirstVisit()) open();
  return { open, isFirstVisit };
})();
