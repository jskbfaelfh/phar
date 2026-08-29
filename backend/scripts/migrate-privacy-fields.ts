import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating Privacy and Search Fields ---');

  // 1. Add fields to tenants table in public schema
  const tenantColumns = [
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "is_search_visible" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "show_selling_prices" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "show_phone_number" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "show_whatsapp" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "is_24_hours" BOOLEAN DEFAULT FALSE;`,
  ];

  for (const sql of tenantColumns) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.warn('Tenant column notice:', e.message);
    }
  }

  // 2. Add fields to central_search_index table in public schema
  const searchColumns = [
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "dosage_form" VARCHAR(100);`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "strength" VARCHAR(100);`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "stock_status" VARCHAR(50) DEFAULT 'HIGH_STOCK';`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "show_selling_prices" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "show_phone_number" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "show_whatsapp" BOOLEAN DEFAULT TRUE;`,
    `ALTER TABLE "central_search_index" ADD COLUMN IF NOT EXISTS "is_24_hours" BOOLEAN DEFAULT FALSE;`,
  ];

  for (const sql of searchColumns) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.warn('Central search column notice:', e.message);
    }
  }

  // 3. Add is_public_visible to inventory_items in all tenant schemas
  const tenants: any[] = await prisma.tenant.findMany({
    select: { id: true, schemaName: true },
  });

  for (const t of tenants) {
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${t.schemaName}"."inventory_items" 
        ADD COLUMN IF NOT EXISTS "is_public_visible" BOOLEAN DEFAULT TRUE;
      `);
      console.log(`Updated schema "${t.schemaName}" successfully.`);
    } catch (e: any) {
      console.warn(`Notice for schema ${t.schemaName}:`, e.message);
    }
  }

  console.log('✅ Privacy and Search migration completed successfully!');
}

main()
  .catch((e) => console.error('Migration failed:', e))
  .finally(() => prisma.$disconnect());
