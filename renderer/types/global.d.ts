export {};

declare global {
  // 비디오 포맷과 정보에 대한 타입 정의 (글로벌로 사용)
  interface VideoFormat {
    itag: string;
    quality: string;
    container: string;
    contentLength?: string;
    type: 'mp4' | 'mp3';
  }

  interface VideoInfo {
    title: string;
    thumbnail: string;
    formats: VideoFormat[];
    error?: string;
  }

  // 다운로드 기록 항목에 대한 타입 정의
  interface DownloadHistoryItem {
    id: string;
    title: string;
    filePath: string;
    type: 'mp4' | 'mp3';
    downloadedAt: string;
  }

  interface Window {
    api: {
      getVideoInfo: (url: string) => Promise<VideoInfo>;
      downloadVideo: (options: {
        url: string;
        formatCode: string;
        type: 'mp4' | 'mp3';
        title: string;
      }) => Promise<void>;
      onDownloadProgress: (
        callback: (
          event: any,
          // 완료 시 filePath가 포함되므로 data 타입 수정
          data: { itag: string; percent: number; filePath: string | null },
        ) => void,
      ) => () => void;
      onDownloadComplete: (
        callback: (event: IpcRendererEvent, data: { itag: string; filePath: string }) => void,
      ) => () => void;
      onDownloadError: (
        callback: (event: any, data: { itag: string; error: string }) => void,
      ) => () => void;
      // --- 신규 API 타입 정의 ---
      getDownloadPath: () => Promise<string | undefined>;
      setDownloadPath: () => Promise<string | undefined>;
      getDownloadHistory: () => Promise<DownloadHistoryItem[]>;
      clearDownloadHistory: () => Promise<void>;
      showItemInFolder: (filePath: string) => Promise<void>;
    };
  }
  // 이 파일이 모듈임을 명시적으로 알리기 위해 빈 export를 추가합니다.
  // 이렇게 해야 declare global이 올바르게 동작합니다.
}
