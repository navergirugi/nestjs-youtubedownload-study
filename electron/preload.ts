// contextBridge: 안전하게 Main 프로세스와 Renderer 프로세스 간에 통신할 수 있는 API를 노출시키는 모듈
// ipcRenderer: Renderer 프로세스에서 Main 프로세스로 비동기 메시지를 보내는 모듈
import { contextBridge, ipcRenderer } from 'electron';

// UI(Renderer)에서 호출할 수 있는 함수들을 정의합니다.
// 이 객체에 정의된 함수들만 UI의 window.api를 통해 접근할 수 있습니다.
const api = {
  // Main 프로세스에 비디오 정보 요청
  // UI에서 window.api.getVideoInfo(url)을 호출하면,
  // ipcRenderer.invoke를 통해 Main 프로세스의 'get-video-info' 핸들러에게 url을 전달하고, 그 결과를 Promise로 반환받습니다.
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),

  // Main 프로세스에 다운로드 요청
  // UI에서 window.api.downloadVideo(options)를 호출하면,
  // ipcRenderer.invoke를 통해 Main 프로세스의 'download-video' 핸들러에게 options 객체를 전달합니다.
  downloadVideo: (options: {
    url: string;
    formatCode: string;
    type: 'mp4' | 'mp3';
    title: string;
  }) => ipcRenderer.invoke('download-video', options),

  // --- 신규 API 함수들 ---
  // 기본 다운로드 경로 가져오기
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  // 기본 다운로드 경로 설정하기
  setDownloadPath: () => ipcRenderer.invoke('set-download-path'),
  // 다운로드 기록 가져오기
  getDownloadHistory: () => ipcRenderer.invoke('get-download-history'),
  // 다운로드 기록 삭제하기
  clearDownloadHistory: () => ipcRenderer.invoke('clear-download-history'),
  // 파일이 있는 폴더 열기
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),

  // Main 프로세스로부터 오는 다운로드 진행률 수신
  // 이 함수는 UI에서 콜백 함수를 등록하는 데 사용됩니다.
  onDownloadProgress: (
    // 완료 시 filePath가 포함되므로 data 타입 수정
    callback: (
      event: any,
      data: { itag: string; percent: number; filePath: string | null },
    ) => void,
  ) => {
    // Main 프로세스가 'download-progress' 채널로 데이터를 보낼 때마다 등록된 콜백 함수가 실행됩니다.
    ipcRenderer.on('download-progress', callback);
    // 클린업(정리) 함수를 반환합니다.
    // React 컴포넌트가 언마운트될 때 이 함수를 호출하여, 불필요한 메모리 누수를 방지하기 위해 리스너를 제거합니다.
    return () => {
      ipcRenderer.removeAllListeners('download-progress');
    };
  },

  // Main 프로세스로부터 오는 다운로드 오류 수신
  onDownloadError: (callback: (event: any, data: { itag: string; error: string }) => void) => {
    // Main 프로세스가 'download-error' 채널로 데이터를 보낼 때마다 등록된 콜백 함수가 실행됩니다.
    ipcRenderer.on('download-error', callback);
    // 마찬가지로, 리스너를 정리하는 클린업 함수를 반환합니다.
    return () => {
      ipcRenderer.removeAllListeners('download-error');
    };
  },
};

// `contextBridge.exposeInMainWorld`를 사용하여 위에서 정의한 `api` 객체를
// UI의 `window` 객체에 `api`라는 이름으로 안전하게 노출시킵니다.
// 이렇게 하면 UI에서는 `window.api.getVideoInfo(...)` 와 같은 방식으로 백엔드 기능을 호출할 수 있습니다.
contextBridge.exposeInMainWorld('api', api);
