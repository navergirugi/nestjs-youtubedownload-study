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
import * as isDev from 'electron-is-dev';
// yt-dlp 명령줄 도구를 Node.js에서 쉽게 사용할 수 있도록 감싸주는 라이브러리입니다.
import YtDlpWrap from 'yt-dlp-wrap';
// yt-dlp가 반환하는 데이터의 타입을 정의해둔 파일을 가져옵니다. 코드의 안정성을 높여줍니다.
import { YTDlpFormat, YTDlpMetadata } from './yt-dlp-types';
// Node.js의 내장 모듈로, 파일 시스템과 상호작용(파일 읽기, 쓰기 등)하는 기능을 제공합니다.
import * as fs from 'fs';
// 앱의 설정(다운로드 경로, 기록 등)을 JSON 파일에 영구적으로 저장하고 불러오는 라이브러리입니다.
// `import * as Store from ...` 구문을 사용하여 모듈 전체를 'Store'라는 이름의 객체로 가져옵니다.
// 최신 `electron-store`는 ES 모듈 방식으로 `export default`를 사용하므로, 실제 클래스는 `Store.default`에 있습니다.
import * as Store from 'electron-store';

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
};

// store 변수를 선언만 해둡니다. 실제 초기화는 app.whenReady() 안에서 이루어집니다.
// 이렇게 해야 app.getPath() 같은 함수를 안전하게 사용할 수 있습니다.
// 타입과 생성자 모두 `Store`가 아닌 `Store.default`를 사용하도록 수정합니다.
let store: Store.default<StoreSchema>;

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

