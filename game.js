'use strict';
// 화면 담당: 클릭 처리, 그리기, 저장, 효과음, 애니메이션
// 게임 규칙 자체는 logic.js 에 있습니다.
const Logic = window.DailyLightsLogic;

// logic.js 나 records.js 를 불러오지 못했다면(네트워크 오류 등) 안내하고 멈춥니다.
if (!Logic || !window.DailyLightsRecords) {
  document.querySelector('#feedback').textContent = '게임 파일을 불러오지 못했어요. 페이지를 새로고침해 주세요.';
  throw new Error('Daily Lights: logic.js 또는 records.js 를 불러오지 못했습니다.');
}

const boardEl = document.querySelector('#board');
const movesEl = document.querySelector('#moves');
const parEl = document.querySelector('#par');
const feedbackEl = document.querySelector('#feedback');
const shareEl = document.querySelector('#share');
const hintEl = document.querySelector('#hint');
const resetEl = document.querySelector('#reset');
const dateEl = document.querySelector('#dateTitle');
const statsEl = document.querySelector('#stats');
const soundEl = document.querySelector('#sound');
const recordsButtonEl = document.querySelector('#openRecords');
const streakBadgeEl = document.querySelector('#streakBadge');
const hintCountEl = document.querySelector('#hintCount');
const footnoteEl = document.querySelector('#footnote');
const confettiEl = document.querySelector('#confetti');
const dateLabelEl = document.querySelector('#dateLabel');
const archiveBarEl = document.querySelector('#archiveBar');
const questBarEl = document.querySelector('#questBar');
const questRuleEl = document.querySelector('#questRule');
const hintIconEl = document.querySelector('#hintIcon');
const hintLabelEl = document.querySelector('#hintLabel');
const questMetaEl = document.querySelector('#questMeta');
const backToTodayEl = document.querySelector('#backToToday');
const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');

const STORE_KEY = 'daily-lights-v2';
const OLD_STORE_KEY = 'daily-lights-v1';          // 3단계 이전 형식 (퍼즐 생성 방식이 바뀌어 더 이상 사용 안 함)
const SETTINGS_KEY = 'daily-lights-settings-v1';
const NEW_DAY_MESSAGE = '새로운 날이 시작되어 오늘의 퍼즐을 불러왔어요.';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let store = Logic.createStore(); // 난이도별 진행 상황 + 기록 (logic.js 참고)
let todayKey = '';
let playDate = '';   // 지금 풀고 있는 퍼즐의 날짜 (보통 오늘, 달력에서 고르면 지난 날짜)
let difficulty = Logic.DEFAULT_DIFFICULTY;
let puzzle = null;   // { board, size, minMoves } 지금 퍼즐의 시작 보드
let size = 0;
let board = [];
let moves = 0;
let hints = 0;
let attempts = 1;       // 퀘스트 도전 횟수 (다시 시작할 때마다 +1)
let elapsedMs = 0;      // 퀘스트 풀이 시간
let lastTickAt = null;  // 시간을 마지막으로 잰 시각 (null = 시계 멈춤)
let solved = false;
let hintIndex = null; // 지금 반짝이는 힌트 칸
let focusIndex = 0;   // 방향키로 이동할 때 현재 칸
let midnightTimer = null;

// ── 저장 ───────────────────────────────────────────────
// localStorage 는 사생활 보호 모드 등에서 실패할 수 있어 항상 try/catch 로 감쌉니다.

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { console.warn('브라우저 저장에 실패했습니다.', e); }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* 지우지 못해도 게임에는 영향 없음 */ }
}
// 사생활 보호 모드 등으로 저장이 막혀 있는지 미리 확인합니다.
function storageWorks() {
  try {
    localStorage.setItem('daily-lights-test', '1');
    localStorage.removeItem('daily-lights-test');
    return true;
  } catch (e) { return false; }
}

