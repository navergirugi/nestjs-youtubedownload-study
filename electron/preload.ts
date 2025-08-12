// 이 파일은 Electron의 메인 프로세스와 렌더러 프로세스(UI) 사이의 안전한 "다리" 역할을 합니다.
// contextBridge를 사용하여, 메인 프로세스의 특정 기능들을 렌더러의 `window` 객체에 안전하게 노출시킵니다.

const { contextBridge, ipcRenderer } = require('electron');
import type { IpcRendererEvent } from 'electron';

// 렌더러와 주고받을 데이터 타입을 명시하여 코드 안정성을 높입니다.
type DownloadRequest = {
  url: string;
  formatCode: string;
  type: 'mp4' | 'mp3';
  title: string;
};

type ProgressData = { itag: string; percent: number };
type CompleteData = { itag: string; filePath: string };
type ErrorData = { itag: string; error: string };

// 콜백 함수 타입들 정의
type DownloadProgressCallback = (event: IpcRendererEvent, data: ProgressData) => void;
type DownloadCompleteCallback = (event: IpcRendererEvent, data: CompleteData) => void;
type DownloadErrorCallback = (event: IpcRendererEvent, data: ErrorData) => void;

// 렌더러에 노출할 API 객체입니다.
const api = {
  // Main -> Renderer (Listeners)
  // 메인 프로세스에서 보내는 이벤트를 수신 대기합니다.
  // React의 useEffect 훅에서 사용하기 좋도록, 리스너를 제거하는 cleanup 함수를 반환합니다.
  onDownloadProgress: (callback: DownloadProgressCallback) => {
    ipcRenderer.on('download-progress', callback);
    return () => ipcRenderer.removeListener('download-progress', callback);
  },
  onDownloadComplete: (callback: DownloadCompleteCallback) => {
    ipcRenderer.on('download-complete', callback);
    return () => ipcRenderer.removeListener('download-complete', callback);
  },
  onDownloadError: (callback: DownloadErrorCallback) => {
    ipcRenderer.on('download-error', callback);
    return () => ipcRenderer.removeListener('download-error', callback);
  },

  // Renderer -> Main (Invokers)
  // 렌더러에서 메인 프로세스의 기능을 호출하고 결과를 비동기적으로 받습니다.
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
  downloadVideo: (options: DownloadRequest) => ipcRenderer.invoke('download-video', options),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  setDownloadPath: () => ipcRenderer.invoke('set-download-path'),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  getDownloadHistory: () => ipcRenderer.invoke('get-download-history'),
  clearDownloadHistory: () => ipcRenderer.invoke('clear-download-history'),
};

// `contextBridge`를 사용하여 위에서 정의한 `api` 객체를 `window.api`라는 이름으로 렌더러에 안전하게 노출합니다.
// 중요: 한 번만 호출해야 합니다!
contextBridge.exposeInMainWorld('api', api);
