import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cols = await prisma.$queryRawUnsafe<any[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='medicines' ORDER BY ordinal_position`);
  console.log(cols.map(c => c.column_name).join('\n'));
  await prisma.$disconnect();
}
main();
