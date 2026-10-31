# Daily Lights — 매일 바뀌는 퍼즐 게임

HTML, CSS, JavaScript만으로 만든 입문용 웹게임입니다. 설치 없이 브라우저에서 실행됩니다.

## 시작하기
1. `index.html`을 크롬·엣지 등의 브라우저에서 엽니다.
2. 타일을 클릭하면 그 칸과 상하좌우의 불이 전환됩니다.
3. 모든 불을 끄면 성공입니다. 공유 버튼으로 결과를 복사하거나 공유할 수 있습니다.

더 안정적인 로컬 개발 환경은 VS Code의 Live Server 확장 또는 다음 명령어로 실행합니다.

```powershell
cd daily-lights
py -m http.server 8000
```

이후 `http://localhost:8000`으로 접속합니다. 서버를 켠 터미널은 닫지 마세요(Ctrl+C로 종료).

## 주요 기능
- 한국 표준시(KST) 날짜를 기준으로 매일 자동 변경되는 퍼즐 (탭을 켜둔 채 자정이 지나도 자동 변경)
- 난이도 3단계: 초급 3×3(최소 4~6번), 중급 4×4(5~7번), 고급 5×5(9~12번)
- 같은 날짜·난이도에는 전 세계 누구나 같은 보드
- 실제로 풀 수 있는 퍼즐만 결정적으로 생성하고, 최소 해답 길이로 난이도를 고르게 맞춤
- 💡 힌트: 최소 해답에 포함된 칸을 알려 줌 (누르면 남은 최소 횟수가 정확히 1 줄어듦)
- 난이도별 기록: 성공한 날, 퍼펙트(힌트 없이 최소 횟수) 횟수, 오늘 최고 기록
- 📊 기록 창: 연속 성공 일수(🔥), 최고 연속, 달력, 난이도별 표
- 오늘의 기록 공유, 백업·복원(JSON 파일, 불러오면 기존 기록과 합침)
- 타일 애니메이션, 성공 축하 효과, 효과음(Web Audio 합성)과 음소거
- 반응형 디자인(320px ~ 데스크톱, 휴대폰 가로 모드), 키보드 조작, 화면 읽기 프로그램 지원
- '움직임 줄이기' 시스템 설정 시 애니메이션 자동 끔
- 여러 탭을 열어도 기록이 덮어써지지 않음, 저장이 막힌 브라우저에서는 안내 표시
- 서버, API, 로그인, 광고, 개인정보 수집 없음

## 파일 설명
| 파일 | 역할 |
|---|---|
| `index.html` | 페이지 구조, 아이콘·공유 미리보기 설정 |
| `styles.css` | 스타일과 애니메이션 |
| `logic.js` | 게임 규칙: 난이도, 퍼즐 생성, 해답·힌트, 저장 데이터 검사, 기록·연속·백업 계산 (화면과 무관해서 테스트 가능) |
| `game.js` | 게임 화면: 클릭, 그리기, 저장, 효과음, 애니메이션, 공유 |
| `records.js` | 기록 창: 통계, 달력, 오늘의 기록 공유, 백업·복원 |
| `icon.svg`, `apple-touch-icon.png` | 브라우저 탭 / 휴대폰 홈 화면 아이콘 |
| `og-image.png` | 카카오톡·SNS 링크 미리보기 이미지 (1200×630) |
| `tests/logic.test.js` | Node.js 로직 테스트 |
| `tests/browser-check.html` | 실제 브라우저 점검 (새로고침 복원, 여러 탭, 레이아웃, 기록 창 등) |
| `.github/workflows/deploy.yml` | GitHub Pages 자동 배포 (테스트 통과 시에만) |

## 테스트
Node.js 18 이상이 필요합니다. 추가 설치는 없습니다.

```powershell
npm test
```

브라우저 점검은 로컬 서버를 켠 뒤 `http://localhost:8000/tests/browser-check.html`을 엽니다.
화면에 `결과: 모두 통과`가 나오면 성공입니다.

접근성·성능 종합 점검은 Edge/Chrome에 기본으로 들어 있는 **Lighthouse**로 할 수 있습니다:
F12 → Lighthouse 탭 → "페이지 로드 분석".

## 배포 (GitHub Pages)
`main` 브랜치에 올리면 GitHub Actions가 **테스트 → 게임 파일만 골라서 → 배포**를 자동으로 합니다.
테스트가 실패하면 배포되지 않습니다.

### 처음 한 번만
1. GitHub에서 새 저장소를 만듭니다. (예: `daily-lights`, Public)
2. 이 폴더에서 저장소에 올립니다.
   ```powershell
   cd daily-lights
   git init -b main
   git add .
   git commit -m "Daily Lights v1.0.0"
   git remote add origin https://github.com/<내 아이디>/daily-lights.git
   git push -u origin main
   ```
   GitHub CLI(`gh`)가 있다면 2번 대신 `gh repo create daily-lights --public --source . --push`로 한 번에 할 수 있습니다.
3. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
4. **Actions** 탭에서 "Deploy to GitHub Pages"가 초록색 ✓가 되면, `https://<내 아이디>.github.io/daily-lights/`에서 게임이 열립니다.
   (처음이라 실행이 안 됐다면 Actions 탭에서 해당 워크플로를 골라 **Run workflow**를 누르세요.)

### 이후 업데이트
코드를 고친 뒤 `git add .` → `git commit -m "변경 내용"` → `git push` 하면 자동으로 다시 배포됩니다.

### 배포할 때 자동으로 바뀌는 값
- `__SITE_URL__` → 실제 주소 (링크 미리보기 이미지 경로에 사용)
- `__VERSION__` → 커밋 번호 앞 7자리. `styles.css?v=abc1234`처럼 붙어서, 새 버전을 올리면 방문자의 브라우저가 옛 파일 대신 새 파일을 받습니다.

로컬에서는 이 값들이 그대로 남아 있어도 게임 실행에는 영향이 없습니다.

## 저장 데이터 형식 (localStorage `daily-lights-v2`)
```js
{
  version: 2,
  difficulty: 'easy',                                              // 마지막으로 고른 난이도
  progress: { easy: { date, board, moves, hints } },               // 오늘 진행 중인 판
  history:  { easy: { '2026-11-01': { moves, hints, minMoves } } } // 날짜별 최고 기록
}
```
- 연속 성공은 "어느 난이도든 하나 이상 성공한 날"이 이어진 일수입니다. 오늘 아직 풀지 않았다면 어제까지의 연속이 유지되며, 자정(KST)이 지나야 끊깁니다.
- 같은 날 다시 풀면 더 좋은 기록(힌트를 덜 쓴 기록 → 같으면 움직임이 적은 기록)만 남습니다.
- 백업 파일(`daily-lights-backup-YYYY-MM-DD.json`)은 `{ app: 'daily-lights', exportedAt, store }` 형식입니다. 불러올 때는 기록만 합치고, 진행 중인 판은 지금 기기의 것을 유지합니다.
- 저장하기 직전에 저장소의 최신 기록을 먼저 합치기 때문에, 탭을 여러 개 열어도 다른 탭의 기록을 덮어쓰지 않습니다.
- 브라우저 데이터를 지우면 기록이 사라지니 가끔 백업해 두세요.

## 다음에 확장할 기능
- 지난 날짜 퍼즐 다시 풀기(아카이브)
- PWA(오프라인 실행, 홈 화면 설치) / 한국어·영어 지원
- 실제 점수 순위표(서버 필요)
