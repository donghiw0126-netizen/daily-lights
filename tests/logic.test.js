// 실행: npm test  (또는 node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const DAY = 24 * 60 * 60 * 1000;
// 2024-01-01 부터 n일치 날짜 문자열
function dates(n) {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: n }, (_, d) => new Date(start + d * DAY).toISOString().slice(0, 10));
}
function solvedBy(board, size, presses) {
  const copy = board.slice();
  for (const p of presses) L.press(copy, p, size);
  return L.isSolved(copy);
}
const TEN_YEARS = dates(3653);

test('난이도 설정: 초급 3×3, 중급 4×4, 고급 5×5, 퀘스트 6×6', () => {
  assert.deepEqual(L.DIFFICULTY_IDS.map(id => L.DIFFICULTIES[id].size), [3, 4, 5, 6]);
  assert.ok(L.isDifficulty('hard'));
  assert.ok(L.isDifficulty('quest') && L.DIFFICULTIES.quest.quest === true);
  assert.ok(!L.isDifficulty('toString'), '객체 기본 속성은 난이도가 아님');
});

test('같은 날짜·난이도에는 항상 같은 퍼즐이 나온다', () => {
  for (const id of L.DIFFICULTY_IDS) {
    for (const date of dates(30)) assert.deepEqual(L.generatePuzzle(date, id), L.generatePuzzle(date, id));
  }
});

test('다른 날짜에는 퍼즐이 바뀐다', () => {
  const all = dates(365);
  for (const id of L.DIFFICULTY_IDS) {
    let sameAsYesterday = 0;
    for (let i = 1; i < all.length; i++) {
      if (String(L.generatePuzzle(all[i], id).board) === String(L.generatePuzzle(all[i - 1], id).board)) sameAsYesterday++;
    }
    // 3×3은 가능한 퍼즐 종류가 적어 아주 드물게 우연히 겹칠 수 있음
    assert.ok(sameAsYesterday <= 3, `${id}: 전날과 같은 퍼즐 ${sameAsYesterday}회`);
  }
  const hardUnique = new Set(all.map(d => String(L.generatePuzzle(d, 'hard').board)));
  assert.equal(hardUnique.size, all.length, '고급 1년치 퍼즐은 모두 서로 다름');
});

test('10년치 모든 난이도 퍼즐: 풀 수 있고, 최소 해답이 목표 범위 안이다', () => {
  for (const id of L.DIFFICULTY_IDS) {
    const { size, minMoves: [low, high] } = L.DIFFICULTIES[id];
    for (const date of TEN_YEARS) {
      const puzzle = L.generatePuzzle(date, id);
      assert.equal(puzzle.size, size);
      assert.equal(puzzle.board.length, size * size);
      const solution = L.solve(puzzle.board, size);
      assert.ok(solution, `${id} ${date}: 해답 없음`);
      assert.ok(solvedBy(puzzle.board, size, solution), `${id} ${date}: 해답으로 풀리지 않음`);
      assert.equal(solution.length, puzzle.minMoves);
      assert.ok(low <= puzzle.minMoves && puzzle.minMoves <= high, `${id} ${date}: 최소 ${puzzle.minMoves}번`);
    }
  }
});

test('solve 는 풀 수 없는 보드를 정확히 판별한다', () => {
  const corner5 = Array(25).fill(false);
  corner5[0] = true; // 5×5 모서리 한 칸만 켜진 보드는 풀 수 없음
  assert.equal(L.solve(corner5, 5), null);
  const corner4 = Array(16).fill(false);
  corner4[0] = true; // 4×4도 마찬가지
  assert.equal(L.solve(corner4, 4), null);
  assert.deepEqual(L.solve(Array(9).fill(false), 3), []);
});

test('힌트: 힌트 칸을 누르면 남은 최소 횟수가 정확히 1 줄어든다', () => {
  for (const id of L.DIFFICULTY_IDS) {
    for (const date of dates(200)) {
      const { board, size } = L.generatePuzzle(date, id);
      const index = L.hint(board, size);
      const before = L.solve(board, size).length;
      L.press(board, index, size);
      assert.equal(L.solve(board, size).length, before - 1, `${id} ${date}`);
    }
  }
});

