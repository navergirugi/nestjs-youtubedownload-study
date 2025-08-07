import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DownloadController } from './download/download.controller';
import { DownloadService } from './download/download.service';
import { DownloadModule } from './download/download.module';

@Module({
  imports: [DownloadModule],
  controllers: [AppController, DownloadController],
  providers: [AppService, DownloadService],
})
export class AppModule {}
