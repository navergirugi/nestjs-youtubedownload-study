// Electron 앱의 생명주기와 네이티브 브라우저 창을 만들기 위한 모듈들을 가져옵니다.
// app: Electron 앱의 생명주기 관리 (예: 앱 시작, 종료)
// BrowserWindow: 데스크톱 창 생성 및 제어
// ipcMain: UI(Renderer) 프로세스로부터 비동기 메시지를 받고 응답을 보낼 수 있게 해주는 메인 프로세스용 모듈
// dialog: 파일 열기/저장 같은 네이티브 시스템 다이얼로그를 표시하는 모듈
// shell: 파일 시스템의 파일을 관리하는 데 사용되는 유틸리티 (예: 폴더에서 파일 보기)
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
// Node.js의 내장 모듈로, 파일 및 디렉토리 경로를 처리하는 유틸리티를 제공합니다.
import * as path from 'path';
// 현재 환경이 개발 환경인지 프로덕션(배포) 환경인지 쉽게 확인하게 해주는 유틸리티입니다.
import isDev from 'electron-is-dev';
// yt-dlp가 반환하는 데이터의 타입을 정의해둔 파일을 가져옵니다. 코드의 안정성을 높여줍니다.
import { YTDlpFormat, YTDlpMetadata } from './yt-dlp-types';
// Node.js의 내장 모듈로, 파일 시스템과 상호작용(파일 읽기, 쓰기 등)하는 기능을 제공합니다.
import * as fs from 'fs';
// 앱의 설정(다운로드 경로, 기록 등)을 JSON 파일에 영구적으로 저장하고 불러오는 라이브러리입니다.
// yt-dlp-wrap과 electron-store는 모두 ESM이므로, 타입 정보만 가져오고 실제 모듈은 동적으로 로드합니다.
// `import = require()` 구문은 복잡한 모듈 환경에서 타입을 가장 안정적으로 가져오는 방법입니다.
// 수많은 시도에도 타입 해석에 실패하므로, 타입 검사를 비활성화하여 문제를 최종적으로 해결합니다.
// import type YtDlpWrap = require('yt-dlp-wrap');
// import type Store = require('electron-store');

// --- 앱 설정을 위한 스키마 정의 ---
// electron-store에 저장될 데이터의 구조와 타입을 명확하게 정의합니다.
// 이렇게 하면 자동완성 기능을 활용할 수 있고, 잘못된 타입의 데이터가 저장되는 것을 방지하여 코드 안정성을 높입니다.

// HistoryItem 타입을 별도로 정의하여 재사용성을 높입니다.
type DownloadHistoryItem = {
  id: string;
  title: string;
  filePath: string;
  type: 'mp4' | 'mp3';
  downloadedAt: string;
};

type StoreSchema = {
  downloadPath: string;
  downloadHistory: DownloadHistoryItem[];
  // downloadHistory: string[];
};

// store 변수를 선언하고, 타입 안정성을 위해 정확한 타입을 지정합니다.
// `import = require()`로 가져온 타입은 네임스페이스처럼 동작하므로, 실제 클래스 타입은 `.default`로 접근해야 합니다.
// any 타입을 사용하여 TypeScript의 타입 검사를 비활성화하고, 런타임에 의존하도록 합니다.
let store: any;

// ytDlpWrap 인스턴스를 담을 변수를 선언합니다.
let ytDlpWrap: any;

// --- IPC 통신을 위한 타입 정의 ---

// UI에서 다운로드 요청 시 보내는 데이터의 구조를 정의합니다.
type DownloadRequest = {
  url: string;
  formatCode: string;
  type: 'mp4' | 'mp3';
  title: string;
};

// yt-dlp 포맷 정보를 UI에 맞게 가공한 후의 데이터 구조를 정의합니다.
type ProcessedFormat = {
  itag: string | undefined;
  quality: string;
  container: string;
  contentLength: string | undefined;
  type: 'mp4' | 'mp3';
};

