// 브라우저 점검(tests/browser-check.html)을 자동으로 실행합니다.
// 실행: npm run test:browser
//
// 1) 테스트용 웹서버를 직접 켜고  2) Edge/Chrome 을 화면 없이(headless) 띄워
// 3) 점검 결과가 나올 때까지 "실제 시간"으로 기다린 뒤  4) 결과를 출력합니다.
// 추가 설치 없이 Node.js 기본 기능(http, fetch, WebSocket)만 사용합니다. (Node.js 22 이상)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TIMEOUT_MS = 180000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 프로젝트 폴더를 그대로 보여 주는 아주 작은 웹서버
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// 브라우저 조종(DevTools 프로토콜)으로 페이지 안의 자바스크립트 값을 읽습니다.
async function connect(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        return ws;
      }
    } catch (e) { /* 브라우저가 아직 준비 중 */ }
    await sleep(200);
  }
  throw new Error('브라우저에 연결하지 못했어요.');
}

function evaluator(ws) {
  let nextId = 1;
  const waiting = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (waiting.has(message.id)) { waiting.get(message.id)(message.result); waiting.delete(message.id); }
  };
  return expression => new Promise(resolve => {
    const id = nextId++;
    waiting.set(id, result => resolve(result && result.result ? result.result.value : undefined));
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
}

async function main() {
  const browser = BROWSERS.find(p => fs.existsSync(p));
  if (!browser) {
    console.error('Edge 또는 Chrome 을 찾지 못했어요. BROWSER 환경 변수로 실행 파일 경로를 알려 주세요.');
    process.exit(2);
  }
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/tests/browser-check.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-lights-check-'));
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, url,
  ], { stdio: 'ignore' });

  let exitCode = 1;
  try {
    const ws = await connect(port);
    const evaluate = evaluator(ws);
    const started = Date.now();
    let title = '';
    while (Date.now() - started < TIMEOUT_MS) {
      title = await evaluate('document.title');
      if (title === 'PASS' || title === 'FAIL') break;
      await sleep(500);
    }
    if (title !== 'PASS' && title !== 'FAIL') throw new Error(`${TIMEOUT_MS / 1000}초 안에 점검이 끝나지 않았어요.`);
    const text = await evaluate("document.querySelector('#result').textContent");
    const lines = text.split('\n');
    const failures = lines.filter(line => line.startsWith('FAIL'));
    const passes = lines.filter(line => line.startsWith('PASS')).length;
    if (process.argv.includes('--verbose')) console.log(text);
    else failures.forEach(line => console.log(line));
    console.log(`브라우저 점검: 통과 ${passes}개, 실패 ${failures.length}개`);
    exitCode = failures.length === 0 ? 0 : 1;
    ws.close();
  } catch (e) {
    console.error(`브라우저 점검 실행 실패: ${e.message}`);
  } finally {
    proc.kill();
    server.close();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 임시 폴더는 나중에 OS가 정리 */ }
  }
  process.exit(exitCode);
}

main();
