import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tests = ['brufin', 'amxicilin', 'فولتارن', 'brufen', 'pantprazol'];
  
  for (const term of tests) {
    const results = await prisma.$queryRawUnsafe<any[]>(`
      SELECT csi.trade_name,
             word_similarity($1, csi.trade_name) as ws
      FROM public.central_search_index csi
      JOIN public.tenants t ON csi.tenant_id = t.id
      WHERE t.is_search_visible = true
        AND t.subscription_status = 'ACTIVE'
        AND csi.is_available = true
        AND (
          word_similarity($1, csi.trade_name) > 0.4
          OR csi.trade_name ILIKE '%' || $1 || '%'
        )
      ORDER BY ws DESC
      LIMIT 5
    `, term);
    
    console.log(`\n🔍 "${term}": ${results.length} results`);
    results.forEach(r => console.log(`   → ${r.trade_name} (ws: ${Number(r.ws).toFixed(2)})`));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); });
