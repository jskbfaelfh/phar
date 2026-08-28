import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ProvisioningService } from './provisioning.service';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [BackupModule],
  controllers: [AdminController],
  providers: [AdminService, ProvisioningService],
  exports: [AdminService, ProvisioningService],
})
export class AdminModule {}
