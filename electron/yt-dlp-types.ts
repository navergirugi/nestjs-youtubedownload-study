// 이 파일은 yt-dlp-wrap 라이브러리가 반환하는 JSON 데이터의 구조를 TypeScript에게 알려주는 "설계도" 역할을 합니다.
// 이를 통해 코드 자동완성, 타입 검사 등의 이점을 얻어 코드의 안정성을 크게 높일 수 있습니다.

/**
 * 개별 비디오/오디오 포맷에 대한 상세 정보를 담는 타입입니다.
 * yt-dlp가 제공하는 수많은 필드 중, 이 앱에서 실제로 사용하는 필드들만 정의합니다.
 * ? 기호는 해당 필드가 항상 존재하지는 않을 수 있음을 의미합니다. (Optional)
 */
export interface YTDlpFormat {
  format_id?: string; // 포맷 고유 ID (예: '137', '251')
  format_note?: string; // 포맷 설명 (예: '1080p', 'medium')
  ext: string; // 파일 확장자 (예: 'mp4', 'webm')
  resolution?: string; // 해상도 문자열 (예: '1920x1080')
  vcodec?: string; // 비디오 코덱 (예: 'avc1.640028', 'none')
  acodec?: string; // 오디오 코덱 (예: 'mp4a.40.2', 'opus')
  height?: number; // 비디오 세로 해상도
  width?: number; // 비디오 가로 해상도
  filesize?: number; // 정확한 파일 크기 (바이트 단위)
  filesize_approx?: number; // 추정 파일 크기 (바이트 단위)
  abr?: number; // 오디오 비트레이트 (kbps)
}

/**
 * yt-dlp가 반환하는 전체 메타데이터의 구조를 정의합니다.
 * 비디오의 제목, 썸네일, 그리고 사용 가능한 모든 포맷 목록을 포함합니다.
 */
export interface YTDlpMetadata {
  id: string; // 비디오 ID
  title: string; // 비디오 제목
  thumbnail?: string; // 썸네일 이미지 URL
  description?: string; // 비디오 설명
  duration?: number; // 비디오 길이 (초 단위)
  formats: YTDlpFormat[]; // 사용 가능한 모든 비디오/오디오 포맷의 배열
}
