// 이 파일은 ESM 프로젝트에서 Electron을 시작하기 위한 CJS(CommonJS) 브릿지입니다.
// Electron의 메인 프로세스는 기본적으로 CJS 환경에서 시작되므로,
// 이 CJS 파일이 진입점(entry point) 역할을 하여 실제 ESM 코드를 불러옵니다.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url'); // [핵심] 파일 경로를 ESM이 이해할 수 있는 URL로 변환하기 위해 추가

// ==================[ 시동 과정 블랙박스 ]==================
// 이 로그는 앱의 메인 코드가 실행되기도 전에 기록되므로, 시동 실패의 원인을 찾는 데 결정적입니다.
const starterLogPath = path.join(os.tmpdir(), 'ydownload_starter.log');
function writeStarterLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(starterLogPath, logMessage);
  } catch (e) {
    // 이 로그조차 실패하면 더 이상 할 수 있는 것이 없습니다.
  }
}

writeStarterLog('--- [1/4] electron-starter.cjs 시작됨 ---');

// 앱이 준비되면, 동적 import()를 사용하여 ESM으로 작성된 실제 메인 파일을 불러옵니다.
const { app, dialog } = require('electron');

app.whenReady().then(() => {
  writeStarterLog('--- [2/4] Electron App Ready ---');

  // [핵심 수정] Electron이 공식적으로 제공하는 `app.isPackaged`를 사용하여 앱이 패키징되었는지 확인합니다.
  const isPackaged = app.isPackaged;

  // [핵심 수정] 패키징된 앱의 정확한 경로를 계산합니다.
  // `electron-starter.cjs`가 실행되는 위치(__dirname)는 `.../Contents/Resources`입니다.
  // 압축 해제된 파일들은 그 안의 `app.asar.unpacked` 폴더에 위치하므로, '..' 없이 바로 경로를 조합해야 합니다.

  // ✅ 수정된 경로 로직
  let mainPath;
  if (isPackaged) {
    // 패키징된 앱에서의 정확한 경로
    // macOS: /Applications/App.app/Contents/Resources/app.asar.unpacked/dist/electron/main.js
    // __dirname은 /Applications/App.app/Contents/Resources 입니다.
    mainPath = path.join(__dirname, 'app.asar.unpacked', 'dist', 'electron', 'main.js');

    // 만약 app.asar.unpacked가 없다면 app.asar 내부에서 찾기
    if (!fs.existsSync(mainPath)) {
      // asar 아카이브 내부의 파일은 직접 접근할 수 없으므로,
      // 대신 dist 폴더가 압축 해제되어 있는지 확인
      const unpackedDistPath = path.join(__dirname, 'dist', 'electron', 'main.js');
      if (fs.existsSync(unpackedDistPath)) {
        mainPath = unpackedDistPath;
      } else {
        // 최후의 수단: 앱 리소스 경로에서 찾기
        const appPath = app.getAppPath();
        mainPath = path.join(appPath, 'dist', 'electron', 'main.js');
      }
    }
  } else {
    // 개발 환경에서의 경로
    mainPath = path.join(__dirname, 'dist', 'electron', 'main.js');
  }
  writeStarterLog(`--- [3/4] isPackaged: ${isPackaged}, 메인 모듈 로드 시도: ${mainPath} ---`);
  writeStarterLog(`--- [3.5/4] 파일 존재 여부: ${fs.existsSync(mainPath)} ---`);

  // 파일이 존재하지 않으면 추가 경로 탐색
  if (!fs.existsSync(mainPath)) {
    const alternativePaths = [
      path.join(__dirname, 'dist', 'electron', 'main.js'),
      path.join(__dirname, '..', 'dist', 'electron', 'main.js'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'electron', 'main.js'),
      path.join(process.resourcesPath, 'dist', 'electron', 'main.js'),
    ];

    for (const altPath of alternativePaths) {
      writeStarterLog(`--- 대안 경로 확인: ${altPath} - 존재: ${fs.existsSync(altPath)} ---`);
      if (fs.existsSync(altPath)) {
        mainPath = altPath;
        break;
      }
    }
  }

  // [핵심] 일반 파일 경로(예: C:\...)를 ESM의 import()가 이해할 수 있는 file:// URL로 변환합니다.
  const mainUrl = pathToFileURL(mainPath).href;

  import(mainUrl).catch((err) => {
    const errorMessage = `치명적 오류: 메인 모듈 로드 실패!\n\n오류: ${err.stack || err}`;
    writeStarterLog(`--- [4/4] 메인 모듈 로드 실패: ${errorMessage} ---`);
    writeStarterLog(`--- 최종 시도한 경로: ${mainPath} ---`);

    // 디렉토리 내용 탐색 로그 추가
    try {
      writeStarterLog(`--- __dirname 내용: ${JSON.stringify(fs.readdirSync(__dirname))} ---`);
      if (fs.existsSync(path.join(__dirname, 'dist'))) {
        writeStarterLog(
          `--- dist 폴더 내용: ${JSON.stringify(fs.readdirSync(path.join(__dirname, 'dist')))} ---`,
        );
      }
    } catch (e) {
      writeStarterLog(`--- 디렉토리 탐색 실패: ${e.message} ---`);
    }

    dialog.showErrorBox('Fatal Startup Error', `${errorMessage}\n\n로그 파일: ${starterLogPath}`);
    app.quit();
  });
});