test('힌트: 엉뚱한 칸을 누른 뒤에도, 힌트만 따라가면 최소 횟수로 끝난다', () => {
  for (const id of L.DIFFICULTY_IDS) {
    const { size } = L.DIFFICULTIES[id];
    const rng = L.seededRandom(42);
    for (const date of dates(100)) {
      const { board } = L.generatePuzzle(date, id);
      for (let k = 0; k < 3; k++) L.press(board, Math.floor(rng() * size * size), size); // 실수 3번
      const remaining = L.solve(board, size).length;
      let steps = 0;
      while (!L.isSolved(board)) {
        L.press(board, L.hint(board, size), size);
        steps++;
        assert.ok(steps <= remaining, '힌트가 최소 횟수보다 오래 걸리면 안 됨');
      }
      assert.equal(steps, remaining);
    }
  }
  assert.equal(L.hint(Array(9).fill(false), 3), null, '이미 풀린 보드에는 힌트 없음');
});

test('누르기 규칙: 본인과 상하좌우만 바뀐다 (가장자리 포함)', () => {
  const sorted = a => a.sort((x, y) => x - y);
  assert.deepEqual(sorted(L.affected(12, 5)), [7, 11, 12, 13, 17]);
  assert.deepEqual(sorted(L.affected(0, 5)), [0, 1, 5]);
  assert.deepEqual(sorted(L.affected(4, 3)), [1, 3, 4, 5, 7]);
  assert.deepEqual(sorted(L.affected(15, 4)), [11, 14, 15]);
  const board = Array(16).fill(false);
  L.press(board, 5, 4);
  L.press(board, 5, 4);
  assert.ok(L.isSolved(board), '같은 칸을 두 번 누르면 원래대로');
});

test('승리 판정: 모두 꺼졌을 때만 성공', () => {
  const { board, size } = L.generatePuzzle('2026-11-01', 'hard');
  const solution = L.solve(board, size);
  for (const p of solution) {
    assert.equal(L.isSolved(board), false);
    L.press(board, p, size);
  }
  assert.equal(L.isSolved(board), true);
});

test('한국 날짜(KST) 경계: 자정 직전/직후, 사용자 시간대 무관', () => {
  // 2026-11-01 00:00 KST == 2026-10-31 15:00 UTC
  const midnight = Date.UTC(2026, 9, 31, 15, 0, 0);
  assert.equal(L.dateKeyKST(midnight - 1), '2026-10-31');
  assert.equal(L.dateKeyKST(midnight), '2026-11-01');
  assert.equal(L.msUntilNextKSTMidnight(midnight - 1000), 1000);
  assert.equal(L.msUntilNextKSTMidnight(midnight), DAY);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3 * 60 * 60 * 1000 + 777) {
    assert.equal(L.dateKeyKST(t), fmt.format(t));
  }
});

test('새로고침 후 진행 상황 복원: 난이도별 진행과 기록이 그대로 돌아온다', () => {
  const today = '2026-11-01';
  const store = L.createStore();
  const { board } = L.generatePuzzle(today, 'normal');
  L.press(board, 3, 4);
  store.difficulty = 'normal';
  store.progress.normal = { date: today, board, moves: 1, hints: 0 };
  store.history.easy['2026-10-31'] = { moves: 5, hints: 1, minMoves: 4 };

  const restored = L.parseStore(L.serializeStore(store), today);
  assert.deepEqual(restored, store);
  restored.progress.normal.board[0] = !restored.progress.normal.board[0];
  assert.notDeepEqual(restored.progress.normal.board, board, '복원된 보드는 원본과 분리된 복사본');

  const tomorrow = L.parseStore(L.serializeStore(store), '2026-11-02');
  assert.equal(tomorrow.progress.normal, undefined, '다음 날에는 진행 중인 판을 버림');
  assert.deepEqual(tomorrow.history.easy, store.history.easy, '기록은 날짜가 바뀌어도 유지');
});

