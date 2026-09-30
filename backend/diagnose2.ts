import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnose2() {
  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;

  // 1. Inventory items where medicine has no barcode
  const noBarcode = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE m.barcode IS NULL OR TRIM(m.barcode) = ''
  `);
  console.log('Items without barcode:', noBarcode[0].count);

  // 2. Of those, how many also have no name
  const noNameNoBarcode = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.barcode IS NULL OR TRIM(m.barcode) = '')
      AND (m.trade_name IS NULL OR TRIM(m.trade_name) = '' OR m.trade_name = 'دواء بدون اسم')
      AND (i.custom_name IS NULL OR TRIM(i.custom_name) = '')
  `);
  console.log('Items with NO name AND no barcode:', noNameNoBarcode[0].count);

  // 3. Sample of items with no barcode - show their actual trade names
  const sample = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      i.id as inv_id,
      i.custom_name,
      m.trade_name,
      m.barcode,
      m.scientific_name,
      m.is_verified,
      m.needs_packaging_review,
      m.created_at
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE m.barcode IS NULL OR TRIM(m.barcode) = ''
    ORDER BY m.created_at DESC
    LIMIT 10
  `);
  
  console.log('\n=== Sample of items without barcode ===');
  for (const row of sample) {
    console.log('  trade_name:', row.trade_name, '| custom_name:', row.custom_name, '| verified:', row.is_verified, '| created:', row.created_at?.toISOString?.()?.slice(0,10));
  }

  // 4. Check if these are OLD items or NEW (created recently by the merge)
  const oldNoBarcode = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.barcode IS NULL OR TRIM(m.barcode) = '')
      AND m.created_at < '2026-09-28'
  `);
  const newNoBarcode = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.barcode IS NULL OR TRIM(m.barcode) = '')
      AND m.created_at >= '2026-09-28'
  `);
  console.log('\nItems without barcode BEFORE 2026-09-28 (pre-existing):', oldNoBarcode[0].count);
  console.log('Items without barcode AFTER 2026-09-28 (new/merge caused):', newNoBarcode[0].count);

  await prisma.$disconnect();
}

diagnose2().catch(e => { console.error(e); prisma.$disconnect(); });