// 저장하기 직전에 저장소의 최신 기록을 먼저 합칩니다.
// 탭을 여러 개 열어 두었을 때, 오래된 탭이 다른 탭의 성공 기록을 덮어쓰지 않게 하기 위해서입니다.
function saveStore() {
  const latest = Logic.parseStore(storageGet(STORE_KEY), todayKey);
  Logic.mergeHistory(store, latest);
  for (const id of Logic.DIFFICULTY_IDS) {
    if (id !== difficulty && latest.progress[id]) store.progress[id] = latest.progress[id];
    if (id !== difficulty && latest.archive[id]) store.archive[id] = latest.archive[id];
  }
  store.difficulty = difficulty;
  storageSet(STORE_KEY, Logic.serializeStore(store));
}

// 지금 지난 퍼즐을 풀고 있는가?
function isArchive() {
  return playDate !== todayKey;
}

// 진행 상황 저장: 오늘 퍼즐은 progress, 지난 퍼즐은 archive 에 (난이도마다 1개씩)
function persist() {
  const state = { date: playDate, board, moves, hints };
  if (isQuest()) Object.assign(state, { attempts, elapsedMs });
  if (isArchive()) store.archive[difficulty] = state;
  else store.progress[difficulty] = state;
  saveStore();
}

// ── 효과음 (Web Audio API로 직접 합성 → 소리 파일 불필요) ──

const sound = {
  ctx: null,
  muted: false,

  load() {
    try { this.muted = JSON.parse(storageGet(SETTINGS_KEY) || '{}').muted === true; } catch (e) { this.muted = false; }
  },
  setMuted(value) {
    this.muted = value;
    storageSet(SETTINGS_KEY, JSON.stringify({ muted: value }));
  },
  // 브라우저는 사용자가 클릭한 뒤에만 소리를 허용하므로 첫 클릭 때 준비합니다.
  context() {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  tone(freq, delay = 0, duration = 0.12, volume = 0.07, type = 'sine') {
    const ctx = this.context();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  },
  tap(turnedOn) { this.tone(turnedOn ? 660 : 440, 0, 0.09, 0.06, 'triangle'); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.35, 0.07)); },
  hint() { this.tone(880, 0, 0.1, 0.05); this.tone(1175, 0.08, 0.16, 0.05); },
  reset() { this.tone(330, 0, 0.12, 0.05, 'triangle'); },
  fail() { [392, 330, 262].forEach((f, i) => this.tone(f, i * 0.14, 0.3, 0.06, 'triangle')); },
};

// ── 그리기 ──────────────────────────────────────────────

function tileLabel(i, on) {
  const hinted = i === hintIndex ? ', 힌트' : '';
  return `${Math.floor(i / size) + 1}행 ${(i % size) + 1}열, ${on ? '켜짐' : '꺼짐'}${hinted}`;
}

// ── 일일 퀘스트 ─────────────────────────────────────────
// 퀘스트는 힌트 금지, puzzle.moveLimit 번 안에 풀어야 클리어. 다 쓰면 실패(다시 시작으로 재도전).

function isQuest() {
  return Logic.DIFFICULTIES[difficulty].quest === true;
}
function isFailed() {
  return !solved && puzzle.moveLimit !== undefined && moves >= puzzle.moveLimit;
}

// ── 퀘스트 풀이 시간 ────────────────────────────────────
// 보드가 화면에 보이는 동안만 셉니다. 다른 탭·앱에 가 있으면 멈추고,
// 아무것도 안 누르고 IDLE_CAP 보다 오래 있으면 자리를 비운 것으로 보고 그만큼만 셉니다.
const IDLE_CAP_MS = 5 * 60 * 1000;

function timerShouldRun() {
  return isQuest() && !solved && !isFailed() && !document.hidden;
}
// 지금까지 흐른 시간을 elapsedMs 에 더합니다.
function tickTimer() {
  if (lastTickAt === null) return;
  const now = Date.now();
  elapsedMs += Math.min(Math.max(now - lastTickAt, 0), IDLE_CAP_MS);
  lastTickAt = now;
}
function resumeTimer() {
  lastTickAt = timerShouldRun() ? Date.now() : null;
}
// 멈추면서 저장 (다른 난이도로 바꾸기, 탭 숨기기, 페이지 떠나기)
function pauseTimer() {
  if (lastTickAt === null) return;
  tickTimer();
  lastTickAt = null;
  persist();
}
function currentElapsed() {
  return lastTickAt === null ? elapsedMs : elapsedMs + Math.min(Date.now() - lastTickAt, IDLE_CAP_MS);
}
function paintQuestMeta() {
  if (isQuest()) questMetaEl.textContent = `⏱ ${Logic.formatClock(currentElapsed())} · ${attempts}번째 도전`;
}

