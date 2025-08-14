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

  // A more reliable way to check if the app is packaged.
  // `app.isPackaged` can sometimes be unreliable. The presence of 'app.asar' in the path is a strong indicator.
  // 앱이 패키징되었는지 확인하는 가장 안정적인 방법은 __dirname에 'app.asar'가 포함되어 있는지 확인하는 것입니다.
  const isPackaged = __dirname.includes('app.asar');

  // ESM 로더(`import`)는 asar 아카이브 내부의 파일을 직접 읽을 수 없습니다.
  // 따라서 electron-builder 설정에서 메인 프로세스 파일들을 압축 해제(`asarUnpack`)하도록 하고,
  // 패키징된
  // The ESM loader (`import`) cannot read files from inside an asar archive.
  // Therefore, we configure electron-builder to unpack the main process files (`asarUnpack`)
  // and adjust the path to point to the unpacked location.
  const mainPath = isPackaged
    ? path.join(__dirname, '..', 'app.asar.unpacked', 'dist', 'electron', 'main.js')
    : path.join(__dirname, 'dist', 'electron', 'main.js');

  writeStarterLog(`--- [3/4] isPackaged: ${isPackaged}, 메인 모듈 로드 시도: ${mainPath} ---`);

  // [핵심] 일반 파일 경로(예: C:\...)를 ESM의 import()가 이해할 수 있는 file:// URL로 변환합니다.
  const mainUrl = pathToFileURL(mainPath).href;

  import(mainUrl).catch((err) => {
    const errorMessage = `치명적 오류: 메인 모듈 로드 실패!\n\n오류: ${err.stack || err}`;
    writeStarterLog(`--- [4/4] 메인 모듈 로드 실패: ${errorMessage} ---`);
    dialog.showErrorBox('Fatal Startup Error', `${errorMessage}\n\n로그 파일: ${starterLogPath}`);
    app.quit();
  });
});
