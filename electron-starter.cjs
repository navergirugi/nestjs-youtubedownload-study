// 이 파일은 ESM 프로젝트에서 Electron을 시작하기 위한 CJS(CommonJS) 브릿지입니다.
// Electron의 메인 프로세스는 기본적으로 CJS 환경에서 시작되므로,
// 이 CJS 파일이 진입점(entry point) 역할을 하여 실제 ESM 코드를 불러옵니다.

const { app } = require('electron');
const path = require('path');

// 앱이 준비되면, 동적 import()를 사용하여 ESM으로 작성된 실제 메인 파일을 불러옵니다.
app.whenReady().then(() => {
  import(path.join(__dirname, 'dist', 'electron', 'main.js'));
});