test('손상되거나 조작된 저장 데이터는 안전하게 무시한다', () => {
  const today = '2026-11-01';
  const empty = L.createStore();
  for (const raw of [null, undefined, '', '{', 'null', '"text"', '[]', '42', '{"version":1}']) {
    assert.deepEqual(L.parseStore(raw, today), empty, `통과하면 안 됨: ${raw}`);
  }

  const good = L.generatePuzzle(today, 'hard').board;
  const corner = Array(25).fill(false);
  corner[0] = true;
  const badProgress = [
    { date: today, board: good.slice(0, 24), moves: 1, hints: 0 },
    { date: today, board: good.map(Number), moves: 1, hints: 0 },
    { date: today, board: good, moves: -1, hints: 0 },
    { date: today, board: good, moves: 1.5, hints: 0 },
    { date: today, board: good, moves: '3', hints: 0 },
    { date: today, board: good, moves: 1e12, hints: 0 },
    { date: today, board: good, moves: 1 },
    { date: today, board: corner, moves: 4, hints: 0 }, // 풀 수 없는 보드
    { date: today, board: Array(9).fill(false), moves: 1, hints: 0 }, // 다른 크기
  ];
  for (const p of badProgress) {
    const parsed = L.parseStore(JSON.stringify({ version: 2, progress: { hard: p }, history: {} }), today);
    assert.equal(parsed.progress.hard, undefined, `통과하면 안 됨: ${JSON.stringify(p).slice(0, 80)}`);
  }

  // 일부만 손상되면 멀쩡한 부분은 살린다
  const mixed = L.parseStore(JSON.stringify({
    version: 2,
    difficulty: '__proto__',
    history: {
      easy: { '2026-10-30': { moves: 4, hints: 0, minMoves: 4 }, 'not-a-date': { moves: 4, hints: 0, minMoves: 4 }, '2026-10-29': { moves: 0, hints: 0, minMoves: 4 } },
      hard: 'broken',
    },
  }), today);
  assert.equal(mixed.difficulty, L.DEFAULT_DIFFICULTY);
  assert.deepEqual(mixed.history.easy, { '2026-10-30': { moves: 4, hints: 0, minMoves: 4 } });
  assert.deepEqual(mixed.history.hard, {});
});

test('기록 관리: 같은 날 다시 풀면 더 좋은 기록만 남기고, 통계를 계산한다', () => {
  const store = L.createStore();
  const date = '2026-11-01';
  assert.equal(L.recordResult(store, 'easy', date, { moves: 7, hints: 1, minMoves: 4 }), true);
  assert.equal(L.recordResult(store, 'easy', date, { moves: 5, hints: 2, minMoves: 4 }), false, '힌트를 더 쓰면 더 나쁜 기록');
  assert.equal(L.recordResult(store, 'easy', date, { moves: 9, hints: 0, minMoves: 4 }), true, '힌트 없이 풀면 더 좋은 기록');
  assert.equal(L.recordResult(store, 'easy', date, { moves: 4, hints: 0, minMoves: 4 }), true);
  assert.deepEqual(store.history.easy[date], { moves: 4, hints: 0, minMoves: 4 });
  assert.deepEqual(store.history.hard, {}, '다른 난이도 기록에는 영향 없음');

  L.recordResult(store, 'easy', '2026-10-31', { moves: 6, hints: 0, minMoves: 5 });
  L.recordResult(store, 'easy', '2026-10-30', { moves: 6, hints: 1, minMoves: 5 });
  assert.deepEqual(L.statsFor(store, 'easy'), { cleared: 3, perfect: 1, noHint: 2 });
  assert.deepEqual(L.statsFor(store, 'normal'), { cleared: 0, perfect: 0, noHint: 0 });
});

// ── 4단계: 날짜 계산, 연속 기록, 달력, 공유, 백업 ──────────────

function storeWith(entries) { // entries: [[difficulty, date, moves, hints, minMoves], ...]
  const store = L.createStore();
  for (const [id, date, moves, hints = 0, minMoves = moves] of entries) store.history[id][date] = { moves, hints, minMoves };
  return store;
}

test('날짜 더하기: 월말·연말·윤년 경계', () => {
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDays('2028-02-28', 1), '2028-02-29', '2028년은 윤년');
  assert.equal(L.addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(L.addDays('2026-01-01', -1), '2025-12-31');
  assert.ok(L.isValidDate('2028-02-29'));
  for (const bad of ['2027-02-29', '2026-13-01', '2026-11-31', '2026-1-01', 'today', 20261101, null]) {
    assert.ok(!L.isValidDate(bad), `거부해야 함: ${bad}`);
  }
});

test('달력: 월의 시작 요일과 날짜 수', () => {
  const nov = L.monthDays(2026, 11);
  assert.equal(nov.firstWeekday, 0, '2026-11-01은 일요일');
  assert.equal(nov.dates.length, 30);
  assert.equal(nov.dates[0], '2026-11-01');
  assert.equal(nov.dates[29], '2026-11-30');
  assert.equal(L.monthDays(2028, 2).dates.length, 29);
  assert.equal(L.monthDays(2027, 2).dates.length, 28);
});

