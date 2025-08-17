// 이 파일은 ESM 프로젝트에서 Electron을 시작하기 위한 CJS(CommonJS) 브릿지입니다.
// Electron의 메인 프로세스는 기본적으로 CJS 환경에서 시작되므로,
// 이 CJS 파일이 진입점(entry point) 역할을 하여 실제 ESM 코드를 불러옵니다.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

// ==================[ 시동 과정 블랙박스 ]==================
const starterLogPath = path.join(os.tmpdir(), 'ydownload_starter.log');
function writeStarterLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(starterLogPath, logMessage);
  } catch {}
}

writeStarterLog('--- [1/4] electron-starter.cjs 시작됨 ---');

const { app, dialog } = require('electron');

app.whenReady().then(() => {
  writeStarterLog('--- [2/4] Electron App Ready ---');

  let mainPath;
  if (app.isPackaged) {
    // 패키징된 앱: app.getAppPath()는 asar 내부 루트를 반환
    const appPath = app.getAppPath();
    mainPath = path.join(appPath, 'dist', 'electron', 'main.js');
  } else {
    // 개발 환경
    mainPath = path.join(__dirname, 'dist', 'electron', 'main.js');
  }

  writeStarterLog(`--- [3/4] isPackaged: ${app.isPackaged}, 메인 모듈 로드 시도: ${mainPath} ---`);

  const mainUrl = pathToFileURL(mainPath).href;

  import(mainUrl).catch((err) => {
    const errorMessage = `치명적 오류: 메인 모듈 로드 실패!\n\n오류: ${err.stack || err}`;
    writeStarterLog(`--- [4/4] 메인 모듈 로드 실패: ${errorMessage} ---`);
    writeStarterLog(`--- 최종 시도한 경로: ${mainPath} ---`);

    try {
      writeStarterLog(`--- __dirname 내용: ${JSON.stringify(fs.readdirSync(__dirname))} ---`);
    } catch (e) {
      writeStarterLog(`--- 디렉토리 탐색 실패: ${e.message} ---`);
    }

    try {
      dialog.showErrorBox('Fatal Startup Error', `${errorMessage}\n\n로그 파일: ${starterLogPath}`);
    } catch {}
    app.quit();
  });
});