function winMessage() {
  const result = { moves, hints, minMoves: puzzle.minMoves };
  if (isQuest()) {
    const detail = `⏱ ${Logic.formatDuration(elapsedMs)} · ${attempts}번째 도전`;
    return Logic.isPerfect(result)
      ? `🏆🌟 퀘스트 퍼펙트 클리어! 최소 횟수 ${moves}번 · ${detail}`
      : `🏆 퀘스트 클리어! ${moves}번 · ${detail} (최소 ${puzzle.minMoves} · 제한 ${puzzle.moveLimit})`;
  }
  if (Logic.isPerfect(result)) return `🌟 퍼펙트! 최소 횟수 ${moves}번 만에 성공했어요.`;
  const hintText = hints ? `, 힌트 ${hints}회` : '';
  return `✨ 성공! ${moves}번 만에 모든 불을 껐어요. (최소 ${puzzle.minMoves}번${hintText})`;
}

function failMessage() {
  return `😢 실패! 제한 ${puzzle.moveLimit}번을 모두 썼어요. "다시 시작"으로 ${attempts + 1}번째 도전!`;
}

// 기본 안내: 남은 불 개수도 알려 줘서 화면 읽기 프로그램 사용자도 진행 상황을 알 수 있게 합니다.
function playingMessage() {
  const lit = board.filter(Boolean).length;
  if (isQuest()) return `남은 불 ${lit}개 · 남은 기회 ${puzzle.moveLimit - moves}번`;
  return `남은 불 ${lit}개 · 빛나는 타일을 모두 꺼 주세요.`;
}

function paint(message) {
  const tiles = boardEl.children;
  board.forEach((on, i) => {
    const tile = tiles[i];
    tile.classList.toggle('on', on);
    tile.classList.toggle('hinted', i === hintIndex);
    tile.setAttribute('aria-label', tileLabel(i, on));
    tile.disabled = solved || isFailed();
    tile.tabIndex = i === focusIndex ? 0 : -1; // Tab 키로는 보드에 한 번만 들어오고, 안에서는 방향키로 이동
  });
  movesEl.textContent = String(moves);
  parEl.textContent = isQuest() ? `최소 ${puzzle.minMoves} · 제한 ${puzzle.moveLimit}` : `최소 ${puzzle.minMoves}번`;
  resetEl.disabled = moves === 0 && hints === 0;
  hintEl.hidden = solved;
  hintEl.disabled = isQuest(); // 퀘스트는 힌트 금지
  hintIconEl.textContent = isQuest() ? '🚫' : '💡';
  hintLabelEl.textContent = isQuest() ? '힌트 금지' : '힌트';
  hintCountEl.textContent = hints ? ` (${hints})` : '';
  shareEl.hidden = !solved;
  feedbackEl.classList.toggle('win', solved);
  feedbackEl.classList.toggle('fail', isFailed());
  feedbackEl.textContent = message || (solved ? winMessage() : isFailed() ? failMessage() : playingMessage());
  paintQuestMeta();
  paintRecords();
}

