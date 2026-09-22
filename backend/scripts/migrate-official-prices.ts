import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Running manual migration for official price columns...');
  const tenants: any[] = await prisma.$queryRawUnsafe('SELECT schema_name as "schemaName" FROM public.tenants');
  for (const t of tenants) {
    if (!t.schemaName) continue;
    console.log(`Updating schema: [${t.schemaName}]...`);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${t.schemaName}".inventory_items
        ADD COLUMN IF NOT EXISTS official_price_pack DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS official_price_unit DECIMAL(12, 2);
    `);
  }
  console.log('✅ ALL TENANT SCHEMAS UPDATED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('❌ Migration Error:', e);
  })
  .finally(() => prisma.$disconnect());
