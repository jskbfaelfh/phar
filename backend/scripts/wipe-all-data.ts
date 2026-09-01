import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function wipeAllData() {
  console.log('🧹 Starting TOTAL WIPE of all medicines and pharmacies...');

  // 1. Drop all tenant schemas
  const tenants = await prisma.tenant.findMany({ select: { schemaName: true } });
  for (const t of tenants) {
    if (t.schemaName && t.schemaName.startsWith('ph_')) {
      console.log(`🔥 Dropping schema: ${t.schemaName}`);
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE;`);
    }
  }

  // 2. Clear central search index, transfers, chains, tenants
  console.log('🗑️ Clearing central search index, stock transfers, tenants & chains...');
  await prisma.centralSearchIndex.deleteMany({});
  await prisma.stockTransfer.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.pharmacyChain.deleteMany({});

  // 3. Clear ALL medicines from central catalog
  console.log('🔥 Deleting ALL medicines from public.medicines master catalog...');
  await prisma.medicine.deleteMany({});

  console.log('🎉 WIPE COMPLETED! Database now has 0 medicines and 0 pharmacies!');
}

wipeAllData()
  .catch((err) => {
    console.error('❌ Wipe failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