// yt-dlp 실행 파일을 저장할 전용 디렉토리를 앱의 사용자 데이터 폴더에 지정합니다.
// 이 방법은 어떤 OS에서든 앱이 쓰기 권한을 가진 안전한 경로를 보장합니다.
// app.getPath('userData')는 OS별로 앱이 데이터를 저장할 수 있는 고유한 경로를 반환합니다. (예: macOS에서는 ~/Library/Application Support/<AppName>)
const binariesPath = path.join(app.getPath('userData'), 'binaries');
// 만약 'binaries' 폴더가 존재하지 않으면,
if (!fs.existsSync(binariesPath)) {
  // 폴더를 생성합니다. { recursive: true } 옵션은 상위 폴더가 없어도 자동으로 만들어줍니다.
  fs.mkdirSync(binariesPath, { recursive: true });
}

// OS에 맞는 yt-dlp 실행 파일의 전체 경로를 생성합니다.
// Windows에서는 '.exe' 확장자가 필요하지만, macOS나 Linux에서는 필요 없습니다.
const ytDlpFilename = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(binariesPath, ytDlpFilename);

// 앱의 메인 윈도우(창)를 생성하는 함수입니다.
function createWindow() {
  // 브라우저 창을 생성합니다.
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      // preload 스크립트의 경로를 지정합니다. 이 스크립트는 UI(Renderer) 코드가 실행되기 전에 먼저 실행됩니다.
      // __dirname은 현재 파일(main.js)이 위치한 디렉토리 경로입니다. (app/ ...)
      preload: path.join(__dirname, 'preload.js'),
      // 보안 강화를 위해 contextIsolation을 활성화합니다.
      // 이 옵션은 preload 스크립트와 UI의 JavaScript 컨텍스트를 분리하여, UI에서 직접적으로 Node.js API에 접근하는 것을 막습니다.
      contextIsolation: true,
      // UI에서 Node.js 기능을 직접 사용하는 것을 비활성화합니다. 보안상 매우 중요합니다.
      nodeIntegration: false,
    },
  });

  // 개발 환경에서는 Next.js 개발 서버를 로드하고,
  // 프로덕션 환경에서는 빌드된 Next.js 앱을 로드합니다.
  if (isDev) {
    // 개발 중일 때는 http://localhost:3000 주소로 실행되는 Next.js 개발 서버를 로드합니다.
    win.loadURL('http://localhost:3000');
    // 개발자 도구(F12)를 자동으로 엽니다.
    win.webContents.openDevTools();
  } else {
    // 앱이 빌드(배포)되었을 때는, 생성된 HTML 파일을 직접 로드합니다.
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }
}

// Electron 앱이 준비되면 (초기화 완료) 이 함수를 실행합니다.
app.whenReady().then(async () => {
  // --- Dynamic Imports for ESM modules ---
  // electron-store와 yt-dlp-wrap은 CommonJS 환경에서 사용하기 위해 동적으로 가져옵니다.
  const StoreClass = (await import('electron-store')).default;
  const YtDlpWrapClass = (await import('yt-dlp-wrap')).default;

  // --- Store 초기화 ---
  store = new StoreClass<StoreSchema>({
    // defaults는 앱을 처음 실행했을 때 설정될 기본값입니다.
    defaults: {
      downloadPath: app.getPath('downloads'), // OS의 기본 '다운로드' 폴더를 기본값으로 사용합니다.
      downloadHistory: [],
    },
  });

  try {
    console.log('[Main Process] Checking and downloading yt-dlp binary...');
    // 앱이 UI를 띄우기 전에, yt-dlp 실행 파일이 다운로드되었는지 확인하고 없으면 다운로드합니다.
    // 파일이 이미 존재하면 중복으로 다운로드하지 않으므로 효율적입니다.
    await YtDlpWrapClass.downloadFromGithub(ytDlpPath);
    console.log('[Main Process] yt-dlp binary is ready.');
  } catch (error) {
    console.error('[Main Process] Failed to download yt-dlp binary:', error);
    // 만약 다운로드에 실패하면 (예: 인터넷 연결 문제), 사용자에게 오류 메시지를 보여줍니다.
    dialog.showErrorBox(
      'Critical Error',
      'Failed to download a required component (yt-dlp). Please check your internet connection and restart the application.',
    );
    // 앱을 종료합니다.
    app.quit();
    return;
  }

  // --- YtDlpWrap 인스턴스 생성 ---
  ytDlpWrap = new YtDlpWrapClass();
  ytDlpWrap.setBinaryPath(ytDlpPath);

  // yt-dlp 준비가 끝나면 메인 윈도우를 생성합니다.
  createWindow();
});

