// 앱 설치(PWA) 설정 점검: 파일 목록이 서로 어긋나면 "오프라인에서만" 조용히 깨지기 쉬워서 자동으로 확인합니다.
// 실행: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const stripQuery = url => url.replace(/^\.\//, '').replace(/\?.*$/, '');

// PNG 파일의 가로×세로 (파일 앞부분 IHDR 정보)
function pngSize(file) {
  const b = fs.readFileSync(path.join(root, file));
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');
const html = read('index.html');
const workflow = read('.github/workflows/deploy.yml');

// sw.js 의 CORE_FILES 목록을 꺼냅니다. (`./game.js?v=${VERSION}` → game.js)
const coreFiles = [...sw.match(/CORE_FILES = \[([\s\S]*?)\];/)[1].matchAll(/['`]([^'`]+)['`]/g)]
  .map(m => stripQuery(m[1]))
  .filter(f => f !== '');
// deploy.yml 이 _site 로 복사하는 파일 목록
const deployed = workflow.match(/cp ([\s\S]*?) _site\//)[1].replace(/\\\n/g, ' ').split(/\s+/).filter(Boolean);

test('manifest: 설치에 필요한 정보가 모두 있다', () => {
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'background_color', 'theme_color']) {
    assert.ok(manifest[key], `manifest 에 ${key} 없음`);
  }
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './', '하위 주소(/daily-lights/)에서도 동작하도록 상대 경로');
});

test('manifest: 아이콘 파일이 있고 크기가 맞다 (192, 512, maskable)', () => {
  const pngs = manifest.icons.filter(i => i.type === 'image/png');
  for (const icon of pngs) {
    assert.ok(exists(icon.src), `아이콘 파일 없음: ${icon.src}`);
    assert.equal(pngSize(icon.src), icon.sizes, `${icon.src} 크기`);
  }
  assert.ok(pngs.some(i => i.sizes === '192x192'));
  assert.ok(pngs.some(i => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(pngs.some(i => i.purpose === 'maskable'));
});

test('서비스 워커: 저장 목록의 파일이 모두 실제로 있다', () => {
  for (const file of coreFiles) assert.ok(exists(file), `sw.js 저장 목록에 있지만 파일 없음: ${file}`);
});

test('서비스 워커: index.html 이 불러오는 스크립트·스타일을 모두 저장한다 (오프라인 실행)', () => {
  const used = [...html.matchAll(/(?:src|href)="(\.\/[^"]+\?v=__VERSION__)"/g)].map(m => stripQuery(m[1]));
  assert.deepEqual(used.sort(), ['game.js', 'i18n.js', 'logic.js', 'records.js', 'settings.js', 'site-config.js', 'site.js', 'styles.css', 'tutorial.js']);
  for (const file of used) assert.ok(coreFiles.includes(file), `sw.js 가 저장하지 않는 파일: ${file}`);
  assert.match(sw, /`\.\/game\.js\?v=\$\{VERSION\}`/, '저장 주소에도 같은 ?v=버전 이 붙어야 함');
});

test('배포 설정: 앱에 필요한 파일을 모두 배포하고, sw.js 버전도 바꾼다', () => {
  const needed = new Set([...coreFiles.filter(f => f !== ''), 'sw.js', 'index.html', 'og-image.png',
    ...manifest.icons.map(i => i.src)]);
  for (const file of needed) assert.ok(deployed.includes(file), `deploy.yml 이 복사하지 않는 파일: ${file}`);
  assert.match(workflow, /__VERSION__#\$\{GITHUB_SHA::7\}#g" _site\/index\.html _site\/sw\.js/, 'sw.js 의 __VERSION__ 도 치환해야 함');
});

test('index.html: manifest 연결, 개발 중 판별용 버전 표시', () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /<meta name="app-version" content="__VERSION__"/);
});
