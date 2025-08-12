// React의 상태 관리(useState)와 생명주기 관리(useEffect)를 위한 훅(hook)들을 가져옵니다.
import { useState, useEffect } from 'react';
import type { VideoFormat, VideoInfo, DownloadHistoryItem } from '../types/electron';

// --- 다운로드 항목 개별 컴포넌트 ---
const DownloadItem = ({
  format,
  progress,
  error,
  filePath,
  onDownload,
}: {
  // 이 컴포넌트가 받는 props(속성)들의 타입을 정의합니다.
  format: VideoFormat;
  progress: number | undefined;
  error: string | undefined;
  // 다운로드가 완료되면 파일의 전체 경로가 여기에 전달됩니다.
  filePath: string | undefined;
  onDownload: () => void;
}) => {
  // 파일 크기(바이트 단위)를 사람이 읽기 쉬운 형태(KB, MB, GB)로 변환하는 유틸리티 함수입니다.
  const formatBytes = (bytes?: string, decimals = 2) => {
    if (!bytes) return 'N/A';
    const bytesNum = parseInt(bytes, 10);
    if (bytesNum === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytesNum) / Math.log(k));
    return parseFloat((bytesNum / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // 현재 다운로드 진행 상태를 나타내는 boolean 값들을 계산합니다.
  const isDownloading = progress !== undefined && progress > 0 && progress < 100;
  const isCompleted = progress === 100 && !!filePath; // filePath가 있어야만 진짜 완료된 것으로 간주

  // '폴더 열기' 버튼을 클릭했을 때 실행되는 함수
  const handleShowItem = () => {
    if (filePath && window.api?.showItemInFolder) {
      window.api.showItemInFolder(filePath);
    }
  };

  // 이 컴포넌트가 화면에 어떻게 보일지를 정의하는 JSX 코드입니다.
  return (
    <div className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
      <div>
        <span className={`font-bold ${format.type === 'mp4' ? 'text-blue-400' : 'text-green-400'}`}>
          {format.type.toUpperCase()}
        </span>
        <span className="ml-4 text-gray-300">{format.quality}</span>
        <span className="ml-4 text-gray-400 text-sm">{formatBytes(format.contentLength)}</span>
      </div>
      {/* 조건부 렌더링: 다운로드 상태에 따라 다른 UI를 보여줍니다. */}
      {error ? (
        // 1. 오류가 발생한 경우
        <span className="text-red-400 font-semibold" title={error}>
          실패
        </span>
      ) : isCompleted ? (
        // 2. 다운로드가 완료된 경우 ('폴더 열기' 버튼으로 변경)
        <button
          onClick={handleShowItem}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          폴더 열기
        </button>
      ) : isDownloading ? (
        // 3. 다운로드가 진행 중인 경우 (프로그레스 바 표시)
        <div className="w-24 bg-gray-600 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      ) : (
        // 4. 아무 상태도 아닌 경우 (다운로드 버튼 표시)
        <button
          onClick={onDownload}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          다운로드
        </button>
      )}
    </div>
  );
};

// --- 다운로드 기록(History) 항목 컴포넌트 ---
const HistoryItem = ({ item }: { item: DownloadHistoryItem }) => {
  // '폴더 열기' 버튼 클릭 시 실행될 함수
  const handleShowItem = () => {
    if (window.api?.showItemInFolder) {
      window.api.showItemInFolder(item.filePath);
    }
  };

  // 다운로드된 시간을 사람이 읽기 쉬운 형태로 포맷팅
  const formattedDate = new Date(item.downloadedAt).toLocaleString('ko-KR');

  return (
    <div className="flex justify-between items-center bg-gray-800 p-3 rounded-md">
      <div className="flex-1 overflow-hidden">
        <p className="text-white truncate" title={item.title}>
          {item.title}
        </p>
        <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
      </div>
      <button
        onClick={handleShowItem}
        className="ml-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-1 px-3 rounded-lg text-sm transition-colors"
      >
        폴더 열기
      </button>
    </div>
  );
};

// --- 메인 페이지 컴포넌트 ---
export default function Home() {
  // React의 상태(state) 훅을 사용하여 컴포넌트의 데이터를 관리합니다.
  // 상태가 변경되면 컴포넌트는 자동으로 다시 렌더링됩니다.
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // URL 분석 시 발생하는 오류

  // 다운로드 진행 상태를 관리하는 객체. { 'itag': progress } 형태입니다.
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // 다운로드 오류 상태를 관리하는 객체. { itag: errorMessage } 형태입니다.
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string | undefined>>({});

  // 다운로드가 완료된 파일의 경로를 관리하는 객체. { itag: filePath } 형태입니다.
  const [completedFiles, setCompletedFiles] = useState<Record<string, string>>({});

  // 컴포넌트가 마운트될 때, 백엔드(Main)에서 보내는 이벤트들을 수신 대기하는 리스너를 설정합니다.
  useEffect(() => {
    // window.api가 로드되었는지 확인합니다. preload 스크립트가 실패하면 api는 존재하지 않습니다.
    if (!window.api) {
      console.error('FATAL: window.api is not defined. Preload script likely failed to load.');
      return;
    }

    // 다운로드 진행률 업데이트를 수신합니다.
    const cleanupProgress = window.api.onDownloadProgress((_, { itag, percent }) => {
      setDownloadProgress((prev) => ({ ...prev, [itag]: percent }));
    });

    // 다운로드 완료를 수신합니다.
    const cleanupComplete = window.api.onDownloadComplete((_, { itag, filePath }) => {
      // 완료 시 진행률을 100%로 확실히 설정하고, 완료 파일 목록에 추가합니다.
      setDownloadProgress((prev) => ({ ...prev, [itag]: 100 }));
      setCompletedFiles((prev) => ({ ...prev, [itag]: filePath }));
    });

    // 다운로드 오류를 수신합니다.
    const cleanupError = window.api.onDownloadError((_, { itag, error }) => {
      setDownloadErrors((prev) => ({ ...prev, [itag]: error }));
      // 오류 발생 시 진행률을 초기화하여 프로그레스 바를 숨깁니다.
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[itag];
        return newProgress;
      });
    });

    // 컴포넌트가 언마운트될 때, 등록했던 모든 리스너를 정리(제거)합니다.
    // 이렇게 하지 않으면 메모리 누수가 발생할 수 있습니다.
    return () => {
      cleanupProgress();
      cleanupComplete();
      cleanupError();
    };
  }, []); // 빈 배열을 전달하여 이 useEffect가 컴포넌트 마운트 시 한 번만 실행되도록 합니다.

  // '정보 가져오기' 버튼을 클릭했을 때 실행되는 비동기 함수입니다.
  const handleFetchInfo = async () => {
    // API가 준비되었는지 확인합니다.
    if (!window.api?.getVideoInfo) {
      setError('API가 준비되지 않았습니다. 앱을 다시 시작해주세요.');
      return;
    }

    if (!url) {
      setError('유튜브 비디오 URL을 입력해주세요.');
      return;
    }

    // 로딩 시작 전에 관련 상태들을 초기화합니다.
    setLoading(true);
    setError('');
    setVideoInfo(null);
    setDownloadProgress({});
    setDownloadErrors({});
    setCompletedFiles({});

    try {
      console.log(`[Home] handleFetchInfo start : ${url}`);
      // window.api를 통해 백엔드에 비디오 정보 요청을 보냅니다.
      const info: VideoInfo = await window.api.getVideoInfo(url);
      console.log(`[Home] handleFetchInfo end : ${JSON.stringify(info)}`);

      // 백엔드로부터 받은 응답을 처리합니다.
      if (info.error) {
        console.error(`[Home] handleFetchInfo error: ${info.error}`);
        setError(info.error);
      } else {
        setVideoInfo(info);
      }
    } catch (error) {
      console.error('Failed to fetch video info:', error);
      setError('비디오 정보를 가져오는 중 오류가 발생했습니다.');
    }

    // 로딩 상태를 종료합니다.
    setLoading(false);
  };

  // 각 다운로드 항목의 '다운로드' 버튼을 클릭했을 때 실행되는 함수입니다.
  const handleDownload = async (format: VideoFormat) => {
    if (!window.api?.downloadVideo) {
      console.error('API가 준비되지 않았습니다.');
      return;
    }

    if (!videoInfo) return;

    try {
      // 다운로드를 시작하기 전에 해당 항목의 진행률과 오류 상태를 초기화합니다.
      setDownloadProgress((prev) => ({ ...prev, [format.itag]: 0 }));
      setDownloadErrors((prev) => ({ ...prev, [format.itag]: undefined })); // 이전 오류 초기화

      // window.api를 통해 백엔드에 실제 다운로드를 요청합니다.
      await window.api.downloadVideo({
        url,
        formatCode: format.itag,
        type: format.type,
        title: videoInfo.title,
      });
    } catch (error) {
      console.error('Failed to start download:', error);
      setDownloadErrors((prev) => ({
        ...prev,
        [format.itag]: '다운로드 시작 중 오류가 발생했습니다.',
      }));
    }
  };

  // 페이지의 전체 UI 구조입니다.
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 text-white p-8 md:p-12">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">YouTube 비디오 다운로더</h1>

        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="여기에 비디오 링크를 붙여넣으세요"
            className="flex-grow p-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
          />
          <button
            onClick={handleFetchInfo}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 md:px-8 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? '로딩중...' : '정보 가져오기'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-4">{error}</p>}

        {/* videoInfo 상태에 데이터가 있을 때만 이 블록을 렌더링합니다. */}
        {videoInfo && (
          <div className="mt-8 text-left bg-gray-800 rounded-lg p-6">
            {(() => {
              // 렌더링 로직을 깔끔하게 관리하기 위해, 받은 포맷 목록을 비디오와 오디오로 분리합니다.
              const mp4Formats = videoInfo.formats.filter((f) => f.type === 'mp4');
              const mp3Formats = videoInfo.formats.filter((f) => f.type === 'mp3');

              return (
                <div className="flex flex-col md:flex-row gap-6">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full md:w-1/3 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{videoInfo.title}</h2>

                    {/* --- 비디오 다운로드 섹션 --- */}
                    {/* 렌더링할 비디오 포맷이 1개 이상 있을 때만 이 섹션을 보여줍니다. */}
                    {mp4Formats.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">
                          비디오 다운로드 (MP4)
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {/* mp4Formats 배열을 순회하며 각 포맷에 대한 DownloadItem 컴포넌트를 렌더링합니다. */}
                          {mp4Formats.map((format) => (
                            <DownloadItem
                              key={format.itag}
                              format={format}
                              progress={downloadProgress[format.itag]}
                              error={downloadErrors[format.itag]}
                              filePath={completedFiles[format.itag]}
                              onDownload={() => handleDownload(format)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* --- 오디오 다운로드 섹션 --- */}
                    {/* 렌더링할 오디오 포맷이 1개 이상 있을 때만 이 섹션을 보여줍니다. */}
                    {mp3Formats.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">
                          오디오 다운로드 (MP3)
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {/* mp3Formats 배열을 순회하며 각 포맷에 대한 DownloadItem 컴포넌트를 렌더링합니다. */}
                          {mp3Formats.map((format) => (
                            <DownloadItem
                              key={format.itag}
                              format={format}
                              progress={downloadProgress[format.itag]}
                              error={downloadErrors[format.itag]}
                              filePath={completedFiles[format.itag]}
                              onDownload={() => handleDownload(format)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
}