// 모든 창이 닫혔을 때 앱을 종료하는 리스너입니다.
app.on('window-all-closed', () => {
  // macOS에서는 모든 창이 닫혀도 앱이 Dock에 남아있는 것이 일반적이므로, macOS가 아닐 경우에만 앱을 종료합니다.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS에서 Dock 아이콘을 클릭했을 때 창을 다시 여는 리스너입니다.
app.on('activate', () => {
  // 열려있는 창이 하나도 없을 경우에만 새 창을 생성합니다.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- 신규 IPC 핸들러: 설정 및 기록 관리 ---

// UI가 저장된 다운로드 경로를 요청할 때 처리합니다.
ipcMain.handle('get-download-path', () => {
  // store에서 'downloadPath' 키로 저장된 값을 가져와 반환합니다.
  return store.get('downloadPath');
});

// UI가 새로운 기본 다운로드 경로를 설정하려고 할 때 처리합니다.
ipcMain.handle('set-download-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  // 사용자에게 폴더를 선택할 수 있는 네이티브 다이얼로그를 엽니다.
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'], // 폴더만 선택 가능하도록 설정
    title: '기본 다운로드 폴더를 선택하세요',
  });

  // 사용자가 취소하지 않고 폴더를 선택했다면,
  if (!canceled && filePaths.length > 0) {
    const selectedPath = filePaths[0];
    // 선택된 경로를 store에 'downloadPath' 키로 저장합니다.
    store.set('downloadPath', selectedPath);
    return selectedPath; // 선택된 경로를 UI로 반환합니다.
  }
  // 사용자가 취소했다면, 기존에 저장된 경로를 반환합니다.
  return store.get('downloadPath');
});

// UI가 저장된 다운로드 기록을 요청할 때 처리합니다.
ipcMain.handle('get-download-history', () => {
  // store에서 'downloadHistory' 키로 저장된 값을 가져옵니다. 없으면 빈 배열을 반환합니다.
  return store.get('downloadHistory', []);
});

// UI가 다운로드 기록을 삭제하려고 할 때 처리합니다.
ipcMain.handle('clear-download-history', () => {
  store.set('downloadHistory', []); // 기록을 빈 배열로 덮어씁니다.
});

// UI가 특정 파일이 있는 폴더를 열어달라고 요청할 때 처리합니다.
ipcMain.handle('show-item-in-folder', (event, filePath: string) => {
  // shell.showItemInFolder는 OS의 파일 탐색기(파인더)에서 해당 파일을 선택된 상태로 보여줍니다.
  shell.showItemInFolder(filePath);
});

// --- 다운로드 기록 관리를 위한 도우미 함수 ---
/**
 * 다운로드 완료된 항목을 기록에 추가하고, 최대 개수를 유지합니다.
 * @param item - 기록에 추가할 다운로드 정보
 */
function addDownloadToHistory(item: DownloadHistoryItem) {
  const history = store
    .get('downloadHistory', [])
    .filter((h: DownloadHistoryItem) => h.filePath !== item.filePath); // 기존에 같은 파일 경로가 있다면 제거 (재다운로드 시 중복 방지)

  history.unshift(item); // 새 항목을 배열 맨 앞에 추가

  // 기록은 최대 50개까지만 저장합니다.
  store.set('downloadHistory', history.slice(0, 50));
}

// --- 비디오/오디오 포맷 처리 로직을 위한 도우미 함수 ---

/**
 * 메타데이터에서 UI에 표시할 비디오 포맷 목록을 필터링하고 가공합니다.
 * @param formats - yt-dlp에서 받은 전체 포맷 목록
 * @param bestAudioSize - 합산 파일 크기 계산에 사용할 오디오 파일 크기
 * @returns UI에 표시하기 좋은 형태로 가공된 비디오 포맷 배열
 */
function processVideoFormats(formats: YTDlpFormat[], bestAudioSize: number): ProcessedFormat[] {
  const seenResolutions = new Set<number>();
  return formats
    .filter((f) => f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4' && f.height)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
    .filter((f) => {
      const height = f.height!;
      if (seenResolutions.has(height)) {
        return false;
      }
      seenResolutions.add(height);
      return true;
    })
    .map((f) => {
      const qualityLabel =
        f.format_note?.match(/\d+p/)?.[0] || (f.height ? `${f.height}p` : f.resolution);
      const videoSize = f.filesize || f.filesize_approx || 0;
      const totalSize = videoSize + bestAudioSize;
      return {
        itag: f.format_id,
        quality: qualityLabel || 'Unknown',
        container: f.ext,
        contentLength: totalSize > 0 ? totalSize.toString() : undefined,
        type: 'mp4',
      };
    });
}

/**
 * 메타데이터에서 UI에 표시할 오디오 포맷 목록을 필터링하고 가공합니다.
 * @param formats - yt-dlp에서 받은 전체 포맷 목록
 * @returns UI에 표시하기 좋은 형태로 가공된 오디오 포맷 배열
 */
function processAudioFormats(formats: YTDlpFormat[]): ProcessedFormat[] {
  return formats
    .filter((f) => f.vcodec === 'none' && f.acodec !== 'none' && (f.abr ?? 0) > 0)
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))
    .slice(0, 3)
    .map((f) => ({
      itag: f.format_id,
      quality: `${Math.round(f.abr ?? 0)}kbps`,
      container: f.ext,
      contentLength: (f.filesize || f.filesize_approx)?.toString(),
      type: 'mp3',
    }));
}