test('연속 성공: 오늘 풀었으면 오늘부터, 아직이면 어제부터 센다', () => {
  const today = '2026-11-01';
  const s = storeWith([['easy', '2026-10-30', 4], ['hard', '2026-10-31', 9]]);
  assert.deepEqual(L.streaks(s, today), { current: 2, best: 2, todayCleared: false }, '오늘 아직 → 어제까지 2일 유지');
  s.history.normal[today] = { moves: 6, hints: 1, minMoves: 5 };
  assert.deepEqual(L.streaks(s, today), { current: 3, best: 3, todayCleared: true });
  assert.equal(L.streaks(s, '2026-11-03').current, 0, '하루를 건너뛰면 끊김');
});

test('연속 성공: 여러 난이도를 같은 날 풀어도 하루로 세고, 연말을 넘어 이어진다', () => {
  const s = storeWith([
    ['easy', '2026-12-30', 4], ['hard', '2026-12-30', 9], ['normal', '2026-12-31', 5], ['easy', '2027-01-01', 4],
    ['easy', '2026-12-01', 4], ['easy', '2026-12-02', 4],
  ]);
  assert.deepEqual(L.streaks(s, '2027-01-01'), { current: 3, best: 3, todayCleared: true });
  assert.deepEqual(L.totalStats(s), { days: 5, perfect: 6 });
  assert.deepEqual(L.streaks(L.createStore(), '2027-01-01'), { current: 0, best: 0, todayCleared: false });
});

test('오늘의 기록 공유 문구', () => {
  const today = '2026-11-01';
  const s = storeWith([['easy', today, 4], ['normal', today, 7, 2, 5], ['easy', '2026-10-31', 4]]);
  assert.equal(L.dailyShareText(s, today), [
    'Daily Lights 2026-11-01',
    '초급 3×3  🟩🟩🟩🟩 🌟 퍼펙트',
    '중급 4×4  🟩🟩🟩🟩🟩🟨🟨 7번 💡2',
    '고급 5×5  ⬜ 아직',
    '퀘스트 6×6  ⬜ 아직',
    '🔥 2일 연속 성공',
  ].join('\n'));
});

test('공유 그림: 시작 보드와 결과 막대', () => {
  const board = [true, false, false, false, true, false, false, true, true];
  assert.equal(L.boardEmoji(board, 3), '🟩⬛⬛\n⬛🟩⬛\n⬛🟩🟩');
  assert.equal(L.movesBar({ moves: 4, minMoves: 4 }), '🟩🟩🟩🟩');
  assert.equal(L.movesBar({ moves: 6, minMoves: 4 }), '🟩🟩🟩🟩🟨🟨');
  assert.equal(L.movesBar({ moves: 30, minMoves: 10 }), `${'🟩'.repeat(10)}${'🟨'.repeat(5)}+15`, '길면 줄임');
});

test('한 판 결과 공유 문구: 정답(누른 칸)은 들어가지 않는다', () => {
  const date = '2026-11-01';
  const { board, minMoves } = L.generatePuzzle(date, 'easy');
  const text = L.resultShareText({ date, difficulty: 'easy', board, result: { moves: minMoves + 2, hints: 1, minMoves }, streak: 3 });
  const lines = text.split('\n');
  assert.equal(lines[0], 'Daily Lights 2026-11-01 · 초급 3×3');
  assert.equal(lines.slice(1, 4).join('\n'), L.boardEmoji(board, 3), '시작 보드 그림');
  assert.equal(lines[4], `${L.movesBar({ moves: minMoves + 2, minMoves })} ${minMoves + 2}번 (최소 ${minMoves})`);
  assert.deepEqual(lines.slice(5), ['💡 힌트 1회', '🔥 3일 연속 성공']);

  const perfect = L.resultShareText({ date, difficulty: 'easy', board, result: { moves: minMoves, hints: 0, minMoves }, streak: 1 });
  assert.ok(perfect.endsWith(`🌟 퍼펙트! ${minMoves}번`), '퍼펙트, 연속 1일은 표시 안 함');

  const archive = L.resultShareText({ date, difficulty: 'easy', board, result: { moves: minMoves, hints: 0, minMoves }, streak: 5, archive: true });
  assert.ok(archive.startsWith('Daily Lights 2026-11-01 (지난 퍼즐)') && !archive.includes('🔥'), '지난 퍼즐은 연속 표시 안 함');
});

test('백업 → 복원: 내보낸 파일을 그대로 불러올 수 있다', () => {
  const today = '2026-11-01';
  const s = storeWith([['easy', '2026-10-31', 4], ['hard', today, 10, 1, 9]]);
  s.progress.hard = { date: today, board: L.generatePuzzle(today, 'hard').board, moves: 0, hints: 0 };
  const restored = L.parseBackup(L.createBackup(s, '2026-11-01T00:00:00Z'), today);
  assert.deepEqual(restored, s);
});

