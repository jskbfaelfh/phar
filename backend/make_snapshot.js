const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
  const schema = 'ph_ph_fanyla_f662af';
  const tables = [
    'users',
    'inventory_items',
    'inventory_batches',
    'suppliers',
    'purchases',
    'sales',
    'sale_items',
    'returns',
    'expenses',
    'stocktakes'
  ];

  const data = {
    metadata: {
      exportedAt: new Date().toISOString(),
      schema: schema,
      system: 'DAWAEE_FULL_STABLE_BACKUP'
    },
    tables: {}
  };

  for (const t of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${schema}"."${t}"`);
      data.tables[t] = rows;
      console.log(`- Exported table ${t}: ${rows.length} rows`);
    } catch (e) {
      console.warn(`Could not export table ${t}:`, e.message);
    }
  }

  const outPath = 'C:\\Users\\Dell\\Desktop\\دوائي\\dawaee_backup_stable_2026-10-01.json';
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✅ Backup successfully written to: ${outPath}`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
