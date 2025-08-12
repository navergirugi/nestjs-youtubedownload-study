// React의 상태 관리(useState)와 생명주기 관리(useEffect)를 위한 훅(hook)들을 가져옵니다.
import { useState, useEffect } from 'react';

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
    if (filePath) window.api.showItemInFolder(filePath);
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
    window.api.showItemInFolder(item.filePath);
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

  // useEffect 훅: 컴포넌트가 처음 렌더링될 때 특정 작업을 수행하게 합니다. (여기서는 백엔드 이벤트 리스너 설정)
  // 다운로드 진행률 업데이트 리스너 설정
  useEffect(() => {
    // window.api를 통해 백엔드(Main)에서 보내는 'download-progress' 이벤트를 수신 대기합니다.
    const cleanup = window.api.onDownloadProgress((_, { itag, percent }) => {
      // 진행률 데이터가 오면, downloadProgress 상태를 업데이트합니다.
      setDownloadProgress((prev) => ({
        ...prev,
        [itag]: percent,
      }));
    });
    // 이 컴포넌트가 사라질 때(unmount) 실행될 클린업 함수입니다.
    // 리스너를 제거하여 메모리 누수를 방지합니다.
    return cleanup;
  }, []);

  // 다운로드 완료 리스너 설정
  useEffect(() => {
    // 백엔드에서 보내는 'download-complete' 이벤트를 수신 대기합니다.
    const cleanup = window.api.onDownloadComplete((_, { itag, filePath }) => {
      // 완료 데이터가 오면, completedFiles 상태를 업데이트합니다.
      setCompletedFiles((prev) => ({ ...prev, [itag]: filePath }));
    });
    return cleanup;
  }, []);

  // 다운로드 오류 리스너 설정
  useEffect(() => {
    const cleanup = window.api.onDownloadError((_, { itag, error }) => {
      // 오류 데이터가 오면, downloadErrors 상태를 업데이트합니다.
      setDownloadErrors((prev) => ({ ...prev, [itag]: error }));
      // 진행률을 undefined로 설정하여 프로그레스 바를 숨깁니다.
      setDownloadProgress((prev) => ({ ...prev, [itag]: undefined }));
    });
    return cleanup;
  }, []);

  // '정보 가져오기' 버튼을 클릭했을 때 실행되는 비동기 함수입니다.
  const handleFetchInfo = async () => {
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
    // 로딩 상태를 종료합니다.
    setLoading(false);
  };

  // 각 다운로드 항목의 '다운로드' 버튼을 클릭했을 때 실행되는 함수입니다.
  const handleDownload = async (format: VideoFormat) => {
    if (!videoInfo) return;
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
  };

  // 페이지의 전체 UI 구조입니다.
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 text-white p-8 md:p-12">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">YouTube 비디오 다운로더</h1>
        {/*<p className="text-md md:text-lg text-gray-400 mb-8">ssyoutube.online 클론 앱</p>*/}
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
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 md:px-8 rounded-lg transition-colors disabled:bg-gray-500"
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
