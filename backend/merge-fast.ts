import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function mergeFast() {
  const tenants = await prisma.$queryRawUnsafe(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schemaName = (tenants as any)[0]?.schema_name || 'public';
  
  console.log('Schema:', schemaName);

  const query = `
    DO $$ 
    DECLARE
      rec RECORD;
      dup_rec RECORD;
      primary_med_id uuid;
      dup_med_id uuid;
      primary_inv_id uuid;
      dup_inv_id uuid;
    BEGIN
      -- Loop over duplicates by barcode
      FOR rec IN (
        SELECT barcode, array_agg(id::uuid) as ids 
        FROM public.medicines 
        WHERE barcode IS NOT NULL AND TRIM(barcode) != ''
        GROUP BY barcode 
        HAVING COUNT(*) > 1
      ) LOOP
        primary_med_id := rec.ids[1];
        
        FOR i IN 2..array_length(rec.ids, 1) LOOP
          dup_med_id := rec.ids[i];
          
          -- 1. Move purchase_invoice_items
          UPDATE "${schemaName}"."purchase_invoice_items"
          SET medicine_id = primary_med_id
          WHERE medicine_id = dup_med_id;
          
          -- 2. Find dup inventory items
          FOR dup_rec IN (
            SELECT id FROM "${schemaName}"."inventory_items" WHERE medicine_id = dup_med_id
          ) LOOP
            dup_inv_id := dup_rec.id;
            
            -- Find primary inventory item
            SELECT id INTO primary_inv_id FROM "${schemaName}"."inventory_items" WHERE medicine_id = primary_med_id LIMIT 1;
            
            IF primary_inv_id IS NULL THEN
              -- Primary doesn't have an inv item, just transfer the dup's inv item
              UPDATE "${schemaName}"."inventory_items" SET medicine_id = primary_med_id WHERE id = dup_inv_id;
            ELSE
              -- Merge them
              UPDATE "${schemaName}"."inventory_batches" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."purchase_items" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."sale_items" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."returns" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              
              DELETE FROM "${schemaName}"."inventory_items" WHERE id = dup_inv_id;
            END IF;
          END LOOP;
          
          -- Delete duplicate medicine
          DELETE FROM public.medicines WHERE id = dup_med_id;
        END LOOP;
      END LOOP;

      -- Loop over duplicates by Name (no barcode)
      FOR rec IN (
        SELECT LOWER(TRIM(trade_name)) as name, array_agg(id::uuid) as ids 
        FROM public.medicines 
        WHERE barcode IS NULL OR TRIM(barcode) = ''
        GROUP BY LOWER(TRIM(trade_name)) 
        HAVING COUNT(*) > 1
      ) LOOP
        primary_med_id := rec.ids[1];
        
        FOR i IN 2..array_length(rec.ids, 1) LOOP
          dup_med_id := rec.ids[i];
          
          UPDATE "${schemaName}"."purchase_invoice_items"
          SET medicine_id = primary_med_id
          WHERE medicine_id = dup_med_id;
          
          FOR dup_rec IN (
            SELECT id FROM "${schemaName}"."inventory_items" WHERE medicine_id = dup_med_id
          ) LOOP
            dup_inv_id := dup_rec.id;
            
            SELECT id INTO primary_inv_id FROM "${schemaName}"."inventory_items" WHERE medicine_id = primary_med_id LIMIT 1;
            
            IF primary_inv_id IS NULL THEN
              UPDATE "${schemaName}"."inventory_items" SET medicine_id = primary_med_id WHERE id = dup_inv_id;
            ELSE
              UPDATE "${schemaName}"."inventory_batches" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."purchase_items" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."sale_items" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              UPDATE "${schemaName}"."returns" SET inventory_item_id = primary_inv_id WHERE inventory_item_id = dup_inv_id;
              
              DELETE FROM "${schemaName}"."inventory_items" WHERE id = dup_inv_id;
            END IF;
          END LOOP;
          
          DELETE FROM public.medicines WHERE id = dup_med_id;
        END LOOP;
      END LOOP;
    END $$;
  `;

  console.log("Executing fast merge...");
  await prisma.$executeRawUnsafe(query);
  console.log("Merge complete!");
  await prisma.$disconnect();
}

mergeFast().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
