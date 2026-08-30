import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { OcrAiService } from './ocr-ai.service';
import { PurchasesController } from './purchases.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, OcrAiService],
  exports: [PurchasesService, OcrAiService],
})
export class PurchasesModule {}
