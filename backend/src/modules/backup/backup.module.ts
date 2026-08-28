import { Module } from "@nestjs/common";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";
import { R2BackupService } from "./r2-backup.service";

@Module({
  controllers: [BackupController],
  providers: [BackupService, R2BackupService],
  exports: [BackupService, R2BackupService],
})
export class BackupModule {}
