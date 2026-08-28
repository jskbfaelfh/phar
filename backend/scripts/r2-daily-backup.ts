import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { R2BackupService } from "../src/modules/backup/r2-backup.service";

async function runCron() {
  console.log("=================================================");
  console.log("⏰ RAILWAY CRON: Starting Cloudflare R2 Daily Backup");
  console.log("=================================================");

  const app = await NestFactory.createApplicationContext(AppModule);
  const backupService = app.get(R2BackupService);

  try {
    const report = await backupService.runDailyBackupJob();
    console.log("=================================================");
    console.log(`✅ CRON FINISHED: Total: ${report.total} | Successful: ${report.successful} | Failed: ${report.failed}`);
    console.log("=================================================");
  } catch (error) {
    console.error("❌ CRON ERROR during daily backup:", error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runCron();
