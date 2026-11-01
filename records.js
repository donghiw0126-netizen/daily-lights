'use strict';
// 기록 창 담당: 연속 성공, 전체 통계, 달력, 오늘의 기록 공유, 백업·복원
// 기록 데이터는 game.js 가 가지고 있고, init(...) 으로 꺼내 쓰는 방법을 넘겨 줍니다.
window.DailyLightsRecords = (function () {
  const Logic = window.DailyLightsLogic;
  const MAX_BACKUP_BYTES = 1024 * 1024; // 1MB: 10년치 기록도 수백 KB를 넘지 않습니다.
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const $ = sel => document.querySelector(sel);
  const dialog = $('#records');
  const calendarDaysEl = $('#calendarDays');
  const statusEl = $('#recordsStatus');

  let app = null;  // { getStore, getToday, getPlayDate, share, onImport, openDate }
  let viewYear = 0;
  let viewMonth = 0; // 1~12

  // ── 그리기 ──────────────────────────────────────────────

  function render() {
    const store = app.getStore();
    const today = app.getToday();
    const streak = Logic.streaks(store, today);
    const total = Logic.totalStats(store);

    $('#streakCurrent').textContent = String(streak.current);
    $('#streakBest').textContent = String(streak.best);
    $('#totalDays').textContent = String(total.days);
    $('#totalPerfect').textContent = String(total.perfect);
    $('#streakNote').textContent = streakNote(streak);

    // 🏆 퀘스트 요약: 클리어 횟수, 연속 클리어(당일 기준), 최단 시간
    const quest = Logic.questStats(store, today);
    const fastest = quest.fastestMs === null ? '' : ` · 최단 ${Logic.formatDuration(quest.fastestMs)}`;
    $('#questSummary').textContent = quest.cleared
      ? `🏆 퀘스트 클리어 ${quest.cleared}회 · 연속 ${quest.current}일 · 최고 연속 ${quest.best}일${fastest}`
      : '🏆 아직 깬 퀘스트가 없어요. 6×6 퀘스트에 도전해 보세요!';
    $('#shareToday').disabled = !streak.todayCleared;
    $('#shareToday').title = streak.todayCleared ? '' : '오늘 퍼즐을 하나 이상 풀면 공유할 수 있어요.';

    $('#difficultyRows').replaceChildren(...Logic.DIFFICULTY_IDS.map(id => {
      const { label, size } = Logic.DIFFICULTIES[id];
      const s = Logic.statsFor(store, id);
      const row = document.createElement('tr');
      row.innerHTML = `<th scope="row"><i class="dot ${id}" aria-hidden="true"></i>${label} <small>${size}×${size}</small></th>`
        + `<td>${s.cleared}일</td><td>${s.noHint}일</td><td>${s.perfect}일</td>`;
      return row;
    }));
    renderCalendar(store, today);
  }

  function streakNote({ current, todayCleared }) {
    if (current === 0) return '오늘 퍼즐을 풀고 연속 기록을 시작해 보세요!';
    if (!todayCleared) return `오늘도 풀면 ${current + 1}일 연속이에요. 자정(KST) 전에 도전하세요!`;
    return `오늘도 성공! 내일도 이어서 ${current + 1}일 연속에 도전해 보세요.`;
  }

  function renderCalendar(store, today) {
    const { firstWeekday, dates } = Logic.monthDays(viewYear, viewMonth);
    $('#calendarTitle').textContent = `${viewYear}년 ${viewMonth}월`;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) { // 1일 앞의 빈칸
      const blank = document.createElement('li');
      blank.className = 'blank';
      blank.setAttribute('aria-hidden', 'true');
      cells.push(blank);
    }
    for (const date of dates) {
      const results = Logic.DIFFICULTY_IDS
        .map(id => ({ id, result: store.history[id][date] }))
        .filter(x => x.result);
      const day = Number(date.slice(8));
      const weekday = WEEKDAYS[(firstWeekday + day - 1) % 7];
      // 오늘과 지난 퍼즐 날짜는 눌러서 열 수 있는 버튼, 나머지(미래·시작일 이전)는 그냥 칸
      const playable = date === today || Logic.isArchiveDate(date, today);
      const item = document.createElement('li');
      const cell = document.createElement(playable ? 'button' : 'div');
      if (playable) {
        cell.type = 'button';
        cell.addEventListener('click', () => { close(); app.openDate(date); });
      }
      cell.className = 'day';
      cell.classList.toggle('playable', playable);
      cell.classList.toggle('cleared', results.length > 0);
      cell.classList.toggle('today', date === today);
      cell.classList.toggle('playing', date === app.getPlayDate());
      cell.classList.toggle('future', date > today);
      item.appendChild(cell);

      const num = document.createElement('span');
      num.className = 'num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = String(day);
      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.setAttribute('aria-hidden', 'true');
      for (const { id, result } of results) {
        const dot = document.createElement('i');
        dot.className = `dot ${id}`;
        dot.classList.toggle('late', Boolean(result.late)); // 나중에 푼 날은 속이 빈 점
        dots.appendChild(dot);
      }
      cell.append(num, dots);
      if (results.some(x => Logic.isPerfect(x.result))) {
        const star = document.createElement('b');
        star.className = 'star';
        star.setAttribute('aria-hidden', 'true');
        star.textContent = '★';
        cell.appendChild(star);
      }

      // 화면 읽기 프로그램용 설명: "11월 1일 일요일 (오늘): 초급 퍼펙트, 고급 성공"
      // (aria-label 보다 숨김 글자가 여러 화면 읽기 프로그램에서 더 확실하게 읽힙니다)
      const summary = results.length
        ? results.map(({ id, result }) => {
          const label = `${Logic.DIFFICULTIES[id].label} ${Logic.isPerfect(result) ? '퍼펙트' : '성공'}`;
          return result.late ? `${label}(나중에 풂)` : label;
        }).join(', ')
        : '기록 없음';
      const description = document.createElement('span');
      description.className = 'sr-only';
      description.textContent = `${viewMonth}월 ${day}일 ${weekday}요일${date === today ? ' (오늘)' : ''}: ${summary}`
        + (playable ? '. 눌러서 퍼즐 열기' : '');
      cell.appendChild(description);
      cells.push(item);
    }
    calendarDaysEl.replaceChildren(...cells);

    // 이동 범위: (지난 퍼즐 시작일과 첫 기록 중 이른 달) ~ 이번 달
    const thisMonth = today.slice(0, 7);
    const firstRecord = [...Logic.clearedDates(store)].sort()[0] || today;
    const earliest = firstRecord < Logic.ARCHIVE_START ? firstRecord : Logic.ARCHIVE_START;
    const shown = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
    $('#nextMonth').disabled = shown >= thisMonth;
    $('#prevMonth').disabled = shown <= earliest.slice(0, 7);
  }

  function moveMonth(delta) {
    const index = viewYear * 12 + (viewMonth - 1) + delta;
    viewYear = Math.floor(index / 12);
    viewMonth = (index % 12) + 1;
    renderCalendar(app.getStore(), app.getToday());
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
  }

  // ── 열기·닫기 ───────────────────────────────────────────

  function open() {
    [viewYear, viewMonth] = app.getPlayDate().split('-').map(Number); // 지금 풀고 있는 날짜의 달부터
    setStatus('');
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', ''); // 아주 오래된 브라우저 대비
  }

  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  // ── 공유 ───────────────────────────────────────────────

  async function shareToday() {
    const outcome = await app.share(Logic.dailyShareText(app.getStore(), app.getToday()));
    if (outcome === 'copied') setStatus('오늘의 기록을 복사했어요! 친구에게 붙여넣어 보세요.');
    else if (outcome === 'failed') setStatus('공유하지 못했어요. 다시 시도해 주세요.', true);
  }

  // ── 백업·복원 ───────────────────────────────────────────

  function exportBackup() {
    try {
      const blob = new Blob([Logic.createBackup(app.getStore())], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `daily-lights-backup-${app.getToday()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('백업 파일을 내려받았어요. 안전한 곳에 보관하세요.');
    } catch (e) {
      setStatus('백업 파일을 만들지 못했어요.', true);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setStatus('파일이 너무 커요. Daily Lights 백업 파일인지 확인해 주세요.', true); return; }
    let text;
    try { text = await file.text(); } catch (e) { setStatus('파일을 읽지 못했어요.', true); return; }

    const incoming = Logic.parseBackup(text, app.getToday());
    if (!incoming) { setStatus('Daily Lights 백업 파일이 아니거나 손상된 파일이에요.', true); return; }

    const { added, improved } = app.onImport(incoming);
    render();
    setStatus(added + improved
      ? `기록을 합쳤어요. 새 기록 ${added}개, 더 좋은 기록으로 바뀐 날 ${improved}개.`
      : '새로 합칠 기록이 없어요. 이미 모두 들어 있어요.');
  }

  // ── 시작 ───────────────────────────────────────────────

  function init(options) {
    app = options;
    $('#openRecords').addEventListener('click', open);
    $('#closeRecords').addEventListener('click', close);
    dialog.addEventListener('click', event => { // 창 바깥(어두운 배경)을 누르면 닫기
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      if (outside) close();
    });
    $('#prevMonth').addEventListener('click', () => moveMonth(-1));
    $('#nextMonth').addEventListener('click', () => moveMonth(1));
    $('#shareToday').addEventListener('click', shareToday);
    $('#exportBackup').addEventListener('click', exportBackup);
    $('#importBackup').addEventListener('click', () => $('#backupFile').click());
    $('#backupFile').addEventListener('change', event => {
      importBackup(event.target.files[0]);
      event.target.value = ''; // 같은 파일을 다시 골라도 change 가 일어나도록
    });
  }

  return { init, render: () => { if (dialog.open) render(); } };
})();