// 난이도 버튼의 ✓ 표시와 아래쪽 기록 줄
function paintRecords() {
  difficultyInputs.forEach(input => {
    input.checked = input.value === difficulty;
    const cleared = Boolean(store.history[input.value][playDate]); // 지금 보고 있는 날짜 기준
    input.closest('label').querySelector('.done').hidden = !cleared;
  });
  const { label } = Logic.DIFFICULTIES[difficulty];
  const stats = Logic.statsFor(store, difficulty);
  const best = store.history[difficulty][playDate];
  const bestLabel = isArchive() ? '이 날 최고' : '오늘 최고';
  const timeText = best && best.timeMs !== undefined ? ` · ${Logic.formatDuration(best.timeMs)}` : '';
  const bestText = best ? ` · ${bestLabel} ${best.moves}번${best.hints ? `(힌트 ${best.hints})` : ''}${timeText}` : '';
  statsEl.textContent = `${label} 기록 · 성공 ${stats.cleared}일 · 퍼펙트 ${stats.perfect}일${bestText}`;

  // 상단 기록 버튼의 🔥 연속 일수
  const { current } = Logic.streaks(store, todayKey);
  streakBadgeEl.hidden = current === 0;
  streakBadgeEl.textContent = `🔥${current}`;
  recordsButtonEl.setAttribute('aria-label', current ? `나의 기록, ${current}일 연속 성공 중` : '나의 기록');
  window.DailyLightsRecords.render(); // 기록 창이 열려 있으면 함께 갱신
}

function paintSoundButton() {
  soundEl.setAttribute('aria-pressed', String(!sound.muted)); // 눌림 = 소리 켜짐
  soundEl.querySelector('.sound-icon').textContent = sound.muted ? '🔇' : '🔊';
  soundEl.querySelector('.sound-text').textContent = sound.muted ? '소리 꺼짐' : '소리 켜짐';
}

// 같은 애니메이션 클래스를 다시 붙여도 처음부터 재생되게 합니다.
function replayAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // 브라우저에 "한 번 그렸다"고 알려 주는 관용 코드
  el.classList.add(className);
}

// 보드 크기가 바뀔 때만 타일을 새로 만듭니다.
function buildBoard() {
  if (boardEl.children.length === size * size) return;
  boardEl.replaceChildren();
  boardEl.style.setProperty('--size', size);
  boardEl.setAttribute('aria-label', `${size}×${size} 퍼즐 보드. 방향키로 칸을 이동하고 Enter나 Space로 누르세요.`);
  for (let i = 0; i < size * size; i++) {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.type = 'button';
    tile.style.setProperty('--wave', `${(Math.floor(i / size) + (i % size)) * 45}ms`);
    tile.addEventListener('click', () => handlePress(i));
    tile.addEventListener('focus', () => { focusIndex = i; });
    tile.addEventListener('animationend', () => tile.classList.remove('flip', 'pressed'));
    boardEl.appendChild(tile);
  }
}

// ── 게임 진행 ───────────────────────────────────────────

// 탭을 켜둔 채 날짜가 바뀌었다면 true 를 돌려주고 오늘의 퍼즐을 엽니다.
function refreshIfNewDay() {
  if (Logic.dateKeyKST() === todayKey) return false;
  start(NEW_DAY_MESSAGE);
  return true;
}

function handlePress(index) {
  if (refreshIfNewDay() || solved || isFailed()) return;

  tickTimer();
  if (lastTickAt === null) resumeTimer(); // 탭을 다시 열고 처음 누른 경우 등
  Logic.press(board, index, size);
  moves++;
  hintIndex = null;
  solved = Logic.isSolved(board);
  focusIndex = index;
  if (solved || isFailed()) lastTickAt = null; // 끝나면 시계 멈춤
  let message;
  if (solved) {
    const wasClearedToday = Logic.streaks(store, todayKey).todayCleared;
    const wasQuestClearedToday = Boolean(store.history.quest[todayKey]);
    const result = { moves, hints, minMoves: puzzle.minMoves };
    if (isQuest()) Object.assign(result, { attempts, timeMs: elapsedMs });
    if (isArchive()) result.late = true; // 지난 퍼즐 기록은 연속 성공에 넣지 않음
    const isNewBest = Logic.recordResult(store, difficulty, playDate, result);
    if (isArchive()) {
      message = `${winMessage()} ${isNewBest ? '지난 퍼즐 기록으로 저장했어요.' : '이 날의 기록은 그대로예요.'}`;
    } else if (!isNewBest) message = `${winMessage()} 오늘 최고 기록은 그대로예요.`;
    else {
      const extras = [];
      if (isQuest() && !wasQuestClearedToday) { // 오늘 첫 퀘스트 클리어면 퀘스트 연속 축하
        const quest = Logic.questStats(store, todayKey);
        if (quest.current > 1) extras.push(`🏆 퀘스트 ${quest.current}일 연속 클리어!`);
      }
      if (!wasClearedToday) { // 오늘 첫 성공이면 연속 기록을 축하
        const { current } = Logic.streaks(store, todayKey);
        if (current > 1) extras.push(`🔥 ${current}일 연속 성공!`);
      }
      if (extras.length) message = `${winMessage()} ${extras.join(' ')}`;
    }
  }
  persist();
  paint(message);

  for (const i of Logic.affected(index, size)) replayAnimation(boardEl.children[i], i === index ? 'pressed' : 'flip');
  if (solved) celebrate();
  else if (isFailed()) { // 퀘스트 제한 횟수를 다 씀
    sound.fail();
    resetEl.focus(); // 타일이 잠기므로 "다시 시작"으로 포커스 이동
  } else sound.tap(board[index]);
}

