import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function setupTrigram() {
  // First check actual column names
  const cols = await prisma.$queryRawUnsafe<any[]>(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='central_search_index'
    ORDER BY ordinal_position
  `);
  console.log('Columns in central_search_index:');
  cols.forEach(c => console.log(' -', c.column_name));

  // pg_trgm already enabled from last run
  console.log('\nCreating indexes...');

  // Use actual column names from above
  const tradeNameCol = cols.find(c => c.column_name.toLowerCase().includes('trade')) ?.column_name;
  const sciNameCol = cols.find(c => c.column_name.toLowerCase().includes('scientific'))?.column_name;
  console.log('tradeName col:', tradeNameCol);
  console.log('scientificName col:', sciNameCol);

  if (tradeNameCol) {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS csi_tradename_trgm 
      ON public.central_search_index 
      USING GIN ("${tradeNameCol}" gin_trgm_ops)
    `);
    console.log(`✅ Index on central_search_index.${tradeNameCol}`);
  }

  if (sciNameCol) {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS csi_scientificname_trgm 
      ON public.central_search_index 
      USING GIN ("${sciNameCol}" gin_trgm_ops)
    `);
    console.log(`✅ Index on central_search_index.${sciNameCol}`);
  }

  // Index on medicines.trade_name
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS medicines_tradename_trgm 
    ON public.medicines 
    USING GIN (trade_name gin_trgm_ops)
  `);
  console.log('✅ Index on medicines.trade_name');

  // Index on medicines.barcode
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS medicines_barcode_trgm 
    ON public.medicines 
    USING GIN (barcode gin_trgm_ops)
  `);
  console.log('✅ Index on medicines.barcode');

  // Test on medicines
  const test = await prisma.$queryRawUnsafe<any[]>(`
    SELECT trade_name, similarity(trade_name, 'amoxicilin') as score
    FROM public.medicines
    WHERE similarity(trade_name, 'amoxicilin') > 0.2
    ORDER BY score DESC
    LIMIT 5
  `);
  console.log('\n🧪 Test "amoxicilin" (with typo):');
  if (test.length === 0) console.log('  No results (try different test word)');
  test.forEach(r => console.log(`  → ${r.trade_name} (${Number(r.score).toFixed(2)})`));

  // Test on central_search_index if tradeNameCol found
  if (tradeNameCol) {
    const test2 = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "${tradeNameCol}", similarity("${tradeNameCol}", 'amoxicilin') as score
      FROM public.central_search_index
      WHERE similarity("${tradeNameCol}", 'amoxicilin') > 0.2
      ORDER BY score DESC
      LIMIT 5
    `);
    console.log('\n🧪 Test on central_search_index:');
    if (test2.length === 0) console.log('  No results');
    test2.forEach(r => console.log(`  → ${r[tradeNameCol]} (${Number(r.score).toFixed(2)})`));
  }

  await prisma.$disconnect();
  console.log('\n✅ All done!');
}

setupTrigram().catch(e => { console.error(e); prisma.$disconnect(); });
