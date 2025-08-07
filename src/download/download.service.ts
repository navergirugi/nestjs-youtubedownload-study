import { Injectable } from '@nestjs/common';

@Injectable()
export class DownloadService {
  constructor(private readonly downloadService: DownloadService) {}

  // 넘어온 url을 파싱 해야 함
  async urlParse(url: string): Promise<string> {
    console.log('urlParse', url);
    return Promise.resolve(url);
  }
}
