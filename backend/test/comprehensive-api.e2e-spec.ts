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

describe('Comprehensive Enterprise API & Regression Test Suite', () => {
  let tenantA: any;
  let tenantB: any;
  let ownerA: any;
  let ownerB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // 1. Fetch 2 active tenants
    const tenants = await prisma.tenant.findMany({
      where: { subscriptionStatus: 'ACTIVE' },
      take: 2,
    });

    if (tenants.length < 2) {
      throw new Error('Requires at least 2 active tenants in database.');
    }

    tenantA = tenants[0];
    tenantB = tenants[1];

    // 2. Fetch Owner A
    const usersA: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, username, name, role FROM "${tenantA.schemaName}".users WHERE role = 'OWNER' LIMIT 1`
    );
    ownerA = usersA[0];

    // 3. Fetch Owner B
    const usersB: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, username, name, role FROM "${tenantB.schemaName}".users WHERE role = 'OWNER' LIMIT 1`
    );
    ownerB = usersB[0];

    tokenA = jwt.sign(
      {
        sub: ownerA.id,
        userId: ownerA.id,
        username: ownerA.username,
        name: ownerA.name,
        role: 'OWNER',
        tenantId: tenantA.id,
        schemaName: tenantA.schemaName,
        subscriptionStatus: 'ACTIVE',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    tokenB = jwt.sign(
      {
        sub: ownerB.id,
        userId: ownerB.id,
        username: ownerB.username,
        name: ownerB.name,
        role: 'OWNER',
        tenantId: tenantB.id,
        schemaName: tenantB.schemaName,
        subscriptionStatus: 'ACTIVE',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  // =========================================================================
  // TEST SUITE 1: Price Update & Batch Synchronization Regression Test
  // =========================================================================
  describe('1. Pricing Engine & Batch Synchronization Regression Test', () => {
    it('should update both inventory_items AND inventory_batches when updating selling price, and reflect in GET /inventory', async () => {
      // 1. Create a medicine and inventory item in Tenant A
      const med = await prisma.medicine.create({
        data: {
          tradeName: `Regression_Med_${Date.now()}`,
          scientificName: 'Paracetamol Test',
          defaultUnitsPerPack: 2,
        },
      });

      const invItemId = crypto.randomUUID();
      const batch1Id = crypto.randomUUID();
      const batch2Id = crypto.randomUUID();

      // Initial price: 4,000 pack / 2,000 unit
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_items
         (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit, official_price_pack, official_price_unit, min_alert_units)
         VALUES ($1::uuid, $2::uuid, 'Panadol Test', 2, 4000, 2000, 4000, 2000, 5)`,
        invItemId,
        med.id
      );

      // Two active batches with old selling price 4,000 / 2,000
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_batches
         (id, inventory_item_id, batch_number, quantity_units_remaining, purchase_price_pack, selling_price_pack, selling_price_unit, expiry_date, is_recalled, is_bonus, created_at)
         VALUES
         ($1::uuid, $2::uuid, 'BATCH-OLD-1', 10, 2500, 4000, 2000, CURRENT_DATE + INTERVAL '1 year', FALSE, FALSE, NOW()),
         ($3::uuid, $2::uuid, 'BATCH-OLD-2', 8, 2500, 4000, 2000, CURRENT_DATE + INTERVAL '2 years', FALSE, FALSE, NOW())`,
        batch1Id,
        invItemId,
        batch2Id
      );

      // 2. Call PATCH /api/inventory/:id/price with NEW price (6,000 pack / 3,000 unit)
      const updateRes = await request(API_URL)
        .patch(`/api/inventory/${invItemId}/price`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customName: 'Panadol Test Updated',
          sellingPricePack: 6000,
          sellingPriceUnit: 3000,
          officialPricePack: 6000,
          officialPriceUnit: 3000,
          minAlertUnits: 8,
          shelfLocation: 'A-12',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      // 3. Verify in DB: inventory_items has new prices and shelf location
      const [itemRow]: any[] = await prisma.$queryRawUnsafe(
        `SELECT selling_price_pack, selling_price_unit, shelf_location FROM "${tenantA.schemaName}".inventory_items WHERE id = $1::uuid`,
        invItemId
      );
      expect(Number(itemRow.selling_price_pack)).toBe(6000);
      expect(Number(itemRow.selling_price_unit)).toBe(3000);
      expect(itemRow.shelf_location).toBe('A-12');

      // 4. Verify in DB: ALL batches have been synchronized to 6,000 / 3,000
      const batchRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT selling_price_pack, selling_price_unit FROM "${tenantA.schemaName}".inventory_batches WHERE inventory_item_id = $1::uuid`,
        invItemId
      );
      expect(batchRows.length).toBe(2);
      for (const b of batchRows) {
        expect(Number(b.selling_price_pack)).toBe(6000);
        expect(Number(b.selling_price_unit)).toBe(3000);
      }

      // 5. Query GET /api/inventory?search=... and verify it returns 6,000 / 3,000 immediately
      const getRes = await request(API_URL)
        .get(`/api/inventory?search=${encodeURIComponent('Panadol Test Updated')}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);
      const found = getRes.body.find((it: any) => it.id === invItemId);
      expect(found).toBeDefined();
      expect(Number(found.sellingPricePack)).toBe(6000);
      expect(Number(found.sellingPriceUnit)).toBe(3000);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Multi-Tenant Data Isolation
  // =========================================================================
  describe('2. Multi-Tenant Enterprise Security & Isolation', () => {
    it('should strictly prevent Tenant B from viewing or modifying Tenant A inventory items', async () => {
      // 1. Create item in Tenant A
      const medA = await prisma.medicine.create({
        data: { tradeName: `TenantA_Exclusive_Med_${Date.now()}`, defaultUnitsPerPack: 1 },
      });
      const invAId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_items (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit)
         VALUES ($1::uuid, $2::uuid, 'TenantA Secret Medicine', 1, 5000, 5000)`,
        invAId,
        medA.id
      );

      // 2. Tenant B searches inventory -> Must NOT find Tenant A item
      const searchResB = await request(API_URL)
        .get(`/api/inventory?search=${encodeURIComponent('TenantA Secret Medicine')}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(searchResB.status).toBe(200);
      const leak = searchResB.body.find((it: any) => it.id === invAId);
      expect(leak).toBeUndefined();

      // 3. Tenant B tries to PATCH price of Tenant A item -> Must return 404
      const hackRes = await request(API_URL)
        .patch(`/api/inventory/${invAId}/price`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sellingPricePack: 1000, sellingPriceUnit: 1000 });

      expect(hackRes.status).toBe(404);
    });
  });

  // =========================================================================
  // TEST SUITE 3: POS Checkout, Stock Depletion & Minimum Margin Protection
  // =========================================================================
  describe('3. POS Financial & Checkout Rules', () => {
    it('should reject sales below minimum cost * 1.2 margin', async () => {
      const med = await prisma.medicine.create({
        data: { tradeName: `Margin_Test_Med_${Date.now()}`, defaultUnitsPerPack: 1 },
      });
      const invId = crypto.randomUUID();
      const batchId = crypto.randomUUID();

      // Purchase cost = 10,000 IQD. Minimum margin price = 12,000 IQD.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_items (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit)
         VALUES ($1::uuid, $2::uuid, 'MarginMed', 1, 15000, 15000)`,
        invId,
        med.id
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_batches (id, inventory_item_id, batch_number, quantity_units_remaining, purchase_price_pack, selling_price_pack, selling_price_unit, expiry_date)
         VALUES ($1::uuid, $2::uuid, 'MARGIN-B1', 10, 10000, 15000, 15000, CURRENT_DATE + INTERVAL '1 year')`,
        batchId,
        invId
      );

      // Attempt to sell with custom discounted price below minimum margin (e.g. 11,000 IQD)
      const res = await request(API_URL)
        .post('/api/pos/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ inventoryItemId: invId, quantity: 1, unitType: 'PACK', unitPrice: 11000 }],
          discountAmount: 0,
        });

      expect(res.status).toBe(400);
      expect(String(res.body.message)).toMatch(/لا يمكن أن يقل عن/);
    });

    it('should accurately deplete stock and reject overselling beyond available inventory', async () => {
      const med = await prisma.medicine.create({
        data: { tradeName: `Deplete_Test_Med_${Date.now()}`, defaultUnitsPerPack: 1 },
      });
      const invId = crypto.randomUUID();
      const batchId = crypto.randomUUID();

      // Exactly 3 units in stock
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_items (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit)
         VALUES ($1::uuid, $2::uuid, 'DepleteMed', 1, 3000, 3000)`,
        invId,
        med.id
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantA.schemaName}".inventory_batches (id, inventory_item_id, batch_number, quantity_units_remaining, purchase_price_pack, selling_price_pack, selling_price_unit, expiry_date)
         VALUES ($1::uuid, $2::uuid, 'DEPLETE-3', 3, 2000, 3000, 3000, CURRENT_DATE + INTERVAL '1 year')`,
        batchId,
        invId
      );

      // Sell 3 units
      const sale1 = await request(API_URL)
        .post('/api/pos/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ inventoryItemId: invId, quantity: 3, unitType: 'PACK' }],
          discountAmount: 0,
        });

      expect(sale1.status).toBe(201);

      // Verify batch remaining is exactly 0
      const [batch]: any[] = await prisma.$queryRawUnsafe(
        `SELECT quantity_units_remaining FROM "${tenantA.schemaName}".inventory_batches WHERE id = $1::uuid`,
        batchId
      );
      expect(Number(batch.quantity_units_remaining)).toBe(0);

      // Attempt to sell 1 more unit -> 400 Bad Request
      const sale2 = await request(API_URL)
        .post('/api/pos/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ inventoryItemId: invId, quantity: 1, unitType: 'PACK' }],
          discountAmount: 0,
        });

      expect(sale2.status).toBe(400);
      expect(String(sale2.body.message)).toMatch(/الكمية المطلوبة.*غير متوفرة/);
    });
  });
});
