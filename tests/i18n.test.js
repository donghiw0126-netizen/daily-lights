// 번역(i18n.js) 점검: 빠진 번역, 잘못된 빈칸, 영어에 섞인 한글, 없는 키 사용을 잡아냅니다.
// 실행: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../i18n.js');
const L = require('../logic.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const HANGUL = /[가-힣]/;
const { ko, en } = I18n.STRINGS;
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('한국어와 영어의 문구 목록이 정확히 짝이 맞다', () => {
  const koKeys = Object.keys(ko).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(koKeys.filter(k => !(k in en)), [], '영어 번역이 빠진 문구');
  assert.deepEqual(enKeys.filter(k => !(k in ko)), [], '한국어에는 없는 영어 문구');
});

test('같은 문구는 두 언어에서 {빈칸} 이름이 같다', () => {
  // 달력은 한국어가 {month}(11월), 영어가 {monthName}(November)을 씁니다. 코드에서 둘 다 넘기므로 같은 것으로 봅니다.
  const normalize = list => [...new Set(list.map(name => (name === 'monthName' ? 'month' : name)))].sort();
  for (const key of Object.keys(ko)) {
    assert.deepEqual(normalize(placeholders(en[key])), normalize(placeholders(ko[key])), `빈칸이 다름: ${key}`);
  }
});

test('영어 문구에 한글이 섞여 있지 않고, 빈 문구가 없다', () => {
  for (const [key, text] of Object.entries(en)) {
    assert.ok(!HANGUL.test(text), `영어 문구에 한글: ${key} = ${text}`);
    assert.ok(text.trim() !== '', `빈 영어 문구: ${key}`);
  }
  for (const [key, text] of Object.entries(ko)) assert.ok(text.trim() !== '', `빈 한국어 문구: ${key}`);
});

test('HTML 과 JS 가 쓰는 번역 키가 모두 번역 파일에 있다', () => {
  const used = new Set();
  const html = read('index.html');
  for (const m of html.matchAll(/data-i18n(?:-html|-aria)?="([\w.]+)"/g)) used.add(m[1]);
  for (const file of ['game.js', 'records.js', 'tutorial.js', 'settings.js', 'site.js', 'logic.js']) {
    const code = read(file);
    for (const m of code.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);           // t('키')
    for (const m of code.matchAll(/\bt\(\s*\w+\s*\?\s*'([\w.]+)'\s*:\s*'([\w.]+)'/g)) { used.add(m[1]); used.add(m[2]); } // t(조건 ? '키' : '키')
    for (const m of code.matchAll(/dataset\.i18n\s*=\s*'([\w.]+)'/g)) used.add(m[1]);
  }
  // 이름을 조합해서 쓰는 키들 (diff.easy, tut.1.title, wd0 …)
  for (const id of L.DIFFICULTY_IDS) used.add(`diff.${id}`);
  for (let i = 1; i <= 4; i++) { used.add(`tut.${i}.title`); used.add(`tut.${i}.text`); }
  for (let i = 0; i < 7; i++) used.add(`wd${i}`);

  assert.ok(used.size > 100, `찾은 키가 너무 적음: ${used.size}`);
  const missing = [...used].filter(key => !(key in ko));
  assert.deepEqual(missing, [], '번역 파일에 없는 키');
});

test('빈칸 채우기와 없는 키 처리', () => {
  const tr = I18n.translator('en');
  assert.equal(tr('msg.playing', { lit: 3 }), '3 lights left · Turn them all off.');
  assert.equal(I18n.translator('ko')('msg.playing', { lit: 3 }), '남은 불 3개 · 빛나는 타일을 모두 꺼 주세요.');
  assert.equal(tr('no.such.key'), 'no.such.key', '없는 키는 키 이름 그대로 (화면에서 바로 눈에 띔)');
  assert.equal(tr('game.par'), 'Best: {min}', '값을 안 주면 빈칸 그대로');
});

test('시간·날짜 표시: 한국어 / 영어', () => {
  assert.equal(I18n.formatDuration(45000, 'ko'), '45초');
  assert.equal(I18n.formatDuration(187000, 'ko'), '3분 7초');
  assert.equal(I18n.formatDuration(3723000, 'ko'), '1시간 2분');
  assert.equal(I18n.formatDuration(187000, 'en'), '3m 7s');
  assert.equal(I18n.formatDuration(3723000, 'en'), '1h 2m');
  I18n.setLang('en');
  assert.equal(I18n.calendarTitle(2026, 11), 'November 2026');
  I18n.setLang('ko');
  assert.equal(I18n.calendarTitle(2026, 11), '2026년 11월');
});

test('브라우저 언어로 처음 언어 고르기', () => {
  assert.equal(I18n.detectLang(['ko-KR', 'en-US']), 'ko');
  assert.equal(I18n.detectLang(['en-US', 'ko']), 'ko', '목록 어딘가에 한국어가 있으면 한국어');
  assert.equal(I18n.detectLang(['en-GB']), 'en');
  assert.equal(I18n.detectLang(['ja-JP']), 'en', '한국어가 아니면 영어');
  assert.equal(I18n.detectLang([]), 'en');
});

test('영어 공유 문구에 한글이 없다 (일반·퀘스트·오늘의 기록)', () => {
  const tr = I18n.translator('en');
  const date = '2026-11-01';
  const p = L.generatePuzzle(date, 'quest');
  const quest = L.resultShareText({
    date, difficulty: 'quest', board: p.board, t: tr, streak: 4, questStreak: 3,
    result: { moves: p.minMoves + 2, hints: 0, minMoves: p.minMoves, attempts: 2, timeMs: 192000 },
  });
  assert.ok(!HANGUL.test(quest), quest);
  assert.ok(quest.includes('🏆 Quest 6×6') && quest.includes('attempt #2') && quest.includes('3-day quest streak'), quest);

  const easy = L.generatePuzzle(date, 'easy');
  const past = L.resultShareText({ date, difficulty: 'easy', board: easy.board, t: tr, archive: true, result: { moves: 7, hints: 1, minMoves: 5 } });
  assert.ok(!HANGUL.test(past) && past.includes('(past puzzle)') && past.includes('hints used: 1'), past);

  const s = L.createStore();
  s.history.easy[date] = { moves: 4, hints: 0, minMoves: 4 };
  const daily = L.dailyShareText(s, date, tr);
  assert.ok(!HANGUL.test(daily), daily);
  assert.ok(daily.includes('Easy 3×3') && daily.includes('Quest 6×6  ⬜ not yet'), daily);
});
