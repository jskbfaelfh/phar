import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SyncService } from './sync.service';
import { SearchController } from './search.controller';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SyncService],
  exports: [SearchService, SyncService],
})
export class SearchModule {}