// 힌트: 최소 해답에 포함된 칸 하나를 반짝이게 합니다. (logic.js 의 hint 참고)
function showHint() {
  if (refreshIfNewDay() || solved || isQuest()) return; // 퀘스트는 힌트 금지
  const index = Logic.hint(board, size);
  if (index === null) return;
  if (index !== hintIndex) hints++; // 같은 힌트를 다시 눌러도 횟수는 한 번만
  hintIndex = index;
  focusIndex = index;
  persist();
  const remaining = Logic.solve(board, size).length;
  paint(`💡 반짝이는 칸을 눌러 보세요. 앞으로 최소 ${remaining}번이면 끝나요.`);
  replayAnimation(boardEl.children[index], 'pressed');
  boardEl.children[index].focus({ preventScroll: true });
  sound.hint();
}

function celebrate() {
  sound.win();
  replayAnimation(boardEl, 'celebrate');
  setTimeout(() => boardEl.classList.remove('celebrate'), 1500);
  launchConfetti();
  shareEl.focus(); // 타일이 비활성화되므로 키보드 포커스를 공유 버튼으로 옮깁니다.
}

function resetPuzzle() {
  if (refreshIfNewDay()) return;
  if (isQuest() && (moves > 0 || solved)) attempts++; // 퀘스트: 다시 시작 = 새 도전
  board = puzzle.board.slice();
  moves = 0;
  hints = 0;
  hintIndex = null;
  solved = false;
  elapsedMs = 0;
  resumeTimer();
  persist();
  // 성공 기록은 history 에 따로 남아 있으므로 다시 풀어도 지워지지 않습니다.
  paint('처음 상태로 되돌렸어요.');
  sound.reset();
  boardEl.querySelectorAll('.tile.on').forEach(tile => replayAnimation(tile, 'flip'));
  boardEl.children[focusIndex].focus();
}

// playDate·난이도의 퍼즐을 열고, 저장된 진행 상황이 있으면 이어서 합니다.
function loadPuzzle(message) {
  if (isArchive() && !Logic.isArchiveDate(playDate, todayKey)) playDate = todayKey; // 범위를 벗어나면 오늘로
  puzzle = Logic.generatePuzzle(playDate, difficulty);
  if (puzzle.size !== size) focusIndex = Math.floor((puzzle.size * puzzle.size) / 2); // 크기가 바뀌면 가운데 칸부터
  size = puzzle.size;
  const archived = store.archive[difficulty];
  const saved = isArchive() ? (archived && archived.date === playDate ? archived : null) : store.progress[difficulty];
  board = saved ? saved.board.slice() : puzzle.board.slice();
  moves = saved ? saved.moves : 0;
  hints = saved ? saved.hints : 0;
  attempts = saved && saved.attempts ? saved.attempts : 1;
  elapsedMs = saved && saved.elapsedMs ? saved.elapsedMs : 0;
  solved = Logic.isSolved(board);
  hintIndex = null;
  resumeTimer();

  dateEl.textContent = playDate;
  dateLabelEl.textContent = isArchive() ? '지난 퍼즐' : '오늘의 퍼즐';
  archiveBarEl.hidden = !isArchive();
  questBarEl.hidden = !isQuest();
  if (isQuest()) questRuleEl.textContent = `힌트 없이 ${puzzle.moveLimit}번 안에 모든 불 끄기`;
  buildBoard();
  paint(message);
}

