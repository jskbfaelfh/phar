import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function restoreFast() {
  const backupPath = 'C:\\Users\\Dell\\Desktop\\دوائي\\dawaee_backup_pharmacy_2026-09-27.json';
  console.log('Loading backup...');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const backupItems: any[] = backup.data.inventoryItems;

  const tenants = await prisma.$queryRawUnsafe<any[]>(`SELECT schema_name FROM public.tenants LIMIT 1`);
  const schema = tenants[0].schema_name;

  // Find broken items
  const brokenItems = await prisma.$queryRawUnsafe<any[]>(`
    SELECT i.id, i.medicine_id
    FROM "${schema}".inventory_items i
    LEFT JOIN public.medicines m ON i.medicine_id = m.id
    WHERE m.id IS NULL
  `);
  console.log(`Still broken: ${brokenItems.length}`);

  if (brokenItems.length === 0) {
    console.log('All medicines restored! ✅');
    await prisma.$disconnect();
    return;
  }

  // Build a map from backup
  const backupMap = new Map<string, any>();
  for (const item of backupItems) {
    backupMap.set(item.id, item);
  }

  // Build batch INSERT for all missing medicines at once
  const valueParts: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const broken of brokenItems) {
    const backupItem = backupMap.get(broken.id);
    if (!backupItem) continue;

    const tradeName = backupItem.tradeName || '';
    const barcode = backupItem.barcode || null;
    const scientificName = backupItem.scientificName || null;
    const dosageForm = backupItem.dosageForm || null;
    const strength = backupItem.strength || null;

    valueParts.push(`($${paramIndex}::uuid, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, false, false, NOW())`);
    params.push(broken.medicine_id, tradeName, scientificName, barcode, dosageForm, strength);
    paramIndex += 6;
  }

  if (valueParts.length === 0) {
    console.log('No matching items in backup to restore');
    await prisma.$disconnect();
    return;
  }

  console.log(`Inserting ${valueParts.length} medicines in one batch...`);
  
  // Split into batches of 50 to avoid query size limits
  const BATCH_SIZE = 50;
  let totalRestored = 0;
  
  for (let i = 0; i < valueParts.length; i += BATCH_SIZE) {
    const batchParts = valueParts.slice(i, i + BATCH_SIZE);
    const batchParams = params.slice(i * 6, (i + BATCH_SIZE) * 6);
    
    const sql = `
      INSERT INTO public.medicines (
        id, trade_name, scientific_name, barcode, dosage_form, strength,
        is_verified, needs_packaging_review, created_at
      ) VALUES ${batchParts.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;
    
    // Re-index params for this batch
    const reindexedParts: string[] = [];
    const reindexedParams: any[] = [];
    let idx = 1;
    for (let j = i; j < Math.min(i + BATCH_SIZE, brokenItems.length); j++) {
      const backupItem = backupMap.get(brokenItems[j].id);
      if (!backupItem) continue;
      reindexedParts.push(`($${idx}::uuid, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, false, false, NOW())`);
      reindexedParams.push(
        brokenItems[j].medicine_id,
        backupItem.tradeName || '',
        backupItem.scientificName || null,
        backupItem.barcode || null,
        backupItem.dosageForm || null,
        backupItem.strength || null
      );
      idx += 6;
    }
    
    if (reindexedParts.length === 0) continue;
    
    const batchSql = `
      INSERT INTO public.medicines (
        id, trade_name, scientific_name, barcode, dosage_form, strength,
        is_verified, needs_packaging_review, created_at
      ) VALUES ${reindexedParts.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;
    
    await prisma.$executeRawUnsafe(batchSql, ...reindexedParams);
    totalRestored += reindexedParts.length;
    console.log(`Batch ${Math.floor(i/BATCH_SIZE)+1}: restored ${reindexedParts.length} medicines (total: ${totalRestored})`);
  }

  // Verify
  const stillBroken = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${schema}".inventory_items i
    LEFT JOIN public.medicines m ON i.medicine_id = m.id
    WHERE m.id IS NULL
  `);
  
  console.log(`\n=== Done ===`);
  console.log(`Restored: ${totalRestored}`);
  console.log(`Still broken after restore: ${stillBroken[0].count}`);

  await prisma.$disconnect();
}

restoreFast().catch(e => { console.error(e); prisma.$disconnect(); });
