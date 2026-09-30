import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function restoreDeletedMedicines() {
  // Load backup
  const backupPath = path.join('C:\\Users\\Dell\\Desktop\\دوائي\\dawaee_backup_pharmacy_2026-09-27.json');
  console.log('Loading backup...');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const backupItems: any[] = backup.data.inventoryItems;
  console.log(`Backup has ${backupItems.length} inventory items`);

  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;
  console.log('Schema:', schema);

  // Step 1: Find broken inventory_items (medicine_id not in public.medicines)
  const brokenItems = await prisma.$queryRawUnsafe<any[]>(`
    SELECT i.id, i.medicine_id
    FROM "${schema}".inventory_items i
    LEFT JOIN public.medicines m ON i.medicine_id = m.id
    WHERE m.id IS NULL
  `);
  console.log(`\nFound ${brokenItems.length} broken inventory items (medicine deleted by merge)`);

  if (brokenItems.length === 0) {
    console.log('Nothing to restore!');
    await prisma.$disconnect();
    return;
  }

  // Build a map from backup: inventory_item_id -> medicine data
  const backupMap = new Map<string, any>();
  for (const item of backupItems) {
    backupMap.set(item.id, item);
  }

  let restored = 0;
  let notFound = 0;

  for (const broken of brokenItems) {
    const invItemId = broken.id;
    const medicineId = broken.medicine_id;

    // Find this item in backup
    const backupItem = backupMap.get(invItemId);
    if (!backupItem) {
      console.log(`⚠️  Inventory item ${invItemId} not found in backup`);
      notFound++;
      continue;
    }

    const tradeName = backupItem.tradeName || '';
    const barcode = backupItem.barcode || null;
    const scientificName = backupItem.scientificName || null;
    const dosageForm = backupItem.dosageForm || null;
    const strength = backupItem.strength || null;

    // Check if medicine already exists (maybe was re-inserted already)
    const exists = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM public.medicines WHERE id = $1::uuid LIMIT 1
    `, medicineId);

    if (exists.length > 0) {
      console.log(`✓ Medicine ${medicineId} already exists, skipping`);
      continue;
    }

    // Re-insert the deleted medicine with its original ID
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.medicines (
          id, trade_name, scientific_name, barcode, dosage_form, strength,
          is_verified, needs_packaging_review, created_at
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6,
          false, false, NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `, medicineId, tradeName, scientificName, barcode, dosageForm, strength);

      console.log(`✅ Restored: ${tradeName} | barcode: ${barcode}`);
      restored++;
    } catch (e: any) {
      console.error(`❌ Error restoring ${tradeName}: ${e.message}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Restored: ${restored}`);
  console.log(`Not in backup: ${notFound}`);
  console.log(`Total broken: ${brokenItems.length}`);

  await prisma.$disconnect();
}

restoreDeletedMedicines().catch(e => { console.error(e); prisma.$disconnect(); });
