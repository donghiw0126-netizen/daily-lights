'use strict';
// 번역(다국어): 화면에 보이는 모든 문구를 한국어·영어 짝으로 모아 둔 곳
// - 문구 안의 {이름} 자리에는 t('키', { 이름: 값 }) 으로 값을 채웁니다.
// - HTML 의 data-i18n="키" (글자), data-i18n-html="키" (굵게 등 태그 포함), data-i18n-aria="키" (화면 읽기용 이름)는
//   applyDom() 이 현재 언어로 바꿔 줍니다.
// 브라우저에서는 window.DailyLightsI18n, Node.js 테스트에서는 require('./i18n.js') 로 사용합니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DailyLightsI18n = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = ['ko', 'en'];

  const STRINGS = {
    ko: {
      'doc.title': 'Daily Lights | 오늘의 퍼즐',
      'doc.description': '하루에 하나씩 새로운 불 끄기 퍼즐. 3단계 난이도와 힌트로 누구나 즐길 수 있어요.',

      // 상단
      'top.records': '기록',
      'top.recordsAria': '나의 기록',
      'top.recordsAriaStreak': '나의 기록, {n}일 연속 성공 중',
      'top.settings': '설정',

      // 소개
      'hero.eyebrow': '매일 자정(KST) · 새로운 도전',
      'hero.title': '오늘의 불을<br><span>모두 꺼보세요.</span>',
      'hero.intro': '칸을 누르면 그 칸과 위·아래·양옆의 불이 바뀝니다. 최소한의 터치로 모든 불을 끄면 성공!',

      // 게임 카드
      'game.aria': '오늘의 퍼즐',
      'game.difficulty': '난이도',
      'diff.easy': '초급',
      'diff.normal': '중급',
      'diff.hard': '고급',
      'diff.quest': '퀘스트',
      'game.doneToday': ' 오늘 완료',
      'archive.bar': '지난 퍼즐을 풀고 있어요 · 연속 기록에는 포함되지 않아요',
      'archive.back': '오늘 퍼즐로',
      'quest.title': '오늘의 퀘스트',
      'quest.rule': '힌트 없이 {limit}번 안에 모든 불 끄기',
      'quest.meta': '⏱ {time} · {n}번째 도전',
      'game.labelToday': '오늘의 퍼즐',
      'game.labelPast': '지난 퍼즐',
      'game.moves': '움직임',
      'game.par': '최소 {min}번',
      'game.parQuest': '최소 {min} · 제한 {limit}',
      'game.boardAria': '{size}×{size} 퍼즐 보드. 방향키로 칸을 이동하고 Enter나 Space로 누르세요.',
      'game.reset': '다시 시작',
      'game.hint': '힌트',
      'game.noHint': '힌트 금지',
      'game.share': '결과 공유하기',
      'game.footnote': '진행 상황과 기록은 이 브라우저에 자동 저장됩니다. 날짜는 한국 표준시(KST) 기준으로 바뀝니다.',
      'game.storageOff': '⚠️ 이 브라우저에서는 저장이 꺼져 있어(사생활 보호 모드 등) 새로고침하면 진행 상황과 기록이 사라져요.',
      'tile.label': '{row}행 {col}열, {state}',
      'tile.on': '켜짐',
      'tile.off': '꺼짐',
      'tile.hinted': ', 힌트',

      // 안내 메시지
      'msg.playing': '남은 불 {lit}개 · 빛나는 타일을 모두 꺼 주세요.',
      'msg.playingQuest': '남은 불 {lit}개 · 남은 기회 {left}번',
      'msg.win': '✨ 성공! {moves}번 만에 모든 불을 껐어요. (최소 {min}번{hint})',
      'msg.winHint': ', 힌트 {n}회',
      'msg.perfect': '🌟 퍼펙트! 최소 횟수 {moves}번 만에 성공했어요.',
      'msg.questWin': '🏆 퀘스트 클리어! {moves}번 · {detail} (최소 {min} · 제한 {limit})',
      'msg.questPerfect': '🏆🌟 퀘스트 퍼펙트 클리어! 최소 횟수 {moves}번 · {detail}',
      'msg.fail': '😢 실패! 제한 {limit}번을 모두 썼어요. "다시 시작"으로 {next}번째 도전!',
      'msg.archiveSaved': '지난 퍼즐 기록으로 저장했어요.',
      'msg.archiveKept': '이 날의 기록은 그대로예요.',
      'msg.bestKept': '오늘 최고 기록은 그대로예요.',
      'msg.questStreak': '🏆 퀘스트 {n}일 연속 클리어!',
      'msg.streak': '🔥 {n}일 연속 성공!',
      'msg.hint': '💡 반짝이는 칸을 눌러 보세요. 앞으로 최소 {n}번이면 끝나요.',
      'msg.reset': '처음 상태로 되돌렸어요.',
      'msg.openedPast': '📅 {date} 퍼즐을 열었어요.',
      'msg.backToday': '오늘의 퍼즐로 돌아왔어요.',
      'msg.newDay': '새로운 날이 시작되어 오늘의 퍼즐을 불러왔어요.',
      'msg.copied': '결과를 복사했어요! 친구에게 붙여넣어 보세요.',
      'msg.shareFailed': '공유하지 못했어요. 다시 시도해 주세요.',
      'msg.copyPrompt': '아래 내용을 복사해 주세요:',
      'msg.error': '문제가 생겼어요. 페이지를 새로고침해 주세요.',

      // 기록 줄
      'stats.line': '{label} 기록 · 성공 {cleared}일 · 퍼펙트 {perfect}일{best}',
      'stats.bestToday': '오늘 최고',
      'stats.bestDay': '이 날 최고',
      'stats.best': ' · {label} {moves}번{hint}{time}',
      'stats.bestHint': '(힌트 {n})',

      // 게임 방법
      'guide.title': '처음이라면? 게임 방법',
      'guide.1': '칸을 누르면 <strong>그 칸과 상하좌우</strong> 4칸이 함께 켜지거나 꺼져요. (십자 모양)',
      'guide.2': '<strong>위에서 아래로 정리하기</strong><br>윗줄에 켜진 불이 있으면 <em>바로 아랫칸</em>을 누르세요. 윗줄 불이 꺼져요. 한 줄씩 내려가면 맨 아랫줄만 남아요.',
      'guide.3': '<strong>초급부터, 막히면 힌트</strong><br>3×3 초급으로 감을 익혀 보세요. 💡 힌트는 정답으로 가는 다음 칸을 알려 줘요. 힌트 없이 최소 횟수로 풀면 <em>퍼펙트</em>!',
      'guide.keyboard': '키보드: 방향키로 이동 · Enter/Space로 누르기',
      'guide.reopen': '처음 안내 다시 보기',

      // 앱 설치
      'install.title': '앱처럼 설치하기',
      'install.help': '홈 화면에서 바로 열고, 인터넷이 없어도 플레이할 수 있어요.',
      'install.ios': 'Safari 아래쪽 공유 버튼(□↑)을 누르고 "홈 화면에 추가"를 고르세요.',
      'install.button': '설치',
      'install.close': '설치 안내 닫기',

      // 하단
      'footer.text': 'Daily Lights · 학습용 오픈 웹게임 · ',
      'footer.privacy': '개인정보·쿠키 수집 없음',
      'footer.analytics': '쿠키 없는 익명 방문 통계만 사용',
      'donate.label': '☕ 개발자 응원하기',

      // 기록 창
      'rec.title': '나의 기록',
      'rec.close': '기록 창 닫기',
      'rec.current': '현재 연속',
      'rec.best': '최고 연속',
      'rec.days': '성공한 날',
      'rec.perfect': '퍼펙트',
      'rec.unitDays': '일',
      'rec.unitTimes': '회',
      'rec.noteStart': '오늘 퍼즐을 풀고 연속 기록을 시작해 보세요!',
      'rec.noteKeep': '오늘도 풀면 {next}일 연속이에요. 자정(KST) 전에 도전하세요!',
      'rec.noteDone': '오늘도 성공! 내일도 이어서 {next}일 연속에 도전해 보세요.',
      'rec.questSummary': '🏆 퀘스트 클리어 {cleared}회 · 연속 {current}일 · 최고 연속 {best}일{fastest}',
      'rec.questFastest': ' · 최단 {time}',
      'rec.questNone': '🏆 아직 깬 퀘스트가 없어요. 6×6 퀘스트에 도전해 보세요!',
      'rec.prevMonth': '이전 달',
      'rec.nextMonth': '다음 달',
      'rec.tableCaption': '난이도별 기록',
      'rec.colDiff': '난이도',
      'rec.colCleared': '성공',
      'rec.colNoHint': '힌트 없이',
      'rec.colPerfect': '퍼펙트',
      'rec.cellDays': '{n}일',
      'rec.shareToday': '오늘의 기록 공유',
      'rec.shareTodayDisabled': '오늘 퍼즐을 하나 이상 풀면 공유할 수 있어요.',
      'rec.export': '백업 내보내기',
      'rec.import': '백업 불러오기',
      'rec.help': '백업 파일을 다른 기기나 브라우저에서 불러오면 기록이 <strong>합쳐집니다</strong>. 같은 날짜는 더 좋은 기록이 남고, 지금 기록은 지워지지 않아요.',
      'rec.copied': '오늘의 기록을 복사했어요! 친구에게 붙여넣어 보세요.',
      'rec.exported': '백업 파일을 내려받았어요. 안전한 곳에 보관하세요.',
      'rec.exportFailed': '백업 파일을 만들지 못했어요.',
      'rec.tooBig': '파일이 너무 커요. Daily Lights 백업 파일인지 확인해 주세요.',
      'rec.readFailed': '파일을 읽지 못했어요.',
      'rec.notBackup': 'Daily Lights 백업 파일이 아니거나 손상된 파일이에요.',
      'rec.merged': '기록을 합쳤어요. 새 기록 {added}개, 더 좋은 기록으로 바뀐 날 {improved}개.',
      'rec.nothingNew': '새로 합칠 기록이 없어요. 이미 모두 들어 있어요.',

      // 달력
      'cal.title': '{year}년 {month}월',
      'cal.day': '{month}월 {day}일 {weekday}요일{today}: {summary}{open}',
      'cal.today': ' (오늘)',
      'cal.open': '. 눌러서 퍼즐 열기',
      'cal.none': '기록 없음',
      'cal.perfect': '퍼펙트',
      'cal.cleared': '성공',
      'cal.late': '(나중에 풂)',
      'cal.legendPerfect': '퍼펙트 포함',
      'cal.legendLate': '나중에 풂',
      'cal.tip': '날짜를 누르면 그날 퍼즐을 풀 수 있어요. (2026년 10월 1일부터)',
      'wd0': '일', 'wd1': '월', 'wd2': '화', 'wd3': '수', 'wd4': '목', 'wd5': '금', 'wd6': '토',

      // 처음 안내
      'tut.skip': '건너뛰기',
      'tut.prev': '이전',
      'tut.next': '다음',
      'tut.start': '시작하기',
      'tut.1.title': '모든 불을 끄면 성공!',
      'tut.1.text': '빛나는 타일을 하나도 남김없이 꺼 보세요. 적게 누를수록 좋은 기록이에요.',
      'tut.1.from': '시작',
      'tut.1.to': '성공',
      'tut.2.title': '누르면 십자 모양으로 바뀌어요',
      'tut.2.text': '칸을 누르면 그 칸과 위·아래·양옆의 불이 함께 켜지거나 꺼져요. 직접 눌러 보세요!',
      'tut.2.try': '👆 가운데 칸을 눌러 보세요.',
      'tut.2.nice': '좋아요! 누른 칸과 상하좌우가 함께 바뀌었죠?',
      'tut.2.clear': '모두 꺼졌어요! 같은 칸을 두 번 누르면 원래대로 돌아와요.',
      'tut.2.aria': '연습용 3×3 보드',
      'tut.2.cell': '{row}행 {col}열',
      'tut.3.title': '이렇게 풀어 보세요',
      'tut.3.text': '막막할 때 써 보는 요령이에요.',
      'tut.3.tip1': '윗줄에 켜진 불이 있으면 바로 아랫칸을 누르세요. 한 줄씩 내려가며 정리해요.',
      'tut.3.tip2': '막히면 힌트 버튼! 정답으로 가는 다음 칸을 알려 줘요.',
      'tut.3.tip3': '힌트 없이 최소 횟수로 풀면 퍼펙트예요.',
      'tut.4.title': '매일 새로운 퍼즐',
      'tut.4.text': '초급 3×3부터 시작해 보세요. 친구들과 같은 퍼즐로 기록을 비교할 수 있어요.',
      'tut.4.tip1': '매일 자정(한국 시간)에 새 퍼즐이 나와요.',
      'tut.4.tip2': '매일 풀면 연속 성공 기록이 쌓여요.',
      'tut.4.tip3': '자신 있다면 6×6 일일 퀘스트에 도전! 힌트 없이 정해진 횟수 안에 풀어야 해요.',
      'tut.4.tip4': '놓친 날은 📊 기록의 달력에서 다시 풀 수 있어요.',

      // 설정
      'set.title': '설정',
      'set.close': '설정 닫기',
      'set.sound': '효과음',
      'set.vibration': '진동',
      'set.vibrationHelp': '타일을 누르거나 성공했을 때 짧게 진동해요.',
      'set.vibrationUnsupported': '이 기기·브라우저에서는 진동을 지원하지 않아요. (아이폰 등)',
      'set.language': '언어',
      'set.tutorial': '처음 안내 다시 보기',

      // 공유 문구
      'share.past': ' (지난 퍼즐)',
      'share.perfect': '🌟 퍼펙트! {moves}번',
      'share.moves': '{moves}번 (최소 {min})',
      'share.quest': '🏆 퀘스트 클리어! {summary}',
      'share.attempt': '{n}번째 도전',
      'share.hints': '💡 힌트 {n}회',
      'share.questStreak': '🏆 퀘스트 {n}일 연속 클리어',
      'share.streak': '🔥 {n}일 연속 성공',
      'share.notYet': '⬜ 아직',
      'share.perfectShort': '🌟 퍼펙트',
      'share.movesShort': '{moves}번',

      // 시간
      'time.hm': '{h}시간 {m}분',
      'time.ms': '{m}분 {s}초',
      'time.s': '{s}초',
    },

    en: {
      'doc.title': 'Daily Lights | Daily Puzzle',
      'doc.description': 'A new lights-out puzzle every day. Three difficulty levels and hints make it fun for everyone.',

      'top.records': 'Stats',
      'top.recordsAria': 'My stats',
      'top.recordsAriaStreak': 'My stats, {n}-day streak',
      'top.settings': 'Settings',

      'hero.eyebrow': 'New puzzle every midnight (KST)',
      'hero.title': 'Turn off<br><span>all the lights.</span>',
      'hero.intro': 'Tapping a tile flips it and the tiles above, below, left and right. Turn every light off in as few taps as you can!',

      'game.aria': "Today's puzzle",
      'game.difficulty': 'Difficulty',
      'diff.easy': 'Easy',
      'diff.normal': 'Medium',
      'diff.hard': 'Hard',
      'diff.quest': 'Quest',
      'game.doneToday': ' cleared today',
      'archive.bar': "Playing a past puzzle · it won't count toward your streak",
      'archive.back': 'Back to today',
      'quest.title': "Today's quest",
      'quest.rule': 'Turn off every light within {limit} taps, no hints',
      'quest.meta': '⏱ {time} · attempt #{n}',
      'game.labelToday': "Today's puzzle",
      'game.labelPast': 'Past puzzle',
      'game.moves': 'Moves',
      'game.par': 'Best: {min}',
      'game.parQuest': 'Best {min} · Max {limit}',
      'game.boardAria': '{size}×{size} puzzle board. Use the arrow keys to move and Enter or Space to press.',
      'game.reset': 'Restart',
      'game.hint': 'Hint',
      'game.noHint': 'No hints',
      'game.share': 'Share result',
      'game.footnote': 'Your progress and stats are saved in this browser. The puzzle changes at midnight Korea time (KST).',
      'game.storageOff': '⚠️ Saving is turned off in this browser (private mode, etc.), so your progress and stats will be lost when you reload.',
      'tile.label': 'Row {row}, column {col}, {state}',
      'tile.on': 'on',
      'tile.off': 'off',
      'tile.hinted': ', hint',

      'msg.playing': '{lit} lights left · Turn them all off.',
      'msg.playingQuest': '{lit} lights left · {left} taps left',
      'msg.win': '✨ Solved in {moves} taps! (best possible: {min}{hint})',
      'msg.winHint': ', hints used: {n}',
      'msg.perfect': '🌟 Perfect! Solved in the minimum {moves} taps.',
      'msg.questWin': '🏆 Quest cleared! {moves} taps · {detail} (best {min} · max {limit})',
      'msg.questPerfect': '🏆🌟 Perfect quest clear! Minimum {moves} taps · {detail}',
      'msg.fail': '😢 Out of taps! You used all {limit}. Press "Restart" for attempt #{next}!',
      'msg.archiveSaved': 'Saved as a past-puzzle record.',
      'msg.archiveKept': 'Your best record for this day stays.',
      'msg.bestKept': "Today's best record stays.",
      'msg.questStreak': '🏆 {n}-day quest streak!',
      'msg.streak': '🔥 {n}-day streak!',
      'msg.hint': '💡 Tap the glowing tile. You can finish in {n} more taps.',
      'msg.reset': 'Back to the start.',
      'msg.openedPast': '📅 Opened the puzzle for {date}.',
      'msg.backToday': "Back to today's puzzle.",
      'msg.newDay': "A new day has begun — here's today's puzzle.",
      'msg.copied': 'Result copied! Paste it to your friends.',
      'msg.shareFailed': "Couldn't share. Please try again.",
      'msg.copyPrompt': 'Copy the text below:',
      'msg.error': 'Something went wrong. Please reload the page.',

      'stats.line': '{label} · cleared {cleared} · perfect {perfect}{best}',
      'stats.bestToday': 'today’s best',
      'stats.bestDay': 'best that day',
      'stats.best': ' · {label} {moves} taps{hint}{time}',
      'stats.bestHint': ' (hints: {n})',

      'guide.title': 'New here? How to play',
      'guide.1': 'Tapping a tile flips <strong>it and its four neighbors</strong> — a plus shape.',
      'guide.2': '<strong>Work from top to bottom</strong><br>If a light is on in a row, tap the tile <em>right below it</em> to turn it off. Go down row by row until only the bottom row is left.',
      'guide.3': '<strong>Start easy, use hints</strong><br>Get the feel with 3×3 Easy. 💡 Hint shows the next tile on the way to the answer. Solve with no hints in the fewest taps for a <em>Perfect</em>!',
      'guide.keyboard': 'Keyboard: arrow keys to move · Enter/Space to press',
      'guide.reopen': 'Show the intro again',

      'install.title': 'Install as an app',
      'install.help': 'Open it from your home screen and play even when offline.',
      'install.ios': 'In Safari, tap the Share button (□↑) and choose "Add to Home Screen".',
      'install.button': 'Install',
      'install.close': 'Close install tip',

      'footer.text': 'Daily Lights · an open learning web game · ',
      'footer.privacy': 'No personal data or cookies collected',
      'footer.analytics': 'Anonymous, cookie-free visit stats only',
      'donate.label': '☕ Support the developer',

      'rec.title': 'My stats',
      'rec.close': 'Close stats',
      'rec.current': 'Streak',
      'rec.best': 'Best streak',
      'rec.days': 'Days cleared',
      'rec.perfect': 'Perfect',
      'rec.unitDays': 'days',
      'rec.unitTimes': 'times',
      'rec.noteStart': "Solve today's puzzle to start a streak!",
      'rec.noteKeep': 'Solve one today for a {next}-day streak. Play before midnight (KST)!',
      'rec.noteDone': 'Done for today! Come back tomorrow for a {next}-day streak.',
      'rec.questSummary': '🏆 Quests cleared: {cleared} · streak {current} · best {best}{fastest}',
      'rec.questFastest': ' · fastest {time}',
      'rec.questNone': '🏆 No quests cleared yet. Take on the 6×6 quest!',
      'rec.prevMonth': 'Previous month',
      'rec.nextMonth': 'Next month',
      'rec.tableCaption': 'Stats by difficulty',
      'rec.colDiff': 'Difficulty',
      'rec.colCleared': 'Cleared',
      'rec.colNoHint': 'No hints',
      'rec.colPerfect': 'Perfect',
      'rec.cellDays': '{n}',
      'rec.shareToday': "Share today's results",
      'rec.shareTodayDisabled': 'Solve at least one puzzle today to share.',
      'rec.export': 'Export backup',
      'rec.import': 'Import backup',
      'rec.help': 'Importing a backup on another device or browser <strong>merges</strong> your records. The better record wins for the same date, and nothing you have now is deleted.',
      'rec.copied': "Today's results copied! Paste them to your friends.",
      'rec.exported': 'Backup downloaded. Keep it somewhere safe.',
      'rec.exportFailed': "Couldn't create the backup file.",
      'rec.tooBig': 'That file is too large. Please check it is a Daily Lights backup.',
      'rec.readFailed': "Couldn't read the file.",
      'rec.notBackup': "That isn't a Daily Lights backup, or the file is damaged.",
      'rec.merged': 'Records merged: {added} new, {improved} improved.',
      'rec.nothingNew': 'Nothing new to merge — everything is already here.',

      'cal.title': '{monthName} {year}',
      'cal.day': '{monthName} {day} ({weekday}){today}: {summary}{open}',
      'cal.today': ', today',
      'cal.open': '. Tap to open the puzzle',
      'cal.none': 'no record',
      'cal.perfect': 'perfect',
      'cal.cleared': 'cleared',
      'cal.late': ' (later)',
      'cal.legendPerfect': 'includes perfect',
      'cal.legendLate': 'solved later',
      'cal.tip': "Tap a date to play that day's puzzle. (From October 1, 2026)",
      'wd0': 'Sun', 'wd1': 'Mon', 'wd2': 'Tue', 'wd3': 'Wed', 'wd4': 'Thu', 'wd5': 'Fri', 'wd6': 'Sat',

      'tut.skip': 'Skip',
      'tut.prev': 'Back',
      'tut.next': 'Next',
      'tut.start': "Let's play",
      'tut.1.title': 'Turn off every light!',
      'tut.1.text': 'Switch off every glowing tile. The fewer taps, the better your score.',
      'tut.1.from': 'Start',
      'tut.1.to': 'Solved',
      'tut.2.title': 'Each tap flips a plus shape',
      'tut.2.text': 'Tapping a tile flips it and the tiles above, below, left and right. Try it yourself!',
      'tut.2.try': '👆 Tap the center tile.',
      'tut.2.nice': 'Nice! The tile and its neighbors flipped together, right?',
      'tut.2.clear': 'All off! Tapping the same tile twice puts it back the way it was.',
      'tut.2.aria': 'Practice 3×3 board',
      'tut.2.cell': 'Row {row}, column {col}',
      'tut.3.title': 'How to solve it',
      'tut.3.text': 'Tricks to try when you are stuck.',
      'tut.3.tip1': 'If a light is on in a row, tap the tile right below it. Clear the board row by row.',
      'tut.3.tip2': 'Stuck? Press Hint to see the next tile on the way to the answer.',
      'tut.3.tip3': 'Solve with no hints in the fewest taps for a Perfect.',
      'tut.4.title': 'A new puzzle every day',
      'tut.4.text': 'Start with 3×3 Easy. Everyone gets the same puzzle, so you can compare with friends.',
      'tut.4.tip1': 'A new puzzle arrives every midnight, Korea time.',
      'tut.4.tip2': 'Solve one every day to build a streak.',
      'tut.4.tip3': 'Feeling brave? Try the 6×6 daily quest — no hints, limited taps.',
      'tut.4.tip4': 'Missed a day? Replay it from the calendar in 📊 Stats.',

      'set.title': 'Settings',
      'set.close': 'Close settings',
      'set.sound': 'Sound effects',
      'set.vibration': 'Vibration',
      'set.vibrationHelp': 'A short buzz when you tap a tile or solve a puzzle.',
      'set.vibrationUnsupported': "Vibration isn't supported on this device or browser (e.g. iPhone).",
      'set.language': 'Language',
      'set.tutorial': 'Show the intro again',

      'share.past': ' (past puzzle)',
      'share.perfect': '🌟 Perfect! {moves} taps',
      'share.moves': '{moves} taps (best {min})',
      'share.quest': '🏆 Quest cleared! {summary}',
      'share.attempt': 'attempt #{n}',
      'share.hints': '💡 hints used: {n}',
      'share.questStreak': '🏆 {n}-day quest streak',
      'share.streak': '🔥 {n}-day streak',
      'share.notYet': '⬜ not yet',
      'share.perfectShort': '🌟 perfect',
      'share.movesShort': '{moves} taps',

      'time.hm': '{h}h {m}m',
      'time.ms': '{m}m {s}s',
      'time.s': '{s}s',
    },
  };

  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  let current = 'ko';

  // '{이름}' 자리에 값 채우기 (값이 없으면 그대로 둠)
  function format(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, name) => (params && params[name] !== undefined ? String(params[name]) : match));
  }

  // 특정 언어로 고정된 번역 함수 (테스트·공유 문구용). 영어에 빠진 문구는 한국어로, 둘 다 없으면 키를 그대로 보여 줌
  function translator(lang) {
    const dict = STRINGS[lang] || STRINGS.ko;
    return (key, params) => {
      const template = dict[key] !== undefined ? dict[key] : STRINGS.ko[key];
      return template === undefined ? key : format(template, params);
    };
  }

  function t(key, params) {
    return translator(current)(key, params);
  }

  function setLang(lang) {
    if (LANGS.includes(lang)) current = lang;
  }
  function getLang() {
    return current;
  }

  // 브라우저 언어 목록에 한국어가 있으면 한국어, 아니면 영어
  function detectLang(languages) {
    return (languages || []).some(l => /^ko\b/i.test(l)) ? 'ko' : 'en';
  }

  function monthName(month) {
    return MONTHS_EN[month - 1];
  }

  // 3분 7초 / 3m 7s
  function formatDuration(ms, lang = current) {
    const tr = translator(lang);
    const total = Math.floor(Math.max(ms, 0) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return tr('time.hm', { h, m });
    return m ? tr('time.ms', { m, s }) : tr('time.s', { s });
  }

  // 달력 제목: 2026년 11월 / November 2026
  function calendarTitle(year, month) {
    return t('cal.title', { year, month, monthName: monthName(month) });
  }

  // HTML 의 data-i18n 표시가 붙은 곳을 현재 언어로 바꿉니다.
  function applyDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    // 번역 사전은 우리가 직접 쓴 믿을 수 있는 문구라 HTML 로 넣어도 안전합니다.
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    if (root === document) {
      document.documentElement.lang = current;
      document.title = t('doc.title');
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = t('doc.description');
    }
  }

  return {
    LANGS, STRINGS, t, translator, setLang, getLang, detectLang,
    monthName, formatDuration, calendarTitle, applyDom,
  };
});
