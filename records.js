'use strict';
// 기록 창 담당: 연속 성공, 전체 통계, 달력, 오늘의 기록 공유, 백업·복원
// 기록 데이터는 game.js 가 가지고 있고, init(...) 으로 꺼내 쓰는 방법을 넘겨 줍니다.
// 화면 문구는 i18n.js 에 있습니다.
window.DailyLightsRecords = (function () {
  const Logic = window.DailyLightsLogic;
  const I18n = window.DailyLightsI18n;
  const t = (key, params) => I18n.t(key, params);
  const MAX_BACKUP_BYTES = 1024 * 1024; // 1MB: 10년치 기록도 수백 KB를 넘지 않습니다.

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
    const fastest = quest.fastestMs === null ? '' : t('rec.questFastest', { time: I18n.formatDuration(quest.fastestMs) });
    $('#questSummary').textContent = quest.cleared
      ? t('rec.questSummary', { cleared: quest.cleared, current: quest.current, best: quest.best, fastest })
      : t('rec.questNone');
    $('#shareToday').disabled = !streak.todayCleared;
    $('#shareToday').title = streak.todayCleared ? '' : t('rec.shareTodayDisabled');

    $('#difficultyRows').replaceChildren(...Logic.DIFFICULTY_IDS.map(id => {
      const { size } = Logic.DIFFICULTIES[id];
      const s = Logic.statsFor(store, id);
      const row = document.createElement('tr');
      const head = document.createElement('th');
      head.scope = 'row';
      const dot = document.createElement('i');
      dot.className = `dot ${id}`;
      dot.setAttribute('aria-hidden', 'true');
      const small = document.createElement('small');
      small.textContent = `${size}×${size}`;
      head.append(dot, `${t(`diff.${id}`)} `, small);
      row.appendChild(head);
      for (const n of [s.cleared, s.noHint, s.perfect]) {
        const cell = document.createElement('td');
        cell.textContent = t('rec.cellDays', { n });
        row.appendChild(cell);
      }
      return row;
    }));
    renderCalendar(store, today);
  }

  function streakNote({ current, todayCleared }) {
    if (current === 0) return t('rec.noteStart');
    return t(todayCleared ? 'rec.noteDone' : 'rec.noteKeep', { next: current + 1 });
  }

  function renderCalendar(store, today) {
    const { firstWeekday, dates } = Logic.monthDays(viewYear, viewMonth);
    $('#calendarTitle').textContent = I18n.calendarTitle(viewYear, viewMonth);

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
      const weekday = t(`wd${(firstWeekday + day - 1) % 7}`);
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
          const label = `${t(`diff.${id}`)} ${t(Logic.isPerfect(result) ? 'cal.perfect' : 'cal.cleared')}`;
          return result.late ? label + t('cal.late') : label;
        }).join(', ')
        : t('cal.none');
      const description = document.createElement('span');
      description.className = 'sr-only';
      description.textContent = t('cal.day', {
        month: viewMonth, monthName: I18n.monthName(viewMonth), day, weekday,
        today: date === today ? t('cal.today') : '', summary, open: playable ? t('cal.open') : '',
      });
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
    const outcome = await app.share(Logic.dailyShareText(app.getStore(), app.getToday(), t));
    if (outcome === 'copied') setStatus(t('rec.copied'));
    else if (outcome === 'failed') setStatus(t('msg.shareFailed'), true);
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
      setStatus(t('rec.exported'));
    } catch (e) {
      setStatus(t('rec.exportFailed'), true);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setStatus(t('rec.tooBig'), true); return; }
    let text;
    try { text = await file.text(); } catch (e) { setStatus(t('rec.readFailed'), true); return; }

    const incoming = Logic.parseBackup(text, app.getToday());
    if (!incoming) { setStatus(t('rec.notBackup'), true); return; }

    const { added, improved } = app.onImport(incoming);
    render();
    setStatus(added + improved ? t('rec.merged', { added, improved }) : t('rec.nothingNew'));
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
    window.addEventListener('daily-lights:language', () => { if (dialog.open) render(); }); // 언어를 바꾸면 다시 그림
  }

  return { init, render: () => { if (dialog.open) render(); } };
})();