// yt-dlp-wrap 라이브러리의 인스턴스(객체)를 생성합니다.
const ytDlpWrap = new YtDlpWrap();
// yt-dlp-wrap 인스턴스에 실행 파일이 어디에 있는지 알려줍니다.
// 이렇게 경로를 명시적으로 지정해주면, 라이브러리가 실행 파일을 찾지 못하는 문제를 방지할 수 있습니다.
ytDlpWrap.setBinaryPath(ytDlpPath);

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
  // --- Store 초기화 ---
  // 앱이 준비된 후에 Store 인스턴스를 생성합니다.
  // 이렇게 하면 app.getPath() 같은 Electron API를 안전하게 사용할 수 있습니다.
  store = new Store.default<StoreSchema>({
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
    await YtDlpWrap.downloadFromGithub(ytDlpPath);
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

// 비디오 정보 요청 처리
// ipcMain.handle은 UI(Renderer)에서 보낸 'get-video-info' 요청을 비동기적으로 처리합니다.
ipcMain.handle('get-video-info', async (event, url) => {
  console.log(`[Main Process] 비디오 정보 요청 받음: ${url}`);
  try {
    // yt-dlp를 이용해 해당 URL의 메타데이터(제목, 썸네일, 포맷 목록 등)를 가져옵니다.
    const metadata: YTDlpMetadata = await ytDlpWrap.getVideoInfo(url);

    // --- 오디오 포맷 필터링 및 정제 (가장 좋은 음질 하나만 찾기) ---
    // 비디오 포맷의 예상 파일 크기를 계산하는 데 사용됩니다.
    const bestAudioFormat = metadata.formats
      .filter((f: YTDlpFormat) => f.vcodec !== 'none' && f.acodec !== 'none' && (f.abr ?? 0) > 0)
      .sort((a: YTDlpFormat, b: YTDlpFormat) => (b.abr ?? 0) - (a.abr ?? 0))[0]; // 정렬 후 첫 번째 항목 선택

    const bestAudioSize = bestAudioFormat?.filesize || bestAudioFormat?.filesize_approx || 0;

    // --- 비디오 포맷 필터링 및 정제 (UI에 표시할 목록) ---
    // 1. 고화질(비디오만 있는) MP4 포맷만 필터링합니다.
    // 2. 화질(세로 해상도)을 기준으로 내림차순 정렬합니다. (예: 1080p, 720p, 480p 순)
    // 3. 중복된 화질을 제거합니다. (예: 1080p 포맷이 여러 개 있으면 가장 좋은 하나만 남김)
    const seenResolutions = new Set<number>(); // 이미 처리한 화질(세로 해상도)을 기록하기 위한 Set
    const videoFormats = metadata.formats
      // 비디오만 있는(소리 없는) 고화질 mp4 포맷을 찾도록 수정
      // 유튜브는 고화질 영상의 경우 비디오와 오디오를 분리해서 제공합니다.
      // vcodec(비디오 코덱)이 있고, acodec(오디오 코덱)은 없으며, 확장자가 mp4인 것만 고릅니다.
      .filter(
        (f: YTDlpFormat) =>
          f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4' && f.height,
      )
      // 화질(세로 픽셀) 기준으로 내림차순 정렬
      .sort((a, b) => {
        return (b.height ?? 0) - (a.height ?? 0);
      })
      // 중복 화질 제거
      .filter((f: YTDlpFormat) => {
        const height = f.height!;
        if (seenResolutions.has(height)) {
          return false; // 이미 더 좋은 화질의 동일 해상도 포맷이 있으므로 건너뜀
        } else {
          seenResolutions.add(height);
          return true; // 새로운 화질이므로 목록에 포함
        }
      })
      // UI에서 사용하기 좋은 형태로 데이터를 가공(map)합니다.
      .map((f: YTDlpFormat) => {
        // 화질 라벨을 생성합니다. (예: '1080p', '720p')
        // f.format_note에 '1080p' 같은 정보가 있으면 우선 사용하고, 없으면 f.height 값을 사용합니다.
        const qualityLabel =
          f.format_note?.match(/\d+p/)?.[0] || (f.height ? `${f.height}p` : f.resolution);

        // 비디오 파일 크기와 가장 좋은 오디오 파일 크기를 합산하여 예상 전체 크기를 계산합니다.
        const videoSize = f.filesize || f.filesize_approx || 0;
        const totalSize = videoSize + bestAudioSize;

        return {
          itag: f.format_id,
          quality: qualityLabel || 'Unknown', // '1080p' 같은 화질 정보
          container: f.ext,
          contentLength: totalSize > 0 ? totalSize.toString() : undefined, // 파일 크기
          type: 'mp4',
        };
      });

    // --- 오디오 포맷 필터링 및 정제 ---
    // 1. 유효한 오디오 포맷만 필터링합니다.
    // 2. 음질(abr)을 기준으로 내림차순 정렬합니다.
    // 3. 가장 음질이 좋은 상위 3개만 선택합니다.
    const audioFormats = metadata.formats
      // 비트레이트(abr)가 0보다 큰, 유효한 오디오 포맷만 필터링하도록 조건 추가
      // vcodec은 없고, acodec은 있으며, 오디오 비트레이트(abr)가 0보다 큰 것만 고릅니다.
      .filter((f: YTDlpFormat) => f.vcodec === 'none' && f.acodec !== 'none' && (f.abr ?? 0) > 0)
      // 음질(abr)이 높은 순서대로 정렬합니다.
      .sort((a: YTDlpFormat, b: YTDlpFormat) => (b.abr ?? 0) - (a.abr ?? 0))
      // 가장 좋은 음질 3개만 잘라냅니다.
      .slice(0, 3)
      // UI에서 사용하기 좋은 형태로 데이터를 가공합니다.
      .map((f: YTDlpFormat) => ({
        itag: f.format_id,
        quality: `${Math.round(f.abr ?? 0)}kbps`, // '128kbps' 같은 음질 정보
        container: f.ext,
        contentLength: (f.filesize || f.filesize_approx)?.toString(),
        type: 'mp3', // 다운로드 시 MP3로 변환할 것을 표시
      }));

    // 최종적으로 UI에 전달할 결과 객체를 만듭니다.
    const result = {
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      // 정제된 비디오와 오디오 포맷 목록을 UI에 전달하기 위해 하나로 합칩니다.
      formats: [...videoFormats, ...audioFormats],
    };
    console.log(`[Main Process] 정보 가져오기 성공. 제목: ${result.title}`);
    // 성공 결과를 UI로 반환합니다.
    return result;
  } catch (error: any) {
    console.error('[Main Process] 정보 가져오기 중 오류 발생:', error);
    // 오류 발생 시, 오류 정보를 담은 객체를 UI로 반환합니다.
    return { error: error.message || '알 수 없는 오류가 발생했습니다.' };
  }
});

// 다운로드 요청 처리
// UI에서 보낸 'download-video' 요청을 처리합니다.
ipcMain.handle('download-video', async (event, { url, formatCode, type, title }) => {
  // 이 요청을 보낸 UI 창(BrowserWindow)을 찾습니다.
  const win = BrowserWindow.fromWebContents(event.sender)!;
  // 파일명으로 사용할 수 없는 문자들을 제거합니다.
  const sanitizedTitle = title.replace(/[\\/:\*\?"<>\|]/g, '');
  const extension = type === 'mp4' ? 'mp4' : 'mp3';

  // 사용자가 설정한 기본 다운로드 경로를 가져옵니다.
  const defaultDownloadPath = store.get('downloadPath');

  // '파일 저장' 다이얼로그를 띄울 때 사용할 옵션을 구성합니다.
  const saveDialogOptions: Electron.SaveDialogOptions = {
    title: '파일 저장 위치 선택',
    defaultPath: defaultDownloadPath
      ? path.join(defaultDownloadPath, `${sanitizedTitle}.${extension}`)
      : `${sanitizedTitle}.${extension}`,
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
      .on('progress', (progress) => {
        // 'download-progress' 채널로 UI에 진행률 데이터를 보냅니다.
        win.webContents.send('download-progress', {
          itag: formatCode,
          percent: progress.percent,
          filePath: null,
        });
      })
      // 'error' 이벤트 리스너: 다운로드 중 오류가 발생하면 호출됩니다.
      .on('error', (error) => {
        console.error('[Main Process] 다운로드 오류:', error);
        // 'download-error' 채널로 UI에 오류 정보를 보냅니다.
        win.webContents.send('download-error', {
          itag: formatCode,
          error: error.message,
        });
      })
      // 'close' 이벤트 리스너: 다운로드가 성공적으로 완료되면 호출됩니다.
      .on('close', () => {
        console.log(`[Main Process] 다운로드 완료: ${filePath}`);
        // 다운로드가 100% 완료되었음을 'download-progress'로 알리고, 별도로 'download-complete' 이벤트도 보냅니다.
        win.webContents.send('download-complete', { itag: formatCode, filePath: filePath });

        // --- 다운로드 기록 저장 ---
        const history = store
          .get('downloadHistory', [])
          .filter((item: DownloadHistoryItem) => item.filePath !== filePath); // 중복 방지
        history.unshift({
          // 배열의 맨 앞에 추가
          id: `${Date.now()}-${formatCode}`, // 고유 ID 생성
          title: sanitizedTitle,
          filePath: filePath,
          type: extension,
          downloadedAt: new Date().toISOString(),
        });

        // 기록은 최대 50개까지만 저장합니다.
        store.set('downloadHistory', history.slice(0, 50));
      });
  }
});