// 달력에서 날짜를 골랐을 때 (records.js 에서 호출). 오늘이나 범위 밖 날짜면 오늘 퍼즐로.
function openDate(date) {
  if (refreshIfNewDay()) return;
  pauseTimer(); // 지금 퀘스트 시간을 저장하고 이동
  playDate = Logic.isArchiveDate(date, todayKey) ? date : todayKey;
  loadPuzzle(isArchive() ? `📅 ${playDate} 퍼즐을 열었어요.` : '오늘의 퍼즐로 돌아왔어요.');
  boardEl.children[focusIndex].focus({ preventScroll: true });
  document.querySelector('.game').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
}

function changeDifficulty(next) {
  if (!Logic.isDifficulty(next) || next === difficulty) return;
  if (refreshIfNewDay()) return;
  pauseTimer(); // 지금 퀘스트 시간을 저장하고 이동
  difficulty = next;
  saveStore();
  loadPuzzle();
  sound.tap(true);
}

function start(message) {
  todayKey = Logic.dateKeyKST();
  playDate = todayKey; // 처음 열거나 날짜가 바뀌면 항상 오늘 퍼즐부터
  store = Logic.parseStore(storageGet(STORE_KEY), todayKey);
  difficulty = store.difficulty;
  loadPuzzle(message);
  scheduleMidnightCheck();
}

// 탭을 켜둔 채 한국 자정이 지나면 자동으로 새 퍼즐로 바꿉니다.
// (절전 모드 등으로 타이머가 늦어질 수 있어 focus/visibilitychange 에서도 한 번 더 확인)
function scheduleMidnightCheck() {
  clearTimeout(midnightTimer);
  midnightTimer = setTimeout(checkNewDay, Logic.msUntilNextKSTMidnight() + 1000);
}
function checkNewDay() {
  if (!refreshIfNewDay()) scheduleMidnightCheck();
}

// ── 키보드: 방향키로 칸 이동, Enter/Space 로 누르기(버튼 기본 동작) ──

function handleBoardKeys(event) {
  const row = Math.floor(focusIndex / size);
  const col = focusIndex % size;
  const targets = {
    ArrowUp: [Math.max(row - 1, 0), col],
    ArrowDown: [Math.min(row + 1, size - 1), col],
    ArrowLeft: [row, Math.max(col - 1, 0)],
    ArrowRight: [row, Math.min(col + 1, size - 1)],
    Home: [row, 0],
    End: [row, size - 1],
  };
  const target = targets[event.key];
  if (!target) return;
  event.preventDefault();
  focusIndex = target[0] * size + target[1];
  [...boardEl.children].forEach((tile, i) => { tile.tabIndex = i === focusIndex ? 0 : -1; });
  boardEl.children[focusIndex].focus();
}

// ── 축하 효과: 가벼운 캔버스 색종이 ────────────────────────

