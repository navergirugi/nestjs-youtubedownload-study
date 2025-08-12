// 이 파일은 UI(Renderer)의 TypeScript에게 `window.api`의 존재와 구조를 알려주는 "신분증" 역할을 합니다.
// 또한, 백엔드와 UI가 주고받는 데이터의 타입을 정의하여 프로젝트 전체의 안정성을 높입니다.

import type { IpcRendererEvent } from 'electron';

// preload.ts에서 정의된 api 객체의 타입을 여기에 직접 정의합니다.
// 이렇게 하면 preload.ts에서 export할 필요가 없어져 모듈 시스템 충돌을 피할 수 있습니다.
type ExposedApi = {
  onDownloadProgress: (callback: (event: IpcRendererEvent, data: { itag: string; percent: number }) => void) => () => void;
  onDownloadComplete: (callback: (event: IpcRendererEvent, data: { itag: string; filePath: string }) => void) => () => void;
  onDownloadError: (callback: (event: IpcRendererEvent, data: { itag: string; error: string }) => void) => () => void;
  getVideoInfo: (url: string) => Promise<VideoInfo>;
  downloadVideo: (options: {
    url: string;
    formatCode: string;
    type: 'mp4' | 'mp3';
    title: string;
  }) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<void>;
  setDownloadPath: () => Promise<string>;
  getDownloadPath: () => Promise<string>;
  getDownloadHistory: () => Promise<DownloadHistoryItem[]>;
  clearDownloadHistory: () => Promise<void>;
};

// UI에서 사용할 데이터 타입들을 정의합니다.
// 이 타입들은 백엔드에서 보내주는 데이터 구조와 일치해야 합니다.
export type VideoFormat = {
  itag: string;
  quality: string;
  container: string;
  contentLength?: string;
  type: 'mp4' | 'mp3';
};

export type VideoInfo = {
  title: string;
  thumbnail: string;
  formats: VideoFormat[];
  error?: string; // 오류 발생 시를 대비해 error 속성을 명시합니다.
};

export type DownloadHistoryItem = {
  id: string;
  title: string;
  filePath: string;
  type: 'mp4' | 'mp3';
  downloadedAt: string;
};

// 전역 `Window` 인터페이스를 확장하여 `api` 속성을 추가합니다.
// 이제 UI의 모든 TypeScript 파일에서 `window.api`를 타입 오류 없이 안전하게 사용할 수 있습니다.
declare global {
  interface Window {
    api: ExposedApi;
  }
}