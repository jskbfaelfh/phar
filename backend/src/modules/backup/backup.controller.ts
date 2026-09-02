import { Controller, Get, Post, Body, UseGuards, Res, StreamableFile, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import * as fs from "fs";
import { BackupService } from "./backup.service";
import { SubscriptionGuard } from "../../common/guards/subscription.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("backup")
@UseGuards(AuthGuard("jwt"), SubscriptionGuard, RolesGuard)
@Roles("OWNER")
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get("export")
  async exportBackup() {
    return this.backupService.exportPharmacyBackup();
  }

  @Get("download-local-db")
  async downloadLocalDb(@Res({ passthrough: true }) res: Response) {
    const filePath = this.backupService.getLocalDbFilePath();
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("ملف البيانات المحلي غير متوفر");
    }
    const file = fs.createReadStream(filePath);
    res.set({
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": 'attachment; filename="dawaee_local.db"',
    });
    return new StreamableFile(file);
  }

  @Post("restore")
  async restoreBackup(@Body() payload: any) {
    return this.backupService.restorePharmacyBackup(payload);
  }
}
