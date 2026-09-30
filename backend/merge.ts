import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function merge() {
  // Let us fetch the actual schema name from the DB
  const tenants = await prisma.$queryRawUnsafe(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schemaName = (tenants as any)[0]?.schema_name || 'public';
  
  console.log('Schema:', schemaName);

  const duplicatesByBarcode = await prisma.$queryRawUnsafe(`
    SELECT barcode, array_agg(id::text) as ids 
    FROM public.medicines 
    WHERE barcode IS NOT NULL AND TRIM(barcode) != ''
    GROUP BY barcode 
    HAVING COUNT(*) > 1
  `);
  
  const duplicatesByName = await prisma.$queryRawUnsafe(`
    SELECT LOWER(TRIM(trade_name)) as name, array_agg(id::text) as ids 
    FROM public.medicines 
    WHERE barcode IS NULL OR TRIM(barcode) = ''
    GROUP BY LOWER(TRIM(trade_name)) 
    HAVING COUNT(*) > 1
  `);

  const allDupes: any[] = [...(duplicatesByBarcode as any[]), ...(duplicatesByName as any[])];
  
  console.log('Found dupes by barcode:', (duplicatesByBarcode as any[]).length);
  console.log('Found dupes by name:', (duplicatesByName as any[]).length);

  for (const row of allDupes) {
    const ids = row.ids as string[];
    // primary is the first one
    const primaryId = ids[0];
    const duplicates = ids.slice(1);

    for (const dupId of duplicates) {
      console.log(`Merging ${dupId} into ${primaryId}`);

      // 1. Move purchase_invoice_items
      await prisma.$executeRawUnsafe(`
        UPDATE "${schemaName}"."purchase_invoice_items"
        SET medicine_id = $1::uuid
        WHERE medicine_id = $2::uuid;
      `, primaryId, dupId);

      // 2. Find if duplicate has an inventory_item
      const dupItems: any[] = await prisma.$queryRawUnsafe(`
        SELECT id FROM "${schemaName}"."inventory_items"
        WHERE medicine_id = $1::uuid;
      `, dupId);

      for (const dupItem of dupItems) {
        const dupItemId = dupItem.id;
        
        // Find primary inventory_item
        const primaryItems: any[] = await prisma.$queryRawUnsafe(`
          SELECT id FROM "${schemaName}"."inventory_items"
          WHERE medicine_id = $1::uuid LIMIT 1;
        `, primaryId);

        let targetInventoryItemId = null;
        
        if (primaryItems.length > 0) {
          targetInventoryItemId = primaryItems[0].id;
        } else {
          // If primary doesn't have an inventory item, just update the medicine_id on the dupItem
          await prisma.$executeRawUnsafe(`
            UPDATE "${schemaName}"."inventory_items"
            SET medicine_id = $1::uuid
            WHERE id = $2::uuid;
          `, primaryId, dupItemId);
          continue; // Move to next dup item
        }

        // We have both primary and dup inventory items! We need to merge them.
        // Move inventory_batches
        await prisma.$executeRawUnsafe(`
          UPDATE "${schemaName}"."inventory_batches"
          SET inventory_item_id = $1::uuid
          WHERE inventory_item_id = $2::uuid;
        `, targetInventoryItemId, dupItemId);

        // Move purchase_items
        await prisma.$executeRawUnsafe(`
          UPDATE "${schemaName}"."purchase_items"
          SET inventory_item_id = $1::uuid
          WHERE inventory_item_id = $2::uuid;
        `, targetInventoryItemId, dupItemId);

        // Move sale_items
        await prisma.$executeRawUnsafe(`
          UPDATE "${schemaName}"."sale_items"
          SET inventory_item_id = $1::uuid
          WHERE inventory_item_id = $2::uuid;
        `, targetInventoryItemId, dupItemId);

        // Move returns
        await prisma.$executeRawUnsafe(`
          UPDATE "${schemaName}"."returns"
          SET inventory_item_id = $1::uuid
          WHERE inventory_item_id = $2::uuid;
        `, targetInventoryItemId, dupItemId);

        // Delete dup inventory item
        await prisma.$executeRawUnsafe(`
          DELETE FROM "${schemaName}"."inventory_items"
          WHERE id = $1::uuid;
        `, dupItemId);
      }

      // Delete the duplicate medicine itself
      await prisma.$executeRawUnsafe(`
        DELETE FROM public.medicines
        WHERE id = $1::uuid;
      `, dupId);
    }
  }
  
  console.log('Merge complete!');
  await prisma.$disconnect();
}

merge().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
