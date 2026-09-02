import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LocalDbService } from './local-db.service';

@Injectable()
export class CloudSyncService implements OnModuleInit {
  private readonly logger = new Logger(CloudSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localDb: LocalDbService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Background Cloud Sync Service...');
    setInterval(() => this.processSyncQueue(), 15000); // Sync every 15s in background
  }

  async processSyncQueue() {
    try {
      const items = this.localDb.query(
        'SELECT * FROM sync_queue WHERE synced = 0 LIMIT 20',
      );

      if (!items || items.length === 0) return;

      for (const item of items) {
        try {
          const payload = JSON.parse(item.payload);

          if (item.table_name === 'medicines') {
            await this.prisma.medicine.upsert({
              where: { id: payload.id },
              create: payload,
              update: payload,
            });
          }

          this.localDb.execute(
            'UPDATE sync_queue SET synced = 1 WHERE id = ?',
            [item.id],
          );
        } catch (err) {
          // If offline or network error, skip silently and retry on next interval
        }
      }
    } catch (err) {
      // Ignore background sync errors when offline
    }
  }

  public enqueue(tableName: string, action: string, payload: any) {
    try {
      this.localDb.execute(
        'INSERT INTO sync_queue (action, table_name, payload) VALUES (?, ?, ?)',
        [action, tableName, JSON.stringify(payload)],
      );
    } catch (err) {
      this.logger.error(`Error enqueuing cloud sync payload: ${err.message}`);
    }
  }
}