test('백업 복원: Daily Lights 백업이 아니거나 망가진 파일은 거부한다', () => {
  const today = '2026-11-01';
  for (const text of ['', 'hello', '{}', '[]', 'null', '{"app":"other","store":{"version":2}}',
    '{"app":"daily-lights"}', '{"app":"daily-lights","store":{"version":1}}']) {
    assert.equal(L.parseBackup(text, today), null, `거부해야 함: ${text}`);
  }
  const partlyBroken = JSON.stringify({ app: 'daily-lights', store: { version: 2, history: {
    easy: { '2026-10-31': { moves: 4, hints: 0, minMoves: 4 }, '2026-02-30': { moves: 4, hints: 0, minMoves: 4 } },
    hard: { '2026-10-31': { moves: 'many' } },
  } } });
  const parsed = L.parseBackup(partlyBroken, today);
  assert.deepEqual(parsed.history.easy, { '2026-10-31': { moves: 4, hints: 0, minMoves: 4 } }, '멀쩡한 기록만 살림');
  assert.deepEqual(parsed.history.hard, {});
});

test('백업 합치기: 새 날짜는 추가, 같은 날짜는 더 좋은 기록만, 기존 기록은 사라지지 않음', () => {
  const current = storeWith([['easy', '2026-10-30', 6, 1, 4], ['easy', '2026-10-31', 4], ['hard', '2026-10-31', 9]]);
  const incoming = storeWith([
    ['easy', '2026-10-30', 4],          // 더 좋음 → 갱신
    ['easy', '2026-10-31', 7, 2, 4],    // 더 나쁨 → 무시
    ['normal', '2026-10-29', 5],        // 새 기록 → 추가
  ]);
  assert.deepEqual(L.mergeHistory(current, incoming), { added: 1, improved: 1 });
  assert.deepEqual(current.history.easy, {
    '2026-10-30': { moves: 4, hints: 0, minMoves: 4 },
    '2026-10-31': { moves: 4, hints: 0, minMoves: 4 },
  });
  assert.deepEqual(current.history.normal, { '2026-10-29': { moves: 5, hints: 0, minMoves: 5 } });
  assert.deepEqual(current.history.hard, { '2026-10-31': { moves: 9, hints: 0, minMoves: 9 } });
  assert.deepEqual(L.mergeHistory(current, incoming), { added: 0, improved: 0 }, '두 번 불러와도 변화 없음');
});

// ── 지난 퍼즐 다시 풀기 ─────────────────────────────────────

test('지난 퍼즐로 열 수 있는 날짜: 시작일 ~ 어제', () => {
  const today = '2026-11-01';
  assert.equal(L.ARCHIVE_START, '2026-10-01');
  assert.ok(L.isArchiveDate('2026-10-01', today));
  assert.ok(L.isArchiveDate('2026-10-31', today));
  for (const bad of ['2026-09-30', today, '2026-11-02', '2026-10-32', 'yesterday']) {
    assert.ok(!L.isArchiveDate(bad, today), `열면 안 됨: ${bad}`);
  }
});

test('나중에 푼 기록(late)은 연속 성공에 넣지 않지만 성공한 날에는 센다', () => {
  const today = '2026-11-01';
  const s = L.createStore();
  s.history.easy['2026-10-31'] = { moves: 4, hints: 0, minMoves: 4 };
  s.history.easy['2026-10-30'] = { moves: 4, hints: 0, minMoves: 4, late: true }; // 나중에 메꾼 날
  s.history.easy['2026-10-29'] = { moves: 4, hints: 0, minMoves: 4 };
  assert.deepEqual(L.streaks(s, today), { current: 1, best: 1, todayCleared: false });
  assert.deepEqual(L.totalStats(s), { days: 3, perfect: 3 });
  assert.equal(L.statsFor(s, 'easy').cleared, 3);
});

