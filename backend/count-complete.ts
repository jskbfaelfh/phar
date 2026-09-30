import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function countFull() {
  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;

  // Total inventory items
  const total = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count FROM "${schema}".inventory_items
  `);

  // Complete: has name AND barcode
  const complete = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NOT NULL AND TRIM(m.trade_name) != '')
      AND (m.barcode IS NOT NULL AND TRIM(m.barcode) != '')
  `);

  // Has name but no barcode
  const nameOnly = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NOT NULL AND TRIM(m.trade_name) != '')
      AND (m.barcode IS NULL OR TRIM(m.barcode) = '')
  `);

  // Has barcode but no name
  const barcodeOnly = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NULL OR TRIM(m.trade_name) = '')
      AND (m.barcode IS NOT NULL AND TRIM(m.barcode) != '')
  `);

  // Neither name nor barcode
  const empty = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NULL OR TRIM(m.trade_name) = '')
      AND (m.barcode IS NULL OR TRIM(m.barcode) = '')
  `);

  console.log('=== حالة بيانات المخزن ===');
  console.log('إجمالي العناصر:', total[0].count);
  console.log('✅ معلومات كاملة (اسم + باركود):', complete[0].count);
  console.log('⚠️  اسم فقط (بدون باركود):', nameOnly[0].count);
  console.log('⚠️  باركود فقط (بدون اسم):', barcodeOnly[0].count);
  console.log('❌ لا اسم ولا باركود:', empty[0].count);

  await prisma.$disconnect();
}

countFull().catch(e => { console.error(e); prisma.$disconnect(); });
