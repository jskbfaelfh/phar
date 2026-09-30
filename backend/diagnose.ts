import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnose() {
  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;
  console.log('Schema:', schema);

  // 1. Inventory items where medicine has no name or no barcode
  const brokenItems = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      i.id as inv_id,
      i.medicine_id,
      i.custom_name,
      m.trade_name,
      m.barcode,
      m.is_verified,
      m.needs_packaging_review
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NULL OR TRIM(m.trade_name) = '')
      OR (m.barcode IS NULL OR TRIM(m.barcode) = '')
    LIMIT 20
  `);

  console.log('\n=== Broken Inventory Items (sample 20) ===');
  console.log('Total broken (approx): checking...');
  
  const brokenCount = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    JOIN public.medicines m ON i.medicine_id = m.id
    WHERE 
      (m.trade_name IS NULL OR TRIM(m.trade_name) = '')
      OR (m.barcode IS NULL OR TRIM(m.barcode) = '')
  `);
  console.log('Total broken inventory items:', brokenCount[0].count);

  for (const item of brokenItems.slice(0, 5)) {
    console.log('\n--- Item ---');
    console.log('  inv_id:', item.inv_id);
    console.log('  custom_name:', item.custom_name);
    console.log('  medicine trade_name:', item.trade_name);
    console.log('  medicine barcode:', item.barcode);
    console.log('  is_verified:', item.is_verified);

    // Check what purchase_items say about this inventory item
    const purchaseItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT pi.id, pi.inventory_item_id, ii.custom_name as item_custom_name, p.invoice_number
      FROM "${schema}".purchase_items pi
      LEFT JOIN "${schema}".inventory_items ii ON pi.inventory_item_id = ii.id
      LEFT JOIN "${schema}".purchases p ON pi.purchase_id = p.id
      WHERE pi.inventory_item_id = $1::uuid
      LIMIT 3
    `, item.inv_id);
    
    if (purchaseItems.length > 0) {
      console.log('  Found in purchase:', purchaseItems[0].invoice_number, '| custom_name:', purchaseItems[0].item_custom_name);
    }
    
    // Check purchase_invoice_items
    const invoiceItems = await prisma.$queryRawUnsafe<any[]>(`
      SELECT pii.custom_name, pii.trade_name
      FROM "${schema}".purchase_invoice_items pii
      WHERE pii.medicine_id = $1::uuid
      LIMIT 3
    `, item.medicine_id);
    
    if (invoiceItems.length > 0) {
      console.log('  Found in invoice_items - custom_name:', invoiceItems[0].custom_name, '| trade_name:', invoiceItems[0].trade_name);
    }
  }

  await prisma.$disconnect();
}

diagnose().catch(e => { console.error(e); prisma.$disconnect(); });