function launchConfetti() {
  if (reducedMotion.matches || !confettiEl.getContext) return;
  const ctx = confettiEl.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  confettiEl.width = width * ratio;
  confettiEl.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const colors = ['#8cf0bb', '#c6ffe2', '#5fd3ff', '#ffffff', '#ffd27a'];
  const origin = boardEl.getBoundingClientRect();
  const pieces = Array.from({ length: 110 }, () => ({
    x: origin.left + origin.width / 2,
    y: origin.top + origin.height / 2,
    vx: (Math.random() - 0.5) * 13,
    vy: Math.random() * -13 - 4,
    size: Math.random() * 6 + 4,
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const duration = 1800;
  const startedAt = performance.now();
  confettiEl.hidden = false;
  function frame(now) {
    const elapsed = now - startedAt;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
    for (const p of pieces) {
      p.vy += 0.38; // 중력
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, width, height); confettiEl.hidden = true; }
  }
  requestAnimationFrame(frame);
}

// ── 공유 ───────────────────────────────────────────────

async function shareResult() {
  if (!solved) return;
  // 시작 보드 그림 + 나의 결과 막대 (문구 모양은 logic.js 의 resultShareText 참고)
  const outcome = await shareText(Logic.resultShareText({
    date: playDate,
    difficulty,
    board: puzzle.board,
    result: { moves, hints, minMoves: puzzle.minMoves },
    streak: Logic.streaks(store, todayKey).current,
    questStreak: Logic.questStats(store, todayKey).current,
    archive: isArchive(),
  }));
  if (outcome === 'copied') paint('결과를 복사했어요! 친구에게 붙여넣어 보세요.');
  else if (outcome === 'failed') paint('공유하지 못했어요. 다시 시도해 주세요.');
}

// 공유창 → 클립보드 → 직접 복사 창 순서로 시도합니다.
// 돌려주는 값: 'shared' | 'copied' | 'prompted' | 'cancelled' | 'failed'
async function shareText(text) {
  // file:// 로 열었을 때는 내 PC 경로가 공유되지 않도록 주소를 빼고 공유합니다.
  const url = location.protocol.startsWith('http') ? `\n${location.href.split('#')[0]}` : '';
  const summary = text + url;
  if (navigator.share) {
    try { await navigator.share({ title: 'Daily Lights', text: summary }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; } // 사용자가 취소한 경우는 그대로 종료
  }
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(summary);
    return 'copied';
  } catch (e) {
    try { window.prompt('아래 내용을 복사해 주세요:', summary); return 'prompted'; } catch (e2) { return 'failed'; }
  }
}

// 백업 파일의 기록을 지금 기록에 합칩니다. (records.js 에서 호출)
function importRecords(incoming) {
  const counts = Logic.mergeHistory(store, incoming);
  saveStore();
  paint();
  return counts;
}

// ── 시작 ───────────────────────────────────────────────

storageRemove(OLD_STORE_KEY);
sound.load();
paintSoundButton();
window.DailyLightsRecords.init({
  getStore: () => store,
  getToday: () => todayKey,
  getPlayDate: () => playDate,
  share: shareText,
  onImport: importRecords,
  openDate,
});
start();
if (!storageWorks()) {
  footnoteEl.textContent = '⚠️ 이 브라우저에서는 저장이 꺼져 있어(사생활 보호 모드 등) 새로고침하면 진행 상황과 기록이 사라져요.';
  footnoteEl.classList.add('warning');
}

boardEl.addEventListener('keydown', handleBoardKeys);
resetEl.addEventListener('click', resetPuzzle);
backToTodayEl.addEventListener('click', () => openDate(todayKey));
hintEl.addEventListener('click', showHint);
shareEl.addEventListener('click', shareResult);
difficultyInputs.forEach(input => input.addEventListener('change', () => changeDifficulty(input.value)));
soundEl.addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  paintSoundButton();
  sound.tap(true); // 소리를 켰을 때 바로 들리도록 확인음
});
window.addEventListener('focus', checkNewDay);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseTimer(); return; } // 다른 탭·앱으로 가면 퀘스트 시계를 멈추고 저장
  checkNewDay();
  if (lastTickAt === null) resumeTimer();
});
window.addEventListener('pagehide', pauseTimer); // 페이지를 떠날 때도 시간 저장
setInterval(paintQuestMeta, 1000); // 퀘스트 시계 표시 (1초마다)

// 다른 탭에서 기록이 바뀌면 이 탭 화면도 최신으로 맞춥니다. (이 탭의 난이도 선택은 유지)
window.addEventListener('storage', event => {
  if (event.key !== STORE_KEY && event.key !== null) return; // null: 저장소 전체 삭제
  if (refreshIfNewDay()) return;
  store = Logic.parseStore(storageGet(STORE_KEY), todayKey);
  loadPuzzle();
});

// 예상하지 못한 오류가 나면 조용히 멈추지 않고 안내합니다. (브라우저 확장 프로그램 오류는 제외)
window.addEventListener('error', event => {
  if (!/(logic|records|game)\.js/.test(event.filename || '')) return;
  feedbackEl.textContent = '문제가 생겼어요. 페이지를 새로고침해 주세요.';
});
