import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const cwdEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

let dbUrl = process.env.DATABASE_URL || '';
dbUrl = dbUrl.replace(/connection_limit=\d+/, 'connection_limit=2').replace(/pool_timeout=\d+/, 'pool_timeout=30');

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

const API_URL = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dawaee-jwt-dev-secret-key-2026';

describe('Phase 3: Offline Local-First & Sync Resilience Tests', () => {
  let tenant: any;
  let owner: any;
  let token: string;

  beforeAll(async () => {
    tenant = await prisma.tenant.findFirst({
      where: { subscriptionStatus: 'ACTIVE' },
    });
    if (!tenant) throw new Error('No active tenant found');

    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, username, name, role FROM "${tenant.schemaName}".users WHERE role = 'OWNER' LIMIT 1`
    );
    owner = users[0];

    token = jwt.sign(
      {
        sub: owner.id,
        userId: owner.id,
        username: owner.username,
        name: owner.name,
        role: 'OWNER',
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        subscriptionStatus: 'ACTIVE',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('should process batch of offline sales idempotently without duplicate rows', async () => {
    const med = await prisma.medicine.create({
      data: { tradeName: `Sync_Med_${Date.now()}`, defaultUnitsPerPack: 1 },
    });

    const invId = crypto.randomUUID();
    const batchId = crypto.randomUUID();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenant.schemaName}".inventory_items (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit)
       VALUES ($1::uuid, $2::uuid, 'SyncMedicine', 1, 4000, 4000)`,
      invId,
      med.id
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenant.schemaName}".inventory_batches (id, inventory_item_id, batch_number, quantity_units_remaining, purchase_price_pack, selling_price_pack, selling_price_unit, expiry_date)
       VALUES ($1::uuid, $2::uuid, 'SYNC-B1', 20, 2000, 4000, 4000, CURRENT_DATE + INTERVAL '1 year')`,
      batchId,
      invId
    );

    const offlineId1 = `offline-tx-${crypto.randomUUID()}`;
    const offlineId2 = `offline-tx-${crypto.randomUUID()}`;

    const syncPayload = {
      sales: [
        {
          offlineId: offlineId1,
          createdAt: new Date().toISOString(),
          discountAmount: 0,
          items: [{ inventoryItemId: invId, quantity: 2, unitType: 'PACK' }],
        },
        {
          offlineId: offlineId2,
          createdAt: new Date().toISOString(),
          discountAmount: 0,
          items: [{ inventoryItemId: invId, quantity: 1, unitType: 'PACK' }],
        },
      ],
    };

    // 1. First sync submission
    const res1 = await request(API_URL)
      .post('/api/pos/sync-offline')
      .set('Authorization', `Bearer ${token}`)
      .send(syncPayload);

    expect(res1.status).toBe(201);
    expect(res1.body.syncedCount).toBe(2);

    // Stock should have deducted 3 units: 20 - 3 = 17
    const [batch1]: any[] = await prisma.$queryRawUnsafe(
      `SELECT quantity_units_remaining FROM "${tenant.schemaName}".inventory_batches WHERE id = $1::uuid`,
      batchId
    );
    expect(Number(batch1.quantity_units_remaining)).toBe(17);

    // 2. Duplicate sync submission (simulating flaky network reconnect retries)
    const res2 = await request(API_URL)
      .post('/api/pos/sync-offline')
      .set('Authorization', `Bearer ${token}`)
      .send(syncPayload);

    expect(res2.status).toBe(201);
    expect(res2.body.results.every((r: any) => r.sale?.isIdempotentReplay)).toBe(true);

    // Stock MUST REMAIN 17 (absolutely NO double deduction!)
    const [batch2]: any[] = await prisma.$queryRawUnsafe(
      `SELECT quantity_units_remaining FROM "${tenant.schemaName}".inventory_batches WHERE id = $1::uuid`,
      batchId
    );
    expect(Number(batch2.quantity_units_remaining)).toBe(17);
  });
});