// 비디오 정보 요청 처리
// ipcMain.handle은 UI(Renderer)에서 보낸 'get-video-info' 요청을 비동기적으로 처리합니다.
ipcMain.handle('get-video-info', async (event, url) => {
  console.log(`[Main Process] 비디오 정보 요청 받음: ${url}`);
  try {
    // yt-dlp를 이용해 해당 URL의 메타데이터(제목, 썸네일, 포맷 목록 등)를 가져옵니다.
    const metadata: YTDlpMetadata = await ytDlpWrap.getVideoInfo(url);

    // 가장 좋은 음질의 오디오 포맷을 찾아 파일 크기를 계산합니다.
    const bestAudioFormat = metadata.formats
      .filter((f: YTDlpFormat) => f.vcodec !== 'none' && f.acodec !== 'none' && (f.abr ?? 0) > 0)
      .sort((a: YTDlpFormat, b: YTDlpFormat) => (b.abr ?? 0) - (a.abr ?? 0))[0]; // 정렬 후 첫 번째 항목 선택

    const bestAudioSize = bestAudioFormat?.filesize || bestAudioFormat?.filesize_approx || 0;

    // 도우미 함수를 호출하여 비디오와 오디오 포맷 목록을 각각 생성합니다.
    const videoFormats = processVideoFormats(metadata.formats, bestAudioSize);
    const audioFormats = processAudioFormats(metadata.formats);

    // 최종적으로 UI에 전달할 결과 객체를 만듭니다.
    const result = {
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      formats: [...videoFormats, ...audioFormats],
    };
    console.log(`[Main Process] 정보 가져오기 성공. 제목: ${result.title}`);
    // 성공 결과를 UI로 반환합니다.
    return result;
  } catch (error) {
    console.error('[Main Process] 정보 가져오기 중 오류 발생:', error);
    // 오류가 Error 객체의 인스턴스인지 확인하여 안전하게 message 속성에 접근합니다.
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    // 오류 발생 시, 오류 정보를 담은 객체를 UI로 반환합니다.
    return { error: errorMessage };
  }
});

