// Based on yt-dlp --dump-json output
export interface YTDlpFormat {
  format_id: string;
  format_note?: string;
  resolution?: string;
  height?: number;
  ext: string;
  vcodec: string;
  acodec: string;
  filesize?: number;
  filesize_approx?: number;
  abr?: number; // audio bitrate
}

export interface YTDlpMetadata {
  title: string;
  thumbnail: string;
  formats: YTDlpFormat[];
}