test('당일 기록은 나중에 푼 기록으로 덮어쓰지 않는다', () => {
  const s = L.createStore();
  const date = '2026-10-20';
  assert.equal(L.recordResult(s, 'easy', date, { moves: 9, hints: 3, minMoves: 4 }), true);
  assert.equal(L.recordResult(s, 'easy', date, { moves: 4, hints: 0, minMoves: 4, late: true }), false, '더 좋아도 당일 기록 유지');
  assert.deepEqual(s.history.easy[date], { moves: 9, hints: 3, minMoves: 4 });

  const other = '2026-10-21';
  L.recordResult(s, 'easy', other, { moves: 8, hints: 1, minMoves: 4, late: true });
  assert.equal(L.recordResult(s, 'easy', other, { moves: 5, hints: 0, minMoves: 4, late: true }), true, '나중 기록끼리는 더 좋은 쪽');
  assert.deepEqual(s.history.easy[other], { moves: 5, hints: 0, minMoves: 4, late: true });

  // 백업 합치기: 다른 기기에서 당일에 푼 기록이 오면 그것이 우선
  const incoming = L.createStore();
  incoming.history.easy[other] = { moves: 7, hints: 2, minMoves: 4 };
  assert.deepEqual(L.mergeHistory(s, incoming), { added: 0, improved: 1 });
  assert.deepEqual(s.history.easy[other], { moves: 7, hints: 2, minMoves: 4 });
});

test('지난 퍼즐 진행 상황 저장·복원과 검증', () => {
  const today = '2026-11-01';
  const date = '2026-10-15';
  const { board } = L.generatePuzzle(date, 'normal');
  L.press(board, 5, 4);
  const s = L.createStore();
  s.archive.normal = { date, board, moves: 1, hints: 0 };
  s.history.normal[date] = { moves: 6, hints: 0, minMoves: 6, late: true };
  assert.deepEqual(L.parseStore(L.serializeStore(s), today), s);

  const bad = [
    { date: today, board, moves: 1, hints: 0 },           // 오늘은 지난 퍼즐이 아님
    { date: '2026-09-01', board, moves: 1, hints: 0 },    // 시작일 이전
    { date, board: board.slice(0, 9), moves: 1, hints: 0 },
    { date, board, moves: -1, hints: 0 },
  ];
  for (const a of bad) {
    const parsed = L.parseStore(JSON.stringify({ version: 2, archive: { normal: a } }), today);
    assert.equal(parsed.archive.normal, undefined, `거부해야 함: ${a.date}`);
  }
  const weird = L.parseStore(JSON.stringify({ version: 2, history: { easy: { [date]: { moves: 4, hints: 0, minMoves: 4, late: 'yes' } } } }), today);
  assert.deepEqual(weird.history.easy, {}, 'late 가 true/false 가 아니면 거부');
});

// ── 일일 퀘스트 ─────────────────────────────────────────────

test('퀘스트: 10년치 모두 6×6, 최소 20~24번, 제한 = 최소 + 여유 횟수, 정답은 하나뿐', () => {
  for (const date of TEN_YEARS) {
    const p = L.generatePuzzle(date, 'quest');
    assert.equal(p.size, 6);
    assert.ok(p.minMoves >= 20 && p.minMoves <= 24, `${date}: 최소 ${p.minMoves}번`);
    assert.equal(p.moveLimit, p.minMoves + L.DIFFICULTIES.quest.extraMoves);
    assert.ok(solvedBy(p.board, 6, L.solve(p.board, 6)));
  }
  // 6×6 은 어떤 배치든 해답이 정확히 하나 → 돌아가는 다른 길이 없음
  const rng = L.seededRandom(7);
  for (let t = 0; t < 200; t++) {
    const board = Array.from({ length: 36 }, () => rng() < 0.5);
    assert.ok(L.solve(board, 6), '6×6 은 항상 풀 수 있음');
  }
  assert.equal(L.generatePuzzle('2026-11-01', 'hard').moveLimit, undefined, '일반 난이도에는 제한 없음');
});

test('퀘스트 공유 문구', () => {
  const date = '2026-11-01';
  const p = L.generatePuzzle(date, 'quest');
  const text = L.resultShareText({ date, difficulty: 'quest', board: p.board, result: { moves: p.minMoves + 3, hints: 0, minMoves: p.minMoves }, streak: 2 });
  const lines = text.split('\n');
  assert.equal(lines[0], 'Daily Lights 2026-11-01 · 🏆 퀘스트 6×6');
  assert.equal(lines.length, 1 + 6 + 1 + 1, '제목 + 6줄 보드 + 결과 + 연속');
  assert.ok(lines[7].endsWith(`🏆 퀘스트 클리어! ${p.minMoves + 3}번 (최소 ${p.minMoves})`), lines[7]);
  assert.ok(lines[7].includes('+'), '긴 막대는 +N 으로 줄임');
});
