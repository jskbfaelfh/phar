import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;
  console.log('Schema:', schema);

  const meds = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM public.medicines`);
  const invItems = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "${schema}".inventory_items`);
  const batches = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "${schema}".inventory_batches`);
  const purchases = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "${schema}".purchases`);
  const sales = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "${schema}".sale_items`);
  
  // Check if there are orphaned batches (batches without inventory_item)
  const orphanedBatches = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count 
    FROM "${schema}".inventory_batches b
    LEFT JOIN "${schema}".inventory_items i ON b.inventory_item_id = i.id
    WHERE i.id IS NULL
  `);

  console.log('Medicines count:', meds[0].count);
  console.log('Inventory Items count:', invItems[0].count);
  console.log('Batches count:', batches[0].count);
  console.log('Purchases count:', purchases[0].count);
  console.log('Sale Items count:', sales[0].count);
  console.log('ORPHANED BATCHES:', orphanedBatches[0].count);

  await prisma.$disconnect();
}
check().catch(e => { console.error(e); prisma.$disconnect(); });