// 다운로드 요청 처리
// UI에서 보낸 'download-video' 요청을 처리합니다.
ipcMain.handle(
  'download-video',
  async (event, { url, formatCode, type, title }: DownloadRequest) => {
    // 이 요청을 보낸 UI 창(BrowserWindow)을 찾습니다.
    const win = BrowserWindow.fromWebContents(event.sender)!;
    // 파일명으로 사용할 수 없는 문자들을 제거합니다.
    const sanitizedTitle = title.replace(/[\\/:\*\?"<>\|]/g, '');
    const extension = type === 'mp4' ? 'mp4' : 'mp3';

    // 사용자가 설정한 기본 다운로드 경로를 가져옵니다.
    const defaultDownloadPath = store.get('downloadPath');

    // 파일 저장 다이얼로그에 표시할 기본 파일 경로를 구성합니다.
    const defaultFileName = `${sanitizedTitle}.${extension}`;
    const fullDefaultPath = defaultDownloadPath
      ? path.join(defaultDownloadPath, defaultFileName)
      : defaultFileName;

    // '파일 저장' 다이얼로그를 띄울 때 사용할 옵션을 구성합니다.
    const saveDialogOptions: Electron.SaveDialogOptions = {
      title: '파일 저장 위치 선택',
      defaultPath: fullDefaultPath,
      filters: [{ name: type === 'mp4' ? 'MP4 Video' : 'MP3 Audio', extensions: [extension] }],
    };
    const { filePath } = await dialog.showSaveDialog(win, saveDialogOptions);

    // 사용자가 파일 경로를 선택했다면 (취소하지 않았다면)
    if (filePath) {
      // yt-dlp에 전달할 인자(argument) 배열을 구성합니다.
      const args = [
        url,
        '-f', // 포맷 코드를 지정하는 옵션
        formatCode,
        // 만약 타입이 'mp3'라면, 오디오만 추출해서(-x) mp3 형식으로 변환(--audio-format mp3)하는 옵션을 추가합니다.
        ...(type === 'mp3' ? ['-x', '--audio-format', 'mp3'] : []),
        '-o', // 출력 파일 경로를 지정하는 옵션
        filePath,
      ];
      console.log(`[Main Process] yt-dlp 실행: ${args.join(' ')}`);
      // 구성된 인자들로 yt-dlp를 실행합니다.
      ytDlpWrap
        .exec(args)
        // 'progress' 이벤트 리스너: 다운로드 진행률이 업데이트될 때마다 호출됩니다.
        .on('progress', (progress: any) => {
          // 'download-progress' 채널로 UI에 진행률 데이터를 보냅니다.
          win.webContents.send('download-progress', {
            itag: formatCode,
            percent: progress.percent,
          });
        })
        // 'error' 이벤트 리스너: 다운로드 중 오류가 발생하면 호출됩니다.
        .on('error', (error: unknown) => {
          console.error('[Main Process] 다운로드 오류:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'An unknown download error occurred.';
          // 'download-error' 채널로 UI에 오류 정보를 보냅니다.
          win.webContents.send('download-error', {
            itag: formatCode,
            error: errorMessage,
          });
        })
        // 'close' 이벤트 리스너: 다운로드가 성공적으로 완료되면 호출됩니다.
        .on('close', () => {
          console.log(`[Main Process] 다운로드 완료: ${filePath}`);
          // 다운로드가 100% 완료되었음을 'download-progress'로 알리고, 별도로 'download-complete' 이벤트도 보냅니다.
          win.webContents.send('download-complete', { itag: formatCode, filePath: filePath });

          // 도우미 함수를 호출하여 다운로드 기록을 깔끔하게 저장합니다.
          addDownloadToHistory({
            id: `${Date.now()}-${formatCode}`, // 고유 ID 생성
            title: sanitizedTitle,
            filePath: filePath,
            type: extension,
            downloadedAt: new Date().toISOString(),
          });
        });
    }
  },
);
