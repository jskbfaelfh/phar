import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Connected to PostgreSQL database successfully.');
        this.startHeartbeat();
        return;
      } catch (error) {
        if (attempt < 4) {
          this.logger.warn(`Database connection attempt ${attempt} failed. Retrying in 2s (waking Neon compute)...`);
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          this.logger.error('Failed to connect to database after retries', error);
        }
      }
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    // Ping Neon database every 25s to keep PgBouncer pooled connection alive and prevent 10054 idle resets
    this.heartbeatInterval = setInterval(async () => {
      try {
        await super.$queryRawUnsafe('SELECT 1');
      } catch (err: any) {
        this.logger.debug(`Neon heartbeat keep-alive: ${err?.message?.slice(0, 80)}`);
      }
    }, 25000);
  }

  async onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database.');
  }

  override $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T> {
    const promise = (async () => {
      try {
        return await super.$queryRawUnsafe<T>(query, ...values);
      } catch (err: any) {
        if (this.isConnectionError(err)) {
          this.logger.warn(`Retrying $queryRawUnsafe after connection reset (${err?.code || 'Reset'})...`);
          await new Promise((r) => setTimeout(r, 250));
          return await super.$queryRawUnsafe<T>(query, ...values);
        }
        throw err;
      }
    })();
    return promise as unknown as Prisma.PrismaPromise<T>;
  }

  override $executeRawUnsafe(query: string, ...values: any[]): Prisma.PrismaPromise<number> {
    const promise = (async () => {
      try {
        return await super.$executeRawUnsafe(query, ...values);
      } catch (err: any) {
        if (this.isConnectionError(err)) {
          this.logger.warn(`Retrying $executeRawUnsafe after connection reset (${err?.code || 'Reset'})...`);
          await new Promise((r) => setTimeout(r, 250));
          return await super.$executeRawUnsafe(query, ...values);
        }
        throw err;
      }
    })();
    return promise as unknown as Prisma.PrismaPromise<number>;
  }

  private isConnectionError(err: any): boolean {
    const code = err?.code;
    const msg = String(err?.message || '');
    return (
      code === 'P1001' ||
      code === 'P1017' ||
      msg.includes('closed the connection') ||
      msg.includes('ConnectionReset') ||
      msg.includes('10054') ||
      msg.includes("Can't reach database server")
    );
  }

  /**
   * Run a raw query or operation inside a specific tenant schema
   */
  async executeInTenantSchema<T>(
    schemaName: string,
    operation: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Set the search_path to the tenant schema first, fallback to public for master tables
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schemaName}", public;`);
      return operation(tx as unknown as PrismaClient);
    });
  }
}

