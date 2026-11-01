'use strict';
// Daily Lights 게임 규칙 (화면과 무관한 순수 로직)
// 브라우저에서는 window.DailyLightsLogic 으로, Node.js 테스트에서는 require('./logic.js') 로 사용합니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DailyLightsLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임이 없어 항상 UTC+9
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_SAVED_COUNT = 100000;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  // 난이도: 보드 크기와 "최소 해답 길이"의 목표 범위 (이름은 i18n.js 의 diff.easy 등)
  // quest: 일일 퀘스트 — 힌트 금지, "최소 + extraMoves"번 안에 풀어야 클리어
  const DIFFICULTIES = {
    easy:   { size: 3, minMoves: [4, 6] },
    normal: { size: 4, minMoves: [5, 7] },
    hard:   { size: 5, minMoves: [9, 12] },
    quest:  { size: 6, minMoves: [20, 24], quest: true, extraMoves: 8 },
  };
  const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);
  const DEFAULT_DIFFICULTY = 'easy';
  // 지난 퍼즐은 이 날짜부터 풀 수 있습니다. (바꾸면 달력에서 열 수 있는 범위가 바뀝니다)
  const ARCHIVE_START = '2026-10-01';

  function isDifficulty(id) {
    return Object.prototype.hasOwnProperty.call(DIFFICULTIES, id);
  }

  // ── 날짜 ───────────────────────────────────────────────

  // 사용자의 PC 시간대와 상관없이 "한국 날짜"를 YYYY-MM-DD 로 돌려줍니다.
  function dateKeyKST(now = Date.now()) {
    return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
  }

  // 다음 한국 자정까지 남은 밀리초 (자정에 퍼즐을 바꾸는 타이머용)
  function msUntilNextKSTMidnight(now = Date.now()) {
    const kstNow = now + KST_OFFSET_MS;
    return DAY_MS - (((kstNow % DAY_MS) + DAY_MS) % DAY_MS);
  }

  // 'YYYY-MM-DD' 문자열에 n일을 더합니다. (시간대 영향이 없도록 UTC 로만 계산)
  function addDays(date, n) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  // 형식뿐 아니라 실제로 있는 날짜인지 확인 ('2026-02-30' 같은 값 거부)
  function isValidDate(date) {
    return typeof date === 'string' && DATE_PATTERN.test(date) && addDays(date, 0) === date;
  }

  // 달력용: 해당 월 1일의 요일(0=일요일)과 그 달의 날짜 목록
  function monthDays(year, month) {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const dates = Array.from({ length: count }, (_, i) => prefix + String(i + 1).padStart(2, '0'));
    return { firstWeekday, dates };
  }

  // ── 결정적 난수 ─────────────────────────────────────────
  // 같은 문자열이면 어느 기기에서든 같은 난수열이 나옵니다.

  function seedFromString(value) { // FNV-1a 해시
    let h = 2166136261;
    for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function seededRandom(seed) { // mulberry32
    let x = seed >>> 0;
    return () => {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 게임 규칙 ───────────────────────────────────────────

  // index 칸을 눌렀을 때 바뀌는 칸들(본인 + 상하좌우)
  function affected(index, size) {
    const row = Math.floor(index / size);
    const col = index % size;
    return [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
      .map(([r, c]) => r * size + c);
  }

  // 보드를 직접 바꿉니다(mutate).
  function press(state, index, size) {
    for (const i of affected(index, size)) state[i] = !state[i];
  }

  function isSolved(state) {
    return state.every(on => !on);
  }

  // ── 해답 계산 ───────────────────────────────────────────
  // "어떤 칸을 누를지"를 0/1 연립방정식(GF(2))으로 풀어 가장 짧은 해답을 찾습니다.
  // 돌려주는 값: 눌러야 할 칸 번호 배열(작은 번호부터). 풀 수 없는 보드면 null.
  function solve(state, size) {
    const n = size * size;
    const rows = [];
    for (let cell = 0; cell < n; cell++) {
      const row = new Uint8Array(n + 1);
      for (const p of affected(cell, size)) row[p] = 1; // 영향 관계는 대칭이라 그대로 사용 가능
      row[n] = state[cell] ? 1 : 0;
      rows.push(row);
    }

    // 가우스-조르단 소거
    const pivotCols = [];
    let r = 0;
    for (let c = 0; c < n && r < n; c++) {
      let p = r;
      while (p < n && !rows[p][c]) p++;
      if (p === n) continue;
      [rows[r], rows[p]] = [rows[p], rows[r]];
      for (let i = 0; i < n; i++) {
        if (i !== r && rows[i][c]) for (let j = c; j <= n; j++) rows[i][j] ^= rows[r][j];
      }
      pivotCols.push(c);
      r++;
    }
    for (let i = r; i < n; i++) if (rows[i][n]) return null; // 0 = 1 모순 → 풀 수 없음

    // 자유 변수의 모든 조합 중 누르는 횟수가 가장 적은 해답을 고릅니다.
    // (3×3은 조합 1개, 4×4는 16개, 5×5는 4개뿐이라 금방 끝납니다)
    const isPivot = new Set(pivotCols);
    const freeCols = [];
    for (let c = 0; c < n; c++) if (!isPivot.has(c)) freeCols.push(c);
    let best = null;
    for (let mask = 0; mask < (1 << freeCols.length); mask++) {
      const x = new Uint8Array(n);
      freeCols.forEach((c, k) => { x[c] = (mask >> k) & 1; });
      pivotCols.forEach((pc, i) => {
        let v = rows[i][n];
        for (const fc of freeCols) if (rows[i][fc] && x[fc]) v ^= 1;
        x[pc] = v;
      });
      const presses = [];
      x.forEach((v, i) => { if (v) presses.push(i); });
      if (!best || presses.length < best.length) best = presses;
    }
    return best;
  }

  // 힌트: 최소 해답에 들어 있는 칸 하나(가장 위·왼쪽).
  // 누르는 순서는 결과에 영향이 없으므로, 이 칸을 누르면 남은 최소 횟수가 정확히 1 줄어듭니다.
  function hint(state, size) {
    const solution = solve(state, size);
    return solution && solution.length ? solution[0] : null;
  }

  // ── 퍼즐 생성 ───────────────────────────────────────────
  // 꺼진 보드에 서로 다른 칸을 실제로 눌러 만들기 때문에 항상 풀 수 있습니다.
  // 최소 해답이 난이도 목표 범위에 들어올 때까지 다시 만들어 난이도를 고르게 맞춥니다.
  // 반환값: { board, size, minMoves } + 퀘스트면 moveLimit(이 횟수 안에 풀어야 함)
  function generatePuzzle(date, difficulty) {
    const { size, minMoves: [low, high], extraMoves } = DIFFICULTIES[difficulty];
    const n = size * size;
    const rng = seededRandom(seedFromString(`daily-lights:v2:${difficulty}:${date}`));
    const finish = (board, minMoves) => (extraMoves
      ? { board, size, minMoves, moveLimit: minMoves + extraMoves }
      : { board, size, minMoves });
    let fallback = null;
    for (let attempt = 0; attempt < 500; attempt++) {
      const count = low + Math.floor(rng() * (high - low + 1));
      const cells = Array.from({ length: n }, (_, i) => i);
      const board = Array(n).fill(false);
      for (let k = 0; k < count; k++) { // 섞으면서 앞에서부터 count 개 고르기 (Fisher-Yates)
        const j = k + Math.floor(rng() * (n - k));
        [cells[k], cells[j]] = [cells[j], cells[k]];
        press(board, cells[k], size);
      }
      const minMoves = solve(board, size).length;
      if (minMoves >= low && minMoves <= high) return finish(board, minMoves);
      if (minMoves > 0 && !fallback) fallback = finish(board, minMoves);
    }
    return fallback; // 테스트상 10년치 모두 위에서 끝나지만, 만일을 대비한 안전장치
  }

  // ── 저장 데이터 ─────────────────────────────────────────
  // store = {
  //   version: 2,
  //   difficulty: 'easy',                                      마지막으로 고른 난이도
  //   progress: { easy: { date, board, moves, hints } },       오늘 진행 중인 판
  //   archive:  { easy: { date, board, moves, hints } },       지난 퍼즐 진행 중인 판 (난이도마다 1개)
  //   history:  { easy: { '2026-11-01': { moves, hints, minMoves, late? } } }  날짜별 최고 기록
  //             late: true = 그날이 지난 뒤에 푼 기록 (연속 성공에는 포함되지 않음)
  // }

  function createStore() {
    const store = { version: 2, difficulty: DEFAULT_DIFFICULTY, progress: {}, archive: {}, history: {} };
    for (const id of DIFFICULTY_IDS) store.history[id] = {};
    return store;
  }

  // 지난 퍼즐로 열 수 있는 날짜인가? (ARCHIVE_START 이후 ~ 어제)
  function isArchiveDate(date, today) {
    return isValidDate(date) && date >= ARCHIVE_START && date < today;
  }

  const isCount = (v, min = 0) => Number.isSafeInteger(v) && v >= min && v <= MAX_SAVED_COUNT;

  // 없어도 되는 값(예전 저장 데이터에는 없음): 있으면 정해진 범위의 정수여야 함
  const optionalCount = (v, min = 0, max = MAX_SAVED_COUNT) => v === undefined || (Number.isSafeInteger(v) && v >= min && v <= max);
  const MAX_TIME_MS = 24 * 60 * 60 * 1000;

  // 진행 중인 판. attempts(도전 횟수)·elapsedMs(풀이 시간)는 퀘스트용이며 없어도 됨
  function validBoardState(p, difficulty) {
    const { size } = DIFFICULTIES[difficulty];
    return !!p && Array.isArray(p.board) && p.board.length === size * size
      && p.board.every(v => typeof v === 'boolean')
      && isCount(p.moves) && isCount(p.hints)
      && optionalCount(p.attempts, 1) && optionalCount(p.elapsedMs, 0, MAX_TIME_MS)
      && solve(p.board, size) !== null; // 정상 플레이로는 나올 수 없는 보드는 거부
  }
  const validProgress = (p, difficulty, today) => validBoardState(p, difficulty) && p.date === today;
  const validArchive = (p, difficulty, today) => validBoardState(p, difficulty) && isArchiveDate(p.date, today);
  function copyBoardState(p) {
    const state = { date: p.date, board: p.board.slice(), moves: p.moves, hints: p.hints };
    if (p.attempts !== undefined) state.attempts = p.attempts;
    if (p.elapsedMs !== undefined) state.elapsedMs = p.elapsedMs;
    return state;
  }

  // 성공 기록. late·attempts(도전 횟수)·timeMs(풀이 시간)는 없어도 됨
  function validResult(r, difficulty) {
    const { size } = DIFFICULTIES[difficulty];
    return !!r && isCount(r.moves, 1) && isCount(r.hints)
      && Number.isSafeInteger(r.minMoves) && r.minMoves >= 1 && r.minMoves <= size * size
      && (r.late === undefined || typeof r.late === 'boolean')
      && optionalCount(r.attempts, 1) && optionalCount(r.timeMs, 0, MAX_TIME_MS);
  }

  // 기록 한 개를 정해진 모양으로 복사 (late 는 true 일 때만, 나머지 선택 값은 있을 때만 남김)
  function copyResult(r) {
    const result = { moves: r.moves, hints: r.hints, minMoves: r.minMoves };
    if (r.late === true) result.late = true;
    if (r.attempts !== undefined) result.attempts = r.attempts;
    if (r.timeMs !== undefined) result.timeMs = r.timeMs;
    return result;
  }

  // 저장 문자열을 읽어 항상 "쓸 수 있는" store 를 돌려줍니다. 절대 예외를 던지지 않습니다.
  // 손상된 부분만 버리고 나머지(예: 다른 난이도 기록)는 살립니다. 지난 날짜의 진행 중인 판은 버립니다.
  function parseStore(raw, today) {
    let data;
    try { data = JSON.parse(raw); } catch { return createStore(); }
    return normalizeStore(data, today);
  }

  function normalizeStore(data, today) {
    const store = createStore();
    if (!data || typeof data !== 'object' || data.version !== 2) return store;

    if (isDifficulty(data.difficulty)) store.difficulty = data.difficulty;
    for (const id of DIFFICULTY_IDS) {
      const p = data.progress && data.progress[id];
      if (validProgress(p, id, today)) store.progress[id] = copyBoardState(p);
      const a = data.archive && data.archive[id];
      if (validArchive(a, id, today)) store.archive[id] = copyBoardState(a);
      const days = data.history && data.history[id];
      if (days && typeof days === 'object') {
        for (const [date, r] of Object.entries(days)) {
          if (isValidDate(date) && validResult(r, id)) store.history[id][date] = copyResult(r);
        }
      }
    }
    return store;
  }

  function serializeStore(store) {
    return JSON.stringify(store);
  }

  // 퍼펙트: 힌트 없이 최소 횟수로 성공
  function isPerfect(result) {
    return result.hints === 0 && result.moves === result.minMoves;
  }

  // 더 좋은 기록인가?
  // 1) 당일에 푼 기록이 나중에 푼 기록보다 항상 우선 (지난 퍼즐로 당일 기록을 덮어쓰지 않음)
  // 2) 힌트를 덜 쓴 쪽 → 3) 같으면 움직임이 적은 쪽
  // 4) 움직임도 같으면 풀이 시간이 짧은 쪽 (둘 다 시간이 있을 때만)
  function isBetterResult(next, prev) {
    if (!prev) return true;
    if (Boolean(next.late) !== Boolean(prev.late)) return !next.late;
    if (next.hints !== prev.hints) return next.hints < prev.hints;
    if (next.moves !== prev.moves) return next.moves < prev.moves;
    return next.timeMs !== undefined && prev.timeMs !== undefined && next.timeMs < prev.timeMs;
  }

  // 성공 기록을 남깁니다. 같은 날 다시 풀었다면 더 좋은 기록만 남깁니다.
  function recordResult(store, difficulty, date, result) {
    const days = store.history[difficulty];
    const isNewBest = isBetterResult(result, days[date]);
    if (isNewBest) days[date] = copyResult(result);
    return isNewBest;
  }

  // 난이도별 통계
  function statsFor(store, difficulty) {
    const results = Object.values(store.history[difficulty]);
    return {
      cleared: results.length,
      perfect: results.filter(isPerfect).length,
      noHint: results.filter(r => r.hints === 0).length,
    };
  }

  // ── 연속 기록과 전체 통계 ────────────────────────────────

  // 어느 난이도든 하나라도 성공한 날짜들 (onTimeOnly: 당일에 푼 기록만)
  // ids: 셀 난이도 목록 (기본: 전체)
  function clearedDates(store, onTimeOnly = false, ids = DIFFICULTY_IDS) {
    const dates = new Set();
    for (const id of ids) {
      for (const [date, r] of Object.entries(store.history[id])) if (!onTimeOnly || !r.late) dates.add(date);
    }
    return dates;
  }

  // current: 지금 이어지고 있는 연속 성공 일수
  //   오늘 아직 안 풀었으면 어제까지 센 값 (오늘 자정까지는 연속이 끊기지 않은 것으로 봄)
  // best: 지금까지 가장 길었던 연속 성공 일수
  // 지난 퍼즐을 나중에 푼 기록(late)은 연속에 넣지 않습니다.
  // ids 를 ['quest'] 로 주면 퀘스트 연속 클리어를 셉니다.
  function streaks(store, today, ids = DIFFICULTY_IDS) {
    const days = clearedDates(store, true, ids);
    const todayCleared = days.has(today);
    let current = 0;
    for (let d = todayCleared ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;

    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of [...days].sort()) {
      run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return { current, best, todayCleared };
  }

  function totalStats(store) {
    let perfect = 0;
    for (const id of DIFFICULTY_IDS) perfect += statsFor(store, id).perfect;
    return { days: clearedDates(store).size, perfect };
  }

  // 퀘스트 통계: 클리어 횟수, 연속 클리어(당일 기준), 최단 시간
  function questStats(store, today) {
    const results = Object.values(store.history.quest);
    const times = results.map(r => r.timeMs).filter(t => t !== undefined);
    const { current, best } = streaks(store, today, ['quest']);
    return { cleared: results.length, current, best, fastestMs: times.length ? Math.min(...times) : null };
  }

  // ── 시간 표시 ───────────────────────────────────────────
  // 시계 모양: 3:07, 1:02:03
  function formatClock(ms) {
    const total = Math.floor(Math.max(ms, 0) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }
  // (문장 모양 "3분 7초 / 3m 7s" 는 언어마다 달라서 i18n.js 의 formatDuration 에 있습니다)

  // ── 공유 문구 (이모지 그림) ─────────────────────────────
  // 정답(누른 칸)은 그리지 않습니다. 친구가 보고 따라 할 수 있기 때문입니다.

  // 시작 보드 그림: 🟩 켜진 불, ⬛ 꺼진 불 (게임을 열면 누구나 보는 화면이라 노출될 것이 없음)
  function boardEmoji(board, size) {
    const rows = [];
    for (let r = 0; r < size; r++) {
      rows.push(board.slice(r * size, (r + 1) * size).map(on => (on ? '🟩' : '⬛')).join(''));
    }
    return rows.join('\n');
  }

  // 나의 결과 막대: 최소 횟수만큼 🟩, 더 누른 만큼 🟨. 너무 길면 뒤를 "+N" 으로 줄입니다.
  function movesBar(result, max = 15) {
    const green = Math.min(result.moves, result.minMoves);
    const yellow = Math.max(result.moves - result.minMoves, 0);
    const cells = '🟩'.repeat(green) + '🟨'.repeat(yellow);
    const total = green + yellow;
    return total > max ? `${[...cells].slice(0, max).join('')}+${total - max}` : cells;
  }

  // 한 판 결과 공유
  // options: { date, difficulty, board(시작 보드), result: { moves, hints, minMoves }, streak, archive }
  // questStreak: 퀘스트 연속 클리어 일수 (퀘스트일 때만 표시)
  // t: 번역 함수 (i18n.js 의 t 또는 translator('ko'|'en')) — 공유 문구도 고른 언어로 만듭니다.
  function resultShareText({ date, difficulty, board, result, streak = 0, questStreak = 0, archive = false, t }) {
    const { size, quest } = DIFFICULTIES[difficulty];
    let summary = isPerfect(result)
      ? t('share.perfect', { moves: result.moves })
      : t('share.moves', { moves: result.moves, min: result.minMoves });
    if (quest) summary = t('share.quest', { summary });
    const lines = [
      `Daily Lights ${date}${archive ? t('share.past') : ''} · ${quest ? '🏆 ' : ''}${t(`diff.${difficulty}`)} ${size}×${size}`,
      boardEmoji(board, size),
      `${movesBar(result)} ${summary}`,
    ];
    if (quest) {
      const details = [];
      if (result.timeMs !== undefined) details.push(`⏱ ${formatClock(result.timeMs)}`);
      if (result.attempts) details.push(t('share.attempt', { n: result.attempts }));
      if (details.length) lines.push(details.join(' · '));
    }
    if (result.hints) lines.push(t('share.hints', { n: result.hints }));
    if (!archive && quest && questStreak > 1) lines.push(t('share.questStreak', { n: questStreak }));
    if (!archive && streak > 1) lines.push(t('share.streak', { n: streak }));
    return lines.join('\n');
  }

  // 모든 난이도(퀘스트 포함)의 오늘 결과를 한 번에 공유하는 문구
  function dailyShareText(store, today, t) {
    const lines = [`Daily Lights ${today}`];
    for (const id of DIFFICULTY_IDS) {
      const { size } = DIFFICULTIES[id];
      const r = store.history[id][today];
      let text = t('share.notYet');
      if (r && isPerfect(r)) text = `${movesBar(r)} ${t('share.perfectShort')}`;
      else if (r) text = `${movesBar(r)} ${t('share.movesShort', { moves: r.moves })}${r.hints ? ` 💡${r.hints}` : ''}`;
      if (r && r.timeMs !== undefined) text += ` ⏱${formatClock(r.timeMs)}`;
      lines.push(`${t(`diff.${id}`)} ${size}×${size}  ${text}`);
    }
    const { current } = streaks(store, today);
    if (current > 0) lines.push(t('share.streak', { n: current }));
    return lines.join('\n');
  }

  // ── 백업과 복원 ─────────────────────────────────────────

  const BACKUP_APP = 'daily-lights';

  function createBackup(store, exportedAt = new Date().toISOString()) {
    return JSON.stringify({ app: BACKUP_APP, exportedAt, store }, null, 2);
  }

  // 백업 파일 내용을 검사해 store 로 돌려줍니다. Daily Lights 백업이 아니면 null.
  function parseBackup(text, today) {
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    if (!data || data.app !== BACKUP_APP || !data.store || data.store.version !== 2) return null;
    return normalizeStore(data.store, today);
  }

  // 백업의 기록을 현재 기록에 합칩니다. 같은 날짜는 더 좋은 기록을 남기므로 기존 기록이 사라지지 않습니다.
  function mergeHistory(target, incoming) {
    let added = 0;
    let improved = 0;
    for (const id of DIFFICULTY_IDS) {
      for (const [date, result] of Object.entries(incoming.history[id])) {
        const existing = target.history[id][date];
        if (!existing) added++;
        else if (isBetterResult(result, existing)) improved++;
        else continue;
        target.history[id][date] = copyResult(result);
      }
    }
    return { added, improved };
  }

  return {
    DIFFICULTIES, DIFFICULTY_IDS, DEFAULT_DIFFICULTY, ARCHIVE_START, isDifficulty, isArchiveDate,
    dateKeyKST, msUntilNextKSTMidnight, addDays, isValidDate, monthDays,
    seedFromString, seededRandom,
    affected, press, isSolved, solve, hint, generatePuzzle,
    createStore, parseStore, serializeStore, isPerfect, isBetterResult, recordResult, statsFor,
    clearedDates, streaks, totalStats, questStats, formatClock,
    boardEmoji, movesBar, resultShareText, dailyShareText,
    createBackup, parseBackup, mergeHistory,
  };
});